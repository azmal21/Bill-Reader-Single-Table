import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../components/BillList.css';

const formatCurrency = (val) => {
  if (val === undefined || val === null || val === '') return '-';
  const num = parseFloat(val);
  if (isNaN(num)) return '-';
  return '₹' + num.toFixed(2);
};

const BillsPage = ({ bills, billsLoading, billsError, handleDelete, openUploadModal }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBills = bills.filter(b => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (b.vendor_name || '').toLowerCase().includes(term) ||
      (b.document_number || '').toLowerCase().includes(term) ||
      (b.bill_type || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="bills-page module-page">
      <div className="module-header">
        <div className="module-title-group">
          <h1>All Bills</h1>
          <span className="module-count">{filteredBills.length}</span>
        </div>
        <div className="module-actions">
          <button className="btn-primary" onClick={openUploadModal}>
            Import Bill
          </button>
        </div>
      </div>

      {billsError && <div className="error-message">{billsError}</div>}

      <div className="list-controls">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by vendor, document number, or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bill-list-container">
        {billsLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading bills...</p>
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📂</div>
            <h3>No Bills Found</h3>
            <p>{searchTerm ? "No bills match your search criteria." : "You haven't uploaded any bills yet."}</p>
            {!searchTerm && (
              <button className="btn-primary" onClick={openUploadModal}>
                Import Your First Bill
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="bill-table">
              <thead>
                <tr>

                  <th>Document Number</th>
                  <th>Date</th>
                  <th>Vendor Name</th>
                  <th>Total Amount</th>
                  <th>Item Count</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th className="actions-cell">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((bill) => (
                  <tr key={bill.id} onClick={() => navigate(`/bills/${bill.id}`)}>

                    <td className="fw-500">{bill.document_number || '-'}</td>
                    <td>{bill.bill_date ? new Date(bill.bill_date).toLocaleDateString() : '-'}</td>
                    <td>{bill.vendor_name || '-'}</td>
                    <td className="amount-cell">{formatCurrency(bill.grand_total)}</td>
                    <td>{bill.item_count || 0}</td>
                    <td>
                      <span className={`status-badge status-${(bill.status || 'saved').toLowerCase()}`}>
                        {bill.status || 'SAVED'}
                      </span>
                    </td>
                    <td>{new Date(bill.created_at).toLocaleDateString()}</td>
                    <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn-icon-danger"
                        onClick={() => handleDelete(bill.id)}
                        title="Delete Bill"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default BillsPage;
