import React from 'react';
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
            onClick={() => { if (!item.disabled) navigate(`/${item.id}`); }}
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
