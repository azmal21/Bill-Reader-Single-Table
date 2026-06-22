// --- HELPER FUNCTIONS FOR OCR PARSING ---

function extractNumbers(line) {
  const tokens = line.split(/\s+/);
  const nums = [];
  for (let token of tokens) {
    // Remove OCR artifacts: leading 'x', broken currency '%', 'R', '₹', '$'
    token = token.replace(/^[x₹R%$]+/i, '');
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
      const tokens = lower.split(/\\s+/);
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
  if (!name || name.trim() === '') return false;
  const words = name.split(/\s+/);
  // Relaxed: Requires at least one word that has 2 or more letters
  const hasWord = words.some(w => /[a-zA-Z]{2,}/.test(w));
  return hasWord;
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

      if (Math.abs(correctedAmount * quantity - total) < 1.0) {
        return correctedAmount;
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

    // Prefer Grand Total, Total, Net Payable, etc.
    if (
      lowerLine.includes("grand total") ||
      lowerLine.includes("invoice amount") ||
      lowerLine.includes("final amount") ||
      lowerLine.includes("net payable") ||
      lowerLine.includes("amount payable") ||
      lowerLine.includes("bill amount") ||
      lowerLine.includes("amount due") ||
      lowerLine.includes("total amount") ||
      lowerLine.includes("paid amount") ||
      /^total\s*:?\s*/i.test(line) ||
      /^total/i.test(line)
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

  // Fallback: if grandTotal is still 0, look for the largest number near the end of the receipt
  if (grandTotal === 0 && lines.length > 0) {
    const lastFewLines = lines.slice(-10);
    for (const line of lastFewLines) {
      const nums = extractNumbers(line);
      if (nums.length > 0) {
        const maxInLine = Math.max(...nums);
        if (maxInLine > grandTotal) {
          grandTotal = maxInLine;
        }
      }
    }
  }

  return { grandTotal, matchLine };
}

// ── NEW: extract document / bill number ─────────────────────────
function extractDocumentNumber(lines) {
  // Patterns: Bill No, Receipt No, Invoice No, Order No, Token No, Ticket No
  const docPatterns = [
    /(?:bill\s*no|receipt\s*no|invoice\s*no|order\s*no|token\s*no|ticket\s*no|txn\s*no|trans\s*no|ref\s*no|order\s*id|receipt\s*#|bill\s*#)\s*[:#]?\s*([A-Z0-9\-/]+)/i,
    /(?:no\.?|#)\s*([A-Z0-9\-/]{3,15})\s*$/i,
  ];
  for (const line of lines) {
    for (const pattern of docPatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }
  return '';
}

// ── NEW: extract bill date ────────────────────────────────────────
function extractBillDate(lines) {
  // Try to find a date keyword line first
  const dateKeywordPattern = /(?:date|dated|bill\s*date|invoice\s*date|order\s*date)\s*[:#]?\s*([0-9]{1,2}[\-/\.][0-9]{1,2}[\-/\.][0-9]{2,4})/i;
  const isoPattern = /\b(\d{4}-\d{2}-\d{2})\b/;
  const dmyPattern = /\b(\d{1,2}[\-/.](\d{1,2})[\-/.]\d{2,4})\b/;

  for (const line of lines) {
    // Prefer lines explicitly labeled as date
    const kwMatch = line.match(dateKeywordPattern);
    if (kwMatch) return normaliseDate(kwMatch[1]);
  }
  // Fallback: scan first 20 lines for any recognisable date
  for (const line of lines.slice(0, 20)) {
    const isoMatch = line.match(isoPattern);
    if (isoMatch) return isoMatch[1];
    const dmyMatch = line.match(dmyPattern);
    if (dmyMatch) return normaliseDate(dmyMatch[1]);
  }
  return '';
}

function normaliseDate(str) {
  // Convert D/M/YY or D-M-YY → YYYY-MM-DD
  const parts = str.split(/[\-/.]/);
  if (parts.length === 3) {
    let [a, b, c] = parts.map(p => p.padStart(2, '0'));
    // If first part is 4-digit year it's already ISO-ish
    if (a.length === 4) return `${a}-${b}-${c}`;
    // Assume DD-MM-YY(YY)
    if (c.length === 2) c = '20' + c;
    return `${c}-${b}-${a}`;
  }
  return str;
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
    .replace(/[^a-zA-Z0-9₹.,$ \n:-]/g, "") // Remove unnecessary symbols
    .trim();
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
      return corrected;
    }
  }
  return total;
}

// Resilient Regex-based parser for Bill items
const parseBillRegex = (ocrText) => {
  let originalLines = ocrText.split('\n').map(l => l.trim()).filter(l => l);
  let lines = [...originalLines];

  // Extract document number and date from the raw (unfiltered) lines
  const documentNumber = extractDocumentNumber(originalLines);
  const billDate = extractBillDate(originalLines);
  console.log(`[DEBUG] documentNumber: "${documentNumber}" | billDate: "${billDate}"`);

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
  
  let restaurantName = findRestaurantName(originalLines);

  function findRestaurantName(sourceLines) {
    for (let i = 0; i < Math.min(8, sourceLines.length); i++) {
      const line = sourceLines[i];
      // Ignore very short OCR garbage
      if (line.length < 4) continue;
      // Ignore lines containing many numbers
      if ((line.match(/\d/g) || []).length > 2) continue;
      
      const cleaned = cleanRestaurantName(line);
      if (cleaned.length >= 4) {
        return cleaned;
      }
    }
    return sourceLines[0] || "Unknown Restaurant";
  }
  
  const items = [];
  const format = detectColumnFormat(lines);
  const { sgst, cgst } = extractGST(lines);
  const { grandTotal, matchLine } = extractGrandTotal(originalLines);

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
      lowerLine.includes("igst") ||
      lowerLine.includes("tax")
    ) {
      console.log(`[DEBUG] Ignored generic/tax/total line: "${line}"`);
      continue;
    }

    let nums = extractNumbers(line);

    // Handle serial number at beginning
    if (
      nums.length >= 3 &&
      nums[0] <= 9 &&
      nums[1] <= 20 &&
      nums[nums.length - 1] > 20
    ) {
      nums.shift(); // Remove serial number
    }

    // Tolerate lines with at least 1 number or just text if we can find a valid item name
    if (nums.length >= 1) {
      // Reconstruct name
      let nameTokens = line.split(/\s+/);
      let nameParts = [];
      let tempNums = [...nums];
      for (let token of nameTokens) {
        let clean = token.replace(/^[x₹R%$]+/i, '').replace(/,/g, '');
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
        console.log(`[DEBUG] Rejected line: "${line}" - Reason: Invalid item name (${name})`);
        continue;
      }

      let qty = nums.find(n => Number.isInteger(n) && n > 0 && n <= 20) || 1; // Default to 1

      let monetaryValues = [...nums];
      if (nums.includes(qty) && nums.length > 1) {
        monetaryValues.splice(monetaryValues.indexOf(qty), 1);
      }

      let total = 0, itemRate = 0;

      if (monetaryValues.length > 0) {
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
        total = fixOcrAmount(qty, itemRate, total);
      } else {
        console.log(`[DEBUG] Missing amounts for line: "${line}", proceeding with 0`);
      }

      // We no longer reject items where total < itemRate
      // We accept partial items

      console.log(`[DEBUG] Accepted item: Name="${name}", Qty=${qty}, Rate=${itemRate}, Total=${total}`);

      items.push({
        name: name || "Unknown Item",
        quantity: qty,
        itemRate: itemRate,
        total: total
      });
    } else {
      console.log(`[DEBUG] Rejected line: "${line}" - Reason: No numbers found.`);
    }
  }

  let finalGrandTotal = grandTotal;
  if (finalGrandTotal === 0 && items.length > 0) {
    finalGrandTotal = items.reduce((sum, item) => sum + item.total, 0);
  }

  console.log(`[DEBUG] Final Parsed Values - Name: "${restaurantName}", DocNo: "${documentNumber}", Date: "${billDate}", Items Count: ${items.length}, SGST: ${sgst}, CGST: ${cgst}, Grand Total: ${finalGrandTotal}`);

  return { restaurantName, documentNumber, billDate, items, sgst, cgst, grandTotal: finalGrandTotal };
};

module.exports = {
  parseBillRegex,
  cleanOcrText
};
