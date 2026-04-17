const { body } = require("express-validator");

const driverRegisterValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage("name must be between 2 and 60 characters"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("email is required")
    .isEmail()
    .withMessage("email must be valid")
    .normalizeEmail(),
  body("password")
    .trim()
    .notEmpty()
    .withMessage("password is required")
    .isLength({ min: 6 })
    .withMessage("password must be at least 6 characters long"),
];

const driverLoginValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("email is required")
    .isEmail()
    .withMessage("email must be valid")
    .normalizeEmail(),
  body("password")
    .trim()
    .notEmpty()
    .withMessage("password is required"),
];

const driverStatusValidation = [
  body("isOnline")
    .notEmpty()
    .withMessage("isOnline is required")
    .isBoolean()
    .withMessage("isOnline must be a boolean value")
    .toBoolean(),
];

const driverLocationValidation = [
  body("latitude")
    .notEmpty()
    .withMessage("latitude is required")
    .isFloat()
    .withMessage("latitude must be a number")
    .toFloat(),
  body("longitude")
    .notEmpty()
    .withMessage("longitude is required")
    .isFloat()
    .withMessage("longitude must be a number")
    .toFloat(),
];

module.exports = {
  driverRegisterValidation,
  driverLoginValidation,
  driverStatusValidation,
  driverLocationValidation,
};
