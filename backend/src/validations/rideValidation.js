const { body, param } = require("express-validator");

const rideRequestValidation = [
  body("pickupLatitude")
    .notEmpty()
    .withMessage("pickupLatitude is required")
    .isFloat()
    .withMessage("pickupLatitude must be a number")
    .toFloat(),
  body("pickupLongitude")
    .notEmpty()
    .withMessage("pickupLongitude is required")
    .isFloat()
    .withMessage("pickupLongitude must be a number")
    .toFloat(),
  body("dropLatitude")
    .notEmpty()
    .withMessage("dropLatitude is required")
    .isFloat()
    .withMessage("dropLatitude must be a number")
    .toFloat(),
  body("dropLongitude")
    .notEmpty()
    .withMessage("dropLongitude is required")
    .isFloat()
    .withMessage("dropLongitude must be a number")
    .toFloat(),
  body("fare")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("fare must be a non-negative number")
    .toFloat(),
];

const rideIdParamValidation = [
  param("rideId")
    .notEmpty()
    .withMessage("rideId is required")
    .isMongoId()
    .withMessage("rideId must be a valid MongoDB ObjectId"),
];

module.exports = {
  rideRequestValidation,
  rideIdParamValidation,
};
