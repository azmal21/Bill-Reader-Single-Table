import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { fetchBills, deleteBill } from './services/api';

import Sidebar from './components/layout/Sidebar';
import UploadModal from './components/upload/UploadModal';
import ReviewBill from './components/bills/ReviewBill';

import DashboardPage from './pages/DashboardPage';
import BillsPage from './pages/BillsPage';
import BillDetailsPage from './pages/BillDetailsPage';

import './App.css';

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeModule = location.pathname.split('/')[1] || 'dashboard';
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
        const res = await fetchBills();
        if (res.success) {
          setBills(res.bills || []);
        } else {
          setBillsError(res.error || "Failed to load bills.");
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
        setRefreshTrigger(prev => prev + 1);
      } else {
        alert(data.error || "Failed to delete bill.");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("An error occurred while deleting.");
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', disabled: false },
    { id: 'bills', label: 'Bills', disabled: false },
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
                navigate('/bills');
              }}
              onCancel={() => setReviewData(null)}
            />
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            
            <Route 
              path="/bills" 
              element={<BillsPage 
                bills={bills} 
                billsLoading={billsLoading} 
                billsError={billsError} 
                handleDelete={handleDelete} 
                openUploadModal={() => setShowUploadModal(true)} 
              />} 
            />
            <Route path="/bills/:id" element={<BillDetailsPage handleDelete={handleDelete} />} />

            {/* Legacy redirects */}
            <Route path="/restaurent" element={<Navigate to="/bills" replace />} />
            <Route path="/restaurant" element={<Navigate to="/bills" replace />} />
            <Route path="/metro/*" element={<Navigate to="/bills" replace />} />
            <Route path="/gst" element={<Navigate to="/bills" replace />} />
            <Route path="/single/*" element={<Navigate to="/bills" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        )}
      </div>

      <UploadModal
        show={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadSuccess={(data) => {
          // ===== DEBUG: Log data flowing through App =====
          console.log('%c\n========== APP: onUploadSuccess ==========', 'color: #e91e63; font-weight: bold;');
          console.log('%c📦 Received data:', 'color: #4caf50;', data);
          console.log(JSON.stringify(data, null, 2));
          console.log('%c==========================================', 'color: #e91e63; font-weight: bold;');
          // ===== END DEBUG =====
          
          if (data && data.saved) {
            setRefreshTrigger(prev => prev + 1);
            if (data.id) {
              navigate(`/bills/${data.id}`);
            }
          } else {
            setReviewData(data);
          }
        }}
      />
    </div>
  );
}

export default App;
