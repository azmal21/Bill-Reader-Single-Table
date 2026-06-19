import React, { useState } from 'react';
import { saveGSTInvoice } from '../../services/api';

const ReviewGSTBill = ({ billData, onSaveSuccess, onCancel }) => {
  const [reviewData, setReviewData] = useState(billData);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSectionChange = (section, field, val) => {
    setReviewData(prev => ({ ...prev, [section]: { ...prev[section], [field]: val } }));
  };

  const recalculateSummary = (itemsList) => {
    let totalNet = 0; let totalDisc = 0; let totalTax = 0; let grandTotal = 0;
    itemsList.forEach(item => {
      const qty = parseFloat(item.qty) || 0;
      const rate = parseFloat(item.product_rate) || 0;
      const discPct = parseFloat(item.discount_percentage) || 0;
      const itemDisc = (qty * rate) * (discPct / 100);
      totalDisc += itemDisc;
      totalNet += parseFloat(item.taxable_amount) || 0;
      totalTax += (parseFloat(item.cgst_amount) || 0) + (parseFloat(item.sgst_amount) || 0) + (parseFloat(item.cess_amount) || 0);
      grandTotal += parseFloat(item.total_amount) || 0;
    });
    return {
      total_net_amount: parseFloat(totalNet.toFixed(2)),
      total_discount_amount: parseFloat(totalDisc.toFixed(2)),
      total_tax_amount: parseFloat(totalTax.toFixed(2)),
      grand_total: parseFloat(grandTotal.toFixed(2))
    };
  };

  const handleItemChange = (idx, field, val) => {
    const updatedItems = [...reviewData.items];
    updatedItems[idx][field] = val;
    if (['qty', 'product_rate', 'discount_percentage', 'cgst_percentage', 'sgst_percentage', 'cess_percentage', 'taxable_amount', 'cgst_amount', 'sgst_amount', 'cess_amount'].includes(field)) {
      const qty = parseFloat(updatedItems[idx].qty) || 0;
      const rate = parseFloat(updatedItems[idx].product_rate) || 0;
      const discPct = parseFloat(updatedItems[idx].discount_percentage) || 0;
      let taxableAmt = parseFloat(updatedItems[idx].taxable_amount) || 0;
      
      if (['qty', 'product_rate', 'discount_percentage'].includes(field)) {
        const gross = qty * rate;
        const discountVal = gross * (discPct / 100);
        taxableAmt = parseFloat((gross - discountVal).toFixed(2));
        updatedItems[idx].taxable_amount = taxableAmt;
      }
      
      const cgstPct = parseFloat(updatedItems[idx].cgst_percentage) || 0;
      const sgstPct = parseFloat(updatedItems[idx].sgst_percentage) || 0;
      const cessPct = parseFloat(updatedItems[idx].cess_percentage) || 0;
      
      let cgstAmt = parseFloat(updatedItems[idx].cgst_amount) || 0;
      let sgstAmt = parseFloat(updatedItems[idx].sgst_amount) || 0;
      let cessAmt = parseFloat(updatedItems[idx].cess_amount) || 0;
      
      if (['qty', 'product_rate', 'discount_percentage', 'cgst_percentage'].includes(field)) {
        cgstAmt = parseFloat((taxableAmt * (cgstPct / 100)).toFixed(2));
        updatedItems[idx].cgst_amount = cgstAmt;
      }
      if (['qty', 'product_rate', 'discount_percentage', 'sgst_percentage'].includes(field)) {
        sgstAmt = parseFloat((taxableAmt * (sgstPct / 100)).toFixed(2));
        updatedItems[idx].sgst_amount = sgstAmt;
      }
      if (['qty', 'product_rate', 'discount_percentage', 'cess_percentage'].includes(field)) {
        cessAmt = parseFloat((taxableAmt * (cessPct / 100)).toFixed(2));
        updatedItems[idx].cess_amount = cessAmt;
      }
      
      const totalAmt = parseFloat((taxableAmt + cgstAmt + sgstAmt + cessAmt).toFixed(2));
      updatedItems[idx].total_amount = totalAmt;
    }
    const newSummary = recalculateSummary(updatedItems);
    setReviewData(prev => ({ ...prev, items: updatedItems, summary: newSummary }));
  };

  const handleAddItemRow = () => {
    const newItem = { sr_no: String(reviewData.items.length + 1), item_description: '', unit_mrp: 0, hsn: '', qty: 1, product_rate: 0, discount_percentage: 0, taxable_amount: 0, cgst_percentage: 9, sgst_percentage: 9, cgst_amount: 0, sgst_amount: 0, cess_percentage: 0, cess_amount: 0, total_amount: 0 };
    const updatedItems = [...reviewData.items, newItem];
    setReviewData(prev => ({ ...prev, items: updatedItems, summary: recalculateSummary(updatedItems) }));
  };

  const handleDeleteItemRow = (idx) => {
    const updatedItems = reviewData.items.filter((_, i) => i !== idx).map((item, index) => ({ ...item, sr_no: String(index + 1) }));
    setReviewData(prev => ({ ...prev, items: updatedItems, summary: recalculateSummary(updatedItems) }));
  };

  const handleSaveInvoice = async () => {
    setIsSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const response = await saveGSTInvoice(reviewData);
      if (response.success) {
        setSuccessMsg("✅ GST Invoice saved successfully!");
        if (onSaveSuccess) setTimeout(onSaveSuccess, 1500);
      } else {
        setError(response.error || "Failed to save GST invoice.");
      }
    } catch (err) {
      const detail = err.response?.data?.details || '';
      const message = err.response?.data?.error || err.message || "Failed to save GST invoice.";
      setError(detail ? `${message} — ${detail}` : message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
      <div className="review-bill-container animate-fade-in">
        <h2>Review &amp; Edit GST Invoice</h2>
        {error && <div className="error-box" >{error}</div>}
        {successMsg && <div className="success-box">{successMsg}</div>}

        <div className="invoice-box">

          {/* Seller & Invoice Info Sections */}
          <div >
            {/* Seller Information */}
            <div>
              <h3 >Seller Information</h3>
              <div>
                <div>
                  <label>Seller Name</label>
                  <input type="text" value={reviewData.seller_information.seller_name || ''} onChange={(e) => handleSectionChange('seller_information', 'seller_name', e.target.value)} />
                </div>
                <div>
                  <label style={{ color: '#a1a1aa', fontSize: '0.78rem', display: 'block', marginBottom: '0.2rem' }}>Seller Address</label>
                  <textarea rows={2} value={reviewData.seller_information.seller_address || ''} onChange={(e) => handleSectionChange('seller_information', 'seller_address', e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ color: '#a1a1aa', fontSize: '0.78rem', display: 'block', marginBottom: '0.2rem' }}>GSTIN</label>
                    <input type="text" value={reviewData.seller_information.gstin || ''} onChange={(e) => handleSectionChange('seller_information', 'gstin', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ color: '#a1a1aa', fontSize: '0.78rem', display: 'block', marginBottom: '0.2rem' }}>FSSAI Number</label>
                    <input type="text" value={reviewData.seller_information.fssai_number || ''} onChange={(e) => handleSectionChange('seller_information', 'fssai_number', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Invoice Information */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ color: '#60a5fa', margin: '0 0 1rem 0', fontSize: '1.05rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.4rem' }}>Invoice Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ color: '#a1a1aa', fontSize: '0.78rem', display: 'block', marginBottom: '0.2rem' }}>Invoice Number</label>
                    <input type="text" value={reviewData.invoice_information.invoice_number || ''} onChange={(e) => handleSectionChange('invoice_information', 'invoice_number', e.target.value)} style={{ width: '100%', padding: '0.45rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#fff' }} />
                  </div>
                  <div>
                    <label style={{ color: '#a1a1aa', fontSize: '0.78rem', display: 'block', marginBottom: '0.2rem' }}>Order Number</label>
                    <input type="text" value={reviewData.invoice_information.order_number || ''} onChange={(e) => handleSectionChange('invoice_information', 'order_number', e.target.value)} style={{ width: '100%', padding: '0.45rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#fff' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ color: '#a1a1aa', fontSize: '0.78rem', display: 'block', marginBottom: '0.2rem' }}>Invoice Date</label>
                    <input type="text" value={reviewData.invoice_information.invoice_date || ''} onChange={(e) => handleSectionChange('invoice_information', 'invoice_date', e.target.value)} style={{ width: '100%', padding: '0.45rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#fff' }} />
                  </div>
                  <div>
                    <label style={{ color: '#a1a1aa', fontSize: '0.78rem', display: 'block', marginBottom: '0.2rem' }}>Place Of Supply</label>
                    <input type="text" value={reviewData.invoice_information.place_of_supply || ''} onChange={(e) => handleSectionChange('invoice_information', 'place_of_supply', e.target.value)} style={{ width: '100%', padding: '0.45rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#fff' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bill To & Ship To Sections */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            {/* Bill To */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ color: '#60a5fa', margin: '0 0 1rem 0', fontSize: '1.05rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.4rem' }}>Bill To</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div>
                  <label style={{ color: '#a1a1aa', fontSize: '0.78rem', display: 'block', marginBottom: '0.2rem' }}>Name</label>
                  <input type="text" value={reviewData.bill_to.name || ''} onChange={(e) => handleSectionChange('bill_to', 'name', e.target.value)} style={{ width: '100%', padding: '0.45rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ color: '#a1a1aa', fontSize: '0.78rem', display: 'block', marginBottom: '0.2rem' }}>Address</label>
                  <textarea rows={2} value={reviewData.bill_to.address || ''} onChange={(e) => handleSectionChange('bill_to', 'address', e.target.value)} style={{ width: '100%', padding: '0.45rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#fff', resize: 'vertical' }} />
                </div>
              </div>
            </div>

            {/* Ship To */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ color: '#60a5fa', margin: '0 0 1rem 0', fontSize: '1.05rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.4rem' }}>Ship To</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div>
                  <label style={{ color: '#a1a1aa', fontSize: '0.78rem', display: 'block', marginBottom: '0.2rem' }}>Name</label>
                  <input type="text" value={reviewData.ship_to.name || ''} onChange={(e) => handleSectionChange('ship_to', 'name', e.target.value)} style={{ width: '100%', padding: '0.45rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#fff' }} />
                </div>
                <div>
                  <label style={{ color: '#a1a1aa', fontSize: '0.78rem', display: 'block', marginBottom: '0.2rem' }}>Address</label>
                  <textarea rows={2} value={reviewData.ship_to.address || ''} onChange={(e) => handleSectionChange('ship_to', 'address', e.target.value)} style={{ width: '100%', padding: '0.45rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#fff', resize: 'vertical' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Item Table */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
            <h3 style={{ color: '#60a5fa', margin: 0, fontSize: '1.1rem' }}>Items Table</h3>
            <button onClick={handleAddItemRow} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.45rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '500', transition: 'background-color 0.2s' }}>+ Add Row</button>
          </div>

          <div className="metro-table-wrapper" style={{ margin: '0 0 2rem 0' }}>
            <table className="metro-table" style={{ minWidth: '1600px' }}>
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Sr No</th>
                  <th style={{ width: '250px' }}>Item Description</th>
                  <th style={{ width: '100px' }}>Unit MRP</th>
                  <th style={{ width: '100px' }}>HSN</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>Qty</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Product Rate</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>Discount %</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Taxable Amt</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>CGST %</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>SGST %</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>CGST Amt</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>SGST Amt</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>Cess %</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Cess Amt</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>Total Amount</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {reviewData.items.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <input type="text" value={item.sr_no || ''} onChange={(e) => handleItemChange(idx, 'sr_no', e.target.value)} style={{ textAlign: 'center' }} />
                    </td>
                    <td>
                      <input type="text" value={item.item_description || ''} onChange={(e) => handleItemChange(idx, 'item_description', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" step="0.01" value={item.unit_mrp} onChange={(e) => handleItemChange(idx, 'unit_mrp', e.target.value)} />
                    </td>
                    <td>
                      <input type="text" value={item.hsn || ''} onChange={(e) => handleItemChange(idx, 'hsn', e.target.value)} style={{ textAlign: 'center' }} />
                    </td>
                    <td>
                      <input type="number" step="any" value={item.qty} onChange={(e) => handleItemChange(idx, 'qty', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" step="0.01" value={item.product_rate} onChange={(e) => handleItemChange(idx, 'product_rate', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" step="any" value={item.discount_percentage} onChange={(e) => handleItemChange(idx, 'discount_percentage', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" step="0.01" value={item.taxable_amount} onChange={(e) => handleItemChange(idx, 'taxable_amount', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" step="any" value={item.cgst_percentage} onChange={(e) => handleItemChange(idx, 'cgst_percentage', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" step="any" value={item.sgst_percentage} onChange={(e) => handleItemChange(idx, 'sgst_percentage', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" step="0.01" value={item.cgst_amount} onChange={(e) => handleItemChange(idx, 'cgst_amount', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" step="0.01" value={item.sgst_amount} onChange={(e) => handleItemChange(idx, 'sgst_amount', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" step="any" value={item.cess_percentage} onChange={(e) => handleItemChange(idx, 'cess_percentage', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" step="0.01" value={item.cess_amount} onChange={(e) => handleItemChange(idx, 'cess_amount', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" step="0.01" value={item.total_amount} onChange={(e) => handleItemChange(idx, 'total_amount', e.target.value)} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => handleDeleteItemRow(idx)} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recalculated Summary Totals */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <span style={{ display: 'block', fontSize: '0.78rem', color: '#a1a1aa', marginBottom: '0.2rem' }}>Total Net Amount (Taxable)</span>
              <span style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff' }}>₹{(reviewData.summary.total_net_amount || 0).toFixed(2)}</span>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.78rem', color: '#a1a1aa', marginBottom: '0.2rem' }}>Total Discount Amount</span>
              <span style={{ fontSize: '1.25rem', fontWeight: '600', color: '#f59e0b' }}>₹{(reviewData.summary.total_discount_amount || 0).toFixed(2)}</span>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.78rem', color: '#a1a1aa', marginBottom: '0.2rem' }}>Total Tax Amount (CGST+SGST+Cess)</span>
              <span style={{ fontSize: '1.25rem', fontWeight: '600', color: '#3b82f6' }}>₹{(reviewData.summary.total_tax_amount || 0).toFixed(2)}</span>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.78rem', color: '#a1a1aa', marginBottom: '0.2rem' }}>Grand Total</span>
              <span style={{ fontSize: '1.45rem', fontWeight: '700', color: '#10b981' }}>₹{(reviewData.summary.grand_total || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="review-actions" style={{ marginTop: '2rem' }}>
          <button className="btn btn-ghost" onClick={onCancel} disabled={isSaving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveInvoice} disabled={isSaving || reviewData.items.length === 0}>
            {isSaving ? 'Saving...' : 'Save GST Invoice'}
          </button>
        </div>
      </div>
    );
};
export default ReviewGSTBill;
