/**
 * parserRules.js
 * Contains generic and reusable parser rules, OCR cleaning utilities, and data validation functions.
 */

/**
 * Cleans the raw OCR text of common garbage, duplicate symbols, and formatting errors.
 * @param {string} text - Raw OCR text.
 * @returns {string} - Cleaned text.
 */
function cleanOCRText(text) {
  if (!text) return '';
  
  return text
    // Replace broken line representations (like multiple underscores or hyphens representing separator lines)
    .replace(/[-_=]{4,}/g, '\n')
    // Remove duplicate symbols like multiple commas, semicolons
    .replace(/,,+/g, ',')
    .replace(/;;+/g, ';')
    .replace(/\.\.+/g, '.')
    // Clean up random garbage symbols that Tesseract sometimes places on vertical margins
    .replace(/[|¦\\\/_`°~]/g, ' ')
    // Replace multiple spaces with a single space
    .replace(/[ \t]+/g, ' ')
    // Split into lines, trim each line, and filter empty lines
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Standardize numeric tokens by replacing common OCR typos.
 * Applies corrections ONLY if the token is primarily numeric (>= 75% digits/decimals).
 * @param {string} token - The string token to process.
 * @returns {number|null} - The corrected numeric value, or null if invalid.
 */
function parseCleanNumber(token) {
  if (token === null || token === undefined) return null;
  
  // Strip spaces, currency symbol (₹, $), commas
  let clean = String(token).replace(/[₹$,\s]/g, '').trim();
  if (!clean) return null;

  // If already a valid number, return it
  if (/^-?\d+(\.\d+)?$/.test(clean)) {
    return parseFloat(clean);
  }

  // Count digit characters vs total letters
  const stripped = clean.replace(/[-.]/g, '');
  const digitCount = (stripped.match(/\d/g) || []).length;
  const totalLength = stripped.length;
  
  if (totalLength === 0) return null;
  const digitRatio = digitCount / totalLength;

  // Apply corrections only if at least 70% of characters are already digits
  if (digitRatio >= 0.70) {
    const fixed = clean
      .replace(/O/g, '0').replace(/o/g, '0')
      .replace(/I/g, '1').replace(/l/g, '1').replace(/i/g, '1')
      .replace(/S/g, '5').replace(/s/g, '5')
      .replace(/B/g, '8')
      .replace(/Z/g, '2').replace(/z/g, '2')
      .replace(/G/g, '6').replace(/g/g, '9');
      
    if (/^-?\d+(\.\d+)?$/.test(fixed)) {
      return parseFloat(fixed);
    }
  }

  return null;
}

/**
 * Formats a monetary number to 2 decimal places and prevents numeric overflow.
 * @param {number|string|null} val - The input value.
 * @param {number} fallback - The fallback value if null (defaults to 0).
 * @returns {number} - Formatted number.
 */
function formatMonetary(val, fallback = 0) {
  if (val === null || val === undefined || val === '') {
    return fallback;
  }
  const num = parseFloat(val);
  if (isNaN(num)) return fallback;

  // Prevent database overflow (maximum numeric field size limit check)
  if (num > 999999999.99 || num < -999999999.99) {
    return fallback;
  }

  return parseFloat(num.toFixed(2));
}

/**
 * Normalizes and validates Indian GSTIN format.
 * Format: 2 digits, 5 uppercase letters, 4 digits, 1 uppercase letter, 1 alphanumeric/digit, 'Z', 1 alphanumeric/digit.
 * @param {string} gst - The GST string.
 * @returns {string|null} - The validated uppercase GST number, or null if invalid.
 */
function validateGST(gst) {
  if (!gst) return null;
  const cleaned = gst.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  
  if (gstRegex.test(cleaned)) {
    return cleaned;
  }
  
  // Relaxed regex fallback for minor OCR errors (e.g. Z replaced by 2 or another char)
  if (cleaned.length === 15) {
    return cleaned; // still return it but flag in validation errors later
  }
  
  return null;
}

/**
 * Normalizes and validates Invoice Dates.
 * Formats supported: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, etc.
 * Returns ISO date format YYYY-MM-DD or null.
 * @param {string} rawDate - Raw date string from OCR.
 * @returns {string|null} - Normalized date, or null if invalid.
 */
function validateAndNormalizeDate(rawDate) {
  if (!rawDate) return null;
  
  const s = String(rawDate).trim();
  
  // ISO format Check
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : s;
  }
  
  // Match DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    const dateStr = `${year}-${month}-${day}`;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : dateStr;
  }

  // Match YYYY/MM/DD or YYYY-MM-DD
  const ymdMatch = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : dateStr;
  }
  
  // General date parse attempt
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return d.toISOString().split('T')[0];
  }

  return null;
}

function parseRawMonetary(val, isDiscount = false) {
  if (val === null || val === undefined) return 0;
  let s = String(val).trim();
  // Replace multiple commas with a dot or remove duplicate commas/dots
  s = s.replace(/,,+/g, '.');
  s = s.replace(/[₹$\s]/g, ''); // strip currency symbols and spaces
  
  // Detect if it is negative (either starts with '-' or has it at the end, or is a discount field)
  let isNegative = false;
  if (s.startsWith('-') || s.endsWith('-') || (isDiscount && parseFloat(s) > 0)) {
    isNegative = true;
  }
  
  // Keep only digits, dots, and minus signs
  s = s.replace(/[^0-9.-]/g, '');
  
  let num = parseFloat(s);
  if (isNaN(num)) return 0;
  if (isNegative && num > 0) num = -num;
  return num;
}

/**
 * Validates and normalizes an individual invoice item row based on specified engine rules.
 * @param {object} row - The raw parsed row.
 * @returns {object} - The normalized row with validation status and correction flags.
 */
function normalizeAndValidateRow(row) {
  const normalized = { ...row };
  const corrected_fields = [];
  const validation_messages = [];

  // 1. Article Code
  const origArticle = String(row.article_code || '');
  let articleCode = origArticle.replace(/\D/g, '');
  if (articleCode.length < 9 || articleCode.length > 14) {
    validation_messages.push("Article code is not between 9 and 14 digits.");
  }
  normalized.article_code = articleCode;
  normalized.articleCode = articleCode;
  if (articleCode !== origArticle) {
    corrected_fields.push('article_code');
  }

  // 2. HSN Code
  const origHsn = String(row.hsn_code || '');
  let hsnCode = origHsn.replace(/\D/g, '');
  if (hsnCode.length < 6 || hsnCode.length > 8) {
    validation_messages.push("HSN code is not between 6 and 8 digits.");
  }
  normalized.hsn_code = hsnCode;
  normalized.hsnCode = hsnCode;
  if (hsnCode !== origHsn) {
    corrected_fields.push('hsn_code');
  }

  // 3. Quantity
  const origQty = row.quantity ?? row.qty ?? 1;
  let quantity = Math.max(0, Math.round(Number(origQty) || 0));
  normalized.quantity = quantity;
  normalized.qty = quantity;
  if (quantity !== Number(origQty)) {
    corrected_fields.push('quantity');
  }

  // 4. Pack Size
  const origPackSize = String(row.pack_size || row.packSize || '1');
  // Extract digits from pack size (e.g. "55G" -> 55, "PK12" -> 12, "24N" -> 24)
  let packSizeVal = parseInt(origPackSize.replace(/\D/g, ''), 10);
  if (isNaN(packSizeVal) || packSizeVal < 0) {
    packSizeVal = 1;
  }
  normalized.pack_size = String(packSizeVal);
  normalized.packSize = String(packSizeVal);
  if (String(packSizeVal) !== origPackSize) {
    corrected_fields.push('pack_size');
  }

  // 5. Tax Percentage
  const origTaxPercent = row.tax_percent ?? row.taxPercent ?? 0;
  let taxPercent = parseFloat(origTaxPercent) || 0;
  if (![0, 5, 12, 18, 28].includes(taxPercent)) {
    validation_messages.push(`Tax percentage is unusual: ${taxPercent}%`);
  }
  normalized.tax_percent = taxPercent;
  normalized.taxPercent = taxPercent;
  normalized.tax_percentage = taxPercent;

  // 6. Monetary Fields Decimals & Formula Check
  // Fields: net_amount, discount_amount, taxable_amount (Net Discount Amount), tax_amount, total_amount
  let net = parseRawMonetary(row.net_amount ?? row.netAmount);
  let disc = parseRawMonetary(row.discount_amount ?? row.discountAmount, true); // default negative
  let taxable = parseRawMonetary(row.taxable_amount ?? row.netDiscountAmount);
  let tax = parseRawMonetary(row.tax_amount ?? row.taxAmount);
  let total = parseRawMonetary(row.total_amount ?? row.totalAmountIncludingGST);

  // Store raw string indicators to see if they originally lacked decimal points
  const rawNetStr = String(row.net_amount ?? row.netAmount ?? '');
  const rawDiscStr = String(row.discount_amount ?? row.discountAmount ?? '');
  const rawTaxableStr = String(row.taxable_amount ?? row.netDiscountAmount ?? '');
  const rawTaxStr = String(row.tax_amount ?? row.taxAmount ?? '');
  const rawTotalStr = String(row.total_amount ?? row.totalAmountIncludingGST ?? '');

  const hasDecimal = (s) => s.includes('.') || s.includes(',');

  // Search combination space of /100 divisions to find the set that satisfies:
  // Eq 1: taxable = net + disc
  // Eq 2: total = taxable + tax
  let bestErr = Infinity;
  let bestVals = [net, disc, taxable, tax, total];
  let bestDivs = [1, 1, 1, 1, 1];

  const divs = [1, 100];
  for (let dNet of divs) {
    for (let dDisc of divs) {
      for (let dTaxable of divs) {
        for (let dTax of divs) {
          for (let dTotal of divs) {
            let net_t = net / dNet;
            let disc_t = disc / dDisc;
            let taxable_t = taxable / dTaxable;
            let tax_t = tax / dTax;
            let total_t = total / dTotal;

            // Handle inference for single missing / zero fields
            if (taxable_t === 0 && net_t !== 0) {
              taxable_t = net_t + disc_t;
            }
            if (total_t === 0 && taxable_t !== 0) {
              total_t = taxable_t + tax_t;
            }
            if (tax_t === 0 && total_t !== 0) {
              tax_t = total_t - taxable_t;
            }
            if (net_t === 0 && taxable_t !== 0) {
              net_t = taxable_t - disc_t;
            }
            if (disc_t === 0 && taxable_t !== 0 && net_t !== 0) {
              disc_t = taxable_t - net_t;
            }

            const err1 = Math.abs(taxable_t - (net_t + disc_t));
            const err2 = Math.abs(total_t - (taxable_t + tax_t));
            const totalErr = err1 + err2;

            // Apply a small penalty if we keep huge numbers undivided (e.g. > 100000) when division was possible
            let penalty = totalErr;
            if (total_t > 10000 && dTotal === 1) penalty += 50;
            if (net_t > 10000 && dNet === 1) penalty += 50;

            // Penalize dividing a number that already had a decimal point
            if (dNet === 100 && hasDecimal(rawNetStr)) penalty += 100;
            if (dDisc === 100 && hasDecimal(rawDiscStr)) penalty += 100;
            if (dTaxable === 100 && hasDecimal(rawTaxableStr)) penalty += 100;
            if (dTax === 100 && hasDecimal(rawTaxStr)) penalty += 100;
            if (dTotal === 100 && hasDecimal(rawTotalStr)) penalty += 100;

            if (penalty < bestErr) {
              bestErr = penalty;
              bestVals = [net_t, disc_t, taxable_t, tax_t, total_t];
              bestDivs = [dNet, dDisc, dTaxable, dTax, dTotal];
            }
          }
        }
      }
    }
  }

  let [net_c, disc_c, taxable_c, tax_c, total_c] = bestVals;

  // If even the best error doesn't satisfy within tolerance (±1 rupee), we calculate the tax amount and total amount
  const finalErr1 = Math.abs(taxable_c - (net_c + disc_c));
  const finalErr2 = Math.abs(total_c - (taxable_c + tax_c));
  
  if (finalErr1 > 1.05) {
    // Correct taxable_amount using formula
    taxable_c = net_c + disc_c;
    corrected_fields.push('taxable_amount');
  }
  if (finalErr2 > 1.05 || tax_c === 0) {
    // Recalculate tax using tax percent
    tax_c = taxable_c * (taxPercent / 100);
    total_c = taxable_c + tax_c;
    corrected_fields.push('tax_amount');
    corrected_fields.push('total_amount');
  }

  // Round all monetary fields to 2 decimals
  net_c = parseFloat(net_c.toFixed(2));
  disc_c = parseFloat(disc_c.toFixed(2));
  taxable_c = parseFloat(taxable_c.toFixed(2));
  tax_c = parseFloat(tax_c.toFixed(2));
  total_c = parseFloat(total_c.toFixed(2));

  // Check which monetary fields were corrected/divided
  if (bestDivs[0] === 100 || net_c !== parseRawMonetary(row.net_amount ?? row.netAmount)) corrected_fields.push('net_amount');
  if (bestDivs[1] === 100 || disc_c !== parseRawMonetary(row.discount_amount ?? row.discountAmount, true)) corrected_fields.push('discount_amount');
  if (bestDivs[2] === 100 || taxable_c !== parseRawMonetary(row.taxable_amount ?? row.netDiscountAmount)) corrected_fields.push('taxable_amount');
  if (bestDivs[3] === 100 || tax_c !== parseRawMonetary(row.tax_amount ?? row.taxAmount)) corrected_fields.push('tax_amount');
  if (bestDivs[4] === 100 || total_c !== parseRawMonetary(row.total_amount ?? row.totalAmountIncludingGST)) corrected_fields.push('total_amount');

  // Assign back corrected values
  normalized.net_amount = net_c;
  normalized.netAmount = net_c;
  
  normalized.discount_amount = disc_c;
  normalized.discountAmount = disc_c;
  normalized.discount = disc_c;

  normalized.taxable_amount = taxable_c;
  normalized.netDiscountAmount = taxable_c;

  normalized.tax_amount = tax_c;
  normalized.taxAmount = tax_c;

  normalized.total_amount = total_c;
  normalized.totalAmountIncludingGST = total_c;

  // Calculate unit price compatibility field
  normalized.unit_price = quantity > 0 ? parseFloat((net_c / quantity).toFixed(2)) : net_c;

  // Set correction flag and validation status
  const uniqueCorrected = [...new Set(corrected_fields)];
  normalized.corrected = uniqueCorrected.length > 0;
  normalized.corrected_fields = uniqueCorrected;
  
  if (validation_messages.length > 0) {
    normalized.validation_status = "invalid";
    normalized.validation_messages = validation_messages;
  } else if (uniqueCorrected.length > 0) {
    normalized.validation_status = "corrected";
    normalized.validation_messages = ["Some fields were auto-corrected or inferred."];
  } else {
    normalized.validation_status = "valid";
    normalized.validation_messages = [];
  }

  return normalized;
}

module.exports = {
  cleanOCRText,
  parseCleanNumber,
  formatMonetary,
  validateGST,
  validateAndNormalizeDate,
  normalizeAndValidateRow
};
