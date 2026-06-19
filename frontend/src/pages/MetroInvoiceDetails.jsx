import React, { useEffect, useState } from 'react';
import { fetchMetroInvoiceById } from '../services/api';
import '../components/ReviewBill.css';

const MetroInvoiceDetails = ({ invoiceId, onBack }) => {
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const formatCurrency = (val) => {
    if (val === undefined || val === null || val === '') return '-';
    const num = parseFloat(val);
    return isNaN(num) ? '-' : `₹${num.toFixed(2)}`;
  };

  const formatDecimal = (val) => {
    if (val === undefined || val === null || val === '') return '-';
    const num = parseFloat(val);
    return isNaN(num) ? '-' : num.toString();
  };

  const formatText = (val) => {
    if (val === undefined || val === null || val === '') return '-';
    return val;
  };

  useEffect(() => {
    if (!invoiceId) return;
    const loadDetails = async () => {
      setLoading(true);
      try {
        const data = await fetchMetroInvoiceById(invoiceId);
        if (data.success) {
          console.log("Invoice Data:", data);
          console.log("Items Count:", data.items?.length);
          console.log("Items:", data.items);
          setInvoice(data.invoice);
          setItems(data);
        } else {
          setError(data.error || "Failed to load invoice details.");
        }
      } catch (err) {
        console.error("Failed to fetch Metro invoice details:", err);
        setError("Error loading invoice details from database.");
      } finally {
        setLoading(false);
      }
    };
    loadDetails();
  }, [invoiceId]);

  if (loading) return <div style={{ marginTop: '20px', color: '#a1a1aa', textAlign: 'center' }}>Loading invoice details...</div>;
  if (error) return <div style={{ marginTop: '20px', color: '#ef4444', textAlign: 'center' }}>{error}</div>;
  if (!invoice) return <div style={{ marginTop: '20px', color: '#a1a1aa', textAlign: 'center' }}>No invoice found.</div>;

  return (
    <div className="review-bill-container animate-fade-in" style={{ maxWidth: '95%', width: '1200px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button className="btn btn-ghost" onClick={onBack} style={{ margin: 0 }}>
          ← Back to List
        </button>
        <h2 style={{ margin: 0 }}>Metro Wholesale Invoice details</h2>
        <div style={{ width: '100px' }} /> {/* spacing spacer */}
      </div>

      <div className="invoice-box" style={{ padding: '2rem', background: 'rgba(20,20,30,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}>

        {/* Supplier & Bill Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
          <div>
            <h4 style={{ color: '#60a5fa', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.8rem' }}>Supplier Details</h4>
            <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#fff' }}>{invoice.supplier_name}</div>
            <div style={{ color: '#a1a1aa', fontSize: '0.85rem', maxWidth: '300px', marginTop: '0.2rem' }}>{invoice.supplier_address}</div>
            <div style={{ color: '#d4d4d8', fontSize: '0.85rem', marginTop: '0.5rem' }}>GSTIN: <span style={{ fontWeight: '500' }}>{invoice.gst_number}</span></div>
            <div style={{ color: '#d4d4d8', fontSize: '0.85rem' }}>PAN: <span style={{ fontWeight: '500' }}>{invoice.pan_number}</span></div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <h4 style={{ color: '#10b981', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.8rem' }}>Invoice Details</h4>
            <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#fff' }}>#{invoice.invoice_number}</div>
            <div style={{ color: '#a1a1aa', fontSize: '0.9rem', marginTop: '0.2rem' }}>Date: {invoice.invoice_date}</div>
            <div style={{ color: '#a1a1aa', fontSize: '0.85rem' }}>State: {invoice.state}</div>
          </div>
        </div>

        {/* Customer Header */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
          <h4 style={{ color: '#a1a1aa', margin: '0 0 0.3rem 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.8rem' }}>Billed To</h4>
          <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#fff' }}>{invoice.customer_name}</div>
          <div style={{ color: '#d4d4d8', fontSize: '0.85rem', marginTop: '0.2rem' }}>Customer Code: <span style={{ fontWeight: '500' }}>{invoice.customer_code}</span></div>
        </div>

        {/* Product Items Table */}
        <h4 style={{ color: '#fff', marginBottom: '0.8rem' }}>Line Items</h4>
        <div className="metro-table-wrapper">
          <table className="metro-table">
            <thead>
              <tr>
                <th>Article Code</th>
                <th>Article Name</th>
                <th>HSN Code</th>
                <th className="text-right">Qty</th>
                <th>Pack Size</th>
                <th className="text-right">Net Amount (INR)</th>
                <th className="text-right">Disc. Amount (INR)</th>
                <th className="text-right">Net Disc Amount (INR)</th>
                <th className="text-right">Tax % (SGST+CGST+CESS)</th>
                <th className="text-right">Tax Amount (INR)</th>
                <th className="text-right">Total Amt Inc. GST (INR)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{formatText(item.article_code)}</td>
                  <td style={{ fontWeight: '500', color: '#fff' }}>{formatText(item.article_name)}</td>
                  <td>{formatText(item.hsn_code)}</td>
                  <td className="text-right">{formatDecimal(item.qty)}</td>
                  <td>{formatText(item.pack_size)}</td>
                  <td className="text-right">{formatCurrency(item.net_amount)}</td>
                  <td className="text-right" style={{ color: '#ef4444' }}>{formatCurrency(item.discount_amount)}</td>
                  <td className="text-right">{formatCurrency(item.net_discount_amount)}</td>
                  <td className="text-right">{formatDecimal(item.tax_percentage) !== '-' ? `${formatDecimal(item.tax_percentage)}%` : '-'}</td>
                  <td className="text-right">{formatCurrency(item.tax_amount)}</td>
                  <td className="text-right" style={{ fontWeight: '600', color: '#fff' }}>{formatCurrency(item.total_amount_including_gst)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Grand Total Summary Box */}
        <div className="metro-summary-wrapper">
          <div className="metro-summary-left">
            Total Items: <span>{items.length}</span>
          </div>
          <div className="metro-summary-right">
            <div className="metro-summary-row grand-total">
              <span>Grand Total:</span>
              <span>{formatCurrency(invoice.grand_total)}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MetroInvoiceDetails;
