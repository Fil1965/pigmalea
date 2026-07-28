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
 *   Accepts boolean for backwards compat (true = 0.5, false = 0). Controls a multi-stage
 *   adaptive pipeline: (a) dynamic median filter, (b) frequency separation with edge
 *   preservation, (c) luminance-selective denoise that preserves color fidelity.
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

    // 3. Advanced Adaptive Denoise — multi-stage edge-preserving noise reduction:
    //    a) Dynamic median filter (salt-and-pepper killer, radius scales with noise)
    //    b) Frequency separation (base + detail, attenuate detail in flat areas)
    //    c) Luminance-selective denoise (clean Y, preserve Cb/Cr color)
    //
    //    The advanced steps (b, c) operate on raw pixel buffers, so they must run
    //    BEFORE the rest of the Sharp pipeline. We materialize the rotated image
    //    to a raw buffer, denoise it, then restart the pipeline from that buffer.
    if (denoiseLevel > 0.01) {
      // a) Quick median filter first (fast, kills impulse noise)
      const medianRadius = Math.max(1, Math.round(1 + denoiseLevel * 4));
      console.log(`Applying adaptive denoise (level=${denoiseLevel.toFixed(2)}): median radius=${medianRadius}`);

      // Materialize the current pipeline state (post-rotation) to a raw buffer
      // so we can apply the advanced pixel-level techniques.
      const { data: rawAfterMedian, info: medianInfo } = await pipeline
        .median(medianRadius)
        .raw()
        .toBuffer({ resolveWithObject: true });

      let denoisedBuffer = rawAfterMedian;
      const w = medianInfo.width;
      const h = medianInfo.height;
      const ch = medianInfo.channels;

      // b) Frequency separation denoise (edge-preserving, cleans flat areas)
      //    Only for moderate-to-heavy noise to avoid unnecessary processing.
      if (denoiseLevel > 0.25) {
        console.log(`Applying frequency separation denoise (level=${denoiseLevel.toFixed(2)})`);
        denoisedBuffer = frequencySeparationDenoise(denoisedBuffer, w, h, ch, denoiseLevel);
      }

      // c) Luminance-selective denoise (clean Y channel, preserve color)
      //    Complements the frequency separation by targeting luminance noise
      //    specifically, which is where most digital noise lives.
      if (denoiseLevel > 0.15) {
        console.log(`Applying luminance-selective denoise (level=${denoiseLevel.toFixed(2)})`);
        denoisedBuffer = luminanceSelectiveDenoise(denoisedBuffer, w, h, ch, denoiseLevel);
      }

      // Restart the pipeline from the denoised raw buffer
      pipeline = sharp(denoisedBuffer, {
        raw: { width: w, height: h, channels: ch }
      });
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

// ==========================================================================
// Advanced denoising utilities (frequency separation, luminance-selective,
// and automatic noise estimation). Used by enhanceImage step 3.
// ==========================================================================

/**
 * Converts an sRGB raw buffer (RGB interleaved) to a grayscale luminance array.
 * Uses Rec. 709 weights: Y = 0.2126*R + 0.7152*G + 0.0722*B
 * @param {Buffer} rawBuffer - RGB interleaved buffer (3 bytes per pixel).
 * @param {number} pixelCount - Number of pixels.
 * @returns {Float32Array} Luminance values [0..255].
 */
function rgbToLuminance(rawBuffer, pixelCount) {
  const lum = new Float32Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const r = rawBuffer[i * 3];
    const g = rawBuffer[i * 3 + 1];
    const b = rawBuffer[i * 3 + 2];
    lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  return lum;
}

/**
 * Estimates the noise level of an image by measuring the variance of the
 * high-pass residual (difference between the image and a lightly blurred version).
 * Flat areas should have near-zero residual; noise produces consistent small-magnitude
 * residuals. We sample several regions and compute the median absolute deviation (MAD),
 * which is a robust noise estimator insensitive to edges and detail.
 *
 * @param {string} filePath - Path to the image file.
 * @returns {Promise<number>} Estimated noise level in [0.0, 1.0].
 *   0.0 = very clean, 1.0 = very noisy. Thresholds tuned empirically.
 */
export async function estimateNoiseLevel(filePath) {
  try {
    // Work on a small downscaled version for speed (256px max dimension)
    const img = sharp(filePath).rotate().resize(256, 256, { fit: 'inside' });
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const pixelCount = info.width * info.height;

    // Build luminance array
    const lum = rgbToLuminance(data, pixelCount);

    // Create a lightly blurred version (3x3 box blur) as the "base" layer
    const blurred = new Float32Array(pixelCount);
    const w = info.width;
    const h = info.height;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              sum += lum[ny * w + nx];
              count++;
            }
          }
        }
        blurred[y * w + x] = sum / count;
      }
    }

    // Compute high-pass residual = original - blurred
    const residual = new Float32Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      residual[i] = Math.abs(lum[i] - blurred[i]);
    }

    // Median Absolute Deviation (MAD) of the residual = robust noise estimate
    const sorted = Float32Array.from(residual).sort();
    const median = sorted[Math.floor(sorted.length / 2)];
    const absDevs = Float32Array.from(residual, (r) => Math.abs(r - median)).sort();
    const mad = absDevs[Math.floor(absDevs.length / 2)];

    // MAD * 1.4826 ≈ robust standard deviation of the noise
    const noiseSigma = mad * 1.4826;

    // Map noiseSigma to [0.0, 1.0] using empirical thresholds:
    //   sigma < 1.5  → 0.0 (clean)   sigma > 12 → 1.0 (very noisy)
    let level = (noiseSigma - 1.5) / (12.0 - 1.5);
    level = Math.max(0, Math.min(1, level));

    console.log(`Noise estimation: MAD=${mad.toFixed(2)}, sigma≈${noiseSigma.toFixed(2)}, level=${level.toFixed(2)}`);
    return level;
  } catch (err) {
    console.error('Noise estimation failed:', err);
    return 0; // Assume clean on error
  }
}

/**
 * Applies frequency-separation denoising to an image buffer.
 *
 * 1. Creates a "base" layer (low-frequency structure) via Gaussian blur.
 * 2. Extracts the "detail" layer = original - base (high-frequency content).
 * 3. Attenuates the detail layer: small-magnitude residuals (likely noise) are
 *    suppressed; large-magnitude residuals (likely real edges/detail) are kept.
 *    The attenuation strength scales with `denoiseLevel`.
 * 4. Recomposes: base + attenuated_detail.
 *
 * This is the technique used by professional photo editors: it cleans noise in
 * flat areas while preserving edges and real texture.
 *
 * @param {Buffer} rawBuffer - RGB interleaved buffer (3 bytes per pixel).
 * @param {number} width
 * @param {number} height
 * @param {number} channels - Should be 3 (RGB).
 * @param {number} denoiseLevel - 0.0 to 1.0.
 * @returns {Buffer} Denoised RGB buffer (same dimensions).
 */
function frequencySeparationDenoise(rawBuffer, width, height, channels, denoiseLevel) {
  if (channels !== 3) return rawBuffer; // Only handle RGB

  const pixelCount = width * height;
  const result = Buffer.alloc(rawBuffer.length);

  // Blur radius for the base layer: scales with noise level.
  // sigma=1 (light noise) → sigma=4 (heavy noise). This is a real spatial blur,
  // not a pipeline op, so we implement a separable Gaussian manually.
  const sigma = 1.0 + denoiseLevel * 3.0;
  const radius = Math.max(1, Math.ceil(sigma * 2));

  // Separable Gaussian blur (horizontal then vertical) on each channel
  // Build a 1D kernel
  const kernelSize = radius * 2 + 1;
  const kernel = new Float32Array(kernelSize);
  let kernelSum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + radius] = v;
    kernelSum += v;
  }
  for (let i = 0; i < kernelSize; i++) kernel[i] /= kernelSum;

  // Temporary buffer for horizontal pass
  const temp = new Float32Array(rawBuffer.length);

  // Horizontal blur
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      for (let k = -radius; k <= radius; k++) {
        const sx = Math.max(0, Math.min(width - 1, x + k));
        const idx = (y * width + sx) * 3;
        const wgt = kernel[k + radius];
        r += rawBuffer[idx] * wgt;
        g += rawBuffer[idx + 1] * wgt;
        b += rawBuffer[idx + 2] * wgt;
      }
      const oi = (y * width + x) * 3;
      temp[oi] = r;
      temp[oi + 1] = g;
      temp[oi + 2] = b;
    }
  }

  // Vertical blur → base layer, and compute detail + attenuate in one pass
  // Attenuation: detail = original - base. We keep detail where |detail| > threshold,
  // and attenuate (shrink toward 0) where |detail| < threshold (noise).
  // threshold scales with denoiseLevel: higher noise → higher threshold → more suppression.
  const threshold = denoiseLevel * 12.0; // 0 (no suppression) to 12 (heavy)
  const keepFactor = 1.0 - denoiseLevel * 0.8; // how much of the detail to keep: 1.0 → 0.2

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      for (let k = -radius; k <= radius; k++) {
        const sy = Math.max(0, Math.min(height - 1, y + k));
        const idx = (sy * width + x) * 3;
        const wgt = kernel[k + radius];
        r += temp[idx] * wgt;
        g += temp[idx + 1] * wgt;
        b += temp[idx + 2] * wgt;
      }
      const oi = (y * width + x) * 3;
      // base = blurred value (r, g, b)
      // detail = original - base
      const baseR = r, baseG = g, baseB = b;
      const detailR = rawBuffer[oi] - baseR;
      const detailG = rawBuffer[oi + 1] - baseG;
      const detailB = rawBuffer[oi + 2] - baseB;

      // Attenuate detail: if |detail| < threshold, it's likely noise → shrink
      // Soft thresholding: detail_out = detail * keepFactor if |detail| < threshold,
      // else detail_out = detail (preserve real edges)
      const attenR = Math.abs(detailR) < threshold ? detailR * keepFactor : detailR;
      const attenG = Math.abs(detailG) < threshold ? detailG * keepFactor : detailG;
      const attenB = Math.abs(detailB) < threshold ? detailB * keepFactor : detailB;

      // Recompose: base + attenuated detail
      const outR = Math.max(0, Math.min(255, Math.round(baseR + attenR)));
      const outG = Math.max(0, Math.min(255, Math.round(baseG + attenG)));
      const outB = Math.max(0, Math.min(255, Math.round(baseB + attenB)));

      result[oi] = outR;
      result[oi + 1] = outG;
      result[oi + 2] = outB;
    }
  }

  return result;
}

/**
 * Applies luminance-selective denoising: converts the image to YCbCr-like space,
 * denoises only the luminance (Y) channel using a simple bilateral-like approach
 * (median + soft blur), and recomposes with the original color (Cb/Cr) untouched.
 * This preserves color fidelity while cleaning luminance noise (which is where
 * most digital noise lives).
 *
 * @param {Buffer} rawBuffer - RGB interleaved buffer (3 bytes per pixel).
 * @param {number} width
 * @param {number} height
 * @param {number} channels
 * @param {number} denoiseLevel - 0.0 to 1.0.
 * @returns {Buffer} Denoised RGB buffer (same dimensions).
 */
function luminanceSelectiveDenoise(rawBuffer, width, height, channels, denoiseLevel) {
  if (channels !== 3) return rawBuffer;

  const pixelCount = width * height;
  const result = Buffer.alloc(rawBuffer.length);

  // Extract luminance
  const lum = new Float32Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    lum[i] = 0.2126 * rawBuffer[i * 3] + 0.7152 * rawBuffer[i * 3 + 1] + 0.0722 * rawBuffer[i * 3 + 2];
  }

  // Apply a 3x3 median filter to the luminance only (kills salt-and-pepper in Y)
  const medianRadius = Math.max(1, Math.round(1 + denoiseLevel * 2));
  const denoisedLum = new Float32Array(pixelCount);
  const w = width, h = height;
  const winSize = medianRadius * 2 + 1;
  const window = new Float32Array(winSize * winSize);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let wIdx = 0;
      for (let dy = -medianRadius; dy <= medianRadius; dy++) {
        for (let dx = -medianRadius; dx <= medianRadius; dx++) {
          const nx = Math.max(0, Math.min(w - 1, x + dx));
          const ny = Math.max(0, Math.min(h - 1, y + dy));
          window[wIdx++] = lum[ny * w + nx];
        }
      }
      // Find median
      const sorted = Float32Array.from(window).sort();
      denoisedLum[y * w + x] = sorted[Math.floor(sorted.length / 2)];
    }
  }

  // Additional soft blur on luminance for heavier noise
  if (denoiseLevel > 0.4) {
    const sigma = (denoiseLevel - 0.4) * 1.5;
    const radius = Math.max(1, Math.ceil(sigma));
    const kernelSize = radius * 2 + 1;
    const kernel = new Float32Array(kernelSize);
    let kernelSum = 0;
    for (let i = -radius; i <= radius; i++) {
      const v = Math.exp(-(i * i) / (2 * sigma * sigma));
      kernel[i + radius] = v;
      kernelSum += v;
    }
    for (let i = 0; i < kernelSize; i++) kernel[i] /= kernelSum;

    // Horizontal pass
    const temp = new Float32Array(pixelCount);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          const sx = Math.max(0, Math.min(w - 1, x + k));
          sum += denoisedLum[y * w + sx] * kernel[k + radius];
        }
        temp[y * w + x] = sum;
      }
    }
    // Vertical pass
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          const sy = Math.max(0, Math.min(h - 1, y + k));
          sum += temp[sy * w + x] * kernel[k + radius];
        }
        denoisedLum[y * w + x] = sum;
      }
    }
  }

  // Recompose: apply the delta (denoised - original luminance) to each channel
  // proportionally to that channel's contribution to luminance. This preserves
  // color while applying the luminance correction.
  for (let i = 0; i < pixelCount; i++) {
    const delta = denoisedLum[i] - lum[i];
    // Each channel gets a fraction of the delta based on its luminance weight
    result[i * 3]     = Math.max(0, Math.min(255, Math.round(rawBuffer[i * 3]     + delta * 0.2126)));
    result[i * 3 + 1] = Math.max(0, Math.min(255, Math.round(rawBuffer[i * 3 + 1] + delta * 0.7152)));
    result[i * 3 + 2] = Math.max(0, Math.min(255, Math.round(rawBuffer[i * 3 + 2] + delta * 0.0722)));
  }

  return result;
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
