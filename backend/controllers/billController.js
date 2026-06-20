const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { performOCR } = require('../services/ocrService');
const { detectBillType } = require('../utils/classifier');
const { parseMetroInvoice } = require('../utils/metroParser');
const { parseGstInvoice } = require('../utils/gstParser');
const { parseRetailInvoice } = require('../utils/retailParser');
const { parseBillRegex, cleanOcrText } = require('../utils/restaurantParser');
const billService = require('../services/billService');

const extractBill = async (req, res) => {
  const startTime = Date.now();

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No image file uploaded.' });
  }

  const filePath = req.file.path;
  const processedPath = `${filePath}-processed.jpg`;

  try {
    // 1. Preprocess
    await sharp(filePath)
      .rotate()
      .resize({ width: 1500, fit: 'inside', withoutEnlargement: true })
      .grayscale()
      .normalize()
      .sharpen()
      .toFile(processedPath);

    // 2. OCR
    const ocrResult = await performOCR(processedPath);
    const rawText = ocrResult.text;

    // 3. Classify
    const billType = detectBillType(rawText);

    // 4. Parse & Map to Unified Schema
    let unifiedBill = {
      bill_type: billType,
      document_number: '',
      bill_date: '',
      vendor_name: '',
      grand_total: 0,
      item_count: 0,
      metadata: { confidence: ocrResult.confidence, raw_text: rawText }
    };
    let unifiedItems = [];

    if (billType === 'metro') {
      const parsed = parseMetroInvoice(rawText);
      unifiedBill.document_number = parsed.invoice.invoice_number || '';
      unifiedBill.bill_date = parsed.invoice.invoice_date || '';
      unifiedBill.vendor_name = parsed.invoice.vendor_name || 'METRO Cash and Carry';
      unifiedBill.grand_total = parsed.invoice.grand_total || 0;
      unifiedBill.metadata.customer_name = parsed.invoice.customer_name;
      unifiedBill.metadata.gst_number = parsed.invoice.gst_number;
      
      unifiedItems = parsed.items.map(item => ({
        item_code: item.article_code || '',
        item_name: item.article_name || '',
        quantity: item.quantity || 0,
        unit_price: (item.net_amount && item.quantity) ? (item.net_amount / item.quantity) : 0,
        discount_amount: item.discount_amount || 0,
        tax_percent: item.tax_percent || 0,
        tax_amount: item.tax_amount || 0,
        line_total: item.total_amount || 0,
        status: item.validation_status || 'valid'
      }));
    } else if (billType === 'gst') {
      const parsed = parseGstInvoice(rawText);
      unifiedBill.document_number = parsed.invoice.invoice_number || '';
      unifiedBill.bill_date = parsed.invoice.invoice_date || '';
      unifiedBill.vendor_name = parsed.invoice.seller_name || '';
      unifiedBill.grand_total = parsed.invoice.grand_total || 0;
      unifiedBill.metadata.gstin = parsed.invoice.gstin;
      
      unifiedItems = parsed.items.map(item => ({
        item_code: item.hsn_code || '',
        item_name: item.item_description || '',
        quantity: item.quantity || 0,
        unit_price: item.product_rate || 0,
        discount_amount: item.discount_amount || 0,
        tax_percent: (item.cgst_percent || 0) + (item.sut_gst_percent || 0),
        tax_amount: (item.cgst_amount || 0) + (item.sut_gst_amount || 0),
        line_total: item.total_amount || 0
      }));
    } else if (billType === 'retail') {
      const parsed = parseRetailInvoice(rawText);
      unifiedBill.document_number = parsed.invoice.invoice_number || '';
      unifiedBill.bill_date = parsed.invoice.invoice_date || '';
      unifiedBill.vendor_name = parsed.invoice.vendor_name || '';
      unifiedBill.grand_total = parsed.invoice.grand_total || 0;
      
      unifiedItems = parsed.items.map(item => ({
        item_code: item.article_code || '',
        item_name: item.article_name || '',
        quantity: item.quantity || 0,
        unit_price: item.net_amount / (item.quantity || 1) || 0,
        discount_amount: item.discount_amount || 0,
        tax_percent: item.tax_percent || 0,
        tax_amount: item.tax_amount || 0,
        line_total: item.total_amount || 0
      }));
    } else {
      // restaurant
      const cleanedText = cleanOcrText(rawText);
      const parsed = parseBillRegex(cleanedText);
      unifiedBill.vendor_name = parsed.restaurantName || '';
      unifiedBill.grand_total = parsed.grandTotal || 0;
      unifiedBill.metadata.sgst = parsed.sgst;
      unifiedBill.metadata.cgst = parsed.cgst;
      
      unifiedItems = parsed.items.map(item => ({
        item_name: item.name || '',
        quantity: item.quantity || 0,
        unit_price: item.itemRate || 0,
        line_total: item.total || 0
      }));
    }

    unifiedBill.item_count = unifiedItems.length;

    const extractionTime = ((Date.now() - startTime) / 1000).toFixed(2);

    return res.status(200).json({
      success: true,
      billData: unifiedBill,
      items: unifiedItems,
      rawText: rawText,
      extractionTime: extractionTime + 's'
    });

  } catch (error) {
    console.error('Extraction error:', error);
    return res.status(500).json({ success: false, error: 'Failed to extract bill.', details: error.message });
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(processedPath)) fs.unlinkSync(processedPath);
  }
};

const saveBill = async (req, res) => {
  try {
    const { billData, items } = req.body;
    
    // Provide defaults for db
    if (!billData.grand_total) billData.grand_total = 0;
    
    const saved = await billService.saveBill(billData, items);
    return res.status(200).json({ success: true, ...saved });
  } catch (error) {
    console.error('Error in saveBill:', error);
    return res.status(500).json({ success: false, error: 'Failed to save bill.' });
  }
};

const getBills = async (req, res) => {
  try {
    const bills = await billService.getAllBills();
    return res.status(200).json({ success: true, bills });
  } catch (error) {
    console.error('Error in getBills:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch bills.' });
  }
};

const getBillById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await billService.getBillById(id);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Bill not found.' });
    }
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('Error in getBillById:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch bill.' });
  }
};

const deleteBill = async (req, res) => {
  try {
    const { id } = req.params;
    const success = await billService.deleteBill(id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Bill not found.' });
    }
    return res.status(200).json({ success: true, message: 'Bill deleted.' });
  } catch (error) {
    console.error('Error in deleteBill:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete bill.' });
  }
};

module.exports = {
  extractBill,
  saveBill,
  getBills,
  getBillById,
  deleteBill
};
