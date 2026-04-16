const { body } = require("express-validator");

const registerValidation = [
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
  body("fullName")
    .trim()
    .notEmpty()
    .withMessage("fullName is required"),
];

const loginValidation = [
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

module.exports = {
  registerValidation,
  loginValidation,
};
