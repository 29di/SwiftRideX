const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const driverModel = require("../models/driverModel");
const { connectRedis, getRedisClient } = require("../config/redis");
const { jwtSecret, jwtExpiresIn } = require("../config");
const REDIS_KEYS = require("../config/redisKeys");
const logger = require("../config/logger");

const sanitizeDriver = (driver) => ({
  id: String(driver.id),
  name: driver.name || "Driver",
  email: driver.email,
  isOnline: driver.isOnline,
  latitude: driver.latitude,
  longitude: driver.longitude,
  createdAt: driver.createdAt,
});

const getRequiredRedisClient = async () => {
  let redisClient = getRedisClient();

  if (!redisClient || !redisClient.isOpen) {
    redisClient = await connectRedis();
  }

  if (!redisClient || !redisClient.isOpen) {
    const error = new Error("Redis is unavailable");
    error.statusCode = 503;
    throw error;
  }

  return redisClient;
};

const register = async ({ name, email, password }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedName = String(name || "").trim();
  const derivedName =
    normalizedName ||
    normalizedEmail
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase()) ||
    "Driver";

  if (!normalizedEmail || !password) {
    const error = new Error("email and password are required");
    error.statusCode = 400;
    throw error;
  }

  if (String(password).length < 6) {
    const error = new Error("Password must be at least 6 characters long");
    error.statusCode = 400;
    throw error;
  }

  const existingDriver = await driverModel.findByEmail(normalizedEmail);
  if (existingDriver) {
    const error = new Error("Driver with this email already exists");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const driver = await driverModel.create({
    name: derivedName,
    email: normalizedEmail,
    passwordHash,
  });

  logger.info("Driver registered", {
    driverId: driver.id,
    email: driver.email,
  });

  return sanitizeDriver(driver);
};

const login = async ({ email, password }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail || !password) {
    const error = new Error("email and password are required");
    error.statusCode = 400;
    throw error;
  }

  const driver = await driverModel.findByEmail(normalizedEmail);
  if (!driver) {
    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    throw error;
  }

  const isPasswordValid = await bcrypt.compare(password, driver.passwordHash);
  if (!isPasswordValid) {
    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    throw error;
  }

  if (!jwtSecret) {
    const error = new Error("JWT_SECRET is not configured");
    error.statusCode = 500;
    throw error;
  }

  const token = jwt.sign(
    {
      sub: driver.id,
      email: driver.email,
      role: "driver",
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );

  logger.info("Driver logged in", {
    driverId: driver.id,
    email: driver.email,
  });

  return {
    token,
    driver: sanitizeDriver(driver),
  };
};

const getProfile = async (driverId) => {
  const driver = await driverModel.findById(driverId);
  if (!driver) {
    const error = new Error("Driver not found");
    error.statusCode = 404;
    throw error;
  }

  return sanitizeDriver(driver);
};

const setOnlineStatus = async (driverId, isOnline) => {
  const driver = await driverModel.updateStatus(driverId, isOnline);
  if (!driver) {
    const error = new Error("Driver not found");
    error.statusCode = 404;
    throw error;
  }

  try {
    const redisClient = await getRequiredRedisClient();

    if (isOnline) {
      await redisClient.sAdd(REDIS_KEYS.driversOnline, String(driverId));
    } else {
      await redisClient.sRem(REDIS_KEYS.driversOnline, String(driverId));
      await redisClient.zRem(REDIS_KEYS.driversLocations, String(driverId));
    }
  } catch (error) {
    logger.error("Failed to sync driver online status to Redis", {
      driverId,
      isOnline,
      error: error.message,
    });
    throw error;
  }

  logger.info("Driver status changed", {
    driverId,
    isOnline,
  });

  return sanitizeDriver(driver);
};

const saveDriverLocationInRedis = async (driverId, latitude, longitude) => {
  const redisClient = await getRequiredRedisClient();

  await redisClient.sendCommand([
    "GEOADD",
    REDIS_KEYS.driversLocations,
    String(longitude),
    String(latitude),
    String(driverId),
  ]);
};

const updateLocation = async (driverId, latitude, longitude) => {
  if (latitude === undefined || longitude === undefined) {
    const error = new Error("latitude and longitude are required");
    error.statusCode = 400;
    throw error;
  }

  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);

  if (Number.isNaN(parsedLatitude) || Number.isNaN(parsedLongitude)) {
    const error = new Error("latitude and longitude must be valid numbers");
    error.statusCode = 400;
    throw error;
  }

  const driver = await driverModel.updateLocation(driverId, parsedLatitude, parsedLongitude);
  if (!driver) {
    const error = new Error("Driver not found");
    error.statusCode = 404;
    throw error;
  }

  try {
    await saveDriverLocationInRedis(driverId, parsedLatitude, parsedLongitude);
  } catch (error) {
    logger.error("Failed to sync driver location to Redis", {
      driverId,
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      error: error.message,
    });
    throw error;
  }

  logger.info("Driver location updated", {
    driverId,
    latitude: parsedLatitude,
    longitude: parsedLongitude,
  });

  return sanitizeDriver(driver);
};

const updateName = async (driverId, name) => {
  const normalizedName = String(name || '').trim();
  if (!normalizedName) {
    const error = new Error('name is required');
    error.statusCode = 400;
    throw error;
  }

  const driver = await driverModel.updateName(driverId, normalizedName);
  if (!driver) {
    const error = new Error('Driver not found');
    error.statusCode = 404;
    throw error;
  }

  logger.info('Driver name updated', {
    driverId,
    name: normalizedName,
  });

  return sanitizeDriver(driver);
};

module.exports = {
  register,
  login,
  getProfile,
  setOnlineStatus,
  updateLocation,
  updateName,
};
