import React from 'react';

const Header = ({ title, actions }) => {
  return (
    <header className="page-header">
      <div className="page-header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h1 className="page-title">{title}</h1>
        {actions}
      </div>
    </header>
  );
};

export default Header;
