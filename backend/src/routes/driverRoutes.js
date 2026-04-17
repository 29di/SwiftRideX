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

const router = express.Router();

router.post("/register", driverRegisterValidation, validateRequest, driverController.register);
router.post("/login", driverLoginValidation, validateRequest, driverController.login);
router.get("/me", driverAuthMiddleware, driverController.getProfile);
router.get("/ride-requests", driverAuthMiddleware, driverController.getRideRequests);
router.patch("/status", driverAuthMiddleware, driverStatusValidation, validateRequest, driverController.toggleStatus);
router.patch("/location", driverAuthMiddleware, driverLocationValidation, validateRequest, driverController.updateLocation);

module.exports = router;
