const express = require("express");

const rideController = require("../controllers/rideController");
const authMiddleware = require("../middlewares/authMiddleware");
const driverAuthMiddleware = require("../middlewares/driverAuthMiddleware");
const validateRequest = require("../middlewares/validateRequest");
const { rideRequestValidation, rideIdParamValidation } = require("../validations");

const router = express.Router();

router.post("/request", authMiddleware, rideRequestValidation, validateRequest, rideController.requestRide);
router.post("/fare-estimate", authMiddleware, rideRequestValidation, validateRequest, rideController.estimateFare);
router.get("/", authMiddleware, rideController.getRides);
router.get("/history", authMiddleware, rideController.getRideHistory);
router.get("/active/rider", authMiddleware, rideController.getActiveRideForRider);
router.get("/active/driver", driverAuthMiddleware, rideController.getActiveRideForDriver);
router.get("/:rideId", authMiddleware, rideIdParamValidation, validateRequest, rideController.getRide);
router.patch("/:rideId/cancel", authMiddleware, rideIdParamValidation, validateRequest, rideController.cancelRide);
router.patch("/:rideId/accept", driverAuthMiddleware, rideIdParamValidation, validateRequest, rideController.acceptRide);
router.patch("/:rideId/start", driverAuthMiddleware, rideIdParamValidation, validateRequest, rideController.startRide);
router.patch("/:rideId/end", driverAuthMiddleware, rideIdParamValidation, validateRequest, rideController.endRide);

module.exports = router;
