import axios from 'axios';

/** 生产/App：VITE_API_URL（当前 IP:5000）；开发：留空走 Vite 代理 */
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
