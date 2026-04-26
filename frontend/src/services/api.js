import axios from 'axios';

// Detect the current host's IP and use port 5000 for the FastAPI backend
const getBaseURL = () => {
  const { hostname } = window.location;
  // If we are on localhost, backend is at localhost:5000
  // If we are on a mobile device, backend is at [mobile-ip]:5000
  return `http://${hostname}:5000/api`;
};

const api = axios.create({
  baseURL: getBaseURL(),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
