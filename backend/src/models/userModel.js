const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

const User = mongoose.model("User", userSchema);

const create = async ({ email, fullName, passwordHash }) =>
  User.create({ email, fullName, passwordHash });

const findByEmail = async (email) => User.findOne({ email: String(email || "").trim().toLowerCase() });

const findById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return User.findById(id);
};

module.exports = {
  create,
  findByEmail,
  findById,
  User,
};
