import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||"https://bharat-fellowship-backend.onrender.com/api/v1";

// Log API base URL in development for debugging
if (import.meta.env.DEV) {
  console.log('API Base URL:', API_BASE_URL);
  if (API_BASE_URL.includes('yourdomain.com')) {
    console.warn('⚠️ WARNING: Using placeholder domain. Create client/.env with: VITE_API_BASE_URL=http://localhost:3000/api/v1');
  }
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Provide better error messages
    if (error.response) {
      // Server responded with error status
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      // Request made but no response (network error, server down, CORS)
      console.error('Network Error:', {
        message: error.message,
        code: error.code,
        config: {
          url: error.config?.url,
          baseURL: error.config?.baseURL,
        },
      });
      // Enhance error with more details
      error.isNetworkError = true;
      error.networkMessage = 'Unable to connect to server. Please ensure the backend server is running.';
    } else {
      // Something else happened
      console.error('Request Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export const apiClient = {
  // Health check
  health: () => api.get('/health'),

  // District current month
  getDistrictCurrent: (state, district) =>
    api.get(`/district/${encodeURIComponent(state)}/${encodeURIComponent(district)}/current`),

  // District history
  getDistrictHistory: (state, district, months = 12) =>
    api.get(`/district/${encodeURIComponent(state)}/${encodeURIComponent(district)}/history`, {
      params: { months },
    }),

  // State comparison
  getStateCompare: (state, district) =>
    api.get(`/state/${encodeURIComponent(state)}/compare`, {
      params: { district },
    }),

  // Search
  search: (query) =>
    api.get('/search', {
      params: { query },
    }),

  // Geospatial lookup
  getDistrictFromGeo: (lat, lon) =>
    api.get('/geo/district', {
      params: { lat, lon },
    }),
};

export default api;

