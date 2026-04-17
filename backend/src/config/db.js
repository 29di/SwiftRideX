const mongoose = require("mongoose");

const { mongoUri, nodeEnv } = require("./index");
const logger = require("./logger");

const connectMongo = async () => {
  if (!mongoUri) {
    const error = new Error("MONGO_URI is not configured");
    error.statusCode = 500;
    throw error;
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  mongoose.connection.on("error", (error) => {
    logger.error("MongoDB connection error", {
      error: error.message,
      service: "SwiftrideX",
    });
  });

  mongoose.connection.on("connected", () => {
    logger.info("MongoDB connected", {
      service: "SwiftrideX",
      uri: mongoUri,
      environment: nodeEnv,
    });
  });

  await mongoose.connect(mongoUri, {
    autoIndex: nodeEnv !== "production",
  });

  return mongoose;
};

const disconnectMongo = async () => {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.disconnect();
};

module.exports = {
  mongoose,
  connectMongo,
  disconnectMongo,
};
