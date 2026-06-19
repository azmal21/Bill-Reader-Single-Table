import React, { useEffect, useState } from 'react';
import { fetchMetroInvoices, deleteMetroInvoice } from '../services/api';
import '../components/BillList.css';

const MetroInvoices = ({ onSelectInvoice, refreshTrigger }) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadInvoices = async () => {
      setLoading(true);
      try {
        const data = await fetchMetroInvoices();
        if (data.success) {
          setInvoices(data.invoices);
        } else {
          setError(data.error || "Failed to load invoices.");
        }
      } catch (err) {
        console.error("Failed to load Metro invoices:", err);
        setError("Failed to fetch data from the database.");
      } finally {
        setLoading(false);
      }
    };
    loadInvoices();
  }, [refreshTrigger]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this Metro invoice?")) return;
    try {
      const data = await deleteMetroInvoice(id);
      if (data.success) {
        setInvoices(prev => prev.filter(inv => inv.id !== id));
      } else {
        alert(data.error || "Failed to delete invoice.");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("An error occurred while deleting.");
    }
  };

  if (loading && invoices.length === 0) return <div style={{ marginTop: '20px', textAlign: 'center', color: '#a1a1aa' }}>Loading Metro Invoices...</div>;
  if (error) return <div style={{ marginTop: '20px', textAlign: 'center', color: '#ef4444' }}>{error}</div>;
  if (invoices.length === 0) return <div style={{ marginTop: '20px', textAlign: 'center', color: '#a1a1aa' }}>No Metro Wholesale invoices found. Upload a document to start.</div>;

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ overflowX: 'auto', background: 'rgba(25, 25, 35, 0.65)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff', fontSize: '0.9rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#a1a1aa' }}>
              <th style={{ padding: '0.8rem' }}>Invoice Number</th>
              <th style={{ padding: '0.8rem' }}>Date</th>
              <th style={{ padding: '0.8rem' }}>Customer</th>
              <th style={{ padding: '0.8rem' }}>Supplier</th>
              <th style={{ padding: '0.8rem', textAlign: 'right' }}>Grand Total</th>
              <th style={{ padding: '0.8rem', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr
                key={inv.id}
                onClick={() => onSelectInvoice(inv.id)}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '0.8rem', fontWeight: '500', color: '#60a5fa' }}>{inv.invoice_number}</td>
                <td style={{ padding: '0.8rem' }}>{inv.invoice_date}</td>
                <td style={{ padding: '0.8rem' }}>
                  <div>{inv.customer_name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#71717a' }}>Code: {inv.customer_code}</div>
                </td>
                <td style={{ padding: '0.8rem', color: '#d4d4d8' }}>{inv.supplier_name}</td>
                <td style={{ padding: '0.8rem', textAlign: 'right', fontWeight: '600', color: '#10b981' }}>₹{parseFloat(inv.grand_total).toFixed(2)}</td>
                <td style={{ padding: '0.8rem', textAlign: 'center' }}>
                  <button
                    onClick={(e) => handleDelete(inv.id, e)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      padding: '0.3rem 0.6rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MetroInvoices;
