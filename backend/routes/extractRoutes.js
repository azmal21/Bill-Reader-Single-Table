/**
 * routes/extractRoutes.js
 * Defines the POST /api/extract route.
 * Applies the Multer upload middleware before passing to the controller.
 */

const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { extractText, getBills, deleteBill, saveBill } = require('../controllers/extractController');
console.log("✅ extractRoutes loaded");

/**
 * POST /api/extract
 * Accepts a single image file under the field name "image",
 * then runs OCR and returns the extracted text.
 */
router.post(
  '/extract',

  // Multer middleware: parse the 'image' field from multipart form data
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      // Handle Multer-specific errors (e.g. wrong file type, file too large)
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }
      next();
    });
  },
  // After successful upload, run the OCR extraction
  extractText
);

router.get('/bills', getBills);
router.post('/save', saveBill);
router.delete('/bills/:id', deleteBill);

module.exports = router;
