import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5001/api/bills',
  timeout: 180000,
  headers: {
    Accept: 'application/json',
  },
});

export const uploadBill = async (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append('image', file);

  const response = await api.post('/import', formData, {
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

  // ===== DEBUG: Log extraction API response =====
  console.log('\n%c========== API RESPONSE: /import ==========', 'color: #00bcd4; font-weight: bold;');
  console.log('%c📄 Raw OCR Text (Plain):', 'color: #ff9800; font-weight: bold;');
  console.log(response.data.rawText);
  console.log('%c📦 Bill Data (JSON):', 'color: #4caf50; font-weight: bold;');

  // ===== END DEBUG =====

  return response.data;
};

export const fetchBills = async () => {
  const response = await api.get('/');
  return response.data;
};

export const fetchBillById = async (id) => {
  const response = await api.get(`/${id}`);
  return response.data;
};

export const saveBill = async (billData, items) => {
  const response = await api.post('/save', { billData, items });
  return response.data;
};

export const deleteBill = async (id) => {
  const response = await api.delete(`/${id}`);
  return response.data;
};

export default api;
