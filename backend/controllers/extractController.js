const { performOCR } = require("../services/ocrService");
const pool = require("../db");
const fs = require("fs");
const sharp = require("sharp");


// --- HELPER FUNCTIONS FOR OCR PARSING ---

function extractNumbers(line) {
  const tokens = line.split(/\s+/);
  const nums = [];
  for (let token of tokens) {
    // Remove OCR artifacts: leading 'x', broken currency '%', 'R', '₹'
    token = token.replace(/^[x₹R%]+/i, '');
    token = token.replace(/,/g, ''); // Remove commas
    if (/^\d+(\.\d+)?$/.test(token)) {
      nums.push(parseFloat(token));
    }
  }
  return nums;
}

function detectColumnFormat(lines) {
  let format = { qtyIdx: -1, priceIdx: -1, totalIdx: -1 };

  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes("qty") || lower.includes("price") || lower.includes("rate") || lower.includes("amount") || lower.includes("total")) {
      const tokens = lower.split(/\s+/);
      const q = tokens.findIndex(t => t.includes("qty") || t.includes("quan"));
      const p = tokens.findIndex(t => t.includes("price") || t.includes("rate") || t.includes("amount"));
      const t = tokens.findIndex(t => t.includes("total"));

      if (q !== -1 || p !== -1 || t !== -1) {
        const valid = [];
        if (q !== -1) valid.push({ type: 'qty', idx: q });
        if (p !== -1) valid.push({ type: 'amount', idx: p });
        if (t !== -1) valid.push({ type: 'total', idx: t });

        valid.sort((a, b) => a.idx - b.idx);
        for (let j = 0; j < valid.length; j++) {
          if (valid[j].type === 'qty') format.qtyIdx = j;
          if (valid[j].type === 'amount') format.priceIdx = j;
          if (valid[j].type === 'total') format.totalIdx = j;
        }
        return format;
      }
    }
  }
  return null;
}

function isValidItemLine(name) {
  const words = name.split(/\s+/);
  // Requires at least one word that has 3 or more letters
  const hasLongWord = words.some(w => /^[a-zA-Z]{3,}$/.test(w.replace(/[^a-zA-Z]/g, '')));
  return hasLongWord;
}

function detectQuantity(nums) {
  const candidates = nums.filter(n => Number.isInteger(n) && n > 0 && n <= 20);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  for (let c of candidates) {
    let others = [...nums];
    others.splice(others.indexOf(c), 1);

    if (others.length >= 2) {
      for (let i = 0; i < others.length; i++) {
        for (let j = 0; j < others.length; j++) {
          if (i === j) continue;
          let amount = others[i];
          let total = others[j];
          if (Math.abs(amount * c - total) < 1.0) return c;
          if (correctRupeeSymbolOCR(amount, c, total)) return c;
        }
      }
    }
  }
  return Math.min(...candidates);
}

function correctRupeeSymbolOCR(price, quantity, total) {
  if (price > 1500) {
    const amountStr = price.toString();
    if (amountStr.length >= 4) {
      const correctedAmount = parseFloat(amountStr.substring(1));

      console.log(`OCR price: ${price}`);
      console.log(`Corrected candidate: ${correctedAmount}`);

      if (Math.abs(correctedAmount * quantity - total) < 1.0) {
        console.log("Validation result: Matches perfectly. Accept corrected price.");
        return correctedAmount;
      } else {
        console.log("Validation result: Does not match total.");
      }
    }
  }
  return null;
}

function recoverOcrQuantity(line) {
  const tokens = line.split(/\s+/);
  const map = {
    'Z': 2, 'z': 2,
    'I': 1, 'l': 1, 'i': 1,
    'O': 0, 'o': 0
  };
  const recovered = [];
  for (let token of tokens) {
    if (map[token] !== undefined) {
      recovered.push(map[token]);
    }
  }
  return recovered;
}

function validateItemMath(quantity, rate, total) {
  return Math.abs((quantity * rate) - total) < 1.0;
}

function recoverMergedQuantity(value1, total) {
  const str = value1.toString();
  for (let q = 1; q <= 20; q++) {
    const qStr = q.toString();
    if (str.startsWith(qStr)) {
      const rateStr = str.substring(qStr.length);
      if (rateStr.length > 0 && rateStr !== ".") {
        const rate = parseFloat(rateStr);
        if (!isNaN(rate) && validateItemMath(q, rate, total)) {
          return { quantity: q, rate: rate };
        }
      }
    }
  }
  return null;
}

function detectTotal(nums, qty, format) {
  let others = [...nums];
  const qIdx = others.indexOf(qty);
  if (qIdx > -1) others.splice(qIdx, 1);

  if (others.length >= 2) {
    for (let i = 0; i < others.length; i++) {
      for (let j = 0; j < others.length; j++) {
        if (i === j) continue;
        let amount = others[i];
        let total = others[j];
        if (Math.abs(amount * qty - total) < 1.0) return total;
        if (correctRupeeSymbolOCR(amount, qty, total)) return total;
      }
    }
    if (format && format.totalIdx !== -1) {
      if (format.totalIdx > format.priceIdx) return others[others.length - 1];
      else return others[0];
    }
    return Math.max(...others);
  }
  return others.length > 0 ? Math.max(...others) : 0;
}

function detectAmount(nums, qty, total, format) {
  let others = [...nums];
  const qIdx = others.indexOf(qty);
  if (qIdx > -1) others.splice(qIdx, 1);
  const tIdx = others.indexOf(total);
  if (tIdx > -1) others.splice(tIdx, 1);

  if (others.length > 0) {
    let best = others[0];
    let minDiff = Math.abs((best * qty) - total);
    for (let n of others) {
      let diff = Math.abs((n * qty) - total);
      if (diff < minDiff) {
        best = n;
        minDiff = diff;
      }
    }
    return best;
  }
  return total / qty;
}

function extractGST(lines) {
  let sgst = 0;
  let cgst = 0;

  for (const line of lines) {
    const lower = line.toLowerCase();

    const matches = line.match(/\d+\.\d+/g);

    if (matches) {
      const amount = parseFloat(matches[matches.length - 1]);

      if (lower.includes("sgst")) {
        sgst = amount;
      }

      if (lower.includes("cgst")) {
        cgst = amount;
      }
    }
  }

  return { sgst, cgst };
}

function extractGrandTotal(lines) {
  let grandTotal = 0;
  let matchLine = "";

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Ignore tax/subtotal lines
    if (lowerLine.includes("total qty") || lowerLine.includes("sub total") ||
      lowerLine.includes("subtotal") || lowerLine.includes("cgst") ||
      lowerLine.includes("sgst") || lowerLine.includes("igst")) {
      continue;
    }

    // Prefer Grand Total, Total, Net Payable
    if (
      lowerLine.includes("grand total") ||
      lowerLine.includes("invoice amount") ||
      lowerLine.includes("final amount") ||
      lowerLine.includes("net payable") ||
      lowerLine.includes("amount payable") ||
      lowerLine.includes("bill amount") ||
      /^total\s*:?\s*/i.test(line)
    ) {
      const nums = extractNumbers(line);
      if (nums.length > 0) {
        const lineTotal = Math.max(...nums);
        if (lineTotal > grandTotal) {
          grandTotal = lineTotal;
          matchLine = line;
        }
      }
    }
  }

  return { grandTotal, matchLine };
}

function cleanRestaurantName(name) {
  const garbageWords = [
    "e",
    "ou",
    "oe",
    "ee",
    "ii",
    "ll",
    "|",
    "g"
  ];

  let words = name.split(/\s+/);

  while (
    words.length > 1 &&
    garbageWords.includes(words[0].toLowerCase())
  ) {
    words.shift();
  }

  return words.join(" ");
}

// Clean OCR text
const cleanOcrText = (raw) => {
  return raw
    .replace(/%(\s*\d)/g, "₹$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[^a-zA-Z0-9₹., \n:-]/g, "") // Remove unnecessary symbols
    .trim();
};

// Resilient Regex-based parser for Bill items
const parseBillRegex = (ocrText) => {
  let lines = ocrText.split('\n').map(l => l.trim()).filter(l => l);

  // Ignore specific phrases
  const ignorePhrases = [
    "thank you", "visit again", "powered by", "cashier",
    "phone", "mobile", "contact", "address", "invoice no", "invoice number",
    "bill no", "receipt no", "transaction id", "payment ref", "date", "time",
    "table", "customer", "name:", "waiter", "server", "fssai",
    "mode:", "card", "cash", "upi", "bank", "pin", "branch", "retail invoice"
  ];

  lines = lines.filter((line, index, self) => {
    if (self.indexOf(line) !== index) return false;
    if (/^[=.-]+$/.test(line)) return false;
    const lowerLine = line.toLowerCase();
    for (const phrase of ignorePhrases) {
      if (lowerLine.includes(phrase)) return false;
    }
    // Skip address-like lines with Indian pincodes
    if (/\b\d{6}\b/.test(line)) return false;
    // Skip lines containing many commas (usually addresses)
    if ((line.match(/,/g) || []).length >= 2) return false;
    return true;
  });
  let restaurantName = findRestaurantName(lines);

  function findRestaurantName(lines) {
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];

      // Ignore very short OCR garbage
      if (line.length < 5) continue;

      // Ignore lines containing many numbers
      if ((line.match(/\d/g) || []).length > 2) continue;

      return cleanRestaurantName(line);
    }

    return lines[0] || "Unknown Restaurant";
  }
  const items = [];

  const format = detectColumnFormat(lines);
  if (format) console.log("Detected Column Format:", format);
  console.log("FILTERED LINES:");
  console.log(lines);
  const { sgst, cgst } = extractGST(lines);
  const { grandTotal, matchLine } = extractGrandTotal(lines);
  if (matchLine) console.log("Matched Grand Total Line:", matchLine);
  if (grandTotal) console.log("Parsed Grand Total:", grandTotal);

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    // Skip lines that look like total lines (already handled by extractGrandTotal)
    // Skip tax and total lines
    if (
      lowerLine.includes("total") ||
      lowerLine.includes("payable") ||
      lowerLine.includes("qty") ||
      lowerLine.includes("cgst") ||
      lowerLine.includes("sgst") ||
      lowerLine.includes("igst")
    ) {
      continue;
    }

    let nums = extractNumbers(line);

    // Handle serial number at beginning
    // Example:
    // 1 Masala Dosa 1 399
    // 2 Idli 2 120

    if (
      nums.length >= 3 &&
      nums[0] <= 9 &&
      nums[1] <= 20 &&
      nums[nums.length - 1] > 20
    ) {
      nums.shift(); // Remove serial number
    }

    // An item line usually has at least 2 numbers (qty, total)
    // or 3 numbers (qty, rate, total)
    if (nums.length >= 2) {

      let qty = nums.find(
        n => Number.isInteger(n) && n > 0 && n <= 20
      );

      if (!qty) {
        console.log("Rejected Invalid Row (No quantity):", line);
        continue;
      }

      let monetaryValues = [...nums];
      monetaryValues.splice(monetaryValues.indexOf(qty), 1);

      if (monetaryValues.length === 0) {
        console.log("Rejected Invalid Row (No monetary values):", line);
        continue;
      }

      let total, itemRate;

      if (monetaryValues.length === 1) {
        total = monetaryValues[0];
        itemRate = total / qty;
      } else {
        total = Math.max(...monetaryValues);
        let remaining = [...monetaryValues];
        remaining.splice(remaining.indexOf(total), 1);
        itemRate = Math.min(...remaining);

        // OCR garbage protection
        if (itemRate < 10 && total > 100) {
          itemRate = total / qty;
        }
      }

      total = fixOcrAmount(
        qty,
        itemRate,
        total
      );

      if (total < itemRate) {
        console.log("Rejected Invalid Row (Total < Item Rate):", line);
        continue;
      }

      // Reconstruct name
      let nameTokens = line.split(/\s+/);
      let nameParts = [];
      let tempNums = [...nums];
      for (let token of nameTokens) {
        let clean = token.replace(/^[x₹R%]+/i, '').replace(/,/g, '');
        let num = parseFloat(clean);
        if (!isNaN(num) && tempNums.includes(num)) {
          tempNums.splice(tempNums.indexOf(num), 1);
          continue;
        }
        nameParts.push(token);
      }
      let name = nameParts.join(' ')
        .replace(/^[xX]\s*/, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      if (!isValidItemLine(name)) {
        console.log("Rejected Garbage Line:", line);
        continue;
      }

      console.log(`\n--- PARSED LINE: ${line} ---`);
      console.log(`Detected Qty: ${qty}`);
      console.log(`Detected Item Rate: ${itemRate}`);
      console.log(`Detected Total: ${total}`);

      items.push({
        name: name,
        quantity: qty,
        itemRate: itemRate,
        total: total
      });
    }
  }

  let finalGrandTotal = grandTotal;
  if (finalGrandTotal === 0 && items.length > 0) {
    finalGrandTotal = items.reduce((sum, item) => sum + item.total, 0);
  }

  return { restaurantName, items, sgst, cgst, grandTotal: finalGrandTotal };
};

const extractText = async (req, res) => {
  console.log("[LOG] request received: POST /extract");
  const startTime = Date.now();

  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: "No image file provided. Please upload a JPG or PNG image.",
    });
  }

  const filePath = req.file.path;
  const processedPath = `${filePath}-processed.jpg`;

  try {
    console.log(`Processing: ${req.file.originalname}`);

    // Preprocess image using Sharp (resize large images for faster OCR)
    await sharp(filePath)
      .rotate()
      .resize({ width: 1500, fit: 'inside', withoutEnlargement: true })
      .grayscale()
      .normalize()
      .sharpen()
      .toFile(processedPath);

    // Step 1: Extract Text using shared persistent OCR worker (local traineddata)
    const ocrResult = await performOCR(processedPath);

    console.log("OCR Confidence:", ocrResult.confidence);

    const cleanedText = cleanOcrText(ocrResult.text);
    console.log(`✅ OCR done | confidence: ${ocrResult.confidence}%`);

    // Step 2: Parse using Regex logic
    console.log("[LOG] parser execution: parseBillRegex");
    const billData = parseBillRegex(cleanedText);
    console.log("[LOG] response generation: extractText success");

    // Failure Detection Validation
    if (
      billData.restaurantName === "Unknown Restaurant" ||
      !billData.items || billData.items.length === 0 ||
      !billData.grandTotal || billData.grandTotal === 0 ||
      cleanedText.length < 20
    ) {
      return res.status(400).json({
        success: false,
        message: "Unable to read the receipt. Please upload a clear photo."
      });
    }

    // Calculate extraction time
    const extractionTime = ((Date.now() - startTime) / 1000).toFixed(2);

    return res.status(200).json({
      success: true,
      billData: billData,
      rawText: ocrResult.text,
      extractionTime: `${extractionTime}s`,
      filename: req.file.originalname,
      parsedBy: "regex",
    });

  } catch (error) {
    console.error("❌ Extraction error:", error.message);
    console.error(error.stack);
    return res.status(500).json({
      success: false,
      error: "Failed to extract text from the image.",
      details: error.message,
    });
  } finally {
    // Clean up temp files (worker is persistent, NOT terminated here)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Temp file deleted: ${filePath}`);
    }
    if (fs.existsSync(processedPath)) {
      fs.unlinkSync(processedPath);
      console.log(`Processed temp file deleted: ${processedPath}`);
    }
  }
};

function fixOcrAmount(qty, rate, total) {

  // Already correct
  if (Math.abs(qty * rate - total) < 1) {
    return total;
  }

  const str = total.toString();

  // Remove leading OCR digit
  if (str.length >= 3) {

    const corrected = Number(str.substring(1));

    if (Math.abs(qty * rate - corrected) < 1) {
      console.log(
        `OCR Total Fixed: ${total} -> ${corrected}`
      );

      return corrected;
    }
  }

  return total;
}

const getBills = async (req, res) => {
  console.log("[LOG] request received: GET /api/bills");
  try {
    const query = `
      SELECT b.id, b.restaurant_name, b.sgst, b.cgst, b.grand_total, b.created_at,
             COALESCE(json_agg(
               json_build_object(
                 'id', bi.id,
                 'name', bi.item_name,
                 'quantity', bi.quantity,
                 'itemRate', bi.unit_price,
                 'total', bi.total_price
               )
             ) FILTER (WHERE bi.id IS NOT NULL), '[]') as items
      FROM bills b
      LEFT JOIN bill_items bi ON b.id = bi.bill_id
      GROUP BY b.id
      ORDER BY b.created_at DESC;
    `;
    console.log("[LOG] database query: GET /api/bills");
    const result = await pool.query(query);
    console.log("[LOG] response generation: getBills success");
    res.json({ success: true, bills: result.rows });
  } catch (error) {
    console.error("DB error in getBills:", error.message);
    console.error(error.stack);
    res.status(500).json({ success: false, error: "Failed to fetch bills from database." });
  }
};

const deleteBill = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM bills WHERE id = $1 RETURNING *', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: "Bill not found." });
    }

    res.json({ success: true, message: "Bill deleted successfully." });
  } catch (error) {
    console.error("DB error in deleteBill:", error.message);
    res.status(500).json({ success: false, error: "Failed to delete bill from database." });
  }
};

const saveBill = async (req, res) => {
  console.log("[LOG] request received: POST /save");
  try {
    const { restaurantName, items, sgst, cgst, grandTotal } = req.body;

    // Validation
    if (sgst < 0 || cgst < 0) {
      return res.status(400).json({ success: false, error: "SGST and CGST must be >= 0." });
    }
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const expectedTotal = subtotal + parseFloat(sgst || 0) + parseFloat(cgst || 0);
    if (grandTotal < expectedTotal - 1.0) { // allow a small rounding margin
      // Depending on rules, just logging or failing:
      console.warn("Grand Total is less than subtotal + taxes.", { grandTotal, expectedTotal });
    }

    const billQuery = `
      INSERT INTO bills (restaurant_name, sgst, cgst, grand_total) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *;
    `;
    const billValues = [
      restaurantName,
      parseFloat(sgst) || 0,
      parseFloat(cgst) || 0,
      parseFloat(grandTotal)
    ];

    console.log("[LOG] database query: POST /save bills");
    const dbResult = await pool.query(billQuery, billValues);
    const savedBill = dbResult.rows[0];
    savedBill.items = [];

    for (const item of items) {
      const itemQuery = `
        INSERT INTO bill_items (bill_id, item_name, quantity, unit_price, total_price)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
      const itemValues = [
        savedBill.id,
        item.name,
        item.quantity,
        item.rate || item.itemRate,
        item.totalRate || item.total
      ];
      const itemResult = await pool.query(itemQuery, itemValues);
      savedBill.items.push({
        id: itemResult.rows[0].id,
        name: itemResult.rows[0].item_name,
        quantity: itemResult.rows[0].quantity,
        rate: itemResult.rows[0].unit_price,
        totalRate: itemResult.rows[0].total_price
      });
    }

    console.log("[LOG] response generation: saveBill success");
    return res.status(200).json({
      success: true,
      message: "Bill saved successfully.",
      bill: {
        id: savedBill.id,
        restaurantName: savedBill.restaurant_name,
        items: savedBill.items,
        sgst: parseFloat(savedBill.sgst) || 0,
        cgst: parseFloat(savedBill.cgst) || 0,
        grandTotal: parseFloat(savedBill.grand_total)
      }
    });
  } catch (error) {
    console.error("DB error in saveBill:", error.message);
    console.error(error.stack);
    res.status(500).json({ success: false, error: "Failed to save bill." });
  }
};

module.exports = { extractText, getBills, deleteBill, saveBill };