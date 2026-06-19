import React from 'react';

const EmptyState = ({ message }) => {
  return (
    <div className="table-empty">
      <div className="empty-icon">📄</div>
      <p>{message || "No items found."}</p>
    </div>
  );
};

export default EmptyState;
