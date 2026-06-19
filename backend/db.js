const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'bill_reader',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// Test connection and initialize table
pool.query(`
  CREATE TABLE IF NOT EXISTS bills (
    id SERIAL PRIMARY KEY,
    restaurant_name VARCHAR(255),
    sgst DECIMAL(10, 2) DEFAULT 0,
    cgst DECIMAL(10, 2) DEFAULT 0,
    grand_total DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bill_items (
    id SERIAL PRIMARY KEY,
    bill_id INTEGER REFERENCES bills(id) ON DELETE CASCADE,
    item_name VARCHAR(255),
    quantity INTEGER,
    unit_price DECIMAL(10, 2),
    total_price DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS metro_invoices (
    id SERIAL PRIMARY KEY,
    invoice_number TEXT NOT NULL,
    invoice_date TEXT,
    customer_name TEXT,
    customer_code TEXT,
    supplier_name TEXT,
    supplier_address TEXT,
    gst_number TEXT,
    pan_number TEXT,
    state TEXT,
    grand_total DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS metro_invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES metro_invoices(id) ON DELETE CASCADE,
    article_code TEXT,
    article_name TEXT,
    hsn_code TEXT,
    qty DECIMAL(10, 2),
    pack_size TEXT,
    net_amount DECIMAL(10, 2),
    discount_amount DECIMAL(10, 2),
    net_discount_amount DECIMAL(10, 2),
    tax_percentage DECIMAL(5, 2),
    tax_amount DECIMAL(10, 2),
    total_amount_including_gst DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS gst_invoices (
    id SERIAL PRIMARY KEY,
    seller_name TEXT,
    seller_address TEXT,
    gstin TEXT,
    fssai TEXT,
    invoice_number TEXT,
    order_number TEXT,
    invoice_date TEXT,
    place_of_supply TEXT,
    customer_name TEXT,
    bill_to_name TEXT,
    bill_to_address TEXT,
    ship_to_name TEXT,
    ship_to_address TEXT,
    total_net_amount DECIMAL(12, 2),
    total_discount_amount DECIMAL(12, 2),
    total_tax_amount DECIMAL(12, 2),
    grand_total DECIMAL(12, 2),
    raw_ocr_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS gst_invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES gst_invoices(id) ON DELETE CASCADE,
    sr_no TEXT,
    item_description TEXT,
    unit_mrp_rsp DECIMAL(12, 2),
    hsn_code TEXT,
    quantity DECIMAL(12, 2),
    product_rate DECIMAL(12, 2),
    discount_percent DECIMAL(5, 2),
    taxable_amount DECIMAL(12, 2),
    cgst_percent DECIMAL(5, 2),
    sut_gst_percent DECIMAL(5, 2),
    cgst_amount DECIMAL(12, 2),
    sut_gst_amount DECIMAL(12, 2),
    cess_percent DECIMAL(5, 2),
    cess_amount DECIMAL(12, 2),
    total_amount DECIMAL(12, 2)
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    vendor_name TEXT,
    invoice_number TEXT NOT NULL,
    invoice_date TEXT,
    gst_number TEXT,
    subtotal DECIMAL(12, 2) DEFAULT 0,
    total_tax DECIMAL(12, 2) DEFAULT 0,
    grand_total DECIMAL(12, 2) NOT NULL,
    raw_ocr_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    customer_name TEXT,
    customer_code TEXT,
    supplier_name TEXT,
    supplier_address TEXT,
    pan_number TEXT,
    state TEXT
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    article_code TEXT,
    article_name TEXT,
    hsn_code TEXT,
    quantity DECIMAL(12, 2) DEFAULT 0,
    pack_size TEXT,
    net_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    taxable_amount DECIMAL(12, 2) DEFAULT 0,
    tax_percent DECIMAL(5, 2) DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) DEFAULT 0,
    
    qty DECIMAL(12, 2) DEFAULT 0,
    net_discount_amount DECIMAL(12, 2) DEFAULT 0,
    tax_percentage DECIMAL(5, 2) DEFAULT 0,
    total_amount_including_gst DECIMAL(12, 2) DEFAULT 0
  );
`)
.then(() =>
  // Widen any legacy VARCHAR(255) columns that were created before this fix.
  // ALTER COLUMN ... TYPE TEXT is a no-op when the column is already TEXT.
  pool.query(`
    ALTER TABLE metro_invoices
      ALTER COLUMN invoice_number TYPE TEXT,
      ALTER COLUMN invoice_date   TYPE TEXT,
      ALTER COLUMN customer_name  TYPE TEXT,
      ALTER COLUMN customer_code  TYPE TEXT,
      ALTER COLUMN supplier_name  TYPE TEXT,
      ALTER COLUMN gst_number     TYPE TEXT,
      ALTER COLUMN pan_number     TYPE TEXT,
      ALTER COLUMN state          TYPE TEXT;

    ALTER TABLE metro_invoice_items
      ALTER COLUMN article_code TYPE TEXT,
      ALTER COLUMN article_name TYPE TEXT,
      ALTER COLUMN hsn_code     TYPE TEXT,
      ALTER COLUMN pack_size    TYPE TEXT;

    ALTER TABLE invoices
      ALTER COLUMN invoice_number TYPE TEXT,
      ALTER COLUMN invoice_date   TYPE TEXT,
      ALTER COLUMN gst_number     TYPE TEXT;

    ALTER TABLE invoice_items
      ALTER COLUMN article_code TYPE TEXT,
      ALTER COLUMN article_name TYPE TEXT,
      ALTER COLUMN hsn_code     TYPE TEXT,
      ALTER COLUMN pack_size    TYPE TEXT;

    ALTER TABLE gst_invoices
      ADD COLUMN IF NOT EXISTS customer_name TEXT,
      ADD COLUMN IF NOT EXISTS raw_ocr_text TEXT;

    ALTER TABLE gst_invoice_items
      ADD COLUMN IF NOT EXISTS unit_mrp_rsp DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS hsn_code TEXT,
      ADD COLUMN IF NOT EXISTS quantity DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS cgst_percent DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS sut_gst_percent DECIMAL(5, 2),
      ADD COLUMN IF NOT EXISTS sut_gst_amount DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS cess_percent DECIMAL(5, 2);
  `)
)
.then(() => console.log('✅ PostgreSQL Connected & Tables ensured.'))
.catch(err => {
  console.error('❌ PostgreSQL Connection Error:', err.message);
  console.log('Please ensure PostgreSQL is running and credentials are correct in .env');
});

module.exports = pool;
