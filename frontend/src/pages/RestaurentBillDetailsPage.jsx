import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BillSummaryCards from '../components/bills/BillSummaryCards';

const parseBillItems = (bill) => {
  try {
    const items = typeof bill.items === 'string' ? JSON.parse(bill.items) : bill.items;
    return Array.isArray(items) ? items : [];
  } catch { return []; }
};

const BillDetailsPage = ({ bills, billsLoading, handleDelete }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const bill = bills.find(b => String(b.id) === id);
  
  if (billsLoading) return <div style={{padding: '2rem'}}>Loading...</div>;
  if (!bill) return <div style={{padding: '2rem'}}>Bill not found.</div>;

  const items = parseBillItems(bill);
  const subtotal = items.reduce((sum, item) => sum + parseFloat(item.totalRate || item.total || 0), 0);
  const sgst = parseFloat(bill.sgst || 0);
  const cgst = parseFloat(bill.cgst || 0);
  const grandTotal = parseFloat(bill.grand_total || 0);

  return (
    <>
      <header className="page-header">
        <div className="page-header-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="back-btn" onClick={() => navigate(-1)} id="back-to-list">← Back</button>
          <h1 className="page-title">{bill.restaurant_name || 'Bill Details'}</h1>
        </div>
        <div className="page-header-right">
          <button className="delete-detail-btn" onClick={async () => { await handleDelete(bill.id); navigate(-1); }}>🗑️ Delete Bill</button>
        </div>
      </header>

      <BillSummaryCards bill={bill} items={items} sgst={sgst} cgst={cgst} grandTotal={grandTotal} />

      <div className="table-container">
        <div className="detail-table-header">
          <h2 className="detail-table-title">Items ({items.length})</h2>
        </div>
        {items.length === 0 ? (
          <div className="table-empty"><p>No items found for this bill.</p></div>
        ) : (
          <table className="bills-table items-detail-table" id="items-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>#</th>
                <th>Item Name</th>
                <th>Quantity</th>
                <th>Rate</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ color: '#9ca3af' }}>{idx + 1}</td>
                  <td style={{ fontWeight: 500 }}>{item.name || '—'}</td>
                  <td>{item.quantity || '—'}</td>
                  <td>₹{parseFloat(item.rate || item.itemRate || 0).toFixed(2)}</td>
                  <td style={{ fontWeight: 600 }}>₹{parseFloat(item.totalRate || item.total || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="items-subtotal-row">
                <td colSpan="4" style={{ textAlign: 'right', fontWeight: 600, color: '#374151' }}>Subtotal</td>
                <td style={{ fontWeight: 700, color: '#1f2937' }}>₹{subtotal.toFixed(2)}</td>
              </tr>
              <tr className="items-tax-row">
                <td colSpan="4" style={{ textAlign: 'right', color: '#6b7280' }}>SGST</td>
                <td style={{ color: '#6b7280' }}>₹{sgst.toFixed(2)}</td>
              </tr>
              <tr className="items-tax-row">
                <td colSpan="4" style={{ textAlign: 'right', color: '#6b7280' }}>CGST</td>
                <td style={{ color: '#6b7280' }}>₹{cgst.toFixed(2)}</td>
              </tr>
              <tr className="items-grand-total-row">
                <td colSpan="4" style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.05rem', color: '#1f2937' }}>Grand Total</td>
                <td style={{ fontWeight: 700, fontSize: '1.05rem', color: '#059669' }}>₹{grandTotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </>
  );
};

export default BillDetailsPage;
