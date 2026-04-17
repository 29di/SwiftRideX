const { connectRedis, getRedisClient } = require("./src/config/redis");
const REDIS_KEYS = require("./src/config/redisKeys");

const SAMPLE_LATITUDE = Number(process.env.DEBUG_SAMPLE_LATITUDE || 12.9716);
const SAMPLE_LONGITUDE = Number(process.env.DEBUG_SAMPLE_LONGITUDE || 77.5946);
const SEARCH_RADIUS_KM = Number(process.env.DEBUG_SEARCH_RADIUS_KM || 5);

const getOrConnectRedisClient = async () => {
  let redisClient = getRedisClient();

  if (!redisClient || !redisClient.isOpen) {
    redisClient = await connectRedis();
  }

  if (!redisClient) {
    throw new Error("Redis is not configured. Set REDIS_URL before running this script.");
  }

  return redisClient;
};

const getDriversFromGeoIndex = async (redisClient) => {
  const allFromGeo = await redisClient.sendCommand([
    "GEOSEARCH",
    REDIS_KEYS.driversLocations,
    "FROMLONLAT",
    "0",
    "0",
    "BYRADIUS",
    "20050",
    "km",
    "ASC",
    "WITHCOORD",
  ]);

  if (!Array.isArray(allFromGeo)) {
    return [];
  }

  return allFromGeo.map((entry) => {
    const member = Array.isArray(entry) ? entry[0] : entry;
    const coordinates = Array.isArray(entry) ? entry[1] : null;

    return {
      driverId: String(member),
      longitude: coordinates ? Number(coordinates[0]) : null,
      latitude: coordinates ? Number(coordinates[1]) : null,
    };
  });
};

const getNearestFromSampleCoordinate = async (redisClient, onlineDriverSet) => {
  const nearbyFromGeo = await redisClient.sendCommand([
    "GEOSEARCH",
    REDIS_KEYS.driversLocations,
    "FROMLONLAT",
    String(SAMPLE_LONGITUDE),
    String(SAMPLE_LATITUDE),
    "BYRADIUS",
    String(SEARCH_RADIUS_KM),
    "km",
    "ASC",
    "COUNT",
    "10",
    "WITHDIST",
    "WITHCOORD",
  ]);

  if (!Array.isArray(nearbyFromGeo)) {
    return [];
  }

  return nearbyFromGeo
    .map((entry) => {
      const member = Array.isArray(entry) ? entry[0] : null;
      const distance = Array.isArray(entry) ? entry[1] : null;
      const coordinates = Array.isArray(entry) ? entry[2] : null;

      return {
        driverId: String(member),
        distanceKm: distance !== null ? Number(distance) : null,
        longitude: coordinates ? Number(coordinates[0]) : null,
        latitude: coordinates ? Number(coordinates[1]) : null,
      };
    })
    .filter((item) => onlineDriverSet.has(item.driverId));
};

const run = async () => {
  let redisClient;

  try {
    redisClient = await getOrConnectRedisClient();

    const geoDrivers = await getDriversFromGeoIndex(redisClient);
    const onlineDrivers = await redisClient.sMembers(REDIS_KEYS.driversOnline);
    const onlineDriverSet = new Set(onlineDrivers.map(String));
    const nearestOnlineDrivers = await getNearestFromSampleCoordinate(redisClient, onlineDriverSet);

    console.log("\n=== Redis Debug: SwiftrideX ===");

    console.log("\nLocation index (drivers:locations):");
    if (geoDrivers.length === 0) {
      console.log("No drivers found in location index.");
    } else {
      console.log(geoDrivers.map((item) => item.driverId));
      console.log("Detailed location entries:");
      console.table(geoDrivers);
    }

    console.log("\nOnline drivers (drivers:online):");
    if (onlineDrivers.length === 0) {
      console.log("No online drivers found.");
    } else {
      console.log(onlineDrivers);
    }

    console.log(
      `\nNearest online drivers from sample (${SAMPLE_LATITUDE}, ${SAMPLE_LONGITUDE}) within ${SEARCH_RADIUS_KM}km:`
    );
    if (nearestOnlineDrivers.length === 0) {
      console.log("No nearby online drivers found.");
    } else {
      console.table(nearestOnlineDrivers);
    }
  } catch (error) {
    console.error("Redis debug failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
    }
  }
};

run();
