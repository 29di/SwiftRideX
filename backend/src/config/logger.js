const fs = require("fs");
const path = require("path");
const { createLogger, format, transports } = require("winston");

const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: {
    service: "SwiftrideX",
  },
  transports: [
    new transports.File({
      filename: path.join(logsDir, "info.log"),
      level: "info",
    }),
    new transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    })
  );
}

module.exports = logger;
