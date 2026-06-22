import React, { useState, useMemo } from 'react';
import { saveBill } from '../../services/api';

// ── Helpers ────────────────────────────────────────────────────────────────
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

// Column definitions for the line-items table
const ITEM_COLUMNS = [
  { key: 'item_code',  label: 'Item Code',   numeric: false },
  { key: 'item_name',  label: 'Description', numeric: false },
  { key: 'quantity',   label: 'Qty',         numeric: true  },
  { key: 'unit_price', label: 'Unit Price',  numeric: true  },
  { key: 'tax_amount', label: 'Tax Amt',     numeric: true  },
  { key: 'line_total', label: 'Line Total',  numeric: true  },
];

// ── Component ──────────────────────────────────────────────────────────────
const ReviewBill = ({ billData, onSaveSuccess, onCancel }) => {
  // Initialize state from extracted data
  const [data, setData] = useState({
    billData: {
      bill_type:       billData?.billData?.bill_type       || 'unknown',
      document_number: billData?.billData?.document_number || '',
      bill_date:       billData?.billData?.bill_date        || '',
      vendor_name:     billData?.billData?.vendor_name      || '',
      grand_total:     billData?.billData?.grand_total      || 0,
      item_count:      billData?.items?.length              || 0,
      sgst:            billData?.billData?.sgst             ?? 0,
      cgst:            billData?.billData?.cgst             ?? 0,
    },
    items: (billData?.items || []).map(item => ({
      item_code:  item.item_code  || '',
      item_name:  item.item_name  || item.name || item.articleName || item.item_description || '',
      quantity:   parseFloat(item.quantity)   || 1,
      unit_price: parseFloat(item.unit_price  || item.rate || item.itemRate || item.product_rate || item.netAmount) || 0,
      tax_amount: parseFloat(item.tax_amount  || item.taxAmount) || 0,
      line_total: parseFloat(item.line_total  || item.totalRate || item.total || item.totalAmountIncludingGST || item.total_amount) || 0,
    })),
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error,    setError]    = useState('');

  const isRestaurant = data.billData.bill_type === 'restaurant';

  // ── Derived: only keep columns that have at least one non-empty/non-zero value
  const visibleColumns = useMemo(
    () => ITEM_COLUMNS.filter(col => !isColumnEmpty(data.items, col.key)),
    [data.items]
  );

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleBillDataChange = (field, value) =>
    setData(prev => ({ ...prev, billData: { ...prev.billData, [field]: value } }));

  const handleItemChange = (index, field, value) => {
    setData(prev => {
      const items = prev.items.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        // Auto-recalculate line_total when qty or unit_price changes
        if (field === 'quantity' || field === 'unit_price') {
          const q  = parseFloat(updated.quantity)   || 0;
          const up = parseFloat(updated.unit_price)  || 0;
          const ta = parseFloat(updated.tax_amount)  || 0;
          updated.line_total = (q * up) + ta;
        }
        return updated;
      });
      return { ...prev, items };
    });
  };

  const addItemRow = () =>
    setData(prev => ({
      ...prev,
      items: [...prev.items, { item_code: '', item_name: '', quantity: 1, unit_price: 0, tax_amount: 0, line_total: 0 }],
    }));

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      const finalBillData = { ...data.billData, item_count: data.items.length };
      const result = await saveBill(finalBillData, data.items);
      if (result.success) {
        onSaveSuccess();
      } else {
        setError(result.error + (result.details ? ` — ${result.details}` : ''));
      }
    } catch (err) {
      setError(
        err.response?.data?.details
          ? `Error: ${err.response.data.details}`
          : err.response?.data?.error || err.message || 'Error saving bill'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="review-bill-container animate-fade-in">
      <h2>Review &amp; Edit Extracted Data</h2>
      <p className="review-subtitle">Please verify the OCR results before saving.</p>

      {error && <div className="error-box">{error}</div>}

      <div className="review-layout">
        {/* ── Header Fields ── */}
        <div className="review-section">
          <h3>Header Information</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Bill Type</label>
              <input type="text" value={data.billData.bill_type} disabled />
            </div>
            <div className="form-group">
              <label>Vendor Name</label>
              <input
                type="text"
                value={data.billData.vendor_name}
                onChange={e => handleBillDataChange('vendor_name', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Document Number</label>
              <input
                type="text"
                value={data.billData.document_number}
                onChange={e => handleBillDataChange('document_number', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input
                type="text"
                value={data.billData.bill_date}
                onChange={e => handleBillDataChange('bill_date', e.target.value)}
                placeholder="YYYY-MM-DD"
              />
            </div>
            <div className="form-group highlight-group">
              <label>Grand Total</label>
              <input
                type="number"
                step="0.01"
                value={data.billData.grand_total}
                onChange={e => handleBillDataChange('grand_total', parseFloat(e.target.value) || 0)}
              />
            </div>

            {/* SGST / CGST — only for restaurant bills */}
            {isRestaurant && (
              <>
                <div className="form-group">
                  <label>SGST</label>
                  <input
                    type="number" step="0.01"
                    value={data.billData.sgst ?? 0}
                    onChange={e => handleBillDataChange('sgst', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="form-group">
                  <label>CGST</label>
                  <input
                    type="number" step="0.01"
                    value={data.billData.cgst ?? 0}
                    onChange={e => handleBillDataChange('cgst', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Line Items Table ── */}
        <div className="review-section mt-4">
          <div className="section-header-flex">
            <h3>Line Items ({data.items.length})</h3>
            <button className="btn-secondary btn-small" onClick={addItemRow}>+ Add Row</button>
          </div>

          <div className="table-responsive">
            <table className="review-table">
              <thead>
                <tr>
                  {visibleColumns.map(col => (
                    <th key={col.key} className={col.numeric ? 'num-col' : ''}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr key={index}>
                    {visibleColumns.map(col => (
                      <td key={col.key} className={col.numeric ? 'num-col' : ''}>
                        <input
                          type={col.numeric ? 'number' : 'text'}
                          step={col.numeric ? '0.01' : undefined}
                          value={item[col.key] ?? ''}
                          onChange={e => handleItemChange(index, col.key, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={visibleColumns.length || 1} className="text-center text-muted">
                      No items extracted.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="review-actions">
        <button className="btn-secondary" onClick={onCancel} disabled={isSaving}>Cancel</button>
        <button className="btn-primary"   onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Bill'}
        </button>
      </div>
    </div>
  );
};

export default ReviewBill;
