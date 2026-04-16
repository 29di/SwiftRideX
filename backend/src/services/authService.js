const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");

const userModel = require("../models/userModel");
const { jwtSecret, jwtExpiresIn, googleClientId } = require("../config");

const googleClient = new OAuth2Client();

const sanitizeUser = (user) => ({
  id: String(user.id),
  email: user.email,
  fullName: user.fullName,
  createdAt: user.createdAt,
});

const register = async ({ email, password, fullName }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedName = String(fullName || "").trim();

  if (!normalizedEmail || !password || !normalizedName) {
    const error = new Error("email, password and fullName are required");
    error.statusCode = 400;
    throw error;
  }

  if (String(password).length < 6) {
    const error = new Error("Password must be at least 6 characters long");
    error.statusCode = 400;
    throw error;
  }

  const existingUser = await userModel.findByEmail(normalizedEmail);
  if (existingUser) {
    const error = new Error("User with this email already exists");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await userModel.create({
    email: normalizedEmail,
    fullName: normalizedName,
    passwordHash,
  });

  return sanitizeUser(user);
};

const login = async ({ email, password }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail || !password) {
    const error = new Error("email and password are required");
    error.statusCode = 400;
    throw error;
  }

  const user = await userModel.findByEmail(normalizedEmail);
  if (!user) {
    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    throw error;
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    throw error;
  }

  if (!jwtSecret) {
    const error = new Error("JWT_SECRET is not configured");
    error.statusCode = 500;
    throw error;
  }

  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: "rider",
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );

  return {
    token,
    user: sanitizeUser(user),
  };
};

const getProfile = async (userId) => {
  const user = await userModel.findById(userId);

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  return sanitizeUser(user);
};

const loginWithGoogle = async ({ credential }) => {
  if (!credential) {
    const error = new Error("Google credential is required");
    error.statusCode = 400;
    throw error;
  }

  if (!googleClientId) {
    const error = new Error("GOOGLE_CLIENT_ID is not configured");
    error.statusCode = 500;
    throw error;
  }

  if (!jwtSecret) {
    const error = new Error("JWT_SECRET is not configured");
    error.statusCode = 500;
    throw error;
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: googleClientId,
  });

  const payload = ticket.getPayload();
  const email = String(payload?.email || "").trim().toLowerCase();
  const fullName = String(payload?.name || payload?.given_name || email || "Google User").trim();

  if (!email) {
    const error = new Error("Google account email is unavailable");
    error.statusCode = 400;
    throw error;
  }

  let user = await userModel.findByEmail(email);

  if (!user) {
    const generatedPassword = crypto.randomBytes(24).toString("hex");
    const passwordHash = await bcrypt.hash(generatedPassword, 10);

    user = await userModel.create({
      email,
      fullName,
      passwordHash,
    });
  }

  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: "rider",
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );

  return {
    token,
    user: sanitizeUser(user),
  };
};

module.exports = {
  register,
  login,
  getProfile,
  loginWithGoogle,
};
