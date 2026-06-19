const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
  extractGSTInvoice,
  saveGSTInvoice,
  getGSTInvoices,
  getGSTInvoiceById,
  deleteGSTInvoice
} = require('../controllers/gstController');

router.post('/extract', upload.single('image'), extractGSTInvoice);
router.post('/save', saveGSTInvoice);
router.get('/', getGSTInvoices);
router.get('/:id', getGSTInvoiceById);
router.delete('/:id', deleteGSTInvoice);

module.exports = router;
