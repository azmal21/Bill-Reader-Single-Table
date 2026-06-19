import React from 'react';

const Pagination = ({ currentLength, totalLength }) => {
  return (
    <div className="table-footer">
      <span className="table-footer-info">Showing 1 to {currentLength} of {totalLength} entries</span>
      <div className="pagination">
        <button className="page-btn" disabled>‹</button>
        <button className="page-btn active">1</button>
        <button className="page-btn" disabled>›</button>
      </div>
    </div>
  );
};

export default Pagination;
