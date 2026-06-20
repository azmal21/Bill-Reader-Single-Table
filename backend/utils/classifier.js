/**
 * classifier.js
 * Automatically determines the type of the bill from the OCR text.
 */

function detectBillType(ocrText) {
  if (!ocrText) return 'restaurant';

  const lowerText = ocrText.toLowerCase();

  // 1. Metro Invoice
  // Usually has 'METRO Cash and Carry' or 'METRO Wholesale'
  if (lowerText.includes('metro cash') || lowerText.includes('metro wholesale') || lowerText.includes('cash and carry')) {
    return 'metro';
  }

  // 2. GST / Retail Invoice
  // Look for specific GST invoice signatures like "Tax Invoice", "HSN", etc.
  // We can refine this to separate GST and Retail if needed, but the prompt mentions:
  // "classify bills automatically (Restaurant, Metro, GST, etc.)"
  if (lowerText.includes('tax invoice') && lowerText.includes('hsn')) {
    // If it has a specific retail format we might detect it here, otherwise default to gst
    return 'gst';
  }
  
  if (lowerText.includes('retail invoice')) {
    return 'retail';
  }

  // 3. Default to restaurant bill
  return 'restaurant';
}

module.exports = {
  detectBillType
};
