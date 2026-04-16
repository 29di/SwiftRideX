const rideModel = require("../models/rideModel");
const driverModel = require("../models/driverModel");
const userModel = require("../models/userModel");
const matchingService = require("./matchingService");
const { getIO, getSocketIdsByUser } = require("../socket/socketServer");
const logger = require("../config/logger");

const sanitizeRide = (ride) => ({
  id: String(ride.id),
  riderId: ride.riderId ? String(ride.riderId) : null,
  driverId: ride.driverId ? String(ride.driverId) : null,
  pickupLatitude: ride.pickupLatitude,
  pickupLongitude: ride.pickupLongitude,
  dropLatitude: ride.dropLatitude,
  dropLongitude: ride.dropLongitude,
  status: ride.status,
  fare: ride.fare,
  createdAt: ride.createdAt,
});

const normalizeNumber = (value) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const emitToSocketIds = (io, socketIds, eventName, payload) => {
  for (const socketId of socketIds) {
    io.to(socketId).emit(eventName, payload);
  }
};

const emitRideEventToParticipants = (eventName, ride) => {
  const io = getIO();
  if (!io) {
    return;
  }

  const payload = {
    rideId: String(ride.id),
    riderId: ride.riderId ? String(ride.riderId) : null,
    driverId: ride.driverId ? String(ride.driverId) : null,
    status: ride.status,
    fare: ride.fare,
    updatedAt: new Date().toISOString(),
  };

  const riderSocketIds = getSocketIdsByUser("rider", ride.riderId);
  const driverSocketIds = getSocketIdsByUser("driver", ride.driverId);
  const participantSocketIds = Array.from(new Set([...riderSocketIds, ...driverSocketIds]));

  emitToSocketIds(io, participantSocketIds, eventName, payload);
  if (eventName !== "ride-status-updated") {
    emitToSocketIds(io, participantSocketIds, "ride-status-updated", payload);
  }
};

const requestRide = async (riderId, payload) => {
  const pickupLatitude = normalizeNumber(payload.pickupLatitude);
  const pickupLongitude = normalizeNumber(payload.pickupLongitude);
  const dropLatitude = normalizeNumber(payload.dropLatitude);
  const dropLongitude = normalizeNumber(payload.dropLongitude);
  const fare = payload.fare === undefined ? 0 : Number(payload.fare);

  if ([pickupLatitude, pickupLongitude, dropLatitude, dropLongitude].some((value) => value === null)) {
    const error = new Error("pickupLatitude, pickupLongitude, dropLatitude and dropLongitude are required numbers");
    error.statusCode = 400;
    throw error;
  }

  if (Number.isNaN(fare) || fare < 0) {
    const error = new Error("fare must be a valid non-negative number");
    error.statusCode = 400;
    throw error;
  }

  const rider = await userModel.findById(riderId);
  if (!rider) {
    const error = new Error("Rider not found");
    error.statusCode = 404;
    throw error;
  }

  const ride = await rideModel.create({
    riderId,
    pickupLatitude,
    pickupLongitude,
    dropLatitude,
    dropLongitude,
    fare,
  });

  const nearestDriver = await matchingService.findNearestDriver(
    {
      latitude: pickupLatitude,
      longitude: pickupLongitude,
    },
    {
      radiusKm: 5,
    }
  );

  let assignedRide = ride;

  if (nearestDriver?.id) {
    assignedRide = await rideModel.update(ride.id, {
      driverId: nearestDriver.id,
    });
  }

  emitRideEventToParticipants("ride-status-updated", assignedRide);

  logger.info("Ride requested", {
    rideId: assignedRide.id,
    riderId,
    driverId: assignedRide.driverId,
    status: assignedRide.status,
    fare,
  });

  return sanitizeRide(assignedRide);
};

const acceptRide = async (driverId, rideId) => {
  const driver = await driverModel.findById(driverId);
  if (!driver) {
    const error = new Error("Driver not found");
    error.statusCode = 404;
    throw error;
  }

  if (!driver.isOnline) {
    const error = new Error("Driver must be online to accept a ride");
    error.statusCode = 400;
    throw error;
  }

  const ride = await rideModel.findById(rideId);
  if (!ride) {
    const error = new Error("Ride not found");
    error.statusCode = 404;
    throw error;
  }

  if (ride.status !== "REQUESTED") {
    const error = new Error("Ride cannot be accepted in its current status");
    error.statusCode = 400;
    throw error;
  }

  if (ride.driverId && String(ride.driverId) !== String(driverId)) {
    const error = new Error("This ride is assigned to another driver");
    error.statusCode = 403;
    throw error;
  }

  const updatedRide = await rideModel.update(ride.id, {
    driverId,
    status: "ACCEPTED",
  });

  logger.info("Ride accepted", {
    rideId: ride.id,
    driverId,
    riderId: ride.riderId,
    status: "ACCEPTED",
  });

  emitRideEventToParticipants("ride-accepted", updatedRide);

  return sanitizeRide(updatedRide);
};

const startRide = async (driverId, rideId) => {
  const ride = await rideModel.findById(rideId);
  if (!ride) {
    const error = new Error("Ride not found");
    error.statusCode = 404;
    throw error;
  }

  if (String(ride.driverId) !== String(driverId)) {
    const error = new Error("Only the assigned driver can start this ride");
    error.statusCode = 403;
    throw error;
  }

  if (ride.status !== "ACCEPTED") {
    const error = new Error("Ride must be accepted before it can be started");
    error.statusCode = 400;
    throw error;
  }

  const updatedRide = await rideModel.update(ride.id, {
    status: "STARTED",
  });

  logger.info("Ride started", {
    rideId: ride.id,
    driverId,
    riderId: ride.riderId,
    status: "STARTED",
  });

  emitRideEventToParticipants("ride-started", updatedRide);

  return sanitizeRide(updatedRide);
};

const endRide = async (driverId, rideId) => {
  const ride = await rideModel.findById(rideId);
  if (!ride) {
    const error = new Error("Ride not found");
    error.statusCode = 404;
    throw error;
  }

  if (String(ride.driverId) !== String(driverId)) {
    const error = new Error("Only the assigned driver can end this ride");
    error.statusCode = 403;
    throw error;
  }

  if (ride.status !== "STARTED") {
    const error = new Error("Ride must be started before it can be completed");
    error.statusCode = 400;
    throw error;
  }

  const updatedRide = await rideModel.update(ride.id, {
    status: "COMPLETED",
  });

  logger.info("Ride completed", {
    rideId: ride.id,
    driverId,
    riderId: ride.riderId,
    status: "COMPLETED",
    fare: ride.fare,
  });

  emitRideEventToParticipants("ride-completed", updatedRide);

  return sanitizeRide(updatedRide);
};

const getRideById = async (rideId) => {
  const ride = await rideModel.findById(rideId);
  if (!ride) {
    const error = new Error("Ride not found");
    error.statusCode = 404;
    throw error;
  }

  return sanitizeRide(ride);
};

const getActiveRideForRider = async (riderId) => {
  const ride = await rideModel.findActiveByRiderId(riderId);
  return ride ? sanitizeRide(ride) : null;
};

const getActiveRideForDriver = async (driverId) => {
  const ride = await rideModel.findActiveByDriverId(driverId);
  return ride ? sanitizeRide(ride) : null;
};

module.exports = {
  requestRide,
  acceptRide,
  startRide,
  endRide,
  getRideById,
  getActiveRideForRider,
  getActiveRideForDriver,
};
