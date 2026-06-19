import React, { useState } from 'react';
import { saveBill } from '../../services/api';

const ReviewBill = ({ billData, onSaveSuccess, onCancel }) => {
  const [data, setData] = useState({ ...billData, sgst: billData.sgst || 0, cgst: billData.cgst || 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleItemChange = (index, field, value) => {
    const newItems = [...data.items];
    newItems[index][field] = value;
    if (field === 'quantity' || field === 'rate' || field === 'itemRate') {
      const q = parseFloat(newItems[index].quantity) || 0;
      const r = parseFloat(newItems[index].rate || newItems[index].itemRate) || 0;
      newItems[index].totalRate = q * r;
      newItems[index].total = q * r;
    }
    setData({ ...data, items: newItems });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      const formattedItems = data.items.map(item => ({
        name: item.name,
        quantity: parseFloat(item.quantity) || 0,
        rate: parseFloat(item.rate || item.itemRate) || 0,
        totalRate: parseFloat(item.totalRate || item.total) || 0
      }));

      const payload = {
        restaurantName: data.restaurantName,
        items: formattedItems,
        sgst: parseFloat(data.sgst) || 0,
        cgst: parseFloat(data.cgst) || 0,
        grandTotal: parseFloat(data.grandTotal) || 0
      };

      if (payload.sgst < 0 || payload.cgst < 0) {
        setError('SGST and CGST must be greater than or equal to 0.');
        setIsSaving(false);
        return;
      }

      const subtotal = formattedItems.reduce((sum, item) => sum + item.totalRate, 0);
      const expectedTotal = subtotal + payload.sgst + payload.cgst;
      if (payload.grandTotal < expectedTotal - 1.0) { // allow small precision gap
        setError(`Grand Total (${payload.grandTotal}) must be greater than or equal to subtotal + taxes (${expectedTotal.toFixed(2)}).`);
        setIsSaving(false);
        return;
      }

      const result = await saveBill(payload);
      if (result.success) {
        onSaveSuccess();
      } else {
        setError(result.error || 'Failed to save bill.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error saving bill');
    } finally {
      setIsSaving(false);
    }
  };

  const subtotal = data.items.reduce((sum, item) => sum + ((parseFloat(item.rate || item.itemRate) || 0) * (parseFloat(item.quantity) || 0)), 0);

  return (
    <div className="review-bill-container animate-fade-in">
      <h2>Review & Edit Bill</h2>
      {error && <div className="error-box">{error}</div>}

      <div className="invoice-box">
        <div className="invoice-header">
          <div className="invoice-divider">--------------------------------------------------</div>
          <input
            type="text"
            className="restaurant-name-input"
            value={data.restaurantName}
            onChange={(e) => setData({ ...data, restaurantName: e.target.value })}
          />
          <div className="invoice-divider">--------------------------------------------------</div>
        </div>

        <table className="invoice-table">
          <thead>
            <tr>
              <th className="left-align">Item Name</th>
              <th className="right-align">Qty</th>
              <th className="right-align">Rate</th>
              <th className="right-align">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => (
              <tr key={index}>
                <td className="left-align">
                  <input type="text" value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} />
                </td>
                <td className="right-align">
                  <input type="number" className="num-input" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} />
                </td>
                <td className="right-align">
                  <input type="number" step="0.01" className="num-input" value={item.rate || item.itemRate} onChange={(e) => handleItemChange(index, 'rate', e.target.value)} />
                </td>
                <td className="right-align">
                  <input type="number" step="0.01" className="num-input" value={item.totalRate || item.total} onChange={(e) => handleItemChange(index, 'totalRate', e.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="invoice-divider">--------------------------------------------------</div>

        <div className="invoice-summary">
          <div className="summary-row">
            <span>SGST</span>
            <span>
              ₹ <input type="number" step="0.01" className="num-input tax-input" value={data.sgst} onChange={(e) => setData({ ...data, sgst: e.target.value })} />
            </span>
          </div>
          <div className="summary-row">
            <span>CGST</span>
            <span>
              ₹ <input type="number" step="0.01" className="num-input tax-input" value={data.cgst} onChange={(e) => setData({ ...data, cgst: e.target.value })} />
            </span>
          </div>

          <div className="invoice-divider">--------------------------------------------------</div>

          <div className="summary-row grand-total-row">
            <span>Grand Total</span>
            <span>
              ₹ <input type="number" step="0.01" className="num-input total-input" value={data.grandTotal} onChange={(e) => setData({ ...data, grandTotal: e.target.value })} />
            </span>
          </div>

          <div className="invoice-divider">--------------------------------------------------</div>
        </div>
      </div>

      <div className="review-actions">
        <button className="btn btn-ghost" onClick={onCancel} disabled={isSaving}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Bill'}
        </button>
      </div>
    </div>
  );
};

export default ReviewBill;
