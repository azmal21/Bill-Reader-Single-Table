const fs = require('fs');

let content = fs.readFileSync('/home/thidiff/Bill-Reader/frontend/src/App.jsx', 'utf8');

content = content.replace(
  "import { useState, useRef, useEffect, useCallback } from 'react';",
  "import { useState, useRef, useEffect, useCallback } from 'react';\nimport { Routes, Route, useNavigate, useLocation, Navigate, Link, useParams } from 'react-router-dom';"
);

content = content.replace(
  "function App() {",
  "function App() {\n  const navigate = useNavigate();\n  const location = useLocation();"
);

content = content.replace(
  "const [activeModule, setActiveModule] = useState('restaurant');",
  "const activeModule = location.pathname.split('/')[1] === 'restaurent' ? 'restaurant' : (location.pathname.split('/')[1] || 'dashboard');"
);

// We'll replace the sidebar nav click handler
content = content.replace(
  "onClick={() => !item.disabled && setActiveModule(item.id)}",
  "onClick={() => { if (!item.disabled) { navigate(item.id === 'restaurant' ? '/restaurent' : `/${item.id}`); } }}"
);

// We'll replace the main content rendering logic
const mainContentRegex = /<div className="main-content">([\s\S]*?){\/\* ══════════════════════════════════════════════════════\n          UPLOAD MODAL/;
const mainContentReplacement = `<div className="main-content">

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
            
            <Route path="/dashboard" element={
              <div style={{padding: '2rem'}}>
                <h1 className="page-title">Dashboard</h1>
                <p style={{marginTop: '1rem', color: '#6b7280'}}>Welcome to Bill Reader Dashboard. Please select a module from the sidebar.</p>
              </div>
            } />

            <Route path="/restaurent" element={<BillsList title="Restaurant Bills" />} />
            <Route path="/restaurant" element={<Navigate to="/restaurent" replace />} />
            <Route path="/metro" element={<BillsList title="Metro Invoices" />} />
            <Route path="/gst" element={<BillsList title="GST Invoices" />} />
            
            <Route path="/single/:id" element={<SingleBillView />} />
          </Routes>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          UPLOAD MODAL`;

content = content.replace(mainContentRegex, mainContentReplacement);

// We need to define BillsList and SingleBillView as local components or inline functions inside App.
// Let's create these as functions before the return statement.

const inlineComponents = `
  const BillsList = ({ title }) => (
    <>
      <header className="page-header">
        <div className="page-header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 className="page-title">{title}</h1>
          <button className="add-btn import-btn" onClick={openUploadModal} id="add-bill-btn">
            <span className="add-btn-icon">📥</span>
            Import
          </button>
        </div>
        <div className="page-header-right">
        </div>
      </header>

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

      <div className="table-container">
        {billsLoading && bills.length === 0 ? (
          <div className="table-empty">
            <div className="table-spinner" />
            <p>Loading bills...</p>
          </div>
        ) : billsError ? (
          <div className="table-empty table-error">
            <p>⚠️ {billsError}</p>
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="table-empty">
            <div className="empty-icon">📄</div>
            <p>No bills found. Click <strong>+ Add</strong> to upload your first bill.</p>
          </div>
        ) : (
          <>
            <table className="bills-table" id="bills-table">
              <thead>
                <tr>
                  <th className="col-checkbox"><input type="checkbox" disabled /></th>
                  <th className="col-date sortable">Date<span className="sort-arrow">▼</span></th>
                  <th className="col-restaurant sortable">Restaurant<span className="sort-arrow">▼</span></th>
                  <th className="col-items sortable">Items<span className="sort-arrow">▼</span></th>
                  <th className="col-sgst sortable">SGST<span className="sort-arrow">▼</span></th>
                  <th className="col-cgst sortable">CGST<span className="sort-arrow">▼</span></th>
                  <th className="col-total sortable">Grand Total<span className="sort-arrow">▼</span></th>
                  <th className="col-created sortable">Created At<span className="sort-arrow">▼</span></th>
                  <th className="col-status">Status</th>
                  <th className="col-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((bill) => {
                  const itemCount = parseBillItems(bill).length;
                  return (
                    <tr key={bill.id}>
                      <td className="col-checkbox"><input type="checkbox" /></td>
                      <td className="col-date"><span className="date-link">{formatDate(bill.created_at)}</span></td>
                      <td className="col-restaurant">
                        <Link className="restaurant-link" to={\`/single/\${bill.id}\`} style={{ textDecoration: 'none', color: '#3b82f6' }}>
                          {bill.restaurant_name || '—'}
                        </Link>
                      </td>
                      <td className="col-items">{itemCount} items</td>
                      <td className="col-sgst">₹{parseFloat(bill.sgst || 0).toFixed(2)}</td>
                      <td className="col-cgst">₹{parseFloat(bill.cgst || 0).toFixed(2)}</td>
                      <td className="col-total"><span className="total-badge">₹{parseFloat(bill.grand_total || 0).toFixed(2)}</span></td>
                      <td className="col-created">{formatDateTime(bill.created_at)}</td>
                      <td className="col-status"><span className="status-badge status-processed">Processed</span></td>
                      <td className="col-action">
                        <button className="action-menu-btn" onClick={() => handleDelete(bill.id)} title="Delete bill">🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="table-footer">
              <span className="table-footer-info">Showing 1 to {filteredBills.length} of {bills.length} entries</span>
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

  const SingleBillView = () => {
    const { id } = useParams();
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
            <button className="back-btn" onClick={() => navigate(-1)} id="back-to-list">
              ← Back
            </button>
            <h1 className="page-title">{bill.restaurant_name || 'Bill Details'}</h1>
          </div>
          <div className="page-header-right">
            <button
              className="delete-detail-btn"
              onClick={async () => {
                await handleDelete(bill.id);
                navigate(-1);
              }}
            >
              🗑️ Delete Bill
            </button>
          </div>
        </header>

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

  return (
`;

content = content.replace("  return (", inlineComponents);

fs.writeFileSync('/home/thidiff/Bill-Reader/frontend/src/App.jsx', content);
console.log("Updated App.jsx successfully.");
