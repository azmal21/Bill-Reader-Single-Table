import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchBillById } from '../services/api';
import '../components/ReviewBill.css';

// ── Helpers ────────────────────────────────────────────────────────────────
const formatCurrency = (val) => {
  if (val === undefined || val === null || val === '') return '-';
  const num = parseFloat(val);
  if (isNaN(num)) return '-';
  return '₹' + num.toFixed(2);
};

/**
 * Returns true when EVERY item has an empty / zero / null value for `field`.
 * Handles numbers, numeric strings ("0", "0.00"), empty strings, null, undefined.
 */
const isColumnEmpty = (items, field) => {
  if (!items.length) return true;
  return items.every(item => {
    const v = item[field];
    if (v === '' || v === null || v === undefined) return true;
    const n = Number(v);
    return !isNaN(n) && n === 0;
  });
};

// Column definitions for the line-items table (read-only view)
const ALL_COLUMNS = [
  { key: 'item_code', label: 'Item Code', numeric: false },
  { key: 'item_name', label: 'Item Name', numeric: false },
  { key: 'quantity', label: 'Qty', numeric: true },
  { key: 'unit_price', label: 'Unit Price', numeric: true },
  { key: 'discount_amount', label: 'Discount', numeric: true },
  { key: 'tax_percent', label: 'Tax %', numeric: true },
  { key: 'tax_amount', label: 'Tax Amount', numeric: true },
  { key: 'line_total', label: 'Line Total', numeric: true },
];

const renderCellValue = (key, value) => {
  if (value === null || value === undefined || value === '') return '-';
  if (['unit_price', 'discount_amount', 'tax_amount', 'line_total'].includes(key)) {
    return formatCurrency(value);
  }
  if (key === 'tax_percent') {
    const n = parseFloat(value);
    return (!isNaN(n) && n > 0) ? `${n}%` : '-';
  }
  return value.toString();
};

// ── Component ──────────────────────────────────────────────────────────────
const BillDetailsPage = ({ handleDelete }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadDetails = async () => {
      setLoading(true);
      try {
        const data = await fetchBillById(id);
        if (data.success) {
          setBill(data.bill);
          setItems(data.items || []);
        } else {
          setError(data.error || 'Failed to load bill details.');
        }
      } catch (err) {
        console.error('Error loading bill details', err);
        setError('Error communicating with the server.');
      } finally {
        setLoading(false);
      }
    };
    loadDetails();
  }, [id]);

  // ── Derived: hide columns where every row is empty / zero ──────────────
  const visibleColumns = useMemo(
    () => ALL_COLUMNS.filter(col => !isColumnEmpty(items, col.key)),
    [items]
  );

  // ── Early returns ──────────────────────────────────────────────────────
  if (loading) return (
    <div className="loading-state">
      <div className="spinner" /><p>Loading Bill Details...</p>
    </div>
  );
  if (error) return <div className="error-message">{error}</div>;
  if (!bill) return <div className="error-message">Bill not found.</div>;

  const sgst = parseFloat(bill.sgst ?? 0);
  const cgst = parseFloat(bill.cgst ?? 0);

  return (
    <div className="review-bill-container">
      {/* ── Top bar ── */}
      <div className="review-header">
        <button className="btn-secondary" onClick={() => navigate('/bills')}>
          ← Back to Bills
        </button>
        <div className="header-actions">
          <button
            className="btn-danger"
            onClick={() => { handleDelete(bill.id); navigate('/bills'); }}
          >
            Delete Bill
          </button>
        </div>
      </div>

      <div className="bill-data-layout">
        <div className="bill-items" style={{ width: '100%' }}>

          <div className="bill-summary-bar">
            {bill.id && (
              <div className="bill-summary-item">
                <span className="bill-summary-label">Bill ID</span>
                <span className="bill-summary-value">{bill.id}</span>
              </div>
            )}
            {bill.document_number && (
              <div className="bill-summary-item">
                <span className="bill-summary-label">Document No</span>
                <span className="bill-summary-value">{bill.document_number}</span>
              </div>
            )}
            {bill.bill_date && (
              <div className="bill-summary-item">
                <span className="bill-summary-label">Date</span>
                <span className="bill-summary-value">{new Date(bill.bill_date).toLocaleDateString('en-IN')}</span>
              </div>
            )}
            <div className="bill-summary-item">
              <span className="bill-summary-label">Vendor</span>
              <span className="bill-summary-value">{bill.vendor_name || '—'}</span>
            </div>
          </div>

          {/* ── Line items table ── */}
          <h2>Line Items ({items.length})</h2>
          {items.length > 0 ? (
            <div className="table-responsive">
              <table className="items-table">
                <thead>
                  <tr>
                    <th style={{ width: '2.5rem' }}>#</th>
                    {visibleColumns.map(col => (
                      <th key={col.key} className={col.numeric ? 'num-col' : ''}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      {visibleColumns.map(col => (
                        <td key={col.key} className={col.numeric ? 'num-col' : ''}>
                          <span className={col.key === 'line_total' ? 'fw-bold' : ''}>
                            {renderCellValue(col.key, item[col.key])}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', fontSize: '1.05rem', paddingRight: '1rem' }}>
                {sgst > 0 && (
                  <div>
                    <strong>SGST:</strong>{' '}
                    <span style={{ color: '#7c3aed', fontWeight: 600, display: 'inline-block', width: '6rem', textAlign: 'right' }}>₹{sgst.toFixed(2)}</span>
                  </div>
                )}
                {cgst > 0 && (
                  <div>
                    <strong>CGST:</strong>{' '}
                    <span style={{ color: '#7c3aed', fontWeight: 600, display: 'inline-block', width: '6rem', textAlign: 'right' }}>₹{cgst.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                  <strong>Grand Total:</strong>{' '}
                  <span style={{ color: '#059669', fontWeight: 700, fontSize: '1.2rem', display: 'inline-block', width: '8rem', textAlign: 'right' }}>
                    {formatCurrency(bill.grand_total)}
                  </span>
                </div>
              </div>

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
