/**
 * gstParser.js
 * Rule-based, manual GST Invoice Parser using regex, text matching, and table extraction.
 * No AI or LLMs.
 */

function parseCleanNumeric(str) {
  if (!str) return null;
  let clean = str.replace(/[₹$,%]/g, "").replace(/,/g, "").trim();
  const val = parseFloat(clean);
  return isNaN(val) ? null : val;
}

function isNumericToken(token) {
  if (!token) return false;
  let clean = token.replace(/[₹$,%]/g, "").trim();
  return /^\d+(\.\d+)?$/.test(clean);
}

function allocateGSTColumns(vals) {
  const result = {
    unit_mrp_rsp: 0,
    quantity: 0,
    product_rate: 0,
    discount_percent: 0,
    taxable_amount: 0,
    cgst_percent: 0,
    sut_gst_percent: 0,
    cgst_amount: 0,
    sut_gst_amount: 0,
    cess_percent: 0,
    cess_amount: 0,
    total_amount: 0
  };

  if (vals.length === 9) {
    // Standard GST without Cess, without Unit MRP
    result.quantity = vals[0];
    result.product_rate = vals[1];
    result.discount_percent = vals[2];
    result.taxable_amount = vals[3];
    result.cgst_percent = vals[4];
    result.cgst_amount = vals[5];
    result.sut_gst_percent = vals[6];
    result.sut_gst_amount = vals[7];
    result.total_amount = vals[8];
  } else if (vals.length === 10) {
    // 10 numbers could be:
    // Case 1: [unit_mrp_rsp, qty, rate, disc%, taxable, cgst%, cgst_amt, sgst%, sgst_amt, total_amt]
    // Case 2: [qty, rate, taxable, cgst%, cgst_amt, sgst%, sgst_amt, cess%, cess_amt, total_amt]
    const isCase1 = Math.abs((vals[1] * vals[2]) * (1 - vals[3]/100) - vals[4]) < 2.0;
    if (isCase1) {
      result.unit_mrp_rsp = vals[0];
      result.quantity = vals[1];
      result.product_rate = vals[2];
      result.discount_percent = vals[3];
      result.taxable_amount = vals[4];
      result.cgst_percent = vals[5];
      result.cgst_amount = vals[6];
      result.sut_gst_percent = vals[7];
      result.sut_gst_amount = vals[8];
      result.total_amount = vals[9];
    } else {
      result.quantity = vals[0];
      result.product_rate = vals[1];
      result.taxable_amount = vals[2];
      result.cgst_percent = vals[3];
      result.cgst_amount = vals[4];
      result.sut_gst_percent = vals[5];
      result.sut_gst_amount = vals[6];
      result.cess_percent = vals[7];
      result.cess_amount = vals[8];
      result.total_amount = vals[9];
    }
  } else if (vals.length === 11) {
    // Standard GST with Cess, without Unit MRP
    result.quantity = vals[0];
    result.product_rate = vals[1];
    result.discount_percent = vals[2];
    result.taxable_amount = vals[3];
    result.cgst_percent = vals[4];
    result.cgst_amount = vals[5];
    result.sut_gst_percent = vals[6];
    result.sut_gst_amount = vals[7];
    result.cess_percent = vals[8];
    result.cess_amount = vals[9];
    result.total_amount = vals[10];
  } else if (vals.length === 12) {
    // With Unit MRP and Cess
    result.unit_mrp_rsp = vals[0];
    result.quantity = vals[1];
    result.product_rate = vals[2];
    result.discount_percent = vals[3];
    result.taxable_amount = vals[4];
    result.cgst_percent = vals[5];
    result.cgst_amount = vals[6];
    result.sut_gst_percent = vals[7];
    result.sut_gst_amount = vals[8];
    result.cess_percent = vals[9];
    result.cess_amount = vals[10];
    result.total_amount = vals[11];
  } else if (vals.length === 8) {
    // Qty, Rate, Taxable, CGST%, CGST Amt, SGST%, SGST Amt, Total (no discount)
    result.quantity = vals[0];
    result.product_rate = vals[1];
    result.taxable_amount = vals[2];
    result.cgst_percent = vals[3];
    result.cgst_amount = vals[4];
    result.sut_gst_percent = vals[5];
    result.sut_gst_amount = vals[6];
    result.total_amount = vals[7];
  } else {
    // Fallback right-to-left
    result.total_amount = vals[vals.length - 1] || 0;
    if (vals.length > 1) result.sut_gst_amount = vals[vals.length - 2] || 0;
    if (vals.length > 2) result.sut_gst_percent = vals[vals.length - 3] || 0;
    if (vals.length > 3) result.cgst_amount = vals[vals.length - 4] || 0;
    if (vals.length > 4) result.cgst_percent = vals[vals.length - 5] || 0;
    if (vals.length > 5) result.taxable_amount = vals[vals.length - 6] || 0;
    if (vals.length > 6) result.discount_percent = vals[vals.length - 7] || 0;
    if (vals.length > 7) result.product_rate = vals[vals.length - 8] || 0;
    if (vals.length > 8) result.quantity = vals[vals.length - 9] || 0;
  }

  // Recalculations and fallbacks for missing/garbled numbers
  if (result.taxable_amount === 0 && result.quantity > 0 && result.product_rate > 0) {
    const gross = result.quantity * result.product_rate;
    result.taxable_amount = gross - (gross * (result.discount_percent / 100));
  }
  if (result.cgst_amount === 0 && result.cgst_percent > 0 && result.taxable_amount > 0) {
    result.cgst_amount = result.taxable_amount * (result.cgst_percent / 100);
  }
  if (result.sut_gst_amount === 0 && result.sut_gst_percent > 0 && result.taxable_amount > 0) {
    result.sut_gst_amount = result.taxable_amount * (result.sut_gst_percent / 100);
  }
  if (result.cess_amount === 0 && result.cess_percent > 0 && result.taxable_amount > 0) {
    result.cess_amount = result.taxable_amount * (result.cess_percent / 100);
  }
  if (result.total_amount === 0 && result.taxable_amount > 0) {
    result.total_amount = result.taxable_amount + result.cgst_amount + result.sut_gst_amount + result.cess_amount;
  }

  // Round all numeric values to 2 decimals
  for (let key in result) {
    if (typeof result[key] === 'number') {
      result[key] = parseFloat(result[key].toFixed(2));
    }
  }

  return result;
}

function parseGSTInvoice(ocrText) {
  console.log("========== START GST INVOICE PARSING ==========");

  const result = {
    seller_information: {
      seller_name: "",
      seller_address: "",
      gstin: "",
      fssai_number: ""
    },
    invoice_information: {
      invoice_number: "",
      order_number: "",
      invoice_date: "",
      place_of_supply: ""
    },
    bill_to: {
      name: "",
      address: ""
    },
    ship_to: {
      name: "",
      address: ""
    },
    customer_name: "",
    items: [],
    summary: {
      total_net_amount: 0,
      total_discount_amount: 0,
      total_tax_amount: 0,
      grand_total: 0
    }
  };

  if (!ocrText || typeof ocrText !== "string") {
    return result;
  }

  const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean);

  let sellerNameCandidate = "";
  let sellerAddressLines = [];
  let currentSection = "SELLER"; // "SELLER", "BILL_TO", "SHIP_TO", "TABLE", "FOOTER"

  let tableStartIdx = -1;
  let tableEndIdx = -1;

  // Find table boundaries
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (tableStartIdx === -1) {
      if (lower.includes("description") || lower.includes("particulars") || lower.includes("item description") || (lower.includes("hsn") && lower.includes("qty"))) {
        tableStartIdx = i;
      }
    } else {
      if (lower.includes("total quantity") || lower.includes("grand total") || lower.includes("total:") || lower.includes("total quantity") || lower.includes("amount in words")) {
        tableEndIdx = i;
        break;
      }
    }
  }

  if (tableStartIdx === -1) tableStartIdx = 0;
  if (tableEndIdx === -1) tableEndIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Section transition updates
    if (lower.includes("bill to") || lower.includes("billed to") || lower.includes("buyer")) {
      currentSection = "BILL_TO";
      continue;
    }
    if (lower.includes("ship to") || lower.includes("shipped to") || lower.includes("delivery to")) {
      currentSection = "SHIP_TO";
      continue;
    }
    if (i > tableStartIdx && i < tableEndIdx) {
      currentSection = "TABLE";
    }
    if (i >= tableEndIdx) {
      currentSection = "FOOTER";
    }

    // 1. Seller Information
    if (currentSection === "SELLER") {
      // Find GSTIN
      if (!result.seller_information.gstin && lower.includes("gstin")) {
        const match = line.match(/([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/i);
        if (match) result.seller_information.gstin = match[1].toUpperCase();
      }
      // Find FSSAI
      if (!result.seller_information.fssai_number && (lower.includes("fssai") || lower.includes("lic"))) {
        const match = line.match(/(?:lic|no)[\s.:]*([0-9]{14})/i) || line.match(/([0-9]{14})/);
        if (match) result.seller_information.fssai_number = match[1];
      }
      // Name & Address heuristics: take early non-header lines
      if (!lower.includes("invoice") && !lower.includes("date") && !lower.includes("order") && !lower.includes("supply") && !lower.includes("gstin") && !lower.includes("fssai") && !lower.includes("lic") && !lower.includes("tax")) {
        if (!sellerNameCandidate) {
          sellerNameCandidate = line;
        } else if (sellerAddressLines.length < 3) {
          sellerAddressLines.push(line);
        }
      }
    }

    // 2. Invoice Details (Header fields)
    if (!result.invoice_information.invoice_number && (lower.includes("invoice no") || lower.includes("bill no") || lower.includes("inv no"))) {
      const match = line.match(/(?:invoice|bill|inv)\s*(?:no|number|num)?[\s.:]*([A-Z0-9-]+)/i);
      if (match) result.invoice_information.invoice_number = match[1];
    }
    if (!result.invoice_information.order_number && lower.includes("order no")) {
      const match = line.match(/order\s*(?:no|number|num)?[\s.:]*([A-Z0-9-]+)/i);
      if (match) result.invoice_information.order_number = match[1];
    }
    if (!result.invoice_information.invoice_date && (lower.includes("date") || lower.includes("dt"))) {
      const match = line.match(/(\d{2}[-./]\d{2}[-./]\d{4})/);
      if (match) result.invoice_information.invoice_date = match[1];
    }
    if (!result.invoice_information.place_of_supply && (lower.includes("place of supply") || lower.includes("supply state") || lower.includes("pos:"))) {
      const match = line.match(/(?:place\s*of\s*supply|pos)[\s.:]*([a-z\s]+)/i);
      if (match) result.invoice_information.place_of_supply = match[1].trim();
    }

    // 3. Bill To Details
    if (currentSection === "BILL_TO") {
      if (lower.includes("customer:") || lower.includes("name:")) {
        const match = line.match(/(?:customer|name)[\s.:]+(.*)/i);
        if (match) result.bill_to.name = match[1].trim();
      } else if (lower.includes("address:")) {
        const match = line.match(/address[\s.:]+(.*)/i);
        if (match) result.bill_to.address = match[1].trim();
      } else if (!result.bill_to.name && !lower.includes("bill to") && !lower.includes("gstin")) {
        result.bill_to.name = line;
      } else if (result.bill_to.name && !result.bill_to.address && !lower.includes("gstin")) {
        result.bill_to.address = line;
      }
      if (result.bill_to.name) {
        result.customer_name = result.bill_to.name;
      }
    }

    // 4. Ship To Details
    if (currentSection === "SHIP_TO") {
      if (lower.includes("customer:") || lower.includes("name:")) {
        const match = line.match(/(?:customer|name)[\s.:]+(.*)/i);
        if (match) result.ship_to.name = match[1].trim();
      } else if (lower.includes("address:")) {
        const match = line.match(/address[\s.:]+(.*)/i);
        if (match) result.ship_to.address = match[1].trim();
      } else if (!result.ship_to.name && !lower.includes("ship to") && !lower.includes("gstin")) {
        result.ship_to.name = line;
      } else if (result.ship_to.name && !result.ship_to.address && !lower.includes("gstin")) {
        result.ship_to.address = line;
      }
    }
  }

  // Fallbacks for Seller Name & Address
  if (sellerNameCandidate) result.seller_information.seller_name = sellerNameCandidate;
  if (sellerAddressLines.length > 0) result.seller_information.seller_address = sellerAddressLines.join(", ");

  // 5. Table Items parsing
  const tableLines = lines.slice(tableStartIdx + 1, tableEndIdx);
  const rowGroups = [];
  let currentGroup = null;

  for (const line of tableLines) {
    if (line.startsWith("---") || line.startsWith("===") || line.includes("____")) {
      continue;
    }
    // Check if it's the start of a row: starts with a serial number digit followed by spaces or vertical bars
    const isRowStart = /^\d+[\s|]+[A-Za-z]/i.test(line) || /^\d+\s*$/i.test(line);

    if (isRowStart) {
      if (currentGroup) {
        rowGroups.push(currentGroup);
      }
      currentGroup = [line];
    } else {
      if (currentGroup) {
        currentGroup.push(line);
      }
    }
  }
  if (currentGroup) {
    rowGroups.push(currentGroup);
  }

  const items = [];
  rowGroups.forEach(group => {
    const firstLine = group[0];
    const cleanFirstLine = firstLine.replace(/[|]/g, " ").replace(/\s+/g, " ").trim();
    const tokens = cleanFirstLine.split(" ").filter(Boolean);

    if (tokens.length < 2) return;

    const srNo = parseInt(tokens[0]);
    if (isNaN(srNo)) return;

    // Search for HSN index
    let hsnIdx = -1;
    let hsnCode = "";
    for (let idx = 1; idx < tokens.length; idx++) {
      if (/^\d{4,8}$/.test(tokens[idx])) {
        hsnIdx = idx;
        hsnCode = tokens[idx];
        break;
      }
    }

    let descriptionTokens = [];
    let numericTokens = [];

    if (hsnIdx !== -1) {
      descriptionTokens = tokens.slice(1, hsnIdx);
      numericTokens = tokens.slice(hsnIdx + 1);
    } else {
      // Find first numeric token where all subsequent are numeric
      let firstNumericIdx = -1;
      for (let idx = 1; idx < tokens.length; idx++) {
        if (isNumericToken(tokens[idx])) {
          let allSubsequentNumeric = true;
          for (let j = idx; j < tokens.length; j++) {
            if (!isNumericToken(tokens[j])) {
              allSubsequentNumeric = false;
              break;
            }
          }
          if (allSubsequentNumeric) {
            firstNumericIdx = idx;
            break;
          }
        }
      }
      if (firstNumericIdx !== -1) {
        descriptionTokens = tokens.slice(1, firstNumericIdx);
        numericTokens = tokens.slice(firstNumericIdx);
      } else {
        descriptionTokens = tokens.slice(1);
      }
    }

    let description = descriptionTokens.join(" ");
    if (group.length > 1) {
      for (let g = 1; g < group.length; g++) {
        description += " " + group[g].trim();
      }
    }
    description = description.replace(/[|]/g, "").replace(/\s+/g, " ").trim();

    const vals = numericTokens.map(t => parseCleanNumeric(t)).filter(v => v !== null);
    const allocated = allocateGSTColumns(vals);

    items.push({
      sr_no: String(srNo),
      item_description: description,
      unit_mrp_rsp: allocated.unit_mrp_rsp,
      hsn_code: hsnCode,
      quantity: allocated.quantity,
      product_rate: allocated.product_rate,
      discount_percent: allocated.discount_percent,
      taxable_amount: allocated.taxable_amount,
      cgst_percent: allocated.cgst_percent,
      sut_gst_percent: allocated.sut_gst_percent,
      cgst_amount: allocated.cgst_amount,
      sut_gst_amount: allocated.sut_gst_amount,
      cess_percent: allocated.cess_percent,
      cess_amount: allocated.cess_amount,
      total_amount: allocated.total_amount,

      // Frontend compatibility duplicate keys
      unit_mrp: allocated.unit_mrp_rsp,
      hsn: hsnCode,
      qty: allocated.quantity,
      discount_percentage: allocated.discount_percent,
      cgst_percentage: allocated.cgst_percent,
      sgst_percentage: allocated.sut_gst_percent,
      sgst_amount: allocated.sut_gst_amount,
      cess_percentage: allocated.cess_percent
    });
  });

  result.items = items;

  // Recalculate summary totals
  let totalNet = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let grandTotal = 0;

  items.forEach(item => {
    totalNet += item.taxable_amount || 0;
    // Discount amount calculation
    const gross = (item.quantity || 0) * (item.product_rate || 0);
    totalDiscount += gross * ((item.discount_percent || 0) / 100);
    totalTax += (item.cgst_amount || 0) + (item.sut_gst_amount || 0) + (item.cess_amount || 0);
    grandTotal += item.total_amount || 0;
  });

  result.summary = {
    total_net_amount: parseFloat(totalNet.toFixed(2)),
    total_discount_amount: parseFloat(totalDiscount.toFixed(2)),
    total_tax_amount: parseFloat(totalTax.toFixed(2)),
    grand_total: parseFloat(grandTotal.toFixed(2))
  };

  // Find footer grand total if present
  let footerGrandTotal = null;
  for (const line of lines) {
    if (line.toLowerCase().includes("grand total") || line.toLowerCase().includes("total:")) {
      const match = line.match(/(?:INR|Rs\.?|Total)?\s*([\d,]+\.\d{2})/i);
      if (match) {
        footerGrandTotal = parseFloat(match[1].replace(/,/g, ""));
      }
    }
  }
  if (footerGrandTotal !== null) {
    result.summary.grand_total = footerGrandTotal;
  }

  console.log("========== GST EXTRACTION JSON RESULT ==========");
  console.log(JSON.stringify(result, null, 2));

  return result;
}

module.exports = { parseGSTInvoice };
