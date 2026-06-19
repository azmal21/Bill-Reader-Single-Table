"use strict";

const ARTICLE_CODE_RE = /^\d{8,14}$/;
const HSN_RE = /^\d{4,8}$/;
const DATE_RE = /\b(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})\b/;
const GSTIN_RE = /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/i;
const PAN_RE = /\b[A-Z]{5}\d{4}[A-Z]\b/i;

function isPureNumber(str) {
  if (!str) return false;
  let s = str.replace(/[₹$,%€]/g, "").trim();
  if (s.startsWith("-")) s = s.slice(1);
  return /^[\d\.]+$/.test(s);
}

function parseMonetary(str) {
  if (!str || typeof str !== "string") return null;
  let s = str.trim();
  if (s.endsWith("-")) {
    s = "-" + s.slice(0, -1);
  }
  let cleaned = s
    .replace(/[oO]/g, "0")
    .replace(/[lI]/g, "1")
    .replace(/[₹$,%]/g, "")
    .replace(/,/g, "")
    .replace(/[^\d.\-]/g, "")
    .trim();
  if ((cleaned.match(/\./g) || []).length > 1) return null;
  if (cleaned === "." || cleaned === "-" || cleaned === "") return null;
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function allocateColumns(numbers) {
  let bestMap = null;
  let minError = Infinity;
  const validTaxRates = [0, 5, 12, 18, 28];

  function getCombinations(nums, slots) {
    if (slots === 0) return nums.length === 0 ? [[]] : [];
    if (nums.length === 0) return [[null, ...getCombinations([], slots - 1)[0]]];

    let res = [];
    for (let c of getCombinations(nums.slice(1), slots - 1)) {
      res.push([nums[0], ...c]);
    }
    if (slots > nums.length) {
      for (let c of getCombinations(nums, slots - 1)) {
        res.push([null, ...c]);
      }
    }
    return res;
  }

  const combos = getCombinations(numbers.slice(0, 8), 8);

  for (let c of combos) {
    let [q, p, n, d, nd, tp, ta, tot] = c;
    let error = 0;

    if (d !== null && d > 0) error += 10000;
    if (tp !== null && !validTaxRates.includes(Math.round(tp))) error += 10000;
    if (q !== null && q <= 0) error += 10000;
    if (p !== null && p <= 0) error += 10000;
    if (ta !== null && ta < 0) error += 10000;
    if (tot !== null && tot < 0) error += 10000;

    if (n !== null && d !== null && nd !== null) {
      error += Math.abs((n + d) - nd);
    }
    if (nd !== null && ta !== null && tot !== null) {
      error += Math.abs((nd + ta) - tot);
    }
    if (nd !== null && tp !== null && ta !== null) {
      error += Math.abs((nd * (tp / 100)) - ta);
    }

    error -= c.filter(x => x !== null).length * 0.1;

    if (error < minError) {
      minError = error;
      bestMap = { qty: q, packSize: p, netAmount: n, discountAmount: d, netDiscAmount: nd, taxPercent: tp, taxAmount: ta, totalAmount: tot };
    }
  }

  return bestMap || {
    qty: numbers[0] ?? null,
    packSize: numbers[1] ?? null,
    netAmount: numbers[2] ?? null,
    discountAmount: numbers[3] ?? null,
    netDiscAmount: numbers[4] ?? null,
    taxPercent: numbers[5] ?? null,
    taxAmount: numbers[6] ?? null,
    totalAmount: numbers[7] ?? null
  };
}

function validateItem(item) {
  const messages = [];
  const validTaxRates = [0, 5, 12, 18, 28];

  if (item.taxPercent !== null && !validTaxRates.includes(Math.round(item.taxPercent))) {
    messages.push(`Invalid tax percent: ${item.taxPercent}`);
  }

  if (item.netAmount !== null && item.discountAmount !== null && item.netDiscAmount !== null) {
    if (Math.abs(item.netAmount + item.discountAmount - item.netDiscAmount) > 2.0) {
      messages.push(`Formula mismatch: netAmount + discountAmount != netDiscAmount`);
    }
  }

  if (item.netDiscAmount !== null && item.taxAmount !== null && item.totalAmountIncludingGST !== null) {
    if (Math.abs(item.netDiscAmount + item.taxAmount - item.totalAmountIncludingGST) > 2.0) {
      messages.push(`Formula mismatch: netDiscAmount + taxAmount != totalAmountIncludingGST`);
    }
  }

  const isMissing = !item.articleCode || !item.hsnCode || item.totalAmountIncludingGST === null || item.qty === null;
  item.validationStatus = isMissing || messages.length > 0 ? "needs_review" : "valid";
  item.status = item.validationStatus;
  item.validationMessages = messages;

  return item;
}

function parseMetroInvoice(rawOcrText) {
  if (!rawOcrText || typeof rawOcrText !== "string") {
    return { invoice: {}, items: [], validation_errors: ["No OCR text provided"] };
  }

  const lines = rawOcrText.split("\n").map(l => l.trim()).filter(l => l.length > 0);

  let phase = "HEADER";
  const header = {
    invoiceNumber: null,
    invoiceDate: null,
    customerName: null,
    customerCode: null,
    supplierName: "METRO Cash and Carry India Private Limited",
    supplierAddress: null,
    gstNumber: null,
    panNumber: null,
    state: null,
    grandTotal: null
  };

  const items = [];
  let currentRowText = "";

  const processRow = (text) => {
    const lowerText = text.toLowerCase();
    // 5. Reject rows containing:
    if (
      lowerText.includes("liquor license") ||
      lowerText.includes("gst no") ||
      lowerText.includes("pan no") ||
      lowerText.includes("customer") ||
      lowerText.includes("cin no") ||
      lowerText.includes("supplier address") ||
      lowerText.includes("apmc license")
    ) {
      return;
    }

    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length < 3) return;

    let artIdx = tokens.findIndex(t => ARTICLE_CODE_RE.test(t));
    if (artIdx === -1) return;

    let hsnIdx = tokens.findIndex((t, i) => i > artIdx && HSN_RE.test(t));

    // If HSN regex failed, search for the start of the numeric columns block
    if (hsnIdx === -1) {
      let numericBlockStart = -1;
      for (let i = artIdx + 1; i < tokens.length - 2; i++) {
        // If we find 3 pure numbers in a row, it's definitely the Qty / Price / Tax columns
        if (isPureNumber(tokens[i]) && isPureNumber(tokens[i + 1]) && isPureNumber(tokens[i + 2])) {
          numericBlockStart = i;
          break;
        }
      }

      if (numericBlockStart !== -1) {
        // Is the token right before the numeric block a garbled HSN?
        // E.g., it has at least 3 digits and length 4-10
        const prevToken = tokens[numericBlockStart - 1];
        const digitCount = (prevToken.match(/\d/g) || []).length;
        if (digitCount >= 3 && prevToken.length >= 4 && prevToken.length <= 10) {
          hsnIdx = numericBlockStart - 1;
        } else {
          // The previous token is part of the name, so the numeric block starts with HSN (or HSN is entirely missing)
          // We will just set hsnIdx to the numericBlockStart so articleName ends correctly
          hsnIdx = numericBlockStart;
        }
      } else {
        // Fallback
        hsnIdx = tokens.length;
      }
    }

    const articleCode = tokens[artIdx];
    const articleName = tokens.slice(artIdx + 1, hsnIdx).join(" ");

    // Determine if the token at hsnIdx is actually an HSN code
    let hsnCode = null;
    if (hsnIdx < tokens.length) {
      const candidate = tokens[hsnIdx];
      const digitCount = (candidate.match(/\d/g) || []).length;
      if (digitCount >= 3 && candidate.length >= 4 && candidate.length <= 10 && !isPureNumber(candidate.replace(/[a-zA-Z]/g, ''))) {
        hsnCode = candidate;
      } else if (HSN_RE.test(candidate)) {
        hsnCode = candidate;
      } else if (candidate.length >= 4 && digitCount >= 4) {
        hsnCode = candidate;
      }
    }

    // If we didn't identify it as an HSN code, it's likely the first financial column (like Qty)
    const afterHsn = hsnCode ? tokens.slice(hsnIdx + 1) : tokens.slice(hsnIdx);
    const numbers = afterHsn.map(parseMonetary).filter(n => n !== null);
    const mapped = allocateColumns(numbers);

    let item = {
      articleCode,
      articleName,
      hsnCode,
      qty: mapped.qty,
      packSize: mapped.packSize,
      netAmount: mapped.netAmount,
      discountAmount: mapped.discountAmount,
      netDiscAmount: mapped.netDiscAmount,
      taxPercent: mapped.taxPercent,
      taxAmount: mapped.taxAmount,
      totalAmountIncludingGST: mapped.totalAmount
    };

    item = validateItem(item);

    // If it lacks HSN or Name, it's definitely needs review
    if (!item.hsnCode || !item.articleName) {
      item.validationStatus = "needs_review";
      item.status = "needs_review";
      item.validationMessages.push("Missing Product Name or HSN Code");
    }

    items.push({
      article_code: item.articleCode,
      article_name: item.articleName,
      hsn_code: item.hsnCode,
      quantity: item.qty,
      pack_size: item.packSize,
      net_amount: item.netAmount,
      discount_amount: item.discountAmount,
      taxable_amount: item.netDiscAmount,
      tax_percent: item.taxPercent,
      tax_amount: item.taxAmount,
      total_amount: item.totalAmountIncludingGST,
      status: item.status,
      validation_messages: item.validationMessages,
      validation_status: item.validationStatus,

      // Legacy compatibility
      qty: item.qty,
      net_discount_amount: item.netDiscAmount,
      tax_percentage: item.taxPercent,
      total_amount_including_gst: item.totalAmountIncludingGST
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    if (phase === "HEADER") {
      if (i === 0 && (lower.includes("metro") || lower.includes("cash and carry"))) {
        header.supplierName = line;
      }

      if (!header.invoiceNumber && /invoice\s*no/i.test(line)) {
        const m = line.match(/no[.:\s]+([A-Z0-9\-\/]+)/i);
        if (m) header.invoiceNumber = m[1];
      }

      if (!header.invoiceDate) {
        const m = line.match(DATE_RE);
        if (m) header.invoiceDate = m[1];
      }

      if (!header.gstNumber) {
        const m = line.match(GSTIN_RE);
        if (m) header.gstNumber = m[0].toUpperCase();
      }

      if (!header.panNumber && /pan/i.test(line)) {
        const m = line.match(PAN_RE);
        if (m) header.panNumber = m[0].toUpperCase();
      }

      if (!header.customerCode && /customer\s*code/i.test(line)) {
        const m = line.match(/code[.:\s]+([0-9]+)/i);
        if (m) header.customerCode = m[1];
      }

      if (!header.customerName && /bill\s*to/i.test(line)) {
        if (i + 1 < lines.length) header.customerName = lines[i + 1];
      }

      if (!header.state && /state\s*:/i.test(line)) {
        const m = line.match(/state\s*:\s*(.+)/i);
        if (m) header.state = m[1];
      }

      if (lower.includes("article code") || lower.includes("article name") || lower.includes("hsn")) {
        phase = "ITEMS";
        continue;
      }
    }
    else if (phase === "ITEMS") {
      if (lower.includes("number of packs") || lower.includes("total:")) {
        phase = "FOOTER";
        if (currentRowText) {
          processRow(currentRowText);
          currentRowText = "";
        }
      } else {
        const tokens = line.split(/\s+/);
        let artIdx = tokens.findIndex(t => ARTICLE_CODE_RE.test(t));
        if (artIdx !== -1 && artIdx <= 2) {
          if (currentRowText) {
            processRow(currentRowText);
          }
          currentRowText = line;
        } else {
          if (currentRowText) {
            currentRowText += " " + line;
          }
        }
      }
    }

    if (phase === "FOOTER" || lower.includes("grand total") || lower.includes("total:")) {
      if (/grand\s*total/i.test(line) || /total:/i.test(line)) {
        const tokens = line.split(/\s+/);
        for (let t = tokens.length - 1; t >= 0; t--) {
          const val = parseMonetary(tokens[t]);
          if (val !== null && val > 0) {
            header.grandTotal = val;
            break;
          }
        }
      }
    }
  }

  if (currentRowText) {
    processRow(currentRowText);
  }

  const calculatedGrandTotal = items.reduce((sum, item) => sum + (item.total_amount || 0), 0);
  const diff = Math.abs((header.grandTotal || 0) - calculatedGrandTotal);

  return {
    invoice: {
      invoice_number: header.invoiceNumber || `METRO-${Date.now()}`,
      invoice_date: header.invoiceDate,
      customer_name: header.customerName,
      customer_code: header.customerCode,
      vendor_name: header.supplierName,
      supplier_name: header.supplierName,
      supplier_address: header.supplierAddress,
      gst_number: header.gstNumber,
      pan_number: header.panNumber,
      state: header.state,
      grand_total: header.grandTotal
    },
    items,
    invoiceNumber: header.invoiceNumber,
    invoiceDate: header.invoiceDate,
    customerName: header.customerName,
    customerCode: header.customerCode,
    supplierName: header.supplierName,
    supplierAddress: header.supplierAddress,
    gstNumber: header.gstNumber,
    panNumber: header.panNumber,
    state: header.state,
    grandTotal: header.grandTotal,
    itemCount: items.length,
    accuracy: items.length ? Math.round(items.filter(i => i.status === 'valid').length / items.length * 100) : 0,
    totalsMatch: header.grandTotal === 0 || diff < 1.0,
    validation_errors: items.flatMap(i => i.validation_messages || [])
  };
}

module.exports = { parseMetroInvoice };