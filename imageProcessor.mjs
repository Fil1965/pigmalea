import sharp from 'sharp';
import fs from 'fs/promises';

/**
 * Applies AI-suggested or manual enhancements to an image using Sharp.
 * @param {string} inputPath - Absolute path to the source image.
 * @param {string} outputPath - Absolute path to save the output image.
 * @param {Object} options - Adjustment parameters.
 * @param {number} [options.brightness=0] - Brightness offset (-0.5 to 0.5)
 * @param {number} [options.contrast=1.0] - Contrast multiplier (0.5 to 2.0)
 * @param {number} [options.saturation=1.0] - Saturation multiplier (0.0 to 2.0)
 * @param {number} [options.sharpness=0] - Sharpness level (0.0 to 5.0)
 * @param {boolean} [options.denoise=false] - Whether to apply noise reduction
 * @param {boolean} [options.upscale=false] - Whether to upscale the image by 2x
 * @param {number} [options.temperature=1.0] - Color temperature multiplier (0.5 to 1.5)
 * @param {number} [options.tint=1.0] - Color tint multiplier (0.5 to 1.5)
 * @returns {Promise<Object>} Metadata of the enhanced image (width, height, size).
 */
export async function enhanceImage(inputPath, outputPath, options = {}) {
  const {
    brightness = 0,
    contrast = 1.0,
    saturation = 1.0,
    sharpness = 0,
    denoise = false,
    upscale = false,
    rotate = 0,
    temperature = 1.0,
    tint = 1.0
  } = options;

  console.log(`Processing image: ${inputPath} -> ${outputPath}`);
  console.log('Options applied:', { brightness, contrast, saturation, sharpness, denoise, upscale, rotate, temperature, tint });

  try {
    let pipeline = sharp(inputPath);
    const metadata = await pipeline.metadata();

    // 1. Auto-rotate based on EXIF orientation metadata to respect original rotation
    pipeline = pipeline.rotate();

    // 2. Manual rotation if requested (90, 180, 270)
    if (rotate && rotate !== 0) {
      console.log(`Applying manual rotation: ${rotate} degrees`);
      pipeline = pipeline.rotate(parseInt(rotate));
    }

    // 3. Denoise (Median filter) - Apply early to clean noise before tonal adjustments
    if (denoise) {
      pipeline = pipeline.median(3);
    }

    // 4. White balance (temperature and tint) using recomb in sRGB space
    //    Keeping the pipeline in sRGB avoids colourspace conversion issues that can
    //    produce black/invalid output when combined with contrast/brightness ops.
    const tempMultiplier = parseFloat(temperature !== undefined ? temperature : 1.0);
    const tintMultiplier = parseFloat(tint !== undefined ? tint : 1.0);

    if (tempMultiplier !== 1.0 || tintMultiplier !== 1.0) {
      const rScale = tempMultiplier;
      const gScale = tintMultiplier;
      const bScale = tempMultiplier !== 0 ? (2.0 - tempMultiplier) : 1.0;

      console.log(`Applying white balance: Red=${rScale.toFixed(2)}, Green=${gScale.toFixed(2)}, Blue=${bScale.toFixed(2)}`);

      pipeline = pipeline.recomb([
        [rScale, 0, 0],
        [0, gScale, 0],
        [0, 0, bScale]
      ]);
    }

    // 5. Brightness and Saturation modulation
    const modOptions = {};
    if (brightness !== 0) {
      // Scale down brightness parameter (e.g. max +0.5 becomes multiplier 1.20) to prevent highlight clipping
      modOptions.brightness = 1.0 + parseFloat(brightness) * 0.4;
    }
    if (saturation !== 1.0) {
      modOptions.saturation = parseFloat(saturation);
    }
    if (Object.keys(modOptions).length > 0) {
      pipeline = pipeline.modulate(modOptions);
    }

    // 6. Contrast adjustment using linear mapping (pixel * a + b)
    if (contrast !== 1.0) {
      const a = parseFloat(contrast);
      const b = 128 * (1.0 - a);
      pipeline = pipeline.linear(a, b);
    }

    // 7. Upscaling (2x resizing with Lanczos interpolation if width < 1600px)
    let currentWidth = metadata.width || 0;
    const isRotated = metadata.orientation && metadata.orientation >= 5 && metadata.orientation <= 8;
    if (isRotated && metadata.height) {
      currentWidth = metadata.height;
    }

    if (upscale && currentWidth && currentWidth < 1600) {
      const targetWidth = Math.round(currentWidth * 2);
      console.log(`Upscaling image width from ${currentWidth}px to ${targetWidth}px (EXIF orientation corrected)`);
      pipeline = pipeline.resize({
        width: targetWidth,
        kernel: sharp.kernel.lanczos
      });
    }

    // 8. Sharpening filter (always last to avoid amplifying noise)
    if (sharpness > 0.05) {
      const sigma = 0.5 + (parseFloat(sharpness) * 0.5);
      pipeline = pipeline.sharpen({ sigma });
    }

    // Save the file
    const info = await pipeline.toFile(outputPath);
    console.log(`Image enhanced successfully. New size: ${info.width}x${info.height}, ${info.size} bytes.`);

    return {
      width: info.width,
      height: info.height,
      size: info.size
    };
  } catch (err) {
    console.error('Error during image enhancement:', err);
    throw err;
  }
}

/**
 * Retrieves basic metadata of an image (width, height, size).
 * @param {string} filePath - Absolute path to the image.
 * @returns {Promise<Object>} Metadata object.
 */
export async function getImageMetadata(filePath) {
  try {
    const metadata = await sharp(filePath).metadata();
    const stats = await fs.stat(filePath);
    return {
      width: metadata.width,
      height: metadata.height,
      size: stats.size
    };
  } catch (err) {
    console.error('Error reading image metadata:', err);
    throw err;
  }
}
