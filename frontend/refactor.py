import os
import re
import sys

def main():
    os.makedirs('src/pages', exist_ok=True)
    os.makedirs('src/components/layout', exist_ok=True)
    os.makedirs('src/components/bills', exist_ok=True)
    os.makedirs('src/components/upload', exist_ok=True)
    os.makedirs('src/components/common', exist_ok=True)

    # We will write out the exact files based on the App.jsx and requested structure.

    # 1. Sidebar.jsx
    with open('src/components/layout/Sidebar.jsx', 'w') as f:
        f.write('''import React from 'react';
import { useNavigate } from 'react-router-dom';

const Sidebar = ({ sidebarCollapsed, activeModule, navItems }) => {
  const navigate = useNavigate();

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🧾</div>
          {!sidebarCollapsed && (
            <div className="sidebar-logo-text">
              <span className="sidebar-brand">Bill Reader</span>
              <span className="sidebar-brand-tag">OCR Engine</span>
            </div>
          )}
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`sidebar-nav-item ${activeModule === item.id ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
            onClick={() => { if (!item.disabled) navigate(item.id === 'restaurant' ? '/restaurent' : `/${item.id}`); }}
            title={item.label}
            disabled={item.disabled}
          >
            <span className="sidebar-nav-icon">{item.icon}</span>
            {!sidebarCollapsed && <span className="sidebar-nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">BR</div>
          {!sidebarCollapsed && (
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">Bill Reader</span>
              <span className="sidebar-user-role">Admin</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
''')

    # 2. UploadModal.jsx
    with open('src/components/upload/UploadModal.jsx', 'w') as f:
        f.write('''import React, { useRef, useState, useCallback } from 'react';
import { extractTextFromImage } from '../../services/api';

const UploadModal = ({ show, onClose, onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const resetUploadState = useCallback(() => {
    setSelectedFile(null);
    setFilePreview(null);
    setUploadError('');
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = () => {
    if (isUploading) return;
    onClose();
    resetUploadState();
  };

  const handleFileSelect = useCallback((file) => {
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Only JPG/JPEG/PNG images are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File too large. Maximum size is 10 MB.');
      return;
    }
    setUploadError('');
    setSelectedFile(file);
    setFilePreview(URL.createObjectURL(file));
  }, []);

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    handleFileSelect(file);
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setUploadError('Please select an image file first.');
      return;
    }
    setIsUploading(true);
    setUploadError('');
    setUploadProgress(0);

    try {
      const data = await extractTextFromImage(selectedFile, (percent) => {
        setUploadProgress(percent);
      });

      if (data.success) {
        console.log("========== RAW TESSERACT OCR TEXT ==========");
        console.log(data.rawText);
        console.log("========== EXTRACTION JSON ==========");
        console.log(JSON.stringify(data.billData, null, 2));

        onUploadSuccess(data.billData);
        resetUploadState();
        onClose();
      } else {
        setUploadError(data.message || data.error || 'Unknown error occurred.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Something went wrong.';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Upload Bill Image</h2>
          <button className="modal-close" onClick={handleClose} disabled={isUploading}>×</button>
        </div>
        <div className="modal-body">
          <div className={`modal-dropzone ${selectedFile ? 'has-file' : ''}`} onClick={() => !isUploading && fileInputRef.current?.click()}>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png" onChange={handleInputChange} className="hidden-input" id="modal-file-input" />
            {selectedFile ? (
              <div className="modal-preview">
                <img src={filePreview} alt="Preview" className="modal-preview-img" />
                <div className="modal-file-info">
                  <span className="modal-file-name">{selectedFile.name}</span>
                  <span className="modal-file-size">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                </div>
              </div>
            ) : (
              <div className="modal-drop-content">
                <div className="modal-drop-icon">📄</div>
                <p className="modal-drop-text">Click to select an image</p>
                <p className="modal-drop-hint">JPG, JPEG, PNG · Max 10 MB</p>
              </div>
            )}
          </div>
          {isUploading && (
            <div className="modal-progress">
              <div className="modal-progress-header">
                <span>{uploadProgress < 100 ? 'Uploading...' : 'Processing OCR...'}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="modal-progress-track">
                <div className="modal-progress-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}
          {uploadError && <div className="modal-error">⚠️ {uploadError}</div>}
        </div>
        <div className="modal-footer">
          <button className="modal-btn modal-btn-cancel" onClick={handleClose} disabled={isUploading}>Cancel</button>
          <button className="modal-btn modal-btn-import" onClick={handleImport} disabled={!selectedFile || isUploading} id="import-btn">
            {isUploading ? <><span className="btn-spinner" />Processing...</> : <>Import</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;
''')

    # 3. Toolbar.jsx
    with open('src/components/common/Toolbar.jsx', 'w') as f:
        f.write('''import React from 'react';

const Toolbar = ({ pageSize, setPageSize, searchQuery, setSearchQuery, sortOrder, setSortOrder }) => {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <div className="page-size-select">
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} id="page-size-select">
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="Search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} id="search-input" />
        </div>
      </div>
      <div className="toolbar-right">
        <div className="sort-select">
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} id="sort-select">
            <option value="newest">Most Recent</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
''')

    # 4. BillRow.jsx
    with open('src/components/bills/BillRow.jsx', 'w') as f:
        f.write('''import React from 'react';
import { Link } from 'react-router-dom';

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
};

const parseBillItems = (bill) => {
  try {
    const items = typeof bill.items === 'string' ? JSON.parse(bill.items) : bill.items;
    return Array.isArray(items) ? items : [];
  } catch { return []; }
};

const BillRow = ({ bill, handleDelete }) => {
  const itemCount = parseBillItems(bill).length;
  return (
    <tr>
      <td className="col-checkbox">
        <input type="checkbox" />
      </td>
      <td className="col-date">
        <span className="date-link">{formatDate(bill.created_at)}</span>
      </td>
      <td className="col-restaurant">
        <Link className="restaurant-link" to={`/single/${bill.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          {bill.restaurant_name || '—'}
        </Link>
      </td>
      <td className="col-items">{itemCount} items</td>
      <td className="col-sgst">₹{parseFloat(bill.sgst || 0).toFixed(2)}</td>
      <td className="col-cgst">₹{parseFloat(bill.cgst || 0).toFixed(2)}</td>
      <td className="col-total">
        <span className="total-badge">₹{parseFloat(bill.grand_total || 0).toFixed(2)}</span>
      </td>
      <td className="col-created">{formatDateTime(bill.created_at)}</td>
      <td className="col-status">
        <span className="status-badge status-processed">Processed</span>
      </td>
      <td className="col-action">
        <button className="action-menu-btn" onClick={() => handleDelete(bill.id)} title="Delete bill">🗑️</button>
      </td>
    </tr>
  );
};

export default BillRow;
''')

    # 5. BillTable.jsx
    with open('src/components/bills/BillTable.jsx', 'w') as f:
        f.write('''import React from 'react';
import BillRow from './BillRow';

const BillTable = ({ bills, handleDelete }) => {
  return (
    <table className="bills-table" id="bills-table">
      <thead>
        <tr>
          <th className="col-checkbox"><input type="checkbox" disabled /></th>
          <th className="col-date sortable">Date <span className="sort-arrow">▼</span></th>
          <th className="col-restaurant sortable">Restaurant <span className="sort-arrow">▼</span></th>
          <th className="col-items sortable">Items <span className="sort-arrow">▼</span></th>
          <th className="col-sgst sortable">SGST <span className="sort-arrow">▼</span></th>
          <th className="col-cgst sortable">CGST <span className="sort-arrow">▼</span></th>
          <th className="col-total sortable">Grand Total <span className="sort-arrow">▼</span></th>
          <th className="col-created sortable">Created At <span className="sort-arrow">▼</span></th>
          <th className="col-status">Status</th>
          <th className="col-action">Action</th>
        </tr>
      </thead>
      <tbody>
        {bills.map(bill => <BillRow key={bill.id} bill={bill} handleDelete={handleDelete} />)}
      </tbody>
    </table>
  );
};

export default BillTable;
''')

    # 6. BillList.jsx
    with open('src/components/bills/BillList.jsx', 'w') as f:
        f.write('''import React, { useState, useMemo } from 'react';
import Toolbar from '../common/Toolbar';
import BillTable from './BillTable';

const BillList = ({ title, bills, billsLoading, billsError, handleDelete, onImportClick, totalBills }) => {
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
            <span className="add-btn-icon">📥</span> Import
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
          <div className="table-empty">
            <div className="empty-icon">📄</div>
            <p>No bills found. Click <strong>+ Add</strong> to upload your first bill.</p>
          </div>
        ) : (
          <>
            <BillTable bills={filteredBills} handleDelete={handleDelete} />
            <div className="table-footer">
              <span className="table-footer-info">Showing 1 to {filteredBills.length} of {totalBills || bills.length} entries</span>
              <div className="pagination">
                <button className="page-btn" disabled>‹</button>
                <button className="page-btn active">1</button>
                <button className="page-btn" disabled>›</button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default BillList;
''')

    # 7. DashboardPage.jsx
    with open('src/pages/DashboardPage.jsx', 'w') as f:
        f.write('''import React from 'react';

const DashboardPage = () => {
  return (
    <div style={{padding: '2rem'}}>
      <h1 className="page-title">Dashboard</h1>
      <p style={{marginTop: '1rem', color: '#6b7280'}}>Welcome to Bill Reader Dashboard. Please select a module from the sidebar.</p>
    </div>
  );
};

export default DashboardPage;
''')

    # 8. RestaurantBillsPage.jsx
    with open('src/pages/RestaurantBillsPage.jsx', 'w') as f:
        f.write('''import React from 'react';
import BillList from '../components/bills/BillList';

const RestaurantBillsPage = ({ bills, billsLoading, billsError, handleDelete, openUploadModal }) => {
  return (
    <BillList 
      title="Restaurant Bills" 
      bills={bills} 
      billsLoading={billsLoading} 
      billsError={billsError} 
      handleDelete={handleDelete} 
      onImportClick={openUploadModal} 
      totalBills={bills.length}
    />
  );
};

export default RestaurantBillsPage;
''')

    # 9. MetroInvoicesPage.jsx
    with open('src/pages/MetroInvoicesPage.jsx', 'w') as f:
        f.write('''import React from 'react';
import BillList from '../components/bills/BillList';

const MetroInvoicesPage = ({ bills, billsLoading, billsError, handleDelete, openUploadModal }) => {
  return (
    <BillList 
      title="Metro Invoices" 
      bills={bills} 
      billsLoading={billsLoading} 
      billsError={billsError} 
      handleDelete={handleDelete} 
      onImportClick={openUploadModal} 
      totalBills={bills.length}
    />
  );
};

export default MetroInvoicesPage;
''')

    # 10. GSTInvoicesPage.jsx
    with open('src/pages/GSTInvoicesPage.jsx', 'w') as f:
        f.write('''import React from 'react';
import BillList from '../components/bills/BillList';

const GSTInvoicesPage = ({ bills, billsLoading, billsError, handleDelete, openUploadModal }) => {
  return (
    <BillList 
      title="GST Invoices" 
      bills={bills} 
      billsLoading={billsLoading} 
      billsError={billsError} 
      handleDelete={handleDelete} 
      onImportClick={openUploadModal} 
      totalBills={bills.length}
    />
  );
};

export default GSTInvoicesPage;
''')

    # 11. BillSummaryCards.jsx
    with open('src/components/bills/BillSummaryCards.jsx', 'w') as f:
        f.write('''import React from 'react';

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
      <div className="summary-card">
        <span className="summary-card-label">SGST</span>
        <span className="summary-card-value">₹{sgst.toFixed(2)}</span>
      </div>
      <div className="summary-card">
        <span className="summary-card-label">CGST</span>
        <span className="summary-card-value">₹{cgst.toFixed(2)}</span>
      </div>
      <div className="summary-card summary-card-highlight">
        <span className="summary-card-label">Grand Total</span>
        <span className="summary-card-value">₹{grandTotal.toFixed(2)}</span>
      </div>
    </div>
  );
};

export default BillSummaryCards;
''')

    # 12. BillDetailsPage.jsx
    with open('src/pages/BillDetailsPage.jsx', 'w') as f:
        f.write('''import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BillSummaryCards from '../components/bills/BillSummaryCards';

const parseBillItems = (bill) => {
  try {
    const items = typeof bill.items === 'string' ? JSON.parse(bill.items) : bill.items;
    return Array.isArray(items) ? items : [];
  } catch { return []; }
};

const BillDetailsPage = ({ bills, billsLoading, handleDelete }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const bill = bills.find(b => String(b.id) === id);
  
  if (billsLoading) return <div style={{padding: '2rem'}}>Loading...</div>;
  if (!bill) return <div style={{padding: '2rem'}}>Bill not found.</div>;

  const items = parseBillItems(bill);
  const subtotal = items.reduce((sum, item) => sum + parseFloat(item.totalRate || item.total || 0), 0);
  const sgst = parseFloat(bill.sgst || 0);
  const cgst = parseFloat(bill.cgst || 0);
  const grandTotal = parseFloat(bill.grand_total || 0);

  return (
    <>
      <header className="page-header">
        <div className="page-header-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="back-btn" onClick={() => navigate(-1)} id="back-to-list">← Back</button>
          <h1 className="page-title">{bill.restaurant_name || 'Bill Details'}</h1>
        </div>
        <div className="page-header-right">
          <button className="delete-detail-btn" onClick={async () => { await handleDelete(bill.id); navigate(-1); }}>🗑️ Delete Bill</button>
        </div>
      </header>

      <BillSummaryCards bill={bill} items={items} sgst={sgst} cgst={cgst} grandTotal={grandTotal} />

      <div className="table-container">
        <div className="detail-table-header">
          <h2 className="detail-table-title">Items ({items.length})</h2>
        </div>
        {items.length === 0 ? (
          <div className="table-empty"><p>No items found for this bill.</p></div>
        ) : (
          <table className="bills-table items-detail-table" id="items-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>#</th>
                <th>Item Name</th>
                <th>Quantity</th>
                <th>Rate</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ color: '#9ca3af' }}>{idx + 1}</td>
                  <td style={{ fontWeight: 500 }}>{item.name || '—'}</td>
                  <td>{item.quantity || '—'}</td>
                  <td>₹{parseFloat(item.rate || item.itemRate || 0).toFixed(2)}</td>
                  <td style={{ fontWeight: 600 }}>₹{parseFloat(item.totalRate || item.total || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="items-subtotal-row">
                <td colSpan="4" style={{ textAlign: 'right', fontWeight: 600, color: '#374151' }}>Subtotal</td>
                <td style={{ fontWeight: 700, color: '#1f2937' }}>₹{subtotal.toFixed(2)}</td>
              </tr>
              <tr className="items-tax-row">
                <td colSpan="4" style={{ textAlign: 'right', color: '#6b7280' }}>SGST</td>
                <td style={{ color: '#6b7280' }}>₹{sgst.toFixed(2)}</td>
              </tr>
              <tr className="items-tax-row">
                <td colSpan="4" style={{ textAlign: 'right', color: '#6b7280' }}>CGST</td>
                <td style={{ color: '#6b7280' }}>₹{cgst.toFixed(2)}</td>
              </tr>
              <tr className="items-grand-total-row">
                <td colSpan="4" style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.05rem', color: '#1f2937' }}>Grand Total</td>
                <td style={{ fontWeight: 700, fontSize: '1.05rem', color: '#059669' }}>₹{grandTotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </>
  );
};

export default BillDetailsPage;
''')

    # 13. App.jsx replacement
    with open('src/App.jsx', 'w') as f:
        f.write('''import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { fetchBills, deleteBill } from './services/api';

import Sidebar from './components/layout/Sidebar';
import UploadModal from './components/upload/UploadModal';
import ReviewBill from './components/ReviewBill';

import DashboardPage from './pages/DashboardPage';
import RestaurantBillsPage from './pages/RestaurantBillsPage';
import MetroInvoicesPage from './pages/MetroInvoicesPage';
import GSTInvoicesPage from './pages/GSTInvoicesPage';
import BillDetailsPage from './pages/BillDetailsPage';

import './App.css';

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeModule = location.pathname.split('/')[1] === 'restaurent' ? 'restaurant' : (location.pathname.split('/')[1] || 'dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [bills, setBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(true);
  const [billsError, setBillsError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [reviewData, setReviewData] = useState(null);

  useEffect(() => {
    const loadBills = async () => {
      setBillsLoading(true);
      try {
        const data = await fetchBills();
        if (data.success) {
          setBills(data.bills);
        } else {
          setBillsError(data.error);
        }
      } catch (err) {
        console.error("Failed to load bills:", err);
        setBillsError("Failed to fetch data from the database.");
      } finally {
        setBillsLoading(false);
      }
    };
    loadBills();
  }, [refreshTrigger]);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this bill?")) return;
    try {
      const data = await deleteBill(id);
      if (data.success) {
        setBills(prev => prev.filter(bill => bill.id !== id));
      } else {
        alert(data.error || "Failed to delete bill.");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("An error occurred while deleting.");
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', disabled: false },
    { id: 'restaurant', label: 'Restaurant Bills', icon: '🧾', disabled: false },
    { id: 'metro', label: 'Metro Invoices', icon: '🏬', disabled: false },
    { id: 'gst', label: 'GST Invoices', icon: '💸', disabled: false },
  ];

  return (
    <div className="app sidebar-layout">
      <Sidebar sidebarCollapsed={sidebarCollapsed} activeModule={activeModule} navItems={navItems} />

      <div className="main-content">
        {reviewData ? (
          <div className="review-wrapper">
            <ReviewBill
              billData={reviewData}
              onSaveSuccess={() => {
                setRefreshTrigger(prev => prev + 1);
                setReviewData(null);
                navigate('/restaurent');
              }}
              onCancel={() => setReviewData(null)}
            />
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            <Route path="/dashboard" element={<DashboardPage />} />

            <Route path="/restaurent" element={<RestaurantBillsPage bills={bills} billsLoading={billsLoading} billsError={billsError} handleDelete={handleDelete} openUploadModal={() => setShowUploadModal(true)} />} />
            <Route path="/restaurant" element={<Navigate to="/restaurent" replace />} />
            <Route path="/metro" element={<MetroInvoicesPage bills={bills} billsLoading={billsLoading} billsError={billsError} handleDelete={handleDelete} openUploadModal={() => setShowUploadModal(true)} />} />
            <Route path="/gst" element={<GSTInvoicesPage bills={bills} billsLoading={billsLoading} billsError={billsError} handleDelete={handleDelete} openUploadModal={() => setShowUploadModal(true)} />} />
            
            <Route path="/single/:id" element={<BillDetailsPage bills={bills} billsLoading={billsLoading} handleDelete={handleDelete} />} />
          </Routes>
        )}
      </div>

      <UploadModal 
        show={showUploadModal} 
        onClose={() => setShowUploadModal(false)} 
        onUploadSuccess={(data) => setReviewData(data)} 
      />
    </div>
  );
}

export default App;
''')

if __name__ == '__main__':
    main()
