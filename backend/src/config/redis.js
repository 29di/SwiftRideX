const { createClient } = require("redis");

const { redisUrl, nodeEnv } = require("./index");

let redisClient = null;
let connectPromise = null;

const connectRedis = async () => {
  if (!redisUrl) {
    const error = new Error("REDIS_URL is not configured");
    error.statusCode = 500;
    throw error;
  }

  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  if (connectPromise) {
    return connectPromise;
  }

  redisClient = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        const delay = Math.min(retries * 100, 3000);
        return delay;
      },
    },
  });

  redisClient.on("error", (error) => {
    console.error("Redis client error:", error.message);
  });

  redisClient.on("connect", () => {
    if (nodeEnv !== "test") {
      console.log("Redis connected");
    }
  });

  connectPromise = redisClient
    .connect()
    .then(() => redisClient)
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
};

const getRedisClient = () => redisClient;

module.exports = {
  connectRedis,
  getRedisClient,
};
