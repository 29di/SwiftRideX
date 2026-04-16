const jwt = require("jsonwebtoken");

const { jwtSecret } = require("../config");

const verifyJwtToken = (token) => {
  if (!token) {
    const error = new Error("Missing authentication token");
    error.statusCode = 401;
    throw error;
  }

  if (!jwtSecret) {
    const error = new Error("JWT_SECRET is not configured");
    error.statusCode = 500;
    throw error;
  }

  try {
    return jwt.verify(token, jwtSecret);
  } catch (error) {
    const authError = new Error("Invalid or expired token");
    authError.statusCode = 401;
    throw authError;
  }
};

module.exports = {
  verifyJwtToken,
};