const express = require("express");

const healthRoutes = require("./healthRoutes");
const authRoutes = require("./authRoutes");
const driverRoutes = require("./driverRoutes");
const rideRoutes = require("./rideRoutes");
const rideChatRoutes = require("./rideChatRoutes");

const router = express.Router();

// Proper route grouping
router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/drivers", driverRoutes);
router.use("/rides", rideRoutes);
router.use("/chat", rideChatRoutes);

module.exports = router;