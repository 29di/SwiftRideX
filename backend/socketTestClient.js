const { io } = require("socket.io-client");

const serverUrl = process.env.SOCKET_SERVER_URL || "http://localhost:5000";
const userId = process.env.SOCKET_USER_ID || process.argv[2] || "1";
const role = process.env.SOCKET_ROLE || process.argv[3] || "rider";

const socket = io(serverUrl, {
  transports: ["websocket"],
  autoConnect: true,
  auth: {
    userId,
    role,
  },
});

const logEvent = (eventName, payload) => {
  console.log(`[socket] ${eventName}:`, JSON.stringify(payload, null, 2));
};

socket.on("connect", () => {
  console.log(`[socket] connected: ${socket.id}`);
  socket.emit("register-user", { userId, role });
});

socket.on("registered", (payload) => {
  logEvent("registered", payload);
});

socket.on("ride-accepted", (payload) => {
  logEvent("ride-accepted", payload);
});

socket.on("ride-started", (payload) => {
  logEvent("ride-started", payload);
});

socket.on("ride-completed", (payload) => {
  logEvent("ride-completed", payload);
});

socket.on("ride-status-updated", (payload) => {
  logEvent("ride-status-updated", payload);
});

socket.on("socket-error", (payload) => {
  logEvent("socket-error", payload);
});

socket.on("disconnect", (reason) => {
  console.log(`[socket] disconnected: ${reason}`);
});

socket.on("connect_error", (error) => {
  console.error(`[socket] connect_error: ${error.message}`);
});

process.on("SIGINT", () => {
  console.log("[socket] closing client...");
  socket.close();
  process.exit(0);
});
