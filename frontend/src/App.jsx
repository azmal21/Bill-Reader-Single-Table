import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { fetchBills, deleteBill, fetchMetroInvoices, fetchGSTInvoices } from './services/api';

import Sidebar from './components/layout/Sidebar';
import UploadModal from './components/upload/UploadModal';
import ReviewBill from './components/bills/ReviewBill';
import ReviewMetroBill from './components/bills/ReviewMetroBill';
import ReviewGSTBill from './components/bills/ReviewGSTBill';

import DashboardPage from './pages/DashboardPage';
import RestaurantBillsPage from './pages/RestaurantBillsPage';
import MetroInvoicesPage from './pages/MetroInvoicesPage';
import GSTInvoicesPage from './pages/GSTInvoicesPage';
import RestaurantBillDetailsPage from './pages/RestaurentBillDetailsPage';
import MetroBillDetailsPage from './pages/MetroBillDetailsPage';

import './App.css';

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeModule = location.pathname.split('/')[1] === 'restaurent' ? 'restaurant' : (location.pathname.split('/')[1] || 'dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [restaurantBills, setRestaurantBills] = useState([]);
  const [metroBills, setMetroBills] = useState([]);
  const [gstBills, setGstBills] = useState([]);

  const [billsLoading, setBillsLoading] = useState(true);
  const [billsError, setBillsError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState('restaurant'); // 'restaurant', 'metro', 'gst'
  const [reviewData, setReviewData] = useState(null);

  useEffect(() => {
    const loadBills = async () => {
      setBillsLoading(true);
      try {
        const [resBills, resMetro, resGst] = await Promise.all([
          fetchBills(),
          fetchMetroInvoices().catch(() => ({ success: false, invoices: [] })),
          fetchGSTInvoices().catch(() => ({ success: false, invoices: [] }))
        ]);

        if (resBills.success) setRestaurantBills(resBills.bills || []);
        if (resMetro.success) setMetroBills(resMetro.invoices || resMetro.data || []);
        if (resGst.success) setGstBills(resGst.invoices || resGst.data || []);

      } catch (err) {
        console.error("Failed to load bills:", err);
        setBillsError("Failed to fetch data from the database.");
      } finally {
        setBillsLoading(false);
      }
    };
    loadBills();
  }, [refreshTrigger]);

  const handleDelete = async (id, type) => {
    if (!window.confirm("Are you sure you want to delete this bill?")) return;
    try {
      let data;
      if (type === 'metro') {
        const { deleteMetroInvoice } = await import('./services/api');
        data = await deleteMetroInvoice(id);
      } else if (type === 'gst') {
        const { deleteGSTInvoice } = await import('./services/api');
        data = await deleteGSTInvoice(id);
      } else {
        data = await deleteBill(id);
      }

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
    { id: 'restaurant', label: 'Restaurant Bills', disabled: false },
    { id: 'metro', label: 'Metro Invoices', disabled: false },
    { id: 'gst', label: 'GST Invoices', disabled: false },
  ];

  return (
    <div className="app sidebar-layout">
      <Sidebar sidebarCollapsed={sidebarCollapsed} activeModule={activeModule} navItems={navItems} />

      <div className="main-content">
        {reviewData ? (
          <div className="review-wrapper">
            {uploadType === 'metro' ? (
              <ReviewMetroBill
                billData={reviewData}
                onSaveSuccess={() => {
                  setRefreshTrigger(prev => prev + 1);
                  setReviewData(null);
                  navigate('/metro');
                }}
                onCancel={() => setReviewData(null)}
              />
            ) : uploadType === 'gst' ? (
              <ReviewGSTBill
                billData={reviewData}
                onSaveSuccess={() => {
                  setRefreshTrigger(prev => prev + 1);
                  setReviewData(null);
                  navigate('/gst');
                }}
                onCancel={() => setReviewData(null)}
              />
            ) : (
              <ReviewBill
                billData={reviewData}
                onSaveSuccess={() => {
                  setRefreshTrigger(prev => prev + 1);
                  setReviewData(null);
                  navigate('/restaurent');
                }}
                onCancel={() => setReviewData(null)}
              />
            )}
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            <Route path="/dashboard" element={<DashboardPage />} />

            <Route path="/restaurent" element={<RestaurantBillsPage bills={restaurantBills} billsLoading={billsLoading} billsError={billsError} handleDelete={(id) => handleDelete(id, 'restaurant')} openUploadModal={() => { setUploadType('restaurant'); setShowUploadModal(true); }} />} />
            <Route path="/restaurant" element={<Navigate to="/restaurent" replace />} />
            <Route path="/metro" element={<MetroInvoicesPage bills={metroBills} billsLoading={billsLoading} billsError={billsError} handleDelete={(id) => handleDelete(id, 'metro')} openUploadModal={() => { setUploadType('metro'); setShowUploadModal(true); }} />} />
            <Route path="/gst" element={<GSTInvoicesPage bills={gstBills} billsLoading={billsLoading} billsError={billsError} handleDelete={(id) => handleDelete(id, 'gst')} openUploadModal={() => { setUploadType('gst'); setShowUploadModal(true); }} />} />

            <Route path="/single/:id" element={<RestaurantBillDetailsPage bills={restaurantBills} billsLoading={billsLoading} handleDelete={(id) => handleDelete(id, 'restaurant')} />} />
            <Route path="/metro/single/:id" element={<MetroBillDetailsPage handleDelete={(id) => handleDelete(id, 'metro')} />} />
          </Routes>
        )}
      </div>

      <UploadModal
        show={showUploadModal}
        uploadType={uploadType}
        onClose={() => setShowUploadModal(false)}
        onUploadSuccess={(data) => {
          if (data && data.saved) {
            setRefreshTrigger(prev => prev + 1);
            if (data.type === 'metro' && data.id) {
              navigate(`/metro/single/${data.id}`);
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
