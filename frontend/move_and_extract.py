import os
import shutil

def main():
    # Move ReviewBill.jsx
    if os.path.exists('src/components/ReviewBill.jsx'):
        shutil.move('src/components/ReviewBill.jsx', 'src/components/bills/ReviewBill.jsx')
    
    # Update App.jsx to point to correct ReviewBill
    with open('src/App.jsx', 'r') as f:
        app_code = f.read()
    app_code = app_code.replace("import ReviewBill from './components/ReviewBill';", "import ReviewBill from './components/bills/ReviewBill';")
    with open('src/App.jsx', 'w') as f:
        f.write(app_code)

    # FileDropZone.jsx
    with open('src/components/upload/FileDropZone.jsx', 'w') as f:
        f.write('''import React from 'react';

const FileDropZone = ({ isUploading, selectedFile, filePreview, handleInputChange, fileInputRef }) => {
  return (
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
  );
};

export default FileDropZone;
''')

    # UploadProgress.jsx
    with open('src/components/upload/UploadProgress.jsx', 'w') as f:
        f.write('''import React from 'react';

const UploadProgress = ({ uploadProgress }) => {
  return (
    <div className="modal-progress">
      <div className="modal-progress-header">
        <span>{uploadProgress < 100 ? 'Uploading...' : 'Processing OCR...'}</span>
        <span>{uploadProgress}%</span>
      </div>
      <div className="modal-progress-track">
        <div className="modal-progress-fill" style={{ width: `${uploadProgress}%` }} />
      </div>
    </div>
  );
};

export default UploadProgress;
''')

    # Update UploadModal.jsx
    with open('src/components/upload/UploadModal.jsx', 'r') as f:
        modal_code = f.read()
    
    modal_code = modal_code.replace(
        "import { extractTextFromImage } from '../../services/api';",
        "import { extractTextFromImage } from '../../services/api';\nimport FileDropZone from './FileDropZone';\nimport UploadProgress from './UploadProgress';"
    )
    
    # Replace dropzone and progress HTML
    modal_code = modal_code.replace(
        """<div className={`modal-dropzone ${selectedFile ? 'has-file' : ''}`} onClick={() => !isUploading && fileInputRef.current?.click()}>
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
          </div>""",
        """<FileDropZone isUploading={isUploading} selectedFile={selectedFile} filePreview={filePreview} handleInputChange={handleInputChange} fileInputRef={fileInputRef} />"""
    )
    
    modal_code = modal_code.replace(
        """{isUploading && (
            <div className="modal-progress">
              <div className="modal-progress-header">
                <span>{uploadProgress < 100 ? 'Uploading...' : 'Processing OCR...'}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="modal-progress-track">
                <div className="modal-progress-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}""",
        """{isUploading && <UploadProgress uploadProgress={uploadProgress} />}"""
    )

    with open('src/components/upload/UploadModal.jsx', 'w') as f:
        f.write(modal_code)

    # SearchBar.jsx
    with open('src/components/common/SearchBar.jsx', 'w') as f:
        f.write('''import React from 'react';

const SearchBar = ({ searchQuery, setSearchQuery }) => {
  return (
    <div className="search-box">
      <span className="search-icon">🔍</span>
      <input type="text" placeholder="Search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} id="search-input" />
    </div>
  );
};

export default SearchBar;
''')

    # Pagination.jsx
    with open('src/components/common/Pagination.jsx', 'w') as f:
        f.write('''import React from 'react';

const Pagination = ({ currentLength, totalLength }) => {
  return (
    <div className="table-footer">
      <span className="table-footer-info">Showing 1 to {currentLength} of {totalLength} entries</span>
      <div className="pagination">
        <button className="page-btn" disabled>‹</button>
        <button className="page-btn active">1</button>
        <button className="page-btn" disabled>›</button>
      </div>
    </div>
  );
};

export default Pagination;
''')

    # EmptyState.jsx
    with open('src/components/common/EmptyState.jsx', 'w') as f:
        f.write('''import React from 'react';

const EmptyState = ({ message }) => {
  return (
    <div className="table-empty">
      <div className="empty-icon">📄</div>
      <p>{message || "No items found."}</p>
    </div>
  );
};

export default EmptyState;
''')

    # Update Toolbar.jsx to use SearchBar
    with open('src/components/common/Toolbar.jsx', 'r') as f:
        toolbar_code = f.read()
    toolbar_code = toolbar_code.replace("import React from 'react';", "import React from 'react';\nimport SearchBar from './SearchBar';")
    toolbar_code = toolbar_code.replace(
        """<div className="search-box">
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="Search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} id="search-input" />
        </div>""",
        "<SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />"
    )
    with open('src/components/common/Toolbar.jsx', 'w') as f:
        f.write(toolbar_code)
    
    # Update BillList.jsx to use Pagination and EmptyState
    with open('src/components/bills/BillList.jsx', 'r') as f:
        bill_list_code = f.read()
    bill_list_code = bill_list_code.replace("import BillTable from './BillTable';", "import BillTable from './BillTable';\nimport Pagination from '../common/Pagination';\nimport EmptyState from '../common/EmptyState';")
    
    bill_list_code = bill_list_code.replace(
        """<div className="table-empty">
            <div className="empty-icon">📄</div>
            <p>No bills found. Click <strong>+ Add</strong> to upload your first bill.</p>
          </div>""",
        """<EmptyState message={<span>No bills found. Click <strong>+ Add</strong> to upload your first bill.</span>} />"""
    )
    
    bill_list_code = bill_list_code.replace(
        """<div className="table-footer">
              <span className="table-footer-info">Showing 1 to {filteredBills.length} of {totalBills || bills.length} entries</span>
              <div className="pagination">
                <button className="page-btn" disabled>‹</button>
                <button className="page-btn active">1</button>
                <button className="page-btn" disabled>›</button>
              </div>
            </div>""",
        """<Pagination currentLength={filteredBills.length} totalLength={totalBills || bills.length} />"""
    )
    
    with open('src/components/bills/BillList.jsx', 'w') as f:
        f.write(bill_list_code)

    # Header.jsx & PageLayout.jsx
    with open('src/components/layout/Header.jsx', 'w') as f:
        f.write('''import React from 'react';

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
''')

    with open('src/components/layout/PageLayout.jsx', 'w') as f:
        f.write('''import React from 'react';

const PageLayout = ({ children }) => {
  return (
    <div className="page-layout">
      {children}
    </div>
  );
};

export default PageLayout;
''')

if __name__ == '__main__':
    main()
