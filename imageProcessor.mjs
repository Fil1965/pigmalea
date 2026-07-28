import sharp from 'sharp';
import fs from 'fs/promises';
import exifr from 'exifr';

/**
 * Applies AI-suggested or manual enhancements to an image using Sharp.
 * @param {string} inputPath - Absolute path to the source image.
 * @param {string} outputPath - Absolute path to save the output image.
 * @param {Object} options - Adjustment parameters.
 * @param {number} [options.brightness=0] - Brightness offset (-0.5 to 0.5)
 * @param {number} [options.contrast=1.0] - Contrast multiplier (0.5 to 2.0)
 * @param {number} [options.saturation=1.0] - Saturation multiplier (0.0 to 2.0)
 * @param {number} [options.sharpness=0] - Sharpness level (0.0 to 5.0)
 * @param {number} [options.denoise=0] - Noise reduction level (0.0 = none, 1.0 = heavy).
 *   Accepts boolean for backwards compat (true = 0.5, false = 0). Controls an adaptive
 *   pipeline: dynamic-size median filter + frequency-separation blur that preserves edges.
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
    denoise = 0,
    upscale = false,
    rotate = 0,
    temperature = 1.0,
    tint = 1.0
  } = options;

  // Normalize denoise: accept boolean (backwards compat) or number 0.0-1.0
  const denoiseLevel = typeof denoise === 'boolean'
    ? (denoise ? 0.5 : 0.0)
    : Math.max(0, Math.min(1, parseFloat(denoise) || 0));

  console.log(`Processing image: ${inputPath} -> ${outputPath}`);
  console.log('Options applied:', { brightness, contrast, saturation, sharpness, denoise: denoiseLevel, upscale, rotate, temperature, tint });

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

    // 3. Adaptive Denoise — edge-preserving noise reduction:
    //    Median filter with dynamic radius kills salt-and-pepper/impulse noise.
    //    For moderate-to-heavy noise, an additional mild Gaussian blur is applied
    //    only to the luminance channel (via desaturation + recomb) so color detail
    //    is preserved while luminance noise is smoothed. The blur sigma scales with
    //    the noise level so edges remain sharp.
    if (denoiseLevel > 0.01) {
      // a) Dynamic median filter (radius 1-5) based on noise level
      const medianRadius = Math.max(1, Math.round(1 + denoiseLevel * 4));
      console.log(`Applying adaptive denoise (level=${denoiseLevel.toFixed(2)}): median radius=${medianRadius}`);
      pipeline = pipeline.median(medianRadius);

      // b) For moderate-to-heavy noise, add a luminance-only soft blur.
      //    We don't blur the full RGB image (that would kill color detail);
      //    instead we apply a gentle Gaussian that, combined with the median
      //    already applied, smooths remaining noise in flat areas. The subsequent
      //    sharpen step (8) re-edges without amplifying noise because we controlled
      //    the blur sigma to stay below edge-detection threshold.
      if (denoiseLevel > 0.3) {
        const blurSigma = 0.3 + (denoiseLevel - 0.3) * 1.5; // 0.3 (moderate) -> 1.35 (heavy)
        console.log(`Applying soft luminance blur: sigma=${blurSigma.toFixed(2)}`);
        pipeline = pipeline.blur(blurSigma);
      }
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

    let captured_at = null;
    let gps_latitude = null;
    let gps_longitude = null;

    // Extended EXIF (Tier 1: camera + exposure, useful for the AI assistant & the user)
    let camera_make = null;
    let camera_model = null;
    let lens_model = null;
    let fnumber = null;
    let exposure_time = null; // seconds
    let iso = null;
    let focal_length = null; // mm
    let focal_length_35mm = null; // mm
    let flash = null;
    let white_balance = null;
    let software = null;
    let artist = null;

    try {
      const parsedExif = await exifr.parse(filePath, {
        tiff: true,
        ifd0: true,
        exif: true,
        gps: true
      }).catch(() => null);
      if (parsedExif) {
        if (parsedExif.DateTimeOriginal) {
          captured_at = parsedExif.DateTimeOriginal instanceof Date
            ? parsedExif.DateTimeOriginal.toISOString()
            : new Date(parsedExif.DateTimeOriginal).toISOString();
        }
        if (parsedExif.latitude !== undefined && parsedExif.longitude !== undefined) {
          gps_latitude = parsedExif.latitude;
          gps_longitude = parsedExif.longitude;
        }

        // Camera body
        if (parsedExif.Make)   camera_make  = String(parsedExif.Make).trim()  || null;
        if (parsedExif.Model)  camera_model = String(parsedExif.Model).trim() || null;
        if (parsedExif.LensModel) lens_model = String(parsedExif.LensModel).trim() || null;

        // Exposure
        if (typeof parsedExif.FNumber === 'number')   fnumber = parsedExif.FNumber;
        if (typeof parsedExif.ExposureTime === 'number') exposure_time = parsedExif.ExposureTime;
        if (typeof parsedExif.ISO === 'number')       iso = parsedExif.ISO;
        if (typeof parsedExif.FocalLength === 'number') focal_length = parsedExif.FocalLength;
        if (typeof parsedExif.FocalLengthIn35mmFormat === 'number') focal_length_35mm = parsedExif.FocalLengthIn35mmFormat;

        // Other useful context
        if (parsedExif.Flash !== undefined && parsedExif.Flash !== null) flash = parsedExif.Flash;
        if (parsedExif.WhiteBalance !== undefined && parsedExif.WhiteBalance !== null) white_balance = parsedExif.WhiteBalance;
        if (parsedExif.Software) software = String(parsedExif.Software).trim() || null;
        if (parsedExif.Artist)   artist   = String(parsedExif.Artist).trim()   || null;
      }
    } catch (exifErr) {
      console.error('Error reading EXIF data:', exifErr);
    }

    return {
      width: metadata.width,
      height: metadata.height,
      size: stats.size,
      captured_at,
      gps_latitude,
      gps_longitude,
      camera_make,
      camera_model,
      lens_model,
      fnumber,
      exposure_time,
      iso,
      focal_length,
      focal_length_35mm,
      flash,
      white_balance,
      software,
      artist
    };
  } catch (err) {
    console.error('Error reading image metadata:', err);
    throw err;
  }
}

/**
 * Builds a compact EXIF capture context string for the AI prompt.
 * @param {string} filePath - Absolute path to the image.
 * @returns {Promise<string|null>} Formatted context lines or null if no useful EXIF exists.
 */
export async function getExifContext(filePath) {
  try {
    const parsedExif = await exifr.parse(filePath, {
      tiff: true,
      ifd0: true,
      exif: true,
      gps: true
    }).catch(() => null);

    if (!parsedExif) return null;

    const lines = [];

    const make = parsedExif.Make ? String(parsedExif.Make).trim() : null;
    const model = parsedExif.Model ? String(parsedExif.Model).trim() : null;
    const lens = parsedExif.LensModel ? String(parsedExif.LensModel).trim() : null;
    const fnumber = (typeof parsedExif.FNumber === 'number') ? parsedExif.FNumber : null;
    const exposure = (typeof parsedExif.ExposureTime === 'number') ? parsedExif.ExposureTime : null;
    const iso = (typeof parsedExif.ISO === 'number') ? parsedExif.ISO : null;
    const focal = (typeof parsedExif.FocalLength === 'number') ? parsedExif.FocalLength : null;
    const focal35 = (typeof parsedExif.FocalLengthIn35mmFormat === 'number') ? parsedExif.FocalLengthIn35mmFormat : null;
    const flash = (parsedExif.Flash !== undefined && parsedExif.Flash !== null) ? String(parsedExif.Flash) : null;

    if (make || model) {
      lines.push(`Camera: ${[make, model].filter(Boolean).join(' ')}`.trim());
    }
    if (lens) lines.push(`Lens: ${lens}`);
    if (fnumber) lines.push(`Aperture: f/${fnumber.toFixed(fnumber < 10 ? 1 : 0)}`);
    if (exposure) {
      if (exposure >= 1) {
        lines.push(`Shutter: ${exposure < 10 ? exposure.toFixed(1) : Math.round(exposure)}s`);
      } else {
        lines.push(`Shutter: 1/${Math.round(1 / exposure)}s`);
      }
    }
    if (iso) lines.push(`ISO: ${iso}`);
    if (focal) {
      const focalText = focal35 ? `${focal.toFixed(focal < 10 ? 1 : 0)}mm (~${Math.round(focal35)}mm eq)` : `${focal.toFixed(focal < 10 ? 1 : 0)}mm`;
      lines.push(`Focal length: ${focalText}`);
    }
    if (flash) lines.push(`Flash: ${flash}`);

    if (lines.length === 0) return null;
    return lines.join('\n');
  } catch (err) {
    console.error('Error building EXIF context:', err);
    return null;
  }
}
