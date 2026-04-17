import api, { getApiErrorMessage } from './api';

export const chatService = {
  getRideMessages: async (rideId, options = {}) => {
    try {
      const response = await api.get(`/chat/rides/${rideId}/messages`, {
        params: {
          limit: options.limit,
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error));
    }
  },

  sendRideMessage: async (rideId, payload) => {
    try {
      const response = await api.post(`/chat/rides/${rideId}/messages`, payload);
      return response.data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error));
    }
  },

  getQuickReplies: async (rideId, options = {}) => {
    try {
      const response = await api.get(`/chat/rides/${rideId}/quick-replies`, {
        params: {
          context: options.context,
          limit: options.limit,
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error));
    }
  },
};
