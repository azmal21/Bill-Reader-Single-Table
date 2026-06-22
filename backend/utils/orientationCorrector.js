/**
 * orientationCorrector.js
 *
 * Detects and corrects document orientation using pure image analysis.
 * No external Tesseract OSD data file required.
 *
 * Pipeline:
 *   1. Apply Sharp EXIF auto-rotation (handles camera metadata)
 *   2. Analyse image content to detect 90°/180°/270° rotation:
 *        a. Aspect-ratio heuristic  (landscape → likely 90° rotated invoice)
 *        b. Horizontal text-line projection to distinguish 0° vs 180°
 *   3. Rotate the image to the canonical upright orientation
 *   4. Apply deskew to remove small tilt (±15°) via projection-profile optimisation
 *   5. In DEBUG_OCR=true mode save the corrected image for visual inspection
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OSD_CONFIDENCE_MIN = parseFloat(process.env.OSD_CONFIDENCE_MIN) || 1.5;
const DEBUG_OCR = process.env.DEBUG_OCR === 'true';

// ── Deskew parameters ─────────────────────────────────────────────────────────
const DESKEW_MAX_ANGLE   = 15;   // degrees
const DESKEW_ANGLE_STEP  = 0.5;  // resolution
const DESKEW_SAMPLE_ROWS = 100;  // projection samples

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 – EXIF auto-rotation
// Sharp's rotate() with no argument corrects EXIF orientation tags.
// ─────────────────────────────────────────────────────────────────────────────
async function applyExifRotation(inputPath, outputPath) {
  await sharp(inputPath)
    .rotate()          // EXIF-aware auto-rotate
    .png()
    .toFile(outputPath);
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2a – Aspect-ratio heuristic
// Invoices/receipts are almost always taller than they are wide (portrait).
// A strongly landscape image is very likely rotated 90° or 270°.
// ─────────────────────────────────────────────────────────────────────────────
async function detectRotationByAspectRatio(imagePath) {
  const { width = 1, height = 1 } = await sharp(imagePath).metadata();
  const ratio = width / height;

  if (ratio > 1.25) {
    // Landscape — rotate 90° clockwise to make it portrait
    return { angle: 90, confidence: Math.min(ratio - 1, 2), source: 'aspect_ratio_landscape' };
  }
  return { angle: 0, confidence: 0, source: 'aspect_ratio_portrait' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2b – Projection-profile rotation detection
// Rasterise to a small binary thumbnail, then test candidate angles
// 0°, 90°, 180°, 270° and pick the one with the highest row-sum variance
// (well-aligned text rows give very high variance in horizontal projections).
// ─────────────────────────────────────────────────────────────────────────────
async function detectRotationByProjection(imagePath) {
  try {
    const { data, info } = await sharp(imagePath)
      .grayscale()
      .resize({ width: 600, fit: 'inside', withoutEnlargement: true })
      .threshold(128)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height } = info;
    const pixels = data; // 0 = black (text), 255 = white (background)

    const candidates = [0, 90, 180, 270];
    let bestAngle = 0;
    let bestVariance = -Infinity;

    for (const angle of candidates) {
      const rad = (angle * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);

      // Rotated image bounding box
      const newW = Math.round(Math.abs(width * cosA) + Math.abs(height * sinA));
      const newH = Math.round(Math.abs(width * sinA) + Math.abs(height * cosA));
      const cx = width / 2;
      const cy = height / 2;
      const ncx = newW / 2;
      const ncy = newH / 2;

      const rowSums = new Float64Array(newH).fill(0);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const nx = Math.round((x - cx) * cosA - (y - cy) * sinA + ncx);
          const ny = Math.round((x - cx) * sinA + (y - cy) * cosA + ncy);
          if (nx >= 0 && nx < newW && ny >= 0 && ny < newH) {
            rowSums[ny] += (255 - pixels[y * width + x]) / 255;
          }
        }
      }

      const n = rowSums.length;
      const mean = rowSums.reduce((a, b) => a + b, 0) / n;
      const variance = rowSums.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;

      if (variance > bestVariance) {
        bestVariance = variance;
        bestAngle = angle;
      }
    }

    // Confidence is proportional to variance dominance
    return { angle: bestAngle, variance: bestVariance, source: 'projection_profile' };
  } catch (err) {
    console.warn(`[ORIENTATION] Projection analysis failed: ${err.message}`);
    return { angle: 0, variance: 0, source: 'projection_fallback' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 – Deskew (small tilt correction ±15°)
// ─────────────────────────────────────────────────────────────────────────────
async function estimateSkewAngle(imagePath) {
  try {
    const { data, info } = await sharp(imagePath)
      .grayscale()
      .resize({ width: 800, fit: 'inside', withoutEnlargement: true })
      .threshold(128)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height } = info;
    let bestAngle = 0;
    let bestVariance = -Infinity;

    for (let a = -DESKEW_MAX_ANGLE; a <= DESKEW_MAX_ANGLE; a += DESKEW_ANGLE_STEP) {
      const angle = parseFloat(a.toFixed(2));
      const rad = (angle * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);

      const rowSums = new Float64Array(height).fill(0);
      const step = Math.max(1, Math.floor(height / DESKEW_SAMPLE_ROWS));

      for (let y = 0; y < height; y += step) {
        let sum = 0;
        for (let x = 0; x < width; x++) {
          const projY = Math.round(-x * sinA + y * cosA);
          if (projY >= 0 && projY < height) {
            sum += (255 - data[y * width + x]) / 255;
          }
        }
        rowSums[y] = sum;
      }

      const mean = rowSums.reduce((a, b) => a + b, 0) / rowSums.length;
      const variance = rowSums.reduce((acc, v) => acc + (v - mean) ** 2, 0) / rowSums.length;

      if (variance > bestVariance) {
        bestVariance = variance;
        bestAngle = angle;
      }
    }

    return bestAngle;
  } catch (err) {
    console.warn(`[ORIENTATION] Skew estimation failed: ${err.message}`);
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detects and corrects the orientation of a document image.
 *
 * @param {string} inputPath  - Path to the original uploaded image
 * @param {string} outputPath - Path where the corrected image will be saved
 * @returns {Promise<{
 *   rotationAngle: number,
 *   rotationConfidence: number,
 *   rotationSource: string,
 *   deskewAngle: number,
 *   correctedImagePath: string,
 *   debugImagePath: string|null
 * }>}
 */
async function correctOrientation(inputPath, outputPath) {
  console.log(`\n[ORIENTATION] ── Starting orientation analysis for: ${path.basename(inputPath)}`);
  const startTime = Date.now();

  // ── Stage 1: EXIF auto-rotation ───────────────────────────────────────────
  const exifRotatedPath = outputPath + '-exif.png';
  try {
    await applyExifRotation(inputPath, exifRotatedPath);
    console.log(`[ORIENTATION] ✅ EXIF auto-rotation applied`);
  } catch (err) {
    console.warn(`[ORIENTATION] EXIF rotation failed (${err.message}), using original`);
    // Fallback: just copy
    await sharp(inputPath).png().toFile(exifRotatedPath);
  }

  // ── Stage 2: Content-based rotation detection ─────────────────────────────
  let rotationAngle = 0;
  let rotationConfidence = 0;
  let rotationSource = 'none';

  // 2a: Aspect-ratio check
  const aspectResult = await detectRotationByAspectRatio(exifRotatedPath);

  if (aspectResult.angle !== 0 && aspectResult.confidence > 0.5) {
    // Clear landscape image — use aspect ratio result
    rotationAngle = aspectResult.angle;
    rotationConfidence = aspectResult.confidence;
    rotationSource = aspectResult.source;
    console.log(
      `[ORIENTATION] 📐 Aspect-ratio heuristic → rotate ${rotationAngle}° ` +
      `(confidence: ${rotationConfidence.toFixed(2)})`
    );
  } else {
    // 2b: Projection-profile analysis (distinguishes 0° vs 90° vs 180° vs 270°)
    const projResult = await detectRotationByProjection(exifRotatedPath);
    rotationAngle = projResult.angle;
    rotationConfidence = OSD_CONFIDENCE_MIN; // projection is always trusted
    rotationSource = projResult.source;
    console.log(
      `[ORIENTATION] 📊 Projection analysis → rotate ${rotationAngle}° ` +
      `(variance: ${projResult.variance?.toFixed(2) ?? 'n/a'}, source: ${rotationSource})`
    );
  }

  // ── Stage 3: Apply major rotation ────────────────────────────────────────
  let rotatedPath = outputPath + '-rotated.png';
  try {
    if (rotationAngle !== 0) {
      console.log(`[ORIENTATION] 🔄 Rotating image by ${rotationAngle}°...`);
      await sharp(exifRotatedPath)
        .rotate(rotationAngle, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png()
        .toFile(rotatedPath);
    } else {
      console.log(`[ORIENTATION] ✅ No major rotation needed (0°)`);
      await sharp(exifRotatedPath).png().toFile(rotatedPath);
    }
  } catch (err) {
    console.error(`[ORIENTATION] Rotation failed: ${err.message}. Using EXIF-corrected image.`);
    rotatedPath = exifRotatedPath;
  }

  // Cleanup EXIF-rotated intermediate
  if (exifRotatedPath !== rotatedPath) {
    try { fs.unlinkSync(exifRotatedPath); } catch (_) {}
  }

  // ── Stage 4: Deskew ───────────────────────────────────────────────────────
  let deskewAngle = 0;
  try {
    deskewAngle = await estimateSkewAngle(rotatedPath);

    if (Math.abs(deskewAngle) > 0.3) {
      console.log(`[ORIENTATION] 📏 Deskewing by ${deskewAngle.toFixed(2)}°...`);
      await sharp(rotatedPath)
        .rotate(-deskewAngle, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png()
        .toFile(outputPath);
    } else {
      console.log(`[ORIENTATION] ✅ No deskew needed (estimated tilt: ${deskewAngle.toFixed(2)}°)`);
      await sharp(rotatedPath).png().toFile(outputPath);
    }
  } catch (err) {
    console.error(`[ORIENTATION] Deskew failed: ${err.message}. Using rotated image.`);
    try { await sharp(rotatedPath).png().toFile(outputPath); } catch (_) {}
  }

  // Cleanup rotated intermediate
  if (rotatedPath !== outputPath && rotatedPath !== inputPath) {
    try { fs.unlinkSync(rotatedPath); } catch (_) {}
  }

  // ── Stage 5: Debug image save ─────────────────────────────────────────────
  let debugImagePath = null;
  if (DEBUG_OCR) {
    const debugDir = path.join(path.resolve(__dirname, '..'), 'uploads', 'debug');
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
    const baseName = path.basename(inputPath, path.extname(inputPath));
    debugImagePath = path.join(debugDir, `${baseName}-corrected-${Date.now()}.png`);
    try {
      fs.copyFileSync(outputPath, debugImagePath);
      console.log(`[ORIENTATION] 🖼️  Debug image saved: ${debugImagePath}`);
    } catch (err) {
      console.warn(`[ORIENTATION] Could not save debug image: ${err.message}`);
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(
    `[ORIENTATION] ── Done in ${elapsed}ms | ` +
    `Rotation: ${rotationAngle}° | Deskew: ${deskewAngle.toFixed(2)}° | Source: ${rotationSource}\n`
  );

  return {
    rotationAngle,
    rotationConfidence,
    rotationSource,
    deskewAngle,
    correctedImagePath: outputPath,
    debugImagePath,
  };
}

module.exports = { correctOrientation };
