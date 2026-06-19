
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 180000,
  headers: {
    Accept: 'application/json',
  },
});

export const extractTextFromImage = async (file, onUploadProgress) => {

  const formData = new FormData();
  formData.append('image', file);

  const response = await api.post('/extract', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },

    onUploadProgress: (progressEvent) => {
      if (progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onUploadProgress?.(percent);
      }
    },
  });

  return response.data;
};

export const fetchBills = async () => {
  const response = await api.get('/bills');
  return response.data;
};

export const deleteBill = async (id) => {
  const response = await api.delete(`/bills/${id}`);
  return response.data;
};

export const saveBill = async (billData) => {
  const response = await api.post('/save', billData);
  return response.data;
};

// ── Metro Invoice API Services ──────────────────────────────────────────────
export const uploadMetroInvoice = async (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append('image', file);
  const response = await api.post('/metro/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onUploadProgress?.(percent);
      }
    },
  });
  return response.data;
};

export const fetchMetroInvoices = async () => {
  const response = await api.get('/metro');
  return response.data;
};

export const fetchMetroInvoiceById = async (id) => {
  const response = await api.get(`/metro/${id}`);
  return response.data;
};

export const saveMetroInvoice = async (invoiceData) => {
  const response = await api.post('/metro/save', invoiceData);
  return response.data;
};

export const deleteMetroInvoice = async (id) => {
  const response = await api.delete(`/metro/${id}`);
  return response.data;
};

// ── GST Invoice API Services ────────────────────────────────────────────────
export const uploadGSTInvoice = async (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append('image', file);
  const response = await api.post('/gst/extract', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onUploadProgress?.(percent);
      }
    },
  });
  return response.data;
};

export const fetchGSTInvoices = async () => {
  const response = await api.get('/gst');
  return response.data;
};

export const fetchGSTInvoiceById = async (id) => {
  const response = await api.get(`/gst/${id}`);
  return response.data;
};

export const saveGSTInvoice = async (invoiceData) => {
  const response = await api.post('/gst/save', invoiceData);
  return response.data;
};

export const deleteGSTInvoice = async (id) => {
  const response = await api.delete(`/gst/${id}`);
  return response.data;
};

export default api;
