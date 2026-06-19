-- Up migration: Create metro_invoices and metro_invoice_items tables
CREATE TABLE IF NOT EXISTS metro_invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(255) NOT NULL,
    invoice_date VARCHAR(255),
    customer_name VARCHAR(255),
    customer_code VARCHAR(255),
    supplier_name VARCHAR(255),
    supplier_address TEXT,
    gst_number VARCHAR(255),
    pan_number VARCHAR(255),
    state VARCHAR(255),
    grand_total DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS metro_invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES metro_invoices(id) ON DELETE CASCADE,
    article_code VARCHAR(255),
    article_name VARCHAR(255),
    hsn_code VARCHAR(255),
    qty DECIMAL(10, 2),
    pack_size VARCHAR(255),
    net_amount DECIMAL(10, 2),
    discount_amount DECIMAL(10, 2),
    net_discount_amount DECIMAL(10, 2),
    tax_percentage DECIMAL(5, 2),
    tax_amount DECIMAL(10, 2),
    total_amount_including_gst DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
