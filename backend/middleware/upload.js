/**
 * middleware/upload.js
 * Configures Multer for handling multipart/form-data (file uploads).
 * - Stores files temporarily in the /uploads folder
 * - Validates that only image files (jpg, jpeg, png) are accepted
 * - Limits file size to 10 MB
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ── Storage Configuration ────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save files to the uploads/ directory
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename using timestamp + original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `bill-${uniqueSuffix}${ext}`);
  },
});

// ── File Filter ──────────────────────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    // Accept the file
    cb(null, true);
  } else {
    // Reject the file with a descriptive error
    cb(new Error('Only JPG, JPEG, PNG, or PDF files are allowed.'), false);
  }
};

// ── Export Multer Instance ────────────────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum file size
  },
});

module.exports = upload;
