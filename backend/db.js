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
    bill_type VARCHAR(50),
    document_number TEXT,
    bill_date TEXT,
    vendor_name TEXT,
    grand_total DECIMAL(12, 2) DEFAULT 0,
    sgst DECIMAL(12, 2) DEFAULT 0,
    cgst DECIMAL(12, 2) DEFAULT 0,
    item_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'valid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bill_items (
    id SERIAL PRIMARY KEY,
    bill_id INTEGER REFERENCES bills(id) ON DELETE CASCADE,
    item_code TEXT,
    item_name TEXT,
    quantity DECIMAL(12, 2) DEFAULT 0,
    unit_price DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    tax_percent DECIMAL(5, 2) DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    line_total DECIMAL(12, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'valid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`)
  .then(() => console.log('✅ PostgreSQL Connected & Tables ensured.'))
  .catch(err => {
    console.error('❌ PostgreSQL Connection Error:', err.message);
    console.log('Please ensure PostgreSQL is running and credentials are correct in .env');
  });

module.exports = pool;
