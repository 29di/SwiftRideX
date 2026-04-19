import axios from 'axios';

const resolveApiUrl = () => {
  const apiUrl = String(import.meta.env.VITE_API_URL || '').trim();

  if (apiUrl) {
    const normalized = apiUrl.replace(/\/+$/, '');
    return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
  }

  return 'http://localhost:5000/api';
};

const api = axios.create({
  baseURL: resolveApiUrl(),
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('swiftridex_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  }

  const rawSession = localStorage.getItem('swiftridex_session');

  if (rawSession) {
    try {
      const session = JSON.parse(rawSession);
      if (session?.token) {
        config.headers.Authorization = `Bearer ${session.token}`;
      }
    } catch {
      localStorage.removeItem('swiftridex_session');
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config;
    const method = String(config?.method || '').toLowerCase();
    const isGetRequest = method === 'get';
    const isTimeout = error?.code === 'ECONNABORTED' || String(error?.message || '').toLowerCase().includes('timeout');

    if (config && isGetRequest && isTimeout && !config.__retriedAfterTimeout) {
      config.__retriedAfterTimeout = true;
      return api.request(config);
    }

    return Promise.reject(error);
  }
);

export const getApiErrorMessage = (error) => {
  if (error?.code === 'ERR_NETWORK' || (!error?.response && error?.request)) {
    return 'Server not reachable';
  }

  const responseData = error?.response?.data;

  if (Array.isArray(responseData?.errors) && responseData.errors.length > 0) {
    return responseData.errors.map((item) => item.message).join('. ');
  }

  return responseData?.message || error?.message || 'Something went wrong';
};

export default api;
