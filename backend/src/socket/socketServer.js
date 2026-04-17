const { Server } = require("socket.io");
const driverService = require("../services/driverService");
const rideChatService = require("../services/rideChatService");
const rideModel = require("../models/rideModel");
const logger = require("../config/logger");
const { verifyJwtToken } = require("../utils/jwt");

let ioInstance = null;
const socketIdToPrincipal = new Map(); // socketId -> { role, userId, principalKey }
const principalToSocketIds = new Map(); // `${role}:${userId}` -> Set<socketId>

const VALID_ROLES = new Set(["rider", "driver"]);

const getPrincipalKey = (role, userId) => `${String(role)}:${String(userId)}`;

const addConnection = (socketId, role, userId) => {
  // Re-registering on the same socket should replace prior identity cleanly.
  removeConnection(socketId);

  const normalizedUserId = String(userId);
  const normalizedRole = String(role);
  const principalKey = getPrincipalKey(normalizedRole, normalizedUserId);

  socketIdToPrincipal.set(socketId, {
    role: normalizedRole,
    userId: normalizedUserId,
    principalKey,
  });

  if (!principalToSocketIds.has(principalKey)) {
    principalToSocketIds.set(principalKey, new Set());
  }

  principalToSocketIds.get(principalKey).add(socketId);
};

function removeConnection(socketId) {
  const principal = socketIdToPrincipal.get(socketId);
  if (!principal) {
    return;
  }

  const socketIds = principalToSocketIds.get(principal.principalKey);
  if (socketIds) {
    socketIds.delete(socketId);
    if (socketIds.size === 0) {
      principalToSocketIds.delete(principal.principalKey);
    }
  }

  socketIdToPrincipal.delete(socketId);
}

const getConnectedUsers = () =>
  Array.from(principalToSocketIds.entries()).map(([principalKey, socketIds]) => {
    const [role, userId] = principalKey.split(":");

    return {
      role,
      userId,
      principalKey,
      socketIds: Array.from(socketIds),
    };
  });

const getUserSocketMap = () => {
  const snapshot = {};

  for (const [principalKey, socketIds] of principalToSocketIds.entries()) {
    snapshot[principalKey] = Array.from(socketIds);
  }

  return snapshot;
};

const getSocketIdsByUser = (role, userId) => {
  if (!role || userId === undefined || userId === null) {
    return [];
  }

  const principalKey = getPrincipalKey(role, userId);
  return Array.from(principalToSocketIds.get(principalKey) || []);
};

const getRideRiderId = (ride) => {
  if (ride?.rider?.id) {
    return String(ride.rider.id);
  }

  return ride?.riderId ? String(ride.riderId) : null;
};

const getSocketIdsByRole = (role) => {
  if (!role) {
    return [];
  }

  const normalizedRole = String(role);
  const socketIds = [];

  for (const [principalKey, ids] of principalToSocketIds.entries()) {
    const [entryRole] = principalKey.split(":");

    if (entryRole === normalizedRole) {
      socketIds.push(...Array.from(ids));
    }
  }

  return Array.from(new Set(socketIds));
};

const emitRideChatMessageToParticipants = (audience, message) => {
  if (!ioInstance || !audience) {
    return;
  }

  const riderSocketIds = getSocketIdsByUser("rider", audience.riderId);
  const driverSocketIds = getSocketIdsByUser("driver", audience.driverId);
  const socketIds = Array.from(new Set([...riderSocketIds, ...driverSocketIds]));

  for (const socketId of socketIds) {
    ioInstance.to(socketId).emit("ride-chat-message", message);
  }
};

const initializeSocketServer = (httpServer) => {
  if (ioInstance) {
    return ioInstance;
  }

  ioInstance = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    },
  });

  ioInstance.use((socket, next) => {
    try {
      const authToken = socket.handshake.auth?.token;
      const bearerHeader = socket.handshake.headers?.authorization;
      const headerToken =
        typeof bearerHeader === "string" && bearerHeader.startsWith("Bearer ")
          ? bearerHeader.slice(7)
          : null;
      const token = authToken || headerToken;

      const payload = verifyJwtToken(token);
      const userId = payload?.sub;
      const role = String(payload?.role || "").toLowerCase();

      if (!userId || !VALID_ROLES.has(role)) {
        const error = new Error("Invalid socket authentication payload");
        error.data = { code: "UNAUTHORIZED" };
        throw error;
      }

      socket.data.user = {
        userId: String(userId),
        role,
        email: payload.email,
      };

      next();
    } catch (error) {
      const authError = new Error(error.message || "Unauthorized socket connection");
      authError.data = { code: "UNAUTHORIZED" };
      next(authError);
    }
  });

  ioInstance.on("connection", (socket) => {
    const connectedUser = socket.data.user;

    addConnection(socket.id, connectedUser.role, connectedUser.userId);

    logger.info("Socket connected", { socketId: socket.id });

    socket.emit("registered", {
      socketId: socket.id,
      userId: connectedUser.userId,
      role: connectedUser.role,
    });

    socket.on("driver-location-update", async ({ latitude, longitude }) => {
      logger.info("Socket event received", {
        event: "driver-location-update",
        socketId: socket.id,
        userId: connectedUser.userId,
      });

      if (!connectedUser || connectedUser.role !== "driver") {
        socket.emit("socket-error", { message: "Only connected drivers can update location" });
        return;
      }

      try {
        const activeRide = await rideModel.findActiveByDriverId(connectedUser.userId);

        if (!activeRide?.id) {
          socket.emit("socket-error", {
            message: "No active ride available to associate driver location update",
          });
          return;
        }

        const updatedDriver = await driverService.updateLocation(
          connectedUser.userId,
          latitude,
          longitude
        );

        const payload = {
          rideId: String(activeRide.id),
          driverId: String(updatedDriver.id),
          latitude: updatedDriver.latitude,
          longitude: updatedDriver.longitude,
          updatedAt: new Date().toISOString(),
        };

        // Acknowledge update to the sending driver socket.
        socket.emit("driver-location-updated", payload);

        const targetRiderId = activeRide ? getRideRiderId(activeRide) : null;

        if (targetRiderId !== undefined && targetRiderId !== null) {
          const riderSocketIds = getSocketIdsByUser("rider", targetRiderId);
          for (const riderSocketId of riderSocketIds) {
            ioInstance.to(riderSocketId).emit("driver-location-updated", payload);
          }
        }
      } catch (error) {
        logger.error("Driver location update failed", {
          socketId: socket.id,
          message: error.message,
          stack: error.stack,
        });
        socket.emit("socket-error", { message: error.message || "Failed to update driver location" });
      }
    });

    socket.on("ride-chat-send", async ({ rideId, text, clientMessageId }) => {
      if (!connectedUser || !connectedUser.userId || !connectedUser.role) {
        socket.emit("socket-error", { message: "Socket user context is not available" });
        return;
      }

      try {
        const { message, audience } = await rideChatService.sendMessage({
          role: connectedUser.role,
          userId: connectedUser.userId,
          rideId,
          text,
          metadata: {
            via: "socket",
            clientMessageId: clientMessageId || null,
          },
        });

        emitRideChatMessageToParticipants(audience, message);
        socket.emit("ride-chat-ack", {
          rideId: String(rideId || ""),
          clientMessageId: clientMessageId || null,
          messageId: message.id,
        });
      } catch (error) {
        logger.error("Ride chat send failed", {
          socketId: socket.id,
          rideId,
          message: error.message,
        });
        socket.emit("socket-error", { message: error.message || "Failed to send chat message" });
      }
    });

    socket.on("disconnect", () => {
      removeConnection(socket.id);
      logger.info("Socket disconnected", { socketId: socket.id });
    });
  });

  return ioInstance;
};

const getIO = () => ioInstance;

module.exports = {
  initializeSocketServer,
  getIO,
  getConnectedUsers,
  getUserSocketMap,
  getSocketIdsByUser,
  getSocketIdsByRole,
  emitRideChatMessageToParticipants,
};
