/**
 * metroController.js
 * Controller layer for the Metro Wholesale Invoice OCR Extraction System.
 * Coordinates Sharp preprocessing, Tesseract OCR, parsing, validation, and persistence.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { preprocessImage } = require('../utils/imagePreprocessor');
const { performOCR, getActiveJobsCount } = require('../services/ocrService');
const { parseMetroInvoice } = require('../utils/metroParser');
const {
  saveInvoiceToDB,
  getAllInvoicesFromDB,
  getInvoiceByIdFromDB,
  getInvoiceItemsFromDB,
  deleteInvoiceFromDB
} = require('../services/invoiceService');

/**
 * Dynamic crop of the table area based on Pass 1 coordinates.
 */
async function cropTableArea(imagePath, words, imageWidth, imageHeight) {
  let headerY = -1;
  let footerY = -1;

  for (const word of words) {
    const text = word.text.toLowerCase();
    const y = word.bbox.y0;

    // Look for header keywords
    if (text.includes('description') || text.includes('article') || text.includes('hsn') || text.includes('particulars')) {
      if (headerY === -1 || y < headerY) {
        headerY = y;
      }
    }

    // Look for footer keywords
    if (y > imageHeight * 0.3) {
      if (text === 'total' || text === 'packs' || text === 'grand' || text === 'thank') {
        if (footerY === -1 || y < footerY) {
          footerY = y;
        }
      }
    }
  }

  // Fallbacks if not found
  if (headerY === -1) {
    headerY = Math.round(imageHeight * 0.25);
  }
  if (footerY === -1) {
    footerY = Math.round(imageHeight * 0.85);
  }

  // Add safety margins
  const top = Math.max(0, headerY - 50);
  const bottom = Math.min(imageHeight, footerY + 50);
  const height = bottom - top;

  if (height <= 0) {
    return { croppedPath: imagePath, headerY, footerY };
  }

  const croppedPath = imagePath.replace(/\.[^/.]+$/, "") + '-cropped.jpg';
  await sharp(imagePath)
    .extract({ left: 0, top: top, width: imageWidth, height: height })
    .toFile(croppedPath);

  console.log(`[CROP] Cropped table area from Y=${top} to Y=${bottom} (height=${height}). Saved to ${croppedPath}`);
  return { croppedPath, headerY, footerY };
}

/**
 * Reconstruct lines from Tesseract words array using Y (rows) and X (columns) coordinates.
 */
function reconstructLinesFromWords(words) {
  if (!words || words.length === 0) return "";

  const cleanWords = words.filter(w => w.text && w.text.trim().length > 0);
  if (cleanWords.length === 0) return "";

  // Sort words by Y coordinate first to group line-by-line vertically
  cleanWords.sort((a, b) => {
    const ay = (a.bbox.y0 + a.bbox.y1) / 2;
    const by = (b.bbox.y0 + b.bbox.y1) / 2;
    return ay - by;
  });

  const rows = [];

  for (const word of cleanWords) {
    const wy0 = word.bbox.y0;
    const wy1 = word.bbox.y1;
    const wh = wy1 - wy0;
    if (wh <= 0) continue;

    let placed = false;
    for (const row of rows) {
      const ry0 = row.sumY0 / row.words.length;
      const ry1 = row.sumY1 / row.words.length;
      const rh = ry1 - ry0;

      // Calculate vertical overlap between word and row
      const overlap = Math.max(0, Math.min(ry1, wy1) - Math.max(ry0, wy0));
      const minH = Math.min(rh, wh);

      // If they overlap by more than 50% of the height, they belong to the same row
      if (minH > 0 && (overlap / minH) >= 0.5) {
        row.words.push(word);
        row.sumY0 += wy0;
        row.sumY1 += wy1;
        placed = true;
        break;
      }
    }

    if (!placed) {
      rows.push({
        words: [word],
        sumY0: wy0,
        sumY1: wy1
      });
    }
  }

  // Sort rows vertically by average Y0
  rows.sort((a, b) => (a.sumY0 / a.words.length) - (b.sumY0 / b.words.length));

  // Reconstruct line text for each row
  const lineTexts = rows.map(row => {
    row.words.sort((a, b) => a.bbox.x0 - b.bbox.x0);

    let lineStr = "";
    for (let i = 0; i < row.words.length; i++) {
      const curr = row.words[i];
      if (i === 0) {
        lineStr = curr.text;
      } else {
        const prev = row.words[i - 1];
        const gap = curr.bbox.x0 - prev.bbox.x1;
        if (gap > 25) {
          lineStr += "   " + curr.text;
        } else {
          lineStr += " " + curr.text;
        }
      }
    }
    return lineStr;
  });

  return lineTexts.join("\n");
}

/**
 * Combines Pass 1 header/footer with Pass 2 reconstructed table text.
 */
function combinePass1AndPass2(pass1Result, reconstructedTableText, headerY, footerY) {
  const cleanWords = pass1Result.words.filter(w => w.text && w.text.trim().length > 0);

  const rows = [];
  for (const word of cleanWords) {
    const wy0 = word.bbox.y0;
    const wy1 = word.bbox.y1;
    const wh = wy1 - wy0;
    if (wh <= 0) continue;

    let placed = false;
    for (const row of rows) {
      const ry0 = row.sumY0 / row.words.length;
      const ry1 = row.sumY1 / row.words.length;
      const rh = ry1 - ry0;

      const overlap = Math.max(0, Math.min(ry1, wy1) - Math.max(ry0, wy0));
      const minH = Math.min(rh, wh);

      if (minH > 0 && (overlap / minH) >= 0.5) {
        row.words.push(word);
        row.sumY0 += wy0;
        row.sumY1 += wy1;
        placed = true;
        break;
      }
    }

    if (!placed) {
      rows.push({
        words: [word],
        sumY0: wy0,
        sumY1: wy1
      });
    }
  }

  rows.sort((a, b) => (a.sumY0 / a.words.length) - (b.sumY0 / b.words.length));

  const headerLines = [];
  const footerLines = [];

  for (const row of rows) {
    const avgY = (row.sumY0 + row.sumY1) / (2 * row.words.length);
    row.words.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const lineText = row.words.map(w => w.text).join(" ");

    if (avgY < headerY) {
      headerLines.push(lineText);
    } else if (avgY > footerY) {
      footerLines.push(lineText);
    }
  }

  return headerLines.join("\n") + "\n" + reconstructedTableText + "\n" + footerLines.join("\n");
}

/**
 * Handles uploading an invoice image, preprocessing it with Sharp, running
 * a dual-pass Tesseract OCR pipeline, parsing with the Metro rule-based parser,
 * validating the data, and returning structured JSON.
 */
const uploadMetroInvoice = async (req, res) => {
  const startTime = Date.now();

  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No invoice file uploaded.',
    });
  }

  const filePath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();

  let preprocessedPath = null;
  let croppedTablePath = null;
  let tesseractText = '';
  let confidenceScore = 0;
  let imageQuality = 'poor';
  let finalParsedInvoice = null;

  // Timing accumulators
  let originalWidth = 0;
  let originalHeight = 0;
  let sharpPreprocessTime = 0;
  let ocrTime = 0;
  let parserTime = 0;

  try {
    // ── Read original image dimensions for diagnostics ─────────────
    try {
      const metadata = await sharp(filePath).metadata();
      originalWidth = metadata.width || 0;
      originalHeight = metadata.height || 0;
    } catch (metaErr) {
      console.warn(`[DIAGNOSTIC] Could not read original image metadata: ${metaErr.message}`);
    }

    // ── STEP 1: Preprocessing ──────────────────────────────────────
    if (ext === '.pdf') {
      console.log('📄 PDF detected, extracting text directly...');
      const pdfParse = require('pdf-parse');
      const pdfBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(pdfBuffer);
      tesseractText = pdfData.text;
      confidenceScore = 100; // Digital PDF text is always 100% certain

      console.time('Parser');
      const parserStart = Date.now();
      finalParsedInvoice = parseMetroInvoice(tesseractText);
      parserTime = (Date.now() - parserStart) / 1000;
      console.timeEnd('Parser');
    } else {
      // ── Sharp preprocessing ──────────────────────────────────────
      preprocessedPath = `${filePath}-processed.jpg`;
      const sharpStart = Date.now();
      await preprocessImage(filePath, preprocessedPath);
      sharpPreprocessTime = (Date.now() - sharpStart) / 1000;

      // ── STEP 2: Dual-Pass Tesseract OCR ──────────────────────
      const ocrStart = Date.now();

      // Pass 1: Full invoice extraction
      console.log("📸 Running OCR Pass 1: Full invoice...");
      const pass1Result = await performOCR(preprocessedPath);

      let finalOcrText = pass1Result.text;
      let finalConfidence = pass1Result.confidence;

      try {
        // Crop only the item table area using Pass 1 coordinates
        const cropRes = await cropTableArea(preprocessedPath, pass1Result.words, pass1Result.imageWidth, pass1Result.imageHeight);
        croppedTablePath = cropRes.croppedPath;

        if (croppedTablePath && croppedTablePath !== preprocessedPath) {
          // Pass 2: Table-only extraction
          console.log("📸 Running OCR Pass 2: Table-only...");
          const pass2Result = await performOCR(croppedTablePath);

          // Reconstruct table rows and columns using X/Y coordinates
          const reconstructedTableText = reconstructLinesFromWords(pass2Result.words);
          console.log(reconstructedTableText);

          // Combine Pass 1 (header/footer) with Pass 2 table text
          finalOcrText = combinePass1AndPass2(pass1Result, reconstructedTableText, cropRes.headerY, cropRes.footerY);
          finalConfidence = Math.round((pass1Result.confidence + pass2Result.confidence) / 2);

          console.log(`[OCR] Dual-pass successfully completed. Combined text length: ${finalOcrText.length}`);
        }
      } catch (cropErr) {
        console.error("⚠️ Dual-pass OCR failed, falling back to Pass 1 text:", cropErr.message);
      }

      ocrTime = (Date.now() - ocrStart) / 1000;

      tesseractText = finalOcrText;
      confidenceScore = finalConfidence;

      // ── STEP 3: Metro Rule-Based Parser ────────────────────────
      console.time('Parser');
      const parserStart = Date.now();
      finalParsedInvoice = parseMetroInvoice(tesseractText);
      parserTime = (Date.now() - parserStart) / 1000;
      console.timeEnd('Parser');
    }

    // ── STEP 4: Image quality classification ──────────────────────
    if (confidenceScore >= 85) {
      imageQuality = 'good';
    } else if (confidenceScore >= 70) {
      imageQuality = 'medium';
    } else {
      imageQuality = 'poor';
    }

    // ── STEP 5: Build response ─────────────────────────────────────
    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⚡ Extraction completed in ${executionTime}s`);

    const systemMetrics = {
      imageWidth: originalWidth,
      imageHeight: originalHeight,
      preprocessingTime: parseFloat(sharpPreprocessTime.toFixed(2)),
      ocrTime: parseFloat(ocrTime.toFixed(2)),
      parserTime: parseFloat(parserTime.toFixed(2)),
      totalExecutionTime: parseFloat(executionTime),
      confidenceScore,
      activeOCRJobs: getActiveJobsCount(),
    };

    console.log('========== SYSTEM METRICS ==========');
    console.log(JSON.stringify(systemMetrics, null, 2));

    const invoiceHeader = finalParsedInvoice.invoice;
    const invoiceItems = finalParsedInvoice.items;

    const parsedData = {
      invoiceNumber: invoiceHeader.invoice_number,
      invoiceDate: invoiceHeader.invoice_date,
      customerName: invoiceHeader.customer_name,
      customerCode: invoiceHeader.customer_code,
      supplierName: invoiceHeader.vendor_name,
      supplierAddress: invoiceHeader.supplier_address,
      gstNumber: invoiceHeader.gst_number,
      panNumber: invoiceHeader.pan_number,
      state: invoiceHeader.state,
      grandTotal: invoiceHeader.grand_total,
      itemCount: invoiceItems.length,
      items: invoiceItems.map(item => ({
        articleCode: item.article_code,
        articleName: item.article_name,
        hsnCode: item.hsn_code,
        qty: item.quantity,
        packSize: item.pack_size,
        netAmount: item.net_amount,
        discountAmount: item.discount_amount,
        netDiscountAmount: item.taxable_amount,
        taxPercent: item.tax_percent,
        taxAmount: item.tax_amount,
        totalAmountIncludingGST: item.total_amount,
        validationStatus: item.validation_status,
        validationMessages: item.validation_messages,
        status: item.status || 'valid',
      })),
    };

    console.log('========== METRO EXTRACTION JSON ==========');
    console.log(JSON.stringify(parsedData, null, 2));

    return res.status(200).json({
      success: true,
      tesseractText,
      rawText: tesseractText,
      parsedData,
      invoiceData: parsedData, // Alias for backward compatibility

      // Flattened root fields for frontend compatibility
      invoiceNumber: parsedData.invoiceNumber,
      invoiceDate: parsedData.invoiceDate,
      customerName: parsedData.customerName,
      customerCode: parsedData.customerCode,
      supplierName: parsedData.supplierName,
      supplierAddress: parsedData.supplierAddress,
      gstNumber: parsedData.gstNumber,
      panNumber: parsedData.panNumber,
      state: parsedData.state,
      grandTotal: parsedData.grandTotal,
      items: parsedData.items,

      accuracy: finalParsedInvoice.accuracy,
      totalsMatch: finalParsedInvoice.totalsMatch,
      invoiceTotals: finalParsedInvoice.invoiceTotals,
      calculatedTotals: finalParsedInvoice.calculatedTotals,
      difference: finalParsedInvoice.difference,
      metadata: {
        tesseractRows: (tesseractText.match(/\n/g) || []).length + 1,
        parsedItems: invoiceItems.length,
        validationErrors: finalParsedInvoice.validation_errors,
        confidenceScore,
        executionTime: `${executionTime}s`,
        preprocessingMethod: 'sharp',
        imageQuality,
        systemMetrics,
      },
    });

  } catch (err) {
    console.error('❌ Controller Error in uploadMetroInvoice:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to extract and parse Metro invoice.',
      details: err.message,
    });
  } finally {
    // Clean up all temporary files
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🧹 Deleted uploaded file: ${filePath}`);
      }
      if (preprocessedPath && fs.existsSync(preprocessedPath)) {
        fs.unlinkSync(preprocessedPath);
        console.log(`🧹 Deleted preprocessed file: ${preprocessedPath}`);
      }
      if (croppedTablePath && fs.existsSync(croppedTablePath)) {
        fs.unlinkSync(croppedTablePath);
        console.log(`🧹 Deleted cropped table file: ${croppedTablePath}`);
      }
    } catch (cleanupErr) {
      console.error('⚠️ Failed to delete temporary files:', cleanupErr.message);
    }
  }
};

/**
 * Handles fetching all saved invoices from the database.
 */
const getMetroInvoices = async (req, res) => {
  try {
    const invoices = await getAllInvoicesFromDB();
    return res.status(200).json({ success: true, invoices });
  } catch (err) {
    console.error('❌ Error in getMetroInvoices:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve Metro invoices from database.',
    });
  }
};

/**
 * Handles fetching a single invoice by ID, including its line items.
 */
const getMetroInvoiceById = async (req, res) => {
  const { id } = req.params;
  try {
    const invoice = await getInvoiceByIdFromDB(id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Metro invoice not found.' });
    }
    const items = await getInvoiceItemsFromDB(id);
    return res.status(200).json({ success: true, invoice, items });
  } catch (err) {
    console.error('❌ Error in getMetroInvoiceById:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve invoice details.',
    });
  }
};

/**
 * Handles validating and saving/persisting an invoice and its line items.
 */
const saveMetroInvoice = async (req, res) => {
  console.log('Database Save: START');
  console.time('Database Save');
  const dbStart = Date.now();
  try {
    const {
      invoiceNumber,
      invoiceDate,
      customerName,
      customerCode,
      supplierName,
      supplierAddress,
      gstNumber,
      panNumber,
      state,
      grandTotal,
      items,
      // also accept snake_case payload keys
      vendor_name,
      subtotal,
      total_tax,
    } = req.body;

    const invoiceHeader = {
      vendor_name: supplierName || vendor_name || 'METRO Cash and Carry India Private Limited',
      invoice_number: invoiceNumber || req.body.invoice_number,
      invoice_date: invoiceDate || req.body.invoice_date,
      gst_number: gstNumber || req.body.gst_number,
      subtotal: subtotal || req.body.subtotal || 0,
      total_tax: total_tax || req.body.total_tax || 0,
      grand_total: grandTotal || req.body.grand_total || 0,
      customer_name: customerName || req.body.customer_name,
      customer_code: customerCode || req.body.customer_code,
      supplier_name: supplierName || vendor_name || 'METRO Cash and Carry India Private Limited',
      supplier_address: supplierAddress || req.body.supplier_address,
      pan_number: panNumber || req.body.pan_number,
      state: state || req.body.state,
    };

    const savedData = await saveInvoiceToDB(invoiceHeader, items);
    console.timeEnd('Database Save');
    console.log('Database Save: END');
    console.log(`Database Save Duration: ${Date.now() - dbStart}ms`);
    return res.status(200).json(savedData);
  } catch (err) {
    console.timeEnd('Database Save');
    console.error('❌ Error in saveMetroInvoice:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to save Metro invoice.',
      details: err.message,
    });
  }
};

/**
 * Handles deleting a saved invoice and its items.
 */
const deleteMetroInvoice = async (req, res) => {
  const { id } = req.params;
  try {
    const success = await deleteInvoiceFromDB(id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Invoice not found.' });
    }
    return res.status(200).json({
      success: true,
      message: 'Metro invoice deleted successfully.',
    });
  } catch (err) {
    console.error('❌ Error in deleteMetroInvoice:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete Metro invoice.',
    });
  }
};

module.exports = {
  uploadMetroInvoice,
  getMetroInvoices,
  getMetroInvoiceById,
  saveMetroInvoice,
  deleteMetroInvoice,
};
