import React, { useState } from 'react';
import { saveMetroInvoice } from '../../services/api';

const formatCurrency = (val) => {
  if (val === undefined || val === null || val === '') return '-';
  const num = parseFloat(val);
  return isNaN(num) ? '-' : `₹${num.toFixed(2)}`;
};

const ReviewMetroBill = ({ billData, onSaveSuccess, onCancel }) => {
  const [reviewData, setReviewData] = useState(billData);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleHeaderChange = (field, val) => {
    setReviewData(prev => ({ ...prev, [field]: val }));
  };

  const handleItemChange = (idx, field, val) => {
    const updatedItems = [...reviewData.items];
    updatedItems[idx][field] = val;
    // Auto-calculate
    if (['qty', 'netAmount', 'discountAmount', 'taxPercent', 'taxAmount'].includes(field)) {
      const qty = parseFloat(updatedItems[idx].qty) || 0;
      const netAmount = parseFloat(updatedItems[idx].netAmount) || 0;
      const discountAmount = parseFloat(updatedItems[idx].discountAmount) || 0;
      const netDiscountAmount = netAmount + discountAmount;
      const taxPercent = parseFloat(updatedItems[idx].taxPercent) || 0;
      const taxAmount = parseFloat((netDiscountAmount * (taxPercent / 100)).toFixed(2));
      const totalAmountIncludingGST = parseFloat((netDiscountAmount + taxAmount).toFixed(2));
      
      updatedItems[idx].netDiscountAmount = netDiscountAmount;
      updatedItems[idx].taxAmount = taxAmount;
      updatedItems[idx].totalAmountIncludingGST = totalAmountIncludingGST;
    }
    setReviewData(prev => ({ ...prev, items: updatedItems }));
  };

  const handleAddItemRow = () => {
    const newItem = { articleCode: '', articleName: '', hsnCode: '', qty: 1, packSize: '1', netAmount: 0, discountAmount: 0, netDiscountAmount: 0, taxPercent: 5, taxAmount: 0, totalAmountIncludingGST: 0 };
    setReviewData(prev => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const handleDeleteItemRow = (idx) => {
    setReviewData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const handleSaveInvoice = async () => {
    setIsSaving(true);
    setError('');
    try {
      const result = await saveMetroInvoice(reviewData);
      if (result.success) {
        if (onSaveSuccess) onSaveSuccess();
      } else {
        setError(result.error || "Failed to save Metro invoice.");
      }
    } catch (err) {
      const detail = err.response?.data?.details || '';
      const message = err.response?.data?.error || err.message || "Failed to save Metro invoice.";
      setError(detail ? `${message} — ${detail}` : message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
      <div className="review-bill-container animate-fade-in" style={{ maxWidth: '95%', width: '1200px' }}>
        <h2>Review &amp; Edit Metro Wholesale Invoice</h2>
        {error && <div className="error-box" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        <div className="invoice-box" style={{ padding: '2rem', background: 'rgba(25,25,35,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {/* Header Fields Section */}
          <h3 style={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Header Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div>
              <label style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>Invoice Number</label>
              <input type="text" value={reviewData.invoiceNumber} onChange={(e) => handleHeaderChange('invoiceNumber', e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff' }} />
            </div>
            <div>
              <label style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>Invoice Date</label>
              <input type="text" value={reviewData.invoiceDate} onChange={(e) => handleHeaderChange('invoiceDate', e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff' }} />
            </div>
            <div>
              <label style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>Customer Name</label>
              <input type="text" value={reviewData.customerName} onChange={(e) => handleHeaderChange('customerName', e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff' }} />
            </div>
            <div>
              <label style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>Customer Code</label>
              <input type="text" value={reviewData.customerCode} onChange={(e) => handleHeaderChange('customerCode', e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff' }} />
            </div>
            <div>
              <label style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>Supplier Name</label>
              <input type="text" value={reviewData.supplierName} onChange={(e) => handleHeaderChange('supplierName', e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff' }} />
            </div>
            <div>
              <label style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>GSTIN</label>
              <input type="text" value={reviewData.gstNumber} onChange={(e) => handleHeaderChange('gstNumber', e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff' }} />
            </div>
            <div>
              <label style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>PAN Number</label>
              <input type="text" value={reviewData.panNumber} onChange={(e) => handleHeaderChange('panNumber', e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff' }} />
            </div>
            <div>
              <label style={{ color: '#a1a1aa', fontSize: '0.8rem' }}>State</label>
              <input type="text" value={reviewData.state} onChange={(e) => handleHeaderChange('state', e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff' }} />
            </div>
          </div>

          {/* Product Items Table Section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
            <h3 style={{ color: '#fff', margin: 0 }}>Item List</h3>
            <button onClick={handleAddItemRow} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>+ Add Item</button>
          </div>

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
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {reviewData.items.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        type="text"
                        value={item.articleCode || ''}
                        onChange={(e) => handleItemChange(idx, 'articleCode', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={item.articleName || ''}
                        onChange={(e) => handleItemChange(idx, 'articleName', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={item.hsnCode || ''}
                        onChange={(e) => handleItemChange(idx, 'hsnCode', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        value={item.qty === undefined || item.qty === null ? '' : item.qty}
                        onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={item.packSize || ''}
                        onChange={(e) => handleItemChange(idx, 'packSize', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={item.netAmount === undefined || item.netAmount === null ? '' : item.netAmount}
                        onChange={(e) => handleItemChange(idx, 'netAmount', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={item.discountAmount === undefined || item.discountAmount === null ? '' : item.discountAmount}
                        onChange={(e) => handleItemChange(idx, 'discountAmount', e.target.value)}
                      />
                    </td>
                    <td className="text-right">
                      {formatCurrency(item.netDiscountAmount)}
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        value={item.taxPercent === undefined || item.taxPercent === null ? '' : item.taxPercent}
                        onChange={(e) => handleItemChange(idx, 'taxPercent', e.target.value)}
                      />
                    </td>
                    <td className="text-right">
                      {formatCurrency(item.taxAmount)}
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={item.totalAmountIncludingGST === undefined || item.totalAmountIncludingGST === null ? '' : item.totalAmountIncludingGST}
                        onChange={(e) => handleItemChange(idx, 'totalAmountIncludingGST', e.target.value)}
                      />
                    </td>
                    <td className="text-center">
                      <button onClick={() => handleDeleteItemRow(idx)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '3px', cursor: 'pointer', fontSize: '0.8rem' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Grand Total edit section / Summary */}
          <div className="metro-summary-wrapper">
            <div className="metro-summary-left">
              Total Items: <span>{reviewData.items.length}</span>
            </div>
            <div className="metro-summary-right">
              <div className="metro-summary-row grand-total" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: '500', color: '#a1a1aa' }}>Grand Total (INR):</span>
                <input
                  type="number"
                  step="0.01"
                  value={reviewData.grandTotal}
                  onChange={(e) => handleHeaderChange('grandTotal', e.target.value)}
                  style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.1)', border: '1px solid #10b981', borderRadius: '4px', color: '#10b981', fontSize: '1.25rem', fontWeight: '700', width: '150px', textAlign: 'right', outline: 'none' }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="review-actions" style={{ marginTop: '2rem' }}>
          <button className="btn btn-ghost" onClick={onCancel} disabled={isSaving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveInvoice} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Metro Invoice'}
          </button>
        </div>
      </div>
    );
};
export default ReviewMetroBill;
