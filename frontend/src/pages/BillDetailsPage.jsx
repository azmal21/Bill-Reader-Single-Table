import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchBillById } from '../services/api';
import '../components/ReviewBill.css';

const formatCurrency = (val) => {
  if (val === undefined || val === null || val === '') return '-';
  const num = parseFloat(val);
  if (isNaN(num)) return '-';
  return '₹' + num.toFixed(2);
};

const BillDetailsPage = ({ handleDelete }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showRawJson, setShowRawJson] = useState(false);

  useEffect(() => {
    const loadDetails = async () => {
      setLoading(true);
      try {
        const data = await fetchBillById(id);
        if (data.success) {
          setBill(data.bill);
          setItems(data.items || []);
        } else {
          setError(data.error || "Failed to load bill details.");
        }
      } catch (err) {
        console.error("Error loading bill details", err);
        setError("Error communicating with the server.");
      } finally {
        setLoading(false);
      }
    };
    loadDetails();
  }, [id]);

  if (loading) return <div className="loading-state"><div className="spinner"></div><p>Loading Bill Details...</p></div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!bill) return <div className="error-message">Bill not found.</div>;

  const columns = [
    'bill_id', 'item_code', 'item_name', 'quantity',
    'unit_price', 'discount_amount', 'tax_percent',
    'tax_amount', 'line_total', 'status'
  ];

  const formatHeader = (key) => {
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const renderCellValue = (key, value) => {
    if (value === null || value === undefined || value === '') return '-';
    // Format known currency columns
    if (['unit_price', 'discount_amount', 'tax_amount', 'line_total'].includes(key)) {
      return formatCurrency(value);
    }
    if (key === 'tax_percent' && value) return `${value}%`;
    return value.toString();
  };

  return (
    <div className="review-bill-container">
      <div className="review-header">
        <button className="btn-secondary" onClick={() => navigate('/bills')}>
          ← Back to Bills
        </button>
        <div className="header-actions">
          <button
            className="btn-danger"
            onClick={() => {
              handleDelete(bill.id);
              navigate('/bills');
            }}
          >
            Delete Bill
          </button>
        </div>
      </div>

      <div className="bill-data-layout">
        <div className="bill-items" style={{ width: '100%' }}>
          {/* ── Bill Summary Bar ── */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '1rem',
            background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: '10px', padding: '0.85rem 1.25rem',
            marginBottom: '1.25rem', fontSize: '0.88rem', color: '#334155'
          }}>
            <span><strong>Bill ID:</strong> {bill.id}</span>
            <span><strong>Document No:</strong> {bill.document_number || '—'}</span>
            <span><strong>Date:</strong> {bill.bill_date ? new Date(bill.bill_date).toLocaleDateString('en-IN') : '—'}</span>
            <span><strong>Vendor:</strong> {bill.vendor_name || '—'}</span>
            <span><strong>Grand Total:</strong> <span style={{color:'#059669', fontWeight:700}}>{formatCurrency(bill.grand_total)}</span></span>
            <span><strong>Type:</strong> <span style={{textTransform:'capitalize'}}>{bill.bill_type || '—'}</span></span>
            {/* ── Tax breakdown: only when SGST or CGST exist ── */}
            {(() => {
              const sgst = parseFloat(bill.sgst ?? 0);
              const cgst = parseFloat(bill.cgst ?? 0);
              if (!sgst && !cgst) return null;
              return (
                <>
                  {sgst > 0 && (
                    <span>
                      <strong>SGST:</strong>{' '}
                      <span style={{color:'#7c3aed', fontWeight:600}}>
                        ₹{sgst.toFixed(2)}
                      </span>
                    </span>
                  )}
                  {cgst > 0 && (
                    <span>
                      <strong>CGST:</strong>{' '}
                      <span style={{color:'#7c3aed', fontWeight:600}}>
                        ₹{cgst.toFixed(2)}
                      </span>
                    </span>
                  )}
                </>
              );
            })()}
          </div>

          <h2>Line Items ({items.length})</h2>
          {items.length > 0 ? (
            <div className="table-responsive">
              <table className="items-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {columns.map(col => (
                      <th key={col} className={['quantity', 'unit_price', 'tax_amount', 'line_total', 'tax_percent'].includes(col) ? 'num-col' : ''}>
                        {formatHeader(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      {columns.map(col => (
                        <td key={col} className={['quantity', 'unit_price', 'tax_amount', 'line_total', 'tax_percent'].includes(col) ? 'num-col' : ''}>
                          <span className={col === 'line_total' ? 'fw-bold' : ''}>
                            {renderCellValue(col, item[col])}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="no-items-msg">No line items were extracted for this bill.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillDetailsPage;
