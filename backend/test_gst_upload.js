const fs = require('fs');
const path = require('path');
const { preprocessImage } = require('./utils/imagePreprocessor');
const { performOCR } = require('./services/ocrService');
const { parseGSTInvoice } = require('./utils/gstParser');

async function test() {
  try {
    const fakePath = 'uploads/fake_test_gst.jpg';
    fs.writeFileSync(fakePath, 'fake_image_data');
    const processedPath = fakePath + '-processed.jpg';
    await preprocessImage(fakePath, processedPath);
    console.log("Success");
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
