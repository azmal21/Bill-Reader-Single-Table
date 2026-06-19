/**
 * gstController.js
 */
const fs = require('fs');
const path = require('path');
const { preprocessImage } = require('../utils/imagePreprocessor');
const { performOCR } = require('../services/ocrService');
const { parseGSTInvoice } = require('../utils/gstParser');
const pool = require('../db');

const extractGSTInvoice = async (req, res) => {
  console.log("🎯 [DEBUG] HIT /api/gst/extract");
  if (!req.file) {
    console.log("❌ [DEBUG] No file uploaded");
    return res.status(400).json({ success: false, error: 'No image uploaded' });
  }

  console.log(`📁 [DEBUG] File path: ${req.file.path}`);
  const filePath = req.file.path;
  const processedPath = `${filePath}-processed.jpg`;

  try {
    await preprocessImage(filePath, processedPath);
    const pass1Result = await performOCR(processedPath);
    
    const startTime = Date.now();
    const finalParsedInvoice = parseGSTInvoice(pass1Result.text);
    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`⚡ GST Extraction completed in ${executionTime}s`);

    return res.status(200).json({
      success: true,
      rawText: pass1Result.text,
      parsedData: finalParsedInvoice,
      metadata: { confidenceScore: pass1Result.confidence }
    });
  } catch (err) {
    console.error("GST Extraction Error:", err);
    return res.status(500).json({ success: false, error: 'Extraction failed', details: err.message });
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(processedPath)) fs.unlinkSync(processedPath);
  }
};

const saveGSTInvoice = async (req, res) => {
  console.log("🎯 [DEBUG] HIT /api/gst/save");
  let { invoice, items, rawText } = req.body;

  if (!invoice && !items) {
    items = req.body.items;
    rawText = req.body.rawText || req.body.raw_ocr_text;
    invoice = req.body;
  }

  if (!invoice) {
    return res.status(400).json({ success: false, error: 'No invoice data provided' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const invoiceQuery = `
      INSERT INTO gst_invoices (
        seller_name, seller_address, gstin, fssai, invoice_number, order_number, invoice_date, place_of_supply, customer_name,
        bill_to_name, bill_to_address, ship_to_name, ship_to_address,
        total_net_amount, total_discount_amount, total_tax_amount, grand_total, raw_ocr_text
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING id
    `;

    const invoiceValues = [
      invoice.seller_information?.seller_name || invoice.seller_name || null,
      invoice.seller_information?.seller_address || invoice.seller_address || null,
      invoice.seller_information?.gstin || invoice.gstin || null,
      invoice.seller_information?.fssai_number || invoice.seller_information?.fssai || invoice.fssai || null,
      invoice.invoice_information?.invoice_number || invoice.invoice_number || null,
      invoice.invoice_information?.order_number || invoice.order_number || null,
      invoice.invoice_information?.invoice_date || invoice.invoice_date || null,
      invoice.invoice_information?.place_of_supply || invoice.place_of_supply || null,
      invoice.customer_name || invoice.bill_to?.name || invoice.bill_to_name || null,
      invoice.bill_to?.name || invoice.bill_to_name || null,
      invoice.bill_to?.address || invoice.bill_to_address || null,
      invoice.ship_to?.name || invoice.ship_to_name || null,
      invoice.ship_to?.address || invoice.ship_to_address || null,
      invoice.summary?.total_net_amount || invoice.total_net_amount || 0,
      invoice.summary?.total_discount_amount || invoice.total_discount_amount || 0,
      invoice.summary?.total_tax_amount || invoice.total_tax_amount || 0,
      invoice.summary?.grand_total || invoice.grand_total || 0,
      rawText || null
    ];


    const result = await client.query(invoiceQuery, invoiceValues);
    const invoiceId = result.rows[0].id;

    if (items && Array.isArray(items)) {
      for (const item of items) {
        const itemQuery = `
          INSERT INTO gst_invoice_items (
            invoice_id, sr_no, item_description, unit_mrp_rsp, hsn_code, quantity, product_rate,
            discount_percent, taxable_amount, cgst_percent, sut_gst_percent, cgst_amount, sut_gst_amount,
            cess_percent, cess_amount, total_amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `;
        const itemValues = [
          invoiceId,
          item.sr_no || null,
          item.item_description || null,
          item.unit_mrp_rsp ?? item.unit_mrp ?? 0,
          item.hsn_code ?? item.hsn ?? null,
          item.quantity ?? item.qty ?? 0,
          item.product_rate ?? 0,
          item.discount_percent ?? item.discount_percentage ?? 0,
          item.taxable_amount ?? 0,
          item.cgst_percent ?? item.cgst_percentage ?? 0,
          item.sut_gst_percent ?? item.sgst_percentage ?? 0,
          item.cgst_amount ?? 0,
          item.sut_gst_amount ?? item.sgst_amount ?? 0,
          item.cess_percent ?? item.cess_percentage ?? 0,
          item.cess_amount ?? 0,
          item.total_amount ?? 0
        ];
        await client.query(itemQuery, itemValues);
      }
    }

    await client.query('COMMIT');
    return res.status(200).json({ success: true, invoiceId, message: 'GST Invoice Saved Successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Save GST Invoice Error:", err);
    return res.status(500).json({ success: false, error: 'Database save failed', details: err.message });
  } finally {
    client.release();
  }
};

const getGSTInvoices = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM gst_invoices ORDER BY created_at DESC');
    return res.status(200).json({ success: true, invoices: result.rows });
  } catch (err) {
    console.error("Get GST Invoices Error:", err);
    return res.status(500).json({ success: false, error: 'Failed to fetch invoices', details: err.message });
  }
};

const getGSTInvoiceById = async (req, res) => {
  const { id } = req.params;
  try {
    const invoiceRes = await pool.query('SELECT * FROM gst_invoices WHERE id = $1', [id]);
    if (invoiceRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    const itemsRes = await pool.query('SELECT * FROM gst_invoice_items WHERE invoice_id = $1 ORDER BY id ASC', [id]);
    return res.status(200).json({
      success: true,
      invoice: invoiceRes.rows[0],
      items: itemsRes.rows
    });
  } catch (err) {
    console.error("Get GST Invoice By ID Error:", err);
    return res.status(500).json({ success: false, error: 'Failed to fetch invoice details', details: err.message });
  }
};

const deleteGSTInvoice = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM gst_invoices WHERE id = $1', [id]);
    return res.status(200).json({ success: true, message: 'Invoice deleted successfully' });
  } catch (err) {
    console.error("Delete GST Invoice Error:", err);
    return res.status(500).json({ success: false, error: 'Failed to delete invoice', details: err.message });
  }
};

module.exports = {
  extractGSTInvoice, saveGSTInvoice, getGSTInvoices, getGSTInvoiceById, deleteGSTInvoice
};

