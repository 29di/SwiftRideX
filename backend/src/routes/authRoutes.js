const express = require("express");

const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");
const validateRequest = require("../middlewares/validateRequest");
const { registerValidation, loginValidation } = require("../validations");

const router = express.Router();

router.post("/register", registerValidation, validateRequest, authController.register);
router.post("/login", loginValidation, validateRequest, authController.login);
router.post("/google", authController.googleLogin);
router.get("/me", authMiddleware, authController.getMe);

module.exports = router;
