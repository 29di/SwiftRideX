import api, { getApiErrorMessage } from './api';

export const rideService = {
  estimateFare: async (payload) => {
    try {
      const response = await api.post('/rides/fare-estimate', payload);
      return response.data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error));
    }
  },
  requestRide: async (payload) => {
    try {
      const response = await api.post('/rides/request', payload);
      return response.data;
    } catch (error) {
      throw new Error(getApiErrorMessage(error));
    }
  },
  getRide: async (rideId) => {
    try {
      const response = await api.get(`/rides/${rideId}`);
      console.log('rideService.getRide response:', response.data);
      return response.data;
    } catch (error) {
      console.error('rideService.getRide error:', error);
      throw new Error(getApiErrorMessage(error));
    }
  },
  getActiveRideForRider: async () => {
    try {
      const response = await api.get('/rides/active/rider');
      console.log('rideService.getActiveRideForRider response:', response.data);
      return response.data;
    } catch (error) {
      console.error('rideService.getActiveRideForRider error:', error);
      throw new Error(getApiErrorMessage(error));
    }
  },
  getActiveRideForDriver: async () => {
    try {
      const response = await api.get('/rides/active/driver');
      console.log('rideService.getActiveRideForDriver response:', response.data);
      return response.data;
    } catch (error) {
      console.error('rideService.getActiveRideForDriver error:', error);
      throw new Error(getApiErrorMessage(error));
    }
  },
  getRideHistoryForRider: async () => {
    try {
      const response = await api.get('/rides/history');
      console.log('rideService.getRideHistoryForRider response:', response.data);
      return response.data;
    } catch (error) {
      console.error('rideService.getRideHistoryForRider error:', error);
      throw new Error(getApiErrorMessage(error));
    }
  },
  acceptRide: (rideId) => api.patch(`/rides/${rideId}/accept`).then((response) => response.data),
  cancelRide: (rideId) => api.patch(`/rides/${rideId}/cancel`).then((response) => response.data),
  startRide: (rideId) => api.patch(`/rides/${rideId}/start`).then((response) => response.data),
  endRide: (rideId) => api.patch(`/rides/${rideId}/end`).then((response) => response.data),
};
