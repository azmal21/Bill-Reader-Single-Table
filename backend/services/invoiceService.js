/**
 * invoiceService.js
 * Service layer for handling invoice data validation and PostgreSQL database queries.
 */

const pool = require('../db');
const { formatMonetary, validateGST, validateAndNormalizeDate } = require('../utils/parserRules');

/**
 * Validates and sanitizes invoice data before saving to the database.
 * Rules:
 * - Quantity, prices, tax percentages must be numeric.
 * - Null/undefined/NaN numeric values should become 0.
 * - Empty strings should become null.
 * - Prevent database numeric overflow (clamp numbers).
 * - Round monetary values to 2 decimals.
 * @param {object} invoice - The invoice header data.
 * @param {Array} items - List of invoice items.
 * @returns {object} - The sanitized invoice and items.
 */
function sanitizeAndValidate(invoice, items) {
  const sanitizedInvoice = {};
  const validationErrors = [];

  // Helper: Empty strings to null, trim others
  const cleanString = (val) => {
    if (val === null || val === undefined || String(val).trim() === '') return null;
    return String(val).trim();
  };

  // Helper: Validate and format numbers, nulls become 0
  const cleanNumber = (val, maxVal = 999999999.99) => {
    if (val === null || val === undefined || val === '') return 0;
    let num = parseFloat(val);
    if (isNaN(num)) return 0;
    // Round to 2 decimals and prevent overflow
    num = parseFloat(num.toFixed(2));
    if (num > maxVal) return maxVal;
    if (num < -maxVal) return -maxVal;
    return num;
  };

  // Header Sanitization
  sanitizedInvoice.vendor_name = cleanString(invoice.vendor_name || invoice.supplier_name);
  sanitizedInvoice.invoice_number = cleanString(invoice.invoice_number);

  // Validate and normalize Invoice Date
  const rawDate = invoice.invoice_date || invoice.invoiceDate;
  const normDate = validateAndNormalizeDate(rawDate);
  if (!normDate) {
    validationErrors.push(`Invalid invoice date format: ${rawDate}`);
  }
  sanitizedInvoice.invoice_date = normDate || cleanString(rawDate); // fallback to raw string if completely invalid

  // Validate GST format
  const rawGst = invoice.gst_number || invoice.gstNumber;
  const validGst = validateGST(rawGst);
  if (!validGst && rawGst) {
    validationErrors.push(`Invalid GST format: ${rawGst}`);
  }
  sanitizedInvoice.gst_number = validGst || cleanString(rawGst);

  sanitizedInvoice.subtotal = cleanNumber(invoice.subtotal || invoice.netAmount);
  sanitizedInvoice.total_tax = cleanNumber(invoice.total_tax || invoice.taxAmount || invoice.totalTax);
  sanitizedInvoice.grand_total = cleanNumber(invoice.grand_total || invoice.grandTotal);
  sanitizedInvoice.raw_ocr_text = cleanString(invoice.raw_ocr_text || invoice.rawText);

  // Additional fields for frontend compatibility
  sanitizedInvoice.customer_name = cleanString(invoice.customer_name || invoice.customerName);
  sanitizedInvoice.customer_code = cleanString(invoice.customer_code || invoice.customerCode);
  sanitizedInvoice.supplier_name = sanitizedInvoice.vendor_name;
  sanitizedInvoice.supplier_address = cleanString(invoice.supplier_address || invoice.storeAddress);
  sanitizedInvoice.pan_number = cleanString(invoice.pan_number || invoice.panNumber);
  sanitizedInvoice.state = cleanString(invoice.state);

  // Items Sanitization
  const sanitizedItems = (items || []).map((item, idx) => {
    const qty = cleanNumber(item.quantity ?? item.qty);
    const unitPrice = cleanNumber(item.unit_price ?? item.unitPrice ?? item.netAmount);
    const discount = cleanNumber(item.discount ?? item.discount_amount ?? item.discountAmount);

    // Taxable amount is netAmount - discount
    let taxableAmount = cleanNumber(item.taxable_amount ?? item.netDiscountAmount);
    if (taxableAmount === 0 && unitPrice > 0) {
      taxableAmount = cleanNumber((unitPrice * qty) - discount);
    }

    const taxPercent = cleanNumber(item.tax_percent ?? item.tax_percentage ?? item.taxPercent, 100);
    const taxAmount = cleanNumber(item.tax_amount ?? item.taxAmount);
    const totalAmount = cleanNumber(item.total_amount ?? item.totalAmountIncludingGST);

    const articleName = cleanString(item.item_name || item.article_name || item.articleName);
    if (!articleName) {
      validationErrors.push(`Item at row ${idx + 1} is missing an article name.`);
    }

    return {
      article_code: cleanString(item.article_code || item.articleCode),
      article_name: articleName,
      hsn_code: cleanString(item.hsn_code || item.hsnCode),
      quantity: qty,
      pack_size: cleanString(item.pack_size || item.packSize) || '1',
      net_amount: cleanNumber(item.net_amount ?? item.netAmount ?? (unitPrice * qty)),
      discount_amount: discount,
      taxable_amount: taxableAmount,
      tax_percent: taxPercent,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      status: item.status || 'valid',

      // Keep frontend duplicate names to allow seamless saves
      qty: qty,
      net_discount_amount: taxableAmount,
      tax_percentage: taxPercent,
      total_amount_including_gst: totalAmount
    };
  });

  return {
    invoice: sanitizedInvoice,
    items: sanitizedItems,
    validationErrors
  };
}

/**
 * Saves a validated invoice and its items to PostgreSQL.
 * Uses a database transaction to ensure atomicity.
 * @param {object} rawInvoice - The raw invoice header.
 * @param {Array} rawItems - The raw list of items.
 * @returns {Promise<object>} - Saved invoice and items.
 */
async function saveInvoiceToDB(rawInvoice, rawItems) {
  const client = await pool.connect();
  try {
    const { invoice, items, validationErrors } = sanitizeAndValidate(rawInvoice, rawItems);

    if (validationErrors.length > 0) {
      console.warn('⚠️ Validation issues before DB save:', validationErrors);
    }

    if (!invoice.invoice_number) {
      throw new Error("Invoice number is required to save.");
    }

    await client.query('BEGIN');

    // 1. Insert Invoice Header
    const invoiceQuery = `
      INSERT INTO invoices (
        vendor_name, invoice_number, invoice_date, gst_number, subtotal, total_tax, grand_total, raw_ocr_text,
        customer_name, customer_code, supplier_name, supplier_address, pan_number, state
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *;
    `;
    const invoiceValues = [
      invoice.vendor_name,
      invoice.invoice_number,
      invoice.invoice_date,
      invoice.gst_number,
      invoice.subtotal,
      invoice.total_tax,
      invoice.grand_total,
      invoice.raw_ocr_text,
      invoice.customer_name,
      invoice.customer_code,
      invoice.supplier_name,
      invoice.supplier_address,
      invoice.pan_number,
      invoice.state
    ];

    const invoiceResult = await client.query(invoiceQuery, invoiceValues);
    const savedInvoice = invoiceResult.rows[0];

    // 2. Insert Invoice Items
    const savedItems = [];
    for (const item of items) {


      const itemQuery = `
        INSERT INTO invoice_items (
          invoice_id, article_code, article_name, hsn_code, quantity, pack_size,
          net_amount, discount_amount, taxable_amount, tax_percent, tax_amount, total_amount,
          qty, net_discount_amount, tax_percentage, total_amount_including_gst
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *;
      `;
      const itemValues = [
        savedInvoice.id,
        item.article_code,
        item.article_name,
        item.hsn_code,
        item.quantity,
        item.pack_size,
        item.net_amount,
        item.discount_amount,
        item.taxable_amount,
        item.tax_percent,
        item.tax_amount,
        item.total_amount,
        item.qty,
        item.net_discount_amount,
        item.tax_percentage,
        item.total_amount_including_gst
      ];
      const itemResult = await client.query(itemQuery, itemValues);
      savedItems.push({
        ...itemResult.rows[0],
        status: 'valid'
      });
    }

    await client.query('COMMIT');
    return {
      success: true,
      invoice: savedInvoice,
      items: savedItems,
      validation_errors: validationErrors
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Database transaction rolled back:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Retrieves all saved invoices.
 * @returns {Promise<Array>} - List of invoices.
 */
async function getAllInvoicesFromDB() {
  const query = `
    SELECT id, invoice_number, invoice_date, customer_name, customer_code,
           supplier_name, supplier_address, gst_number, pan_number, state,
           grand_total, created_at, vendor_name, subtotal, total_tax, raw_ocr_text
    FROM invoices
    ORDER BY created_at DESC;
  `;
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Retrieves a single invoice header by ID.
 * @param {number} id - Invoice ID.
 * @returns {Promise<object|null>} - Invoice header.
 */
async function getInvoiceByIdFromDB(id) {
  const query = `SELECT * FROM invoices WHERE id = $1;`;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

/**
 * Retrieves all items for a given invoice.
 * @param {number} invoiceId - Invoice ID.
 * @returns {Promise<Array>} - List of items.
 */
async function getInvoiceItemsFromDB(invoiceId) {
  const query = `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id ASC;`;
  const result = await pool.query(query, [invoiceId]);
  return result.rows;
}

/**
 * Deletes an invoice and all its cascade-referenced items.
 * @param {number} id - Invoice ID.
 * @returns {Promise<boolean>} - True if deleted, false if not found.
 */
async function deleteInvoiceFromDB(id) {
  const result = await pool.query('DELETE FROM invoices WHERE id = $1 RETURNING *;', [id]);
  return result.rowCount > 0;
}

module.exports = {
  sanitizeAndValidate,
  saveInvoiceToDB,
  getAllInvoicesFromDB,
  getInvoiceByIdFromDB,
  getInvoiceItemsFromDB,
  deleteInvoiceFromDB
};
