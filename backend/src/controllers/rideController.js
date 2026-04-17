const rideService = require("../services/rideService");

const requestRide = async (req, res, next) => {
  try {
    const ride = await rideService.requestRide(req.user.id, req.body);
    res.status(201).json({
      message: "Ride requested successfully",
      ride,
    });
  } catch (error) {
    next(error);
  }
};

const estimateFare = async (req, res, next) => {
  try {
    const fare = await rideService.estimateFare(req.body);
    res.status(200).json({ fare });
  } catch (error) {
    next(error);
  }
};

const acceptRide = async (req, res, next) => {
  try {
    const ride = await rideService.acceptRide(req.user.id, req.params.rideId);
    res.status(200).json({
      message: "Ride accepted successfully",
      ride,
    });
  } catch (error) {
    next(error);
  }
};

const startRide = async (req, res, next) => {
  try {
    const ride = await rideService.startRide(req.user.id, req.params.rideId);
    res.status(200).json({
      message: "Ride started successfully",
      ride,
    });
  } catch (error) {
    next(error);
  }
};

const endRide = async (req, res, next) => {
  try {
    const ride = await rideService.endRide(req.user.id, req.params.rideId);
    res.status(200).json({
      message: "Ride completed successfully",
      ride,
    });
  } catch (error) {
    next(error);
  }
};

const cancelRide = async (req, res, next) => {
  try {
    const ride = await rideService.cancelRide(req.user.id, req.params.rideId);
    res.status(200).json({
      message: "Ride cancelled successfully",
      ride,
    });
  } catch (error) {
    next(error);
  }
};

const getRide = async (req, res, next) => {
  try {
    const ride = await rideService.getRideById(req.params.rideId);
    res.status(200).json({ ride });
  } catch (error) {
    next(error);
  }
};

const getRides = async (req, res, next) => {
  try {
    const ride = await rideService.getActiveRideForRider(req.user.id);
    res.status(200).json(ride ? { ride } : { ride: null });
  } catch (error) {
    next(error);
  }
};

const getRideHistory = async (req, res, next) => {
  try {
    const rides = await rideService.getRideHistoryForRider(req.user.id);
    res.status(200).json({ rides });
  } catch (error) {
    next(error);
  }
};

const getActiveRideForRider = async (req, res, next) => {
  try {
    const ride = await rideService.getActiveRideForRider(req.user.id);
    res.status(200).json({ ride });
  } catch (error) {
    next(error);
  }
};

const getActiveRideForDriver = async (req, res, next) => {
  try {
    const ride = await rideService.getActiveRideForDriver(req.user.id);
    res.status(200).json({ ride });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requestRide,
  estimateFare,
  acceptRide,
  startRide,
  endRide,
  cancelRide,
  getRide,
  getRides,
  getRideHistory,
  getActiveRideForRider,
  getActiveRideForDriver,
};
