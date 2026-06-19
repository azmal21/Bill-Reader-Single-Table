import React from 'react';

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
