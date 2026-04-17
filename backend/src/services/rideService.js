const rideModel = require("../models/rideModel");
const driverModel = require("../models/driverModel");
const userModel = require("../models/userModel");
const { getIO, getSocketIdsByUser, getSocketIdsByRole } = require("../socket/socketServer");
const logger = require("../config/logger");

const EARTH_RADIUS_KM = 6371;
const BASE_FARE = 40;
const PER_KM_RATE = 12;
const MINIMUM_FARE = 50;

const resolveRiderId = (ride) => {
  if (ride?.rider?.id) {
    return String(ride.rider.id);
  }

  return ride?.riderId ? String(ride.riderId) : null;
};

const resolveDriverId = (ride) => {
  if (ride?.driver?.id) {
    return String(ride.driver.id);
  }

  return ride?.driverId ? String(ride.driverId) : null;
};

const buildRiderSnapshot = (rider) => ({
  id: String(rider.id),
  email: rider.email || null,
  fullName: rider.fullName || null,
});

const buildDriverSnapshot = (driver) => ({
  id: String(driver.id),
  email: driver.email || null,
  name: driver.name || null,
});

const sanitizeRide = (ride) => ({
  id: String(ride.id),
  riderId: resolveRiderId(ride),
  driverId: resolveDriverId(ride),
  rider: ride.rider
    ? {
        id: String(ride.rider.id),
        email: ride.rider.email || null,
        fullName: ride.rider.fullName || null,
      }
    : null,
  driver: ride.driver
    ? {
        id: String(ride.driver.id),
        email: ride.driver.email || null,
        name: ride.driver.name || null,
      }
    : null,
  pickupLatitude: ride.pickupLatitude,
  pickupLongitude: ride.pickupLongitude,
  dropLatitude: ride.dropLatitude,
  dropLongitude: ride.dropLongitude,
  pickupAddress: ride.pickupAddress || null,
  dropAddress: ride.dropAddress || null,
  status: ride.status,
  fare: ride.fare,
  createdAt: ride.createdAt,
});

const normalizeNumber = (value) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const toRadians = (value) => (Number(value) * Math.PI) / 180;

const getDistanceKm = (start, end) => {
  const lat1 = toRadians(start.latitude);
  const lon1 = toRadians(start.longitude);
  const lat2 = toRadians(end.latitude);
  const lon2 = toRadians(end.longitude);

  const deltaLat = lat2 - lat1;
  const deltaLon = lon2 - lon1;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

const calculateEstimatedFare = ({ pickupLatitude, pickupLongitude, dropLatitude, dropLongitude }) => {
  const distanceKm = getDistanceKm(
    { latitude: pickupLatitude, longitude: pickupLongitude },
    { latitude: dropLatitude, longitude: dropLongitude }
  );

  const computedFare = BASE_FARE + distanceKm * PER_KM_RATE;
  return Number(Math.max(computedFare, MINIMUM_FARE).toFixed(2));
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
    riderId: resolveRiderId(ride),
    driverId: resolveDriverId(ride),
    status: ride.status,
    fare: ride.fare,
    updatedAt: new Date().toISOString(),
  };

  const riderSocketIds = getSocketIdsByUser("rider", resolveRiderId(ride));
  const driverSocketIds = getSocketIdsByUser("driver", resolveDriverId(ride));
  const participantSocketIds = Array.from(new Set([...riderSocketIds, ...driverSocketIds]));

  emitToSocketIds(io, participantSocketIds, eventName, payload);
  if (eventName !== "ride-status-updated") {
    emitToSocketIds(io, participantSocketIds, "ride-status-updated", payload);
  }
};

const emitRideRequestedToDrivers = (ride) => {
  const io = getIO();
  if (!io) {
    return;
  }

  const payload = {
    rideId: String(ride.id),
    riderId: resolveRiderId(ride),
    driverId: null,
    status: ride.status,
    fare: ride.fare,
    pickupLatitude: ride.pickupLatitude,
    pickupLongitude: ride.pickupLongitude,
    dropLatitude: ride.dropLatitude,
    dropLongitude: ride.dropLongitude,
    pickupAddress: ride.pickupAddress || null,
    dropAddress: ride.dropAddress || null,
    updatedAt: new Date().toISOString(),
  };

  const driverSocketIds = getSocketIdsByRole("driver");
  emitToSocketIds(io, driverSocketIds, "ride-requested", payload);
  emitToSocketIds(io, driverSocketIds, "ride-status-updated", payload);
};

const requestRide = async (riderId, payload) => {
  const pickupLatitude = normalizeNumber(payload.pickupLatitude);
  const pickupLongitude = normalizeNumber(payload.pickupLongitude);
  const dropLatitude = normalizeNumber(payload.dropLatitude);
  const dropLongitude = normalizeNumber(payload.dropLongitude);

  const hasExplicitFare =
    payload.fare !== undefined && payload.fare !== null && String(payload.fare).trim() !== "";

  const fare = hasExplicitFare
    ? Number(payload.fare)
    : calculateEstimatedFare({
        pickupLatitude,
        pickupLongitude,
        dropLatitude,
        dropLongitude,
      });

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
    rider: buildRiderSnapshot(rider),
    riderId,
    pickupLatitude,
    pickupLongitude,
    dropLatitude,
    dropLongitude,
    pickupAddress: payload.pickupAddress ? String(payload.pickupAddress).trim() : null,
    dropAddress: payload.dropAddress ? String(payload.dropAddress).trim() : null,
    fare,
  });

  emitRideRequestedToDrivers(ride);
  emitRideEventToParticipants("ride-status-updated", ride);

  logger.info("Ride requested", {
    rideId: ride.id,
    riderId,
    driverId: resolveDriverId(ride),
    status: ride.status,
    fare,
    fareSource: hasExplicitFare ? "client" : "auto-calculated",
  });

  return sanitizeRide(ride);
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

  const currentDriverId = resolveDriverId(ride);

  if (currentDriverId && String(currentDriverId) !== String(driverId)) {
    const error = new Error("This ride is assigned to another driver");
    error.statusCode = 403;
    throw error;
  }

  const updatedRide = await rideModel.update(ride.id, {
    driver: buildDriverSnapshot(driver),
    driverId,
    status: "ACCEPTED",
  });

  logger.info("Ride accepted", {
    rideId: ride.id,
    driverId,
    riderId: resolveRiderId(ride),
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

  if (String(resolveDriverId(ride)) !== String(driverId)) {
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
    riderId: resolveRiderId(ride),
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

  if (String(resolveDriverId(ride)) !== String(driverId)) {
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
    riderId: resolveRiderId(ride),
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

const getRideHistoryForRider = async (riderId) => {
  const rides = await rideModel.findByRiderId(riderId);
  return rides.map((ride) => sanitizeRide(ride));
};

const getOpenRideRequestsForDriver = async () => {
  const rides = await rideModel.findOpenRequests();
  return rides.map((ride) => sanitizeRide(ride));
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
  getRideHistoryForRider,
  getOpenRideRequestsForDriver,
  getActiveRideForDriver,
};
