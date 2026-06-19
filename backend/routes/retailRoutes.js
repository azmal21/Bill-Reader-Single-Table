const express = require('express');
const router = express.Router();
const multer = require('multer');

const {
  uploadRetailInvoice,
  getRetailInvoices,
  getRetailInvoiceById,
  saveRetailInvoice,
  deleteRetailInvoice
} = require('../controllers/retailController');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

router.post('/upload', upload.single('image'), uploadRetailInvoice);
router.get('/', getRetailInvoices);
router.get('/:id', getRetailInvoiceById);
router.post('/save', saveRetailInvoice);
router.delete('/:id', deleteRetailInvoice);

module.exports = router;
