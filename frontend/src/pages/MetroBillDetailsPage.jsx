import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BillSummaryCards from '../components/bills/BillSummaryCards';
import { fetchMetroInvoiceById } from '../services/api';

const MetroBillDetailsPage = ({ handleDelete }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [bill, setBill] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDetails = async () => {
      try {
        const response = await fetchMetroInvoiceById(id);
        if (response.success) {
          setBill(response.invoice);
          setItems(response.items || []);
        } else {
          setError(response.error || 'Failed to load details.');
        }
      } catch (err) {
        setError('Error fetching Metro invoice details.');
      } finally {
        setLoading(false);
      }
    };
    loadDetails();
  }, [id]);

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;
  if (error || !bill) return <div style={{ padding: '2rem' }}>{error || 'Bill not found.'}</div>;

  const subtotal = parseFloat(bill.subtotal || 0);
  const totalTax = parseFloat(bill.total_tax || 0);
  const grandTotal = parseFloat(bill.grand_total || 0);

  return (
    <>
      <header className="page-header">
        <div className="page-header-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="back-btn" onClick={() => navigate(-1)} id="back-to-list">← Back</button>
        </div>
        <div className="page-header-right">
          <button className="delete-detail-btn" onClick={async () => { await handleDelete(bill.id); navigate(-1); }}>Delete Bill</button>
        </div>
      </header>

      <BillSummaryCards
        bill={{ ...bill, created_at: bill.invoice_date || bill.created_at }}
        items={items}
        totalTax={totalTax}
        grandTotal={grandTotal}
        entityLabel="Supplier / Vendor"
        entityName={bill.vendor_name || bill.supplier_name}
      />

      <div className="table-container">
        <div className="detail-table-header">
          <h2 className="detail-table-title">Items ({items.length})</h2>
        </div>
        {items.length === 0 ? (
          <div className="table-empty"><p>No items found for this invoice.</p></div>
        ) : (
          <table className="bills-table items-detail-table" id="items-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>#</th>
                <th>Article Code</th>
                <th>Item Name</th>
                <th>Pack Size</th>
                <th>Quantity</th>
                <th>Net Amount</th>
                <th>Tax Amount</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ color: '#9ca3af' }}>{idx + 1}</td>
                  <td>{item.article_code || '—'}</td>
                  <td style={{ fontWeight: 500 }}>{item.article_name || '—'}</td>
                  <td>{item.pack_size || '—'}</td>
                  <td>{item.quantity || item.qty || '—'}</td>
                  <td>₹{parseFloat(item.net_amount || 0).toFixed(2)}</td>
                  <td>₹{parseFloat(item.tax_amount || 0).toFixed(2)}</td>
                  <td style={{ fontWeight: 600 }}>₹{parseFloat(item.total_amount || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="items-subtotal-row">
                <td colSpan="7" style={{ textAlign: 'right', fontWeight: 600, color: '#374151' }}>Subtotal</td>
                <td style={{ fontWeight: 700, color: '#1f2937' }}>₹{subtotal.toFixed(2)}</td>
              </tr>
              <tr className="items-tax-row">
                <td colSpan="7" style={{ textAlign: 'right', color: '#6b7280' }}>Total Tax</td>
                <td style={{ color: '#6b7280' }}>₹{totalTax.toFixed(2)}</td>
              </tr>
              <tr className="items-grand-total-row">
                <td colSpan="7" style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.05rem', color: '#1f2937' }}>Grand Total</td>
                <td style={{ fontWeight: 700, fontSize: '1.05rem', color: '#059669' }}>₹{grandTotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </>
  );
};

export default MetroBillDetailsPage;
