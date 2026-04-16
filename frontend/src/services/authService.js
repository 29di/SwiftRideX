import api, { getApiErrorMessage } from './api';

export const authService = {
  register: async (payload) => {
    try {
      const response = await api.post('/auth/register', payload);
      return response.data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error));
    }
  },
  login: async (payload) => {
    try {
      const response = await api.post('/auth/login', payload);
      return response.data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error));
    }
  },
  googleLogin: async (credential) => {
    try {
      const response = await api.post('/auth/google', { credential });
      return response.data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error));
    }
  },
  me: () => api.get('/auth/me').then((response) => response.data),
};
