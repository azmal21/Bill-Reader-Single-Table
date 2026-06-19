const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const {
  uploadMetroInvoice,
  getMetroInvoices,
  getMetroInvoiceById,
  saveMetroInvoice,
  deleteMetroInvoice
} = require("../controllers/metroController");

// Upload route with Multer middleware
router.post(
  "/upload",
  (req, res, next) => {
    console.time("Image Upload");
    req.uploadStartTime = Date.now();
    next();
  },
  (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      console.timeEnd("Image Upload");
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }
      next();
    });
  },
  uploadMetroInvoice
);

// CRUD routes for Metro Invoices
router.get("/", getMetroInvoices);
router.get("/:id", getMetroInvoiceById);
router.post("/save", saveMetroInvoice);
router.post("/", saveMetroInvoice); // support both paths
router.delete("/:id", deleteMetroInvoice);

module.exports = router;
