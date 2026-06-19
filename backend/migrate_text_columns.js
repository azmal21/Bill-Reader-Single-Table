/**
 * migrate_text_columns.js
 * Widens all VARCHAR(255) columns that can hold long OCR strings to TEXT.
 * Run once: node migrate_text_columns.js
 */
require('dotenv').config();
const pool = require('./db');

const sql = `
  ALTER TABLE metro_invoice_items
    ALTER COLUMN article_code TYPE TEXT,
    ALTER COLUMN article_name TYPE TEXT,
    ALTER COLUMN hsn_code     TYPE TEXT,
    ALTER COLUMN pack_size    TYPE TEXT;

  ALTER TABLE metro_invoices
    ALTER COLUMN invoice_number TYPE TEXT,
    ALTER COLUMN invoice_date   TYPE TEXT,
    ALTER COLUMN customer_name  TYPE TEXT,
    ALTER COLUMN customer_code  TYPE TEXT,
    ALTER COLUMN supplier_name  TYPE TEXT,
    ALTER COLUMN gst_number     TYPE TEXT,
    ALTER COLUMN pan_number     TYPE TEXT,
    ALTER COLUMN state          TYPE TEXT;
`;

pool.query(sql)
  .then(() => {
    console.log('✅ Migration complete — all columns widened to TEXT.');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  });
