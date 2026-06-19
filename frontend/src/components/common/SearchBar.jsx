import React from 'react';

const SearchBar = ({ searchQuery, setSearchQuery }) => {
  return (
    <div className="search-box">
      <span className="search-icon">🔍</span>
      <input type="text" placeholder="Search here" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} id="search-input" />
    </div>
  );
};

export default SearchBar;
