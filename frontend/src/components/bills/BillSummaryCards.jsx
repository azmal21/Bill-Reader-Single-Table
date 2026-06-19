import React from 'react';

const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
};

const BillSummaryCards = ({ bill, items, sgst, cgst, totalTax, grandTotal, entityLabel = "Restaurant", entityName }) => {
  return (
    <div className="detail-summary">
      <div className="summary-card">
        <span className="summary-card-label">{entityLabel}</span>
        <span className="summary-card-value">{entityName || bill.restaurant_name || '—'}</span>
      </div>
      <div className="summary-card">
        <span className="summary-card-label">Date</span>
        <span className="summary-card-value">{formatDateTime(bill.created_at)}</span>
      </div>
      <div className="summary-card">
        <span className="summary-card-label">Total Items</span>
        <span className="summary-card-value">{items.length}</span>
      </div>
      {sgst !== undefined && sgst > 0 && (
        <div className="summary-card">
          <span className="summary-card-label">SGST</span>
          <span className="summary-card-value">₹{sgst.toFixed(2)}</span>
        </div>
      )}
      {cgst !== undefined && cgst > 0 && (
        <div className="summary-card">
          <span className="summary-card-label">CGST</span>
          <span className="summary-card-value">₹{cgst.toFixed(2)}</span>
        </div>
      )}
      {totalTax !== undefined && (sgst === undefined || cgst === undefined) && totalTax > 0 && (
        <div className="summary-card">
          <span className="summary-card-label">Total Tax</span>
          <span className="summary-card-value">₹{totalTax.toFixed(2)}</span>
        </div>
      )}
      <div className="summary-card summary-card-highlight">
        <span className="summary-card-label">Grand Total</span>
        <span className="summary-card-value">₹{grandTotal.toFixed(2)}</span>
      </div>
    </div>
  );
};

export default BillSummaryCards;
