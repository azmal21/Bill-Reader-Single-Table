import React from 'react';

const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
};

const BillSummaryCards = ({ bill, items, sgst, cgst, grandTotal }) => {
  return (
    <div className="detail-summary">
      <div className="summary-card">
        <span className="summary-card-label">Restaurant</span>
        <span className="summary-card-value">{bill.restaurant_name || '—'}</span>
      </div>
      <div className="summary-card">
        <span className="summary-card-label">Date</span>
        <span className="summary-card-value">{formatDateTime(bill.created_at)}</span>
      </div>
      <div className="summary-card">
        <span className="summary-card-label">Total Items</span>
        <span className="summary-card-value">{items.length}</span>
      </div>
      <div className="summary-card summary-card-highlight">
        <span className="summary-card-label">Grand Total</span>
        <span className="summary-card-value">₹{grandTotal.toFixed(2)}</span>
      </div>
    </div>
  );
};

export default BillSummaryCards;
