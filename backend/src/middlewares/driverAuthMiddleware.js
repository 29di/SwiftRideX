const { verifyJwtToken } = require("../utils/jwt");

const driverAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid authorization header" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = verifyJwtToken(token);

    if (payload.role !== "driver") {
      return res.status(403).json({ message: "Driver access required" });
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    return next();
  } catch (error) {
    return res.status(error.statusCode || 401).json({ message: error.message || "Unauthorized" });
  }
};

module.exports = driverAuthMiddleware;
