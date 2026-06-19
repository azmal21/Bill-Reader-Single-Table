/**
 * retailParser.js
 * Extractor for generic retail invoices.
 */

function parseRetailInvoice(rawText) {
  console.log("========== RETAIL INVOICE RAW OCR ==========");
  console.log(rawText);

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  const invoice = {
    invoiceNumber: null,
    invoiceDate: null,
    sellerName: null,
    sellerAddress: null,
    gstNumber: null,
    fssaiNumber: null,
    orderNumber: null,
    placeOfSupply: null,
    billTo: null,
    shipTo: null,
    netAmount: 0,
    taxAmount: 0,
    grandTotal: 0,
    itemCount: 0,
    items: []
  };

  // Basic Header Extraction
  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    if (!invoice.invoiceNumber && /(?:invoice\s*no|invoice\s*number|bill\s*no)[\s.:]*([a-zA-Z0-9/-]+)/i.test(line)) {
      invoice.invoiceNumber = line.match(/(?:invoice\s*no|invoice\s*number|bill\s*no)[\s.:]*([a-zA-Z0-9/-]+)/i)[1];
    }
    if (!invoice.invoiceDate && /(?:date|invoice\s*date)[\s.:]*(\d{2}[-/.]\d{2}[-/.]\d{2,4})/i.test(line)) {
      invoice.invoiceDate = line.match(/(?:date|invoice\s*date)[\s.:]*(\d{2}[-/.]\d{2}[-/.]\d{2,4})/i)[1];
    }
    if (!invoice.gstNumber && /(?:gstin|gst\s*number|gst\s*no)[\s.:]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/i.test(line)) {
      invoice.gstNumber = line.match(/(?:gstin|gst\s*number|gst\s*no)[\s.:]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/i)[1].toUpperCase();
    }
    if (!invoice.fssaiNumber && /fssai[\s.:]*([0-9]{14})/i.test(line)) {
      invoice.fssaiNumber = line.match(/fssai[\s.:]*([0-9]{14})/i)[1];
    }
    if (!invoice.orderNumber && /(?:order\s*no|order\s*number)[\s.:]*([a-zA-Z0-9/-]+)/i.test(line)) {
      invoice.orderNumber = line.match(/(?:order\s*no|order\s*number)[\s.:]*([a-zA-Z0-9/-]+)/i)[1];
    }
    if (!invoice.placeOfSupply && /(?:place\s*of\s*supply)[\s.:]*([a-zA-Z\s]+)/i.test(line)) {
      invoice.placeOfSupply = line.match(/(?:place\s*of\s*supply)[\s.:]*([a-zA-Z\s]+)/i)[1].trim();
    }
  }

  // Seller name heuristic: First non-empty line could be seller name
  if (lines.length > 0 && !lines[0].toLowerCase().includes('tax invoice')) {
    invoice.sellerName = lines[0];
    if (lines.length > 1 && !lines[1].toLowerCase().includes('invoice')) {
       invoice.sellerAddress = lines[1];
    }
  }

  // Item extraction heuristic
  let inTable = false;
  lines.forEach((line) => {
    const lower = line.toLowerCase();
    
    // Start of table heuristic
    if (lower.includes('qty') || lower.includes('quantity') || lower.includes('description') || lower.includes('particulars')) {
      inTable = true;
      return;
    }

    if (inTable) {
      // End of table heuristic
      if (lower.includes('total') || lower.includes('amount in words') || lower.includes('bank details')) {
        inTable = false;
        
        if (lower.includes('total')) {
           // Attempt to extract totals from footer
           const nums = line.match(/\b\d+\.\d{2}\b/g);
           if (nums && nums.length > 0) {
              invoice.grandTotal = parseFloat(nums[nums.length - 1]);
           }
        }
        return;
      }

      // Simple row extraction: look for something that ends with numbers
      const tokens = line.split(/\s+/);
      const isNumeric = (str) => !isNaN(parseFloat(str.replace(/,/g, '')));
      
      // If the last few tokens are numeric, it's likely a row
      if (tokens.length >= 3 && isNumeric(tokens[tokens.length - 1]) && isNumeric(tokens[tokens.length - 2])) {
         
         const parseNum = (str) => parseFloat((str || '').replace(/[^0-9.-]+/g, '')) || 0;
         
         // Extract backwards
         const totalAmount = parseNum(tokens.pop());
         const taxAmtOrRate = parseNum(tokens.pop());
         const qty = parseNum(tokens.pop());
         
         const description = tokens.join(' ');

         invoice.items.push({
            srNo: invoice.items.length + 1,
            itemDescription: description,
            unitMrp: 0,
            hsnCode: '',
            qty: qty,
            productRate: 0,
            discountPercent: 0,
            taxableAmount: 0,
            cgstPercent: 0,
            sgstPercent: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            cessPercent: 0,
            cessAmount: 0,
            totalAmount: totalAmount
         });
      }
    }
  });

  invoice.itemCount = invoice.items.length;

  // Calculate Totals if not found
  let calcTotal = 0;
  invoice.items.forEach(item => {
     calcTotal += item.totalAmount;
  });

  if (!invoice.grandTotal || Math.abs(invoice.grandTotal - calcTotal) > 5) {
      invoice.grandTotal = calcTotal;
  }
  
  invoice.netAmount = calcTotal; // Simplify for now

  console.log("Extracted Header Fields:", {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      sellerName: invoice.sellerName,
      grandTotal: invoice.grandTotal
  });
  console.log("Extracted Item Rows:", invoice.items.length);
  console.log("Final JSON:", invoice);

  return invoice;
}

module.exports = {
  parseRetailInvoice
};
