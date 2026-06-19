import React from 'react';

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
