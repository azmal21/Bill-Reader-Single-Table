const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { extractBill, saveBill, getBills, getBillById, deleteBill } = require('../controllers/billController');

// Upload and extract bill
router.post(
  '/import',
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      next();
    });
  },
  extractBill
);

router.post('/save', saveBill);
router.get('/', getBills);
router.get('/:id', getBillById);
router.delete('/:id', deleteBill);

module.exports = router;
