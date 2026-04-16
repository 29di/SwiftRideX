const { connectRedis, getRedisClient } = require("../config/redis");
const driverModel = require("../models/driverModel");
const REDIS_KEYS = require("../config/redisKeys");
const logger = require("../config/logger");

const normalizeCoordinate = (value, fieldName) => {
  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    const error = new Error(`${fieldName} must be a valid number`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
};

const findNearestDriver = async (riderLocation, options = {}) => {
  if (!riderLocation || typeof riderLocation !== "object") {
    const error = new Error("riderLocation is required");
    error.statusCode = 400;
    throw error;
  }

  const riderLatitude = normalizeCoordinate(riderLocation.latitude, "riderLocation.latitude");
  const riderLongitude = normalizeCoordinate(riderLocation.longitude, "riderLocation.longitude");
  const radiusKm = Number(options.radiusKm ?? 5);
  const candidateLimit = Number(options.candidateLimit ?? 30);

  if (Number.isNaN(radiusKm) || radiusKm <= 0) {
    const error = new Error("radiusKm must be a valid positive number");
    error.statusCode = 400;
    throw error;
  }

  if (Number.isNaN(candidateLimit) || candidateLimit <= 0) {
    const error = new Error("candidateLimit must be a valid positive number");
    error.statusCode = 400;
    throw error;
  }

  let redisClient = getRedisClient();
  if (!redisClient || !redisClient.isOpen) {
    redisClient = await connectRedis();
  }

  if (!redisClient || !redisClient.isOpen) {
    const error = new Error("Redis is unavailable for ride matching");
    error.statusCode = 503;
    throw error;
  }

  const rawResults = await redisClient.sendCommand([
    "GEOSEARCH",
    REDIS_KEYS.driversLocations,
    "FROMLONLAT",
    String(riderLongitude),
    String(riderLatitude),
    "BYRADIUS",
    String(radiusKm),
    "km",
    "ASC",
    "COUNT",
    String(candidateLimit),
    "WITHDIST",
  ]);

  if (!Array.isArray(rawResults) || rawResults.length === 0) {
    return null;
  }

  const candidateIds = rawResults
    .map((item) => (Array.isArray(item) ? item[0] : item))
    .filter((member) => member !== undefined && member !== null)
    .map((member) => String(member));

  if (candidateIds.length === 0) {
    return null;
  }

  const onlineFlags = await redisClient.sendCommand([
    "SMISMEMBER",
    REDIS_KEYS.driversOnline,
    ...candidateIds,
  ]);

  if (!Array.isArray(onlineFlags)) {
    return null;
  }

  for (let index = 0; index < rawResults.length; index += 1) {
    const item = rawResults[index];
    const isOnline = Number(onlineFlags[index]) === 1;

    if (!isOnline) {
      continue;
    }

    const member = Array.isArray(item) ? item[0] : item;
    const distanceKmRaw = Array.isArray(item) ? item[1] : null;
    const driverId = String(member);

    if (!driverId) {
      continue;
    }

    const driver = await driverModel.findById(driverId);
    if (!driver) {
      continue;
    }

    const driverData = typeof driver.toObject === "function" ? driver.toObject() : driver;

    logger.info("Driver matched", {
      driverId: driver.id,
      riderLatitude,
      riderLongitude,
      distanceKm: distanceKmRaw ? Number(distanceKmRaw) : null,
    });

    return {
      id: String(driver.id),
      ...driverData,
      distanceKm: distanceKmRaw ? Number(distanceKmRaw) : null,
    };
  }

  return null;
};

module.exports = {
  findNearestDriver,
};
