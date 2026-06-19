/**
 * retailController.js
 * Controller layer for the Retail Invoice Extractor.
 */

const fs = require('fs');
const path = require('path');
const { preprocessImage } = require('../utils/imagePreprocessor');
const { performOCR, getActiveJobsCount } = require('../services/ocrService');
const { parseRetailInvoice } = require('../utils/retailParser');
const {
  saveInvoiceToDB,
  getAllInvoicesFromDB,
  getInvoiceByIdFromDB,
  getInvoiceItemsFromDB,
  deleteInvoiceFromDB
} = require('../services/invoiceService');

const uploadRetailInvoice = async (req, res) => {
  const startTime = Date.now();

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No invoice file uploaded.' });
  }

  const filePath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();

  let preprocessedPath = null;
  let tesseractText = '';
  let confidenceScore = 0;
  let finalParsedInvoice = null;

  try {
    if (ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      const pdfBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(pdfBuffer);
      tesseractText = pdfData.text;
      confidenceScore = 100;
    } else {
      preprocessedPath = `${filePath}-processed.jpg`;
      await preprocessImage(filePath, preprocessedPath);
      const pass1Result = await performOCR(preprocessedPath);
      tesseractText = pass1Result.text;
      confidenceScore = pass1Result.confidence;
    }

    finalParsedInvoice = parseRetailInvoice(tesseractText);

    // Build the mapped response
    const parsedData = {
      ...finalParsedInvoice
    };

    return res.status(200).json({
      success: true,
      rawText: tesseractText,
      parsedData,
      metadata: {
        confidenceScore,
        systemMetrics: {
          activeOCRJobs: getActiveJobsCount()
        }
      }
    });

  } catch (err) {
    console.error('❌ Controller Error in uploadRetailInvoice:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to extract and parse retail invoice.',
      details: err.message,
    });
  } finally {
    try {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      if (preprocessedPath && fs.existsSync(preprocessedPath)) fs.unlinkSync(preprocessedPath);
    } catch (cleanupErr) {
      console.error('⚠️ Failed to delete temporary files:', cleanupErr.message);
    }
  }
};

const getRetailInvoices = async (req, res) => {
  try {
    const invoices = await getAllInvoicesFromDB();
    return res.status(200).json({ success: true, invoices });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve retail invoices.' });
  }
};

const getRetailInvoiceById = async (req, res) => {
  const { id } = req.params;
  try {
    const invoice = await getInvoiceByIdFromDB(id);
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found.' });
    const items = await getInvoiceItemsFromDB(id);
    return res.status(200).json({ success: true, invoice, items });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve invoice.' });
  }
};

const saveRetailInvoice = async (req, res) => {
  try {
    const rawData = req.body;
    
    // Map Retail JSON to Database Schema structure
    const invoiceHeader = {
      vendor_name: rawData.sellerName || 'Unknown Seller',
      invoice_number: rawData.invoiceNumber,
      invoice_date: rawData.invoiceDate,
      gst_number: rawData.gstNumber,
      subtotal: rawData.netAmount,
      total_tax: rawData.taxAmount,
      grand_total: rawData.grandTotal,
      customer_name: rawData.billTo,
      supplier_name: rawData.sellerName,
      supplier_address: rawData.sellerAddress,
      state: rawData.placeOfSupply
    };

    const items = (rawData.items || []).map(item => ({
      article_code: item.srNo ? String(item.srNo) : '',
      article_name: item.itemDescription,
      hsn_code: item.hsnCode,
      quantity: item.qty,
      net_amount: item.totalAmount, 
      taxable_amount: item.taxableAmount,
      tax_amount: (item.cgstAmount || 0) + (item.sgstAmount || 0) + (item.cessAmount || 0),
      tax_percent: (item.cgstPercent || 0) + (item.sgstPercent || 0),
      total_amount: item.totalAmount
    }));

    const savedData = await saveInvoiceToDB(invoiceHeader, items);
    return res.status(200).json(savedData);
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to save retail invoice.', details: err.message });
  }
};

const deleteRetailInvoice = async (req, res) => {
  const { id } = req.params;
  try {
    const success = await deleteInvoiceFromDB(id);
    if (!success) return res.status(404).json({ success: false, error: 'Invoice not found.' });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to delete retail invoice.' });
  }
};

module.exports = {
  uploadRetailInvoice,
  getRetailInvoices,
  getRetailInvoiceById,
  saveRetailInvoice,
  deleteRetailInvoice
};
