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

  function search(slotIdx, currentMap, usedIndices) {
    if (slotIdx === 8) {
      let [q, p, n, d, nd, tp, ta, tot] = currentMap;
      let error = 0;

      if (n !== null && d !== null && nd !== null) {
        error += Math.abs((n + d) - nd);
      }
      if (nd !== null && ta !== null && tot !== null) {
        error += Math.abs((nd + ta) - tot);
      }
      if (nd !== null && tp !== null && ta !== null) {
        error += Math.abs((nd * (tp / 100)) - ta);
      }
      // Penalize missing values
      error += currentMap.filter(x => x === null).length * 10;

      if (error < minError) {
        minError = error;
        bestMap = [...currentMap];
      }
      return;
    }

    // Try assigning null
    currentMap[slotIdx] = null;
    search(slotIdx + 1, currentMap, usedIndices);

    // Try assigning each unused number
    for (let i = 0; i < Math.min(15, numbers.length); i++) {
      if (!usedIndices[i]) {
        let val = numbers[i];

        // Constraints for pruning
        if (slotIdx === 0 && (!Number.isInteger(val) || val <= 0)) continue; // Qty
        if (slotIdx === 1 && (!Number.isInteger(val) || val <= 0)) continue; // Pack
        if (slotIdx === 3 && val > 0) continue; // Disc must be <= 0
        if (slotIdx === 5 && !validTaxRates.includes(Math.round(val))) continue; // TaxPercent
        if (slotIdx === 6 && val < 0) continue; // TaxAmount
        if (slotIdx === 7 && val <= 0) continue; // TotalAmount

        usedIndices[i] = true;
        currentMap[slotIdx] = val;
        search(slotIdx + 1, currentMap, usedIndices);
        usedIndices[i] = false;
      }
    }
  }

  search(0, new Array(8).fill(null), {});

  if (bestMap) {
    return {
      qty: bestMap[0],
      packSize: bestMap[1],
      netAmount: bestMap[2],
      discountAmount: bestMap[3],
      netDiscAmount: bestMap[4],
      taxPercent: bestMap[5],
      taxAmount: bestMap[6],
      totalAmount: bestMap[7]
    };
  }

  return {
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

    let hsnIdx = tokens.findIndex((t, i) => i > artIdx && HSN_RE.test(t) && t.length >= 4 && t.length <= 10 && !t.includes('.'));

    let numericBlockStart = -1;
    for (let i = artIdx + 1; i < tokens.length - 1; i++) {
      if (isPureNumber(tokens[i]) && isPureNumber(tokens[i + 1])) {
        numericBlockStart = i;
        break;
      }
    }

    let nameEndIdx = tokens.length;
    if (numericBlockStart !== -1 && hsnIdx !== -1) {
      nameEndIdx = Math.min(numericBlockStart, hsnIdx);
    } else if (numericBlockStart !== -1) {
      nameEndIdx = numericBlockStart;
    } else if (hsnIdx !== -1) {
      nameEndIdx = hsnIdx;
    }

    const articleCode = tokens[artIdx];
    const articleName = tokens.slice(artIdx + 1, nameEndIdx)
      .join(" ")
      .replace(/^[xX\-\~]+|[xX\-\~]+$/g, '')
      .trim();

    let hsnCode = null;
    if (hsnIdx !== -1) {
      hsnCode = tokens[hsnIdx];
    } else {
      for (let i = nameEndIdx; i < tokens.length; i++) {
        if (/^\d{4,10}$/.test(tokens[i]) && !tokens[i].includes('.')) {
          hsnCode = tokens[i];
          break;
        }
      }
    }

    const remainingTokens = tokens.slice(nameEndIdx);
    if (hsnCode) {
      const hsnLocalIdx = remainingTokens.indexOf(hsnCode);
      if (hsnLocalIdx !== -1) {
        remainingTokens.splice(hsnLocalIdx, 1);
      }
    }

    const numbers = remainingTokens.map(parseMonetary).filter(n => n !== null);
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
      articleCode: item.articleCode,
      articleName: item.articleName,
      hsnCode: item.hsnCode,
      qty: item.qty,
      packSize: item.packSize,
      netAmount: item.netAmount,
      discountAmount: item.discountAmount,
      netDiscountAmount: item.netDiscAmount,
      taxPercent: item.taxPercent,
      taxAmount: item.taxAmount,
      totalAmountIncludingGST: item.totalAmountIncludingGST,
      validationStatus: item.validationStatus,
      validationMessages: item.validationMessages,
      status: item.status
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