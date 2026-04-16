require("dotenv").config();
const http = require("http");

const app = require("./src/app");
const { port } = require("./src/config");
const { connectMongo } = require("./src/config/db");
const { connectRedis } = require("./src/config/redis");
const { initializeSocketServer } = require("./src/socket/socketServer");
const logger = require("./src/config/logger");

// Temporary debug check to verify env loading during startup.
console.log("JWT_SECRET:", process.env.JWT_SECRET);

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing. Please set JWT_SECRET in backend/.env");
}

const httpServer = http.createServer(app);

const startServer = async () => {
  try {
    await connectMongo();
    await connectRedis();
    initializeSocketServer(httpServer);

    httpServer.listen(port, () => {
      logger.info("HTTP and Socket.io server running", { port });
    });
  } catch (error) {
    logger.error("Failed to start SwiftrideX backend", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

startServer();