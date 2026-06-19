const sharp = require("sharp");

async function preprocessImage(inputPath, outputPath) {
  const info = await sharp(inputPath)
    .rotate()
    .grayscale()
    .normalize()
    .sharpen({
      sigma: 1.5
    })
    .resize({
      width: 2000,
      fit: "inside",
      withoutEnlargement: false
    })
    .png()
    .toFile(outputPath);

  return {
    success: true,
    processedWidth: info.width,
    processedHeight: info.height
  };
}

module.exports = { preprocessImage };