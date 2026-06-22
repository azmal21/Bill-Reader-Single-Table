const pool = require('../db');

/**
 * Saves a unified bill and its items to PostgreSQL.
 * @param {object} billData - Unified bill header
 * @param {Array} itemsData - Unified list of items
 * @returns {Promise<object>}
 */
async function saveBill(billData, itemsData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const billQuery = `
      INSERT INTO bills (
        bill_type, document_number, bill_date, vendor_name,
        grand_total, sgst, cgst, item_count, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const billValues = [
      billData.bill_type,
      billData.document_number,
      billData.bill_date,
      billData.vendor_name,
      billData.grand_total,
      billData.sgst || 0,
      billData.cgst || 0,
      billData.item_count,
      billData.status || 'valid'
    ];

    const billResult = await client.query(billQuery, billValues);
    const savedBill = billResult.rows[0];

    const savedItems = [];
    for (const item of itemsData) {
      const itemQuery = `
        INSERT INTO bill_items (
          bill_id, item_code, item_name, quantity, unit_price, 
          discount_amount, tax_percent, tax_amount, line_total, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *;
      `;
      const itemValues = [
        savedBill.id,
        item.item_code,
        item.item_name,
        item.quantity,
        item.unit_price,
        item.discount_amount,
        item.tax_percent,
        item.tax_amount,
        item.line_total,
        item.status || 'valid'
      ];
      const itemResult = await client.query(itemQuery, itemValues);
      savedItems.push(itemResult.rows[0]);
    }

    await client.query('COMMIT');
    return { bill: savedBill, items: savedItems };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving bill:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function getAllBills() {
  const query = `
    SELECT * FROM bills
    ORDER BY created_at DESC;
  `;
  const result = await pool.query(query);
  return result.rows;
}

async function getBillById(id) {
  const billQuery = `SELECT * FROM bills WHERE id = $1;`;
  const billResult = await pool.query(billQuery, [id]);
  
  if (billResult.rows.length === 0) return null;
  
  const itemsQuery = `SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY id ASC;`;
  const itemsResult = await pool.query(itemsQuery, [id]);
  
  return {
    bill: billResult.rows[0],
    items: itemsResult.rows
  };
}

async function deleteBill(id) {
  const result = await pool.query('DELETE FROM bills WHERE id = $1 RETURNING *;', [id]);
  return result.rowCount > 0;
}

module.exports = {
  saveBill,
  getAllBills,
  getBillById,
  deleteBill
};
