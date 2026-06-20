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

  // Dynamically determine item columns
  const itemKeys = new Set();
  items.forEach(item => {
    Object.keys(item).forEach(key => {
      // Exclude internal database keys
      if (!['id', 'bill_id', 'created_at', 'updated_at'].includes(key) && item[key] !== null && item[key] !== '') {
        itemKeys.add(key);
      }
    });
  });
  
  // Enforce a logical order for common columns if they exist
  const priorityKeys = ['item_code', 'item_name', 'quantity', 'unit_price', 'discount_amount', 'tax_percent', 'tax_amount', 'line_total', 'status'];
  const columns = Array.from(itemKeys).sort((a, b) => {
    const idxA = priorityKeys.indexOf(a);
    const idxB = priorityKeys.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

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
        <div className="bill-metadata">
          <h2>Bill Summary</h2>
          <div className="metadata-grid">
            <div className="meta-field">
              <label>Bill Type</label>
              <div className="meta-value" style={{textTransform: 'capitalize'}}>{bill.bill_type || 'Unknown'}</div>
            </div>
            <div className="meta-field">
              <label>Document Number</label>
              <div className="meta-value">{bill.document_number || '-'}</div>
            </div>
            <div className="meta-field">
              <label>Date</label>
              <div className="meta-value">{bill.bill_date ? new Date(bill.bill_date).toLocaleDateString() : '-'}</div>
            </div>
            <div className="meta-field">
              <label>Vendor Name</label>
              <div className="meta-value">{bill.vendor_name || '-'}</div>
            </div>
            <div className="meta-field highlight">
              <label>Grand Total</label>
              <div className="meta-value">{formatCurrency(bill.grand_total)}</div>
            </div>
            <div className="meta-field">
              <label>Item Count</label>
              <div className="meta-value">{bill.item_count || 0}</div>
            </div>
            <div className="meta-field">
              <label>Status</label>
              <div className="meta-value">{bill.status || '-'}</div>
            </div>
            <div className="meta-field">
              <label>Created At</label>
              <div className="meta-value">{bill.created_at ? new Date(bill.created_at).toLocaleString() : '-'}</div>
            </div>
          </div>
          
          {bill.metadata && Object.keys(bill.metadata).length > 0 && (
            <div className="additional-metadata">
              <h3>Metadata ({bill.bill_type} specific)</h3>
              <div className="metadata-grid">
                {Object.entries(bill.metadata).map(([key, value]) => {
                  if (typeof value === 'object' || value === null || value === '') return null;
                  return (
                    <div className="meta-field" key={key}>
                      <label>{formatHeader(key)}</label>
                      <div className="meta-value">{value.toString()}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="bill-items">
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

        <div className="raw-data-section">
          <div className="section-header-flex">
            <h2>Raw Extracted Data</h2>
            <button className="btn-secondary btn-small" onClick={() => setShowRawJson(!showRawJson)}>
              {showRawJson ? 'Hide JSON' : 'View JSON'}
            </button>
          </div>
          {showRawJson && (
            <div className="raw-json-container" style={{background: '#1e1e1e', color: '#d4d4d4', padding: '1rem', borderRadius: '8px', overflowX: 'auto', marginTop: '1rem'}}>
              <pre style={{margin: 0, fontSize: '0.85rem', fontFamily: 'monospace'}}>
                {JSON.stringify({ bill, items }, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillDetailsPage;
