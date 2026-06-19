import React from 'react';
import SearchBar from './SearchBar';

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
        <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
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
