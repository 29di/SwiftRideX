import api from './api';

export const driverService = {
  register: (payload) => api.post('/drivers/register', payload).then((response) => response.data),
  login: (payload) => api.post('/drivers/login', payload).then((response) => response.data),
  me: () => api.get('/drivers/me').then((response) => response.data),
  getRideRequests: () => api.get('/drivers/ride-requests').then((response) => response.data),
  toggleStatus: (isOnline) => api.patch('/drivers/status', { isOnline }).then((response) => response.data),
  updateLocation: (latitude, longitude) =>
    api.patch('/drivers/location', { latitude, longitude }).then((response) => response.data),
};
