import React, { useState, useMemo } from 'react';
import Toolbar from '../common/Toolbar';
import BillTable from './BillTable';
import Pagination from '../common/Pagination';
import EmptyState from '../common/EmptyState';

const BillList = ({ title, bills, billsLoading, billsError, handleDelete, onImportClick, totalBills, detailRoutePrefix = "/single", billType = "restaurant" }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [pageSize, setPageSize] = useState(50);

  const filteredBills = useMemo(() => {
    return bills
      .filter(bill => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          (bill.restaurant_name || '').toLowerCase().includes(q) ||
          (bill.vendor_name || '').toLowerCase().includes(q) ||
          (bill.supplier_name || '').toLowerCase().includes(q) ||
          String(bill.id).includes(q) ||
          String(bill.grand_total || '').includes(q)
        );
      })
      .sort((a, b) => {
        if (sortOrder === 'newest') return new Date(b.created_at) - new Date(a.created_at);
        if (sortOrder === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
        return 0;
      })
      .slice(0, pageSize);
  }, [bills, searchQuery, sortOrder, pageSize]);

  return (
    <>
      <header className="page-header">
        <div className="page-header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 className="page-title">{title}</h1>
          <button className="add-btn import-btn" onClick={onImportClick} id="add-bill-btn">
            <span className="add-btn-icon"></span> Import
          </button>
        </div>
      </header>

      <Toolbar
        pageSize={pageSize} setPageSize={setPageSize}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        sortOrder={sortOrder} setSortOrder={setSortOrder}
      />

      <div className="filter-chips">
        <span className="filter-label">Date:</span>
        <span className="filter-chip active">All <button className="chip-close">×</button></span>
      </div>

      <div className="table-container">
        {billsLoading && bills.length === 0 ? (
          <div className="table-empty">
            <div className="table-spinner" />
            <p>Loading bills...</p>
          </div>
        ) : billsError ? (
          <div className="table-empty table-error"><p>⚠️ {billsError}</p></div>
        ) : filteredBills.length === 0 ? (
          <EmptyState message={<span>No bills found. Click <strong>+ Add</strong> to upload your first bill.</span>} />
        ) : (
          <>
            <BillTable bills={filteredBills} handleDelete={handleDelete} detailRoutePrefix={detailRoutePrefix} billType={billType} />
            <Pagination currentLength={filteredBills.length} totalLength={totalBills || bills.length} />
          </>
        )}
      </div>
    </>
  );
};

export default BillList;
