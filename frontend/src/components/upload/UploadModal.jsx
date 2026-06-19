import React, { useRef, useState, useCallback } from 'react';
import { extractTextFromImage, uploadMetroInvoice, uploadGSTInvoice, saveMetroInvoice } from '../../services/api';
import FileDropZone from './FileDropZone';
import UploadProgress from './UploadProgress';

const UploadModal = ({ show, uploadType, onClose, onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const resetUploadState = useCallback(() => {
    setSelectedFile(null);
    setFilePreview(null);
    setUploadError('');
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = () => {
    if (isUploading) return;
    onClose();
    resetUploadState();
  };

  const handleFileSelect = useCallback((file) => {
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Only JPG/JPEG/PNG images are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File too large. Maximum size is 10 MB.');
      return;
    }
    setUploadError('');
    setSelectedFile(file);
    setFilePreview(URL.createObjectURL(file));
  }, []);

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    handleFileSelect(file);
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setUploadError('Please select an image file first.');
      return;
    }
    setIsUploading(true);
    setUploadError('');
    setUploadProgress(0);

    try {
      let data;
      if (uploadType === 'metro') {
        data = await uploadMetroInvoice(selectedFile, (percent) => setUploadProgress(percent));
      } else if (uploadType === 'gst') {
        data = await uploadGSTInvoice(selectedFile, (percent) => setUploadProgress(percent));
      } else {
        data = await extractTextFromImage(selectedFile, (percent) => setUploadProgress(percent));
      }

      if (data.success) {
        console.log(`========== ${uploadType.toUpperCase()} RAW TESSERACT OCR TEXT ==========`);
        console.log(data.rawText || data.tesseractText);
        console.log(`========== ${uploadType.toUpperCase()} EXTRACTION JSON ==========`);
        console.log(JSON.stringify(data.billData || data.parsedData, null, 2));

        if (uploadType === 'metro') {
          const saveRes = await saveMetroInvoice(data.parsedData);
          if (saveRes.success) {
            onUploadSuccess({ saved: true, type: 'metro', id: saveRes.invoice.id });
          } else {
            setUploadError(saveRes.error || 'Failed to save Metro invoice directly.');
            setIsUploading(false);
            return;
          }
        } else {
          onUploadSuccess(data.billData || data.parsedData);
        }
        
        resetUploadState();
        onClose();
      } else {
        setUploadError(data.message || data.error || 'Unknown error occurred.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Something went wrong.';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Upload Bill Image</h2>
          <button className="modal-close" onClick={handleClose} disabled={isUploading}>×</button>
        </div>
        <div className="modal-body">
          <FileDropZone isUploading={isUploading} selectedFile={selectedFile} filePreview={filePreview} handleInputChange={handleInputChange} fileInputRef={fileInputRef} />
          {isUploading && <UploadProgress uploadProgress={uploadProgress} />}
          {uploadError && <div className="modal-error">⚠️ {uploadError}</div>}
        </div>
        <div className="modal-footer">
          <button className="modal-btn modal-btn-cancel" onClick={handleClose} disabled={isUploading}>Cancel</button>
          <button className="modal-btn modal-btn-import" onClick={handleImport} disabled={!selectedFile || isUploading} id="import-btn">
            {isUploading ? <><span className="btn-spinner" />Processing...</> : <>Import</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;
