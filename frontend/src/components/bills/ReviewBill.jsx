import React, { useState } from 'react';
import { saveBill } from '../../services/api';

const ReviewBill = ({ billData, onSaveSuccess, onCancel }) => {
  // ===== DEBUG: Log data received by ReviewBill =====
  console.log('%c\n========== REVIEW BILL: Received Props ==========', 'color: #ff5722; font-weight: bold;');
  console.log('%c📄 Raw Text (Plain):', 'color: #ff9800;', billData?.rawText);
  console.log('%c📦 Bill Data (JSON):', 'color: #4caf50;');
  console.log(JSON.stringify(billData?.billData, null, 2));
  console.log('%c📋 Items (JSON):', 'color: #9c27b0;');
  console.log(JSON.stringify(billData?.items, null, 2));
  console.log('%c=================================================', 'color: #ff5722; font-weight: bold;');
  // ===== END DEBUG =====
  
  // Initialize state with the unified schema structure
  const [data, setData] = useState({
    billData: {
      bill_type: billData?.billData?.bill_type || 'unknown',
      document_number: billData?.billData?.document_number || '',
      bill_date: billData?.billData?.bill_date || '',
      vendor_name: billData?.billData?.vendor_name || '',
      grand_total: billData?.billData?.grand_total || 0,
      item_count: billData?.items?.length || 0,
      sgst: billData?.billData?.sgst ?? 0,
      cgst: billData?.billData?.cgst ?? 0,
    },
    items: (billData?.items || []).map(item => ({
      item_code: item.item_code || '',
      item_name: item.item_name || item.name || item.articleName || item.item_description || '',
      quantity: parseFloat(item.quantity) || 1,
      unit_price: parseFloat(item.unit_price || item.rate || item.itemRate || item.product_rate || item.netAmount) || 0,
      tax_amount: parseFloat(item.tax_amount || item.taxAmount) || 0,
      line_total: parseFloat(item.line_total || item.totalRate || item.total || item.totalAmountIncludingGST || item.total_amount) || 0
    }))
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleBillDataChange = (field, value) => {
    setData({
      ...data,
      billData: {
        ...data.billData,
        [field]: value
      }
    });
  };

  const isRestaurant = data.billData.bill_type === 'restaurant';

  const handleItemChange = (index, field, value) => {
    const newItems = [...data.items];
    newItems[index][field] = value;
    
    // Auto-calculate line total if quantity or unit_price changes
    if (field === 'quantity' || field === 'unit_price') {
      const q = parseFloat(newItems[index].quantity) || 0;
      const up = parseFloat(newItems[index].unit_price) || 0;
      const ta = parseFloat(newItems[index].tax_amount) || 0;
      newItems[index].line_total = (q * up) + ta;
    }

    setData({ ...data, items: newItems });
  };

  const addItemRow = () => {
    setData({
      ...data,
      items: [
        ...data.items,
        { item_code: '', item_name: '', quantity: 1, unit_price: 0, tax_amount: 0, line_total: 0 }
      ]
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      const finalBillData = {
        ...data.billData,
        item_count: data.items.length
      };

      const result = await saveBill(finalBillData, data.items);
      
      if (result.success) {
        onSaveSuccess();
      } else {
        setError(result.error + (result.details ? ` Details: ${result.details}` : ''));
      }
    } catch (err) {
      setError(err.response?.data?.details ? `Error: ${err.response.data.details}` : (err.response?.data?.error || err.message || 'Error saving bill'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="review-bill-container animate-fade-in">
      <h2>Review & Edit Extracted Data</h2>
      <p className="review-subtitle">Please verify the OCR results before saving.</p>
      
      {error && <div className="error-box">{error}</div>}

      <div className="review-layout">
        <div className="review-section">
          <h3>Header Information</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Bill Type</label>
              <input 
                type="text" 
                value={data.billData.bill_type} 
                onChange={(e) => handleBillDataChange('bill_type', e.target.value)} 
                disabled
              />
            </div>
            <div className="form-group">
              <label>Vendor Name</label>
              <input 
                type="text" 
                value={data.billData.vendor_name} 
                onChange={(e) => handleBillDataChange('vendor_name', e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label>Document Number</label>
              <input 
                type="text" 
                value={data.billData.document_number} 
                onChange={(e) => handleBillDataChange('document_number', e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input 
                type="text" 
                value={data.billData.bill_date} 
                onChange={(e) => handleBillDataChange('bill_date', e.target.value)} 
                placeholder="YYYY-MM-DD"
              />
            </div>
            <div className="form-group highlight-group">
              <label>Grand Total</label>
              <input 
                type="number" 
                step="0.01"
                value={data.billData.grand_total} 
                onChange={(e) => handleBillDataChange('grand_total', parseFloat(e.target.value) || 0)} 
              />
            </div>

            {/* ── SGST / CGST: only for restaurant bills ── */}
            {isRestaurant && (
              <>
                <div className="form-group">
                  <label>SGST</label>
                  <input
                    type="number"
                    step="0.01"
                    value={data.billData.sgst ?? 0}
                    onChange={(e) => handleBillDataChange('sgst', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="form-group">
                  <label>CGST</label>
                  <input
                    type="number"
                    step="0.01"
                    value={data.billData.cgst ?? 0}
                    onChange={(e) => handleBillDataChange('cgst', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="review-section mt-4">
          <div className="section-header-flex">
            <h3>Line Items ({data.items.length})</h3>
            <button className="btn-secondary btn-small" onClick={addItemRow}>+ Add Row</button>
          </div>
          
          <div className="table-responsive">
            <table className="review-table">
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Description</th>
                  <th className="num-col">Qty</th>
                  <th className="num-col">Unit Price</th>
                  <th className="num-col">Tax Amount</th>
                  <th className="num-col">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr key={index}>
                    <td>
                      <input type="text" value={item.item_code} onChange={(e) => handleItemChange(index, 'item_code', e.target.value)} />
                    </td>
                    <td>
                      <input type="text" value={item.item_name} onChange={(e) => handleItemChange(index, 'item_name', e.target.value)} />
                    </td>
                    <td className="num-col">
                      <input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} />
                    </td>
                    <td className="num-col">
                      <input type="number" step="0.01" value={item.unit_price} onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)} />
                    </td>
                    <td className="num-col">
                      <input type="number" step="0.01" value={item.tax_amount} onChange={(e) => handleItemChange(index, 'tax_amount', e.target.value)} />
                    </td>
                    <td className="num-col">
                      <input type="number" step="0.01" value={item.line_total} onChange={(e) => handleItemChange(index, 'line_total', e.target.value)} />
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center text-muted">No items extracted.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="review-actions">
        <button className="btn-secondary" onClick={onCancel} disabled={isSaving}>Cancel</button>
        <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Bill'}
        </button>
      </div>
    </div>
  );
};

export default ReviewBill;
