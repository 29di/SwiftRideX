const driverService = require("../services/driverService");

const register = async (req, res, next) => {
  try {
    const driver = await driverService.register(req.body);
    res.status(201).json({
      message: "Driver registered successfully",
      driver,
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const data = await driverService.login(req.body);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const driver = await driverService.getProfile(req.user.id);
    res.status(200).json({ driver });
  } catch (error) {
    next(error);
  }
};

const toggleStatus = async (req, res, next) => {
  try {
    const { isOnline } = req.body;
    const nextStatus = typeof isOnline === "boolean" ? isOnline : String(isOnline).toLowerCase() === "true";
    const driver = await driverService.setOnlineStatus(req.user.id, nextStatus);
    res.status(200).json({
      message: `Driver marked ${driver.isOnline ? "online" : "offline"}`,
      driver,
    });
  } catch (error) {
    next(error);
  }
};

const updateLocation = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    const driver = await driverService.updateLocation(req.user.id, latitude, longitude);
    res.status(200).json({
      message: "Driver location updated successfully",
      driver,
    });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { name } = req.body;
    const driver = await driverService.updateName(req.user.id, name);
    res.status(200).json({
      message: 'Driver profile updated successfully',
      driver,
    });
  } catch (error) {
    next(error);
  }
};

const getRideRequests = async (req, res, next) => {
  try {
    const rideService = require("../services/rideService");
    const requests = await rideService.getOpenRideRequestsForDriver(req.user.id);
    res.status(200).json({ rides: requests });
  } catch (error) {
    next(error);
  }
};

const getRideHistory = async (req, res, next) => {
  try {
    const rideService = require('../services/rideService');
    const rides = await rideService.getCompletedRideHistoryForDriver(req.user.id);
    res.status(200).json({ rides });
  } catch (error) {
    next(error);
  }
};

const getRideDetail = async (req, res, next) => {
  try {
    const rideService = require('../services/rideService');
    const ride = await rideService.getRideByIdForDriver(req.user.id, req.params.rideId);
    res.status(200).json({ ride });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  toggleStatus,
  updateLocation,
  getRideRequests,
  getRideHistory,
  getRideDetail,
};
