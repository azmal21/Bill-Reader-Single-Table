import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchBills, fetchMetroInvoices, fetchGSTInvoices } from '../services/api';
import './DashboardPage.css';

const DashboardPage = () => {
  const [stats, setStats] = useState({
    restaurant: { count: 0, total: 0 },
    metro: { count: 0, total: 0 },
    gst: { count: 0, total: 0 },
    recent: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [resBills, resMetro, resGst] = await Promise.all([
          fetchBills().catch(() => ({ success: false, bills: [] })),
          fetchMetroInvoices().catch(() => ({ success: false, invoices: [] })),
          fetchGSTInvoices().catch(() => ({ success: false, invoices: [] }))
        ]);

        const rBills = resBills.success ? (resBills.bills || []) : [];
        const mBills = resMetro.success ? (resMetro.invoices || resMetro.data || []) : [];
        const gBills = resGst.success ? (resGst.invoices || resGst.data || []) : [];

        // Sum amounts
        const rTotal = rBills.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);
        const mTotal = mBills.reduce((sum, b) => sum + (parseFloat(b.netAmount) || 0), 0);
        const gTotal = gBills.reduce((sum, b) => sum + (parseFloat(b.grandTotal) || 0), 0);

        // Aggregate recent bills
        const allRecent = [
          ...rBills.map(b => ({ id: b.id, type: 'restaurant', label: b.restaurant_name || 'Restaurant', date: b.date, amount: b.total_amount, link: `/single/${b.id}` })),
          ...mBills.map(b => ({ id: b.id, type: 'metro', label: b.storeName || 'Metro', date: b.invoiceDate, amount: b.netAmount, link: `/metro/single/${b.id}` })),
          ...gBills.map(b => ({ id: b.id, type: 'gst', label: b.sellerName || 'GST Seller', date: b.invoiceDate, amount: b.grandTotal, link: `/gst` }))
        ];

        // Sort by date (assuming ISO format or standard date strings)
        allRecent.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        setStats({
          restaurant: { count: rBills.length, total: rTotal },
          metro: { count: mBills.length, total: mTotal },
          gst: { count: gBills.length, total: gTotal },
          recent: allRecent.slice(0, 5) // Top 5 recent
        });

      } catch (error) {
        console.error("Error loading dashboard data", error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  const totalDocuments = stats.restaurant.count + stats.metro.count + stats.gst.count;
  const totalValue = stats.restaurant.total + stats.metro.total + stats.gst.total;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Overview Dashboard</h1>
          <p className="dashboard-subtitle">Here's a summary of your automated invoice processing.</p>
        </div>
      </header>

      <div className="dashboard-stats-grid">
        <div className="stat-card total">
          <div className="stat-header">
            <span className="stat-title">Total Processed</span>
            <div className="stat-icon">📄</div>
          </div>
          <div className="stat-value">{totalDocuments}</div>
          <div className="stat-subtext">Across all categories</div>
        </div>

        <div className="stat-card restaurant">
          <div className="stat-header">
            <span className="stat-title">Restaurant Bills</span>
            <div className="stat-icon">🍽️</div>
          </div>
          <div className="stat-value">{stats.restaurant.count}</div>
          <div className="stat-subtext">Total: {formatCurrency(stats.restaurant.total)}</div>
        </div>

        <div className="stat-card metro">
          <div className="stat-header">
            <span className="stat-title">Metro Invoices</span>
            <div className="stat-icon">🛒</div>
          </div>
          <div className="stat-value">{stats.metro.count}</div>
          <div className="stat-subtext">Total: {formatCurrency(stats.metro.total)}</div>
        </div>

        <div className="stat-card gst">
          <div className="stat-header">
            <span className="stat-title">GST Invoices</span>
            <div className="stat-icon">🏛️</div>
          </div>
          <div className="stat-value">{stats.gst.count}</div>
          <div className="stat-subtext">Total: {formatCurrency(stats.gst.total)}</div>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="dashboard-panel">
          <div className="panel-header">
            <h3 className="panel-title">Recent Activity</h3>
          </div>
          {stats.recent.length > 0 ? (
            <ul className="recent-list">
              {stats.recent.map((item, index) => (
                <li key={index} className="recent-item">
                  <div className="recent-info">
                    <span className={`recent-badge ${item.type}`}>
                      {item.type}
                    </span>
                    <div>
                      <div className="recent-title">{item.label}</div>
                      <div className="recent-date">{item.date ? new Date(item.date).toLocaleDateString() : 'Unknown Date'}</div>
                    </div>
                  </div>
                  <div className="recent-amount">
                    {formatCurrency(item.amount)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem 0' }}>No recent activity found.</p>
          )}
        </div>

        <div className="dashboard-panel">
          <div className="panel-header">
            <h3 className="panel-title">Quick Links</h3>
          </div>
          <div className="action-links">
            <Link to="/restaurent" className="action-btn">
              <div style={{display: 'flex', alignItems: 'center'}}>
                <span className="action-icon">🍽️</span>
                <span className="action-text">Manage Restaurant Bills</span>
              </div>
              <span className="arrow-icon">→</span>
            </Link>
            <Link to="/metro" className="action-btn">
              <div style={{display: 'flex', alignItems: 'center'}}>
                <span className="action-icon">🛒</span>
                <span className="action-text">Manage Metro Invoices</span>
              </div>
              <span className="arrow-icon">→</span>
            </Link>
            <Link to="/gst" className="action-btn">
              <div style={{display: 'flex', alignItems: 'center'}}>
                <span className="action-icon">🏛️</span>
                <span className="action-text">Manage GST Invoices</span>
              </div>
              <span className="arrow-icon">→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
