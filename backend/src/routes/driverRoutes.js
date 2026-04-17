const express = require("express");

const driverController = require("../controllers/driverController");
const driverAuthMiddleware = require("../middlewares/driverAuthMiddleware");
const validateRequest = require("../middlewares/validateRequest");
const {
  driverRegisterValidation,
  driverLoginValidation,
  driverStatusValidation,
  driverLocationValidation,
} = require("../validations");
const { rideIdParamValidation } = require('../validations');

const router = express.Router();

router.post("/register", driverRegisterValidation, validateRequest, driverController.register);
router.post("/login", driverLoginValidation, validateRequest, driverController.login);
router.get("/me", driverAuthMiddleware, driverController.getProfile);
router.patch('/me', driverAuthMiddleware, driverController.updateProfile);
router.get("/ride-requests", driverAuthMiddleware, driverController.getRideRequests);
router.get('/rides/history', driverAuthMiddleware, driverController.getRideHistory);
router.get('/rides/:rideId', driverAuthMiddleware, rideIdParamValidation, validateRequest, driverController.getRideDetail);
router.patch("/status", driverAuthMiddleware, driverStatusValidation, validateRequest, driverController.toggleStatus);
router.patch("/location", driverAuthMiddleware, driverLocationValidation, validateRequest, driverController.updateLocation);

module.exports = router;
