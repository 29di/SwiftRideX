const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      default: "Driver",
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
    isOnline: {
      type: Boolean,
      default: false,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
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

const Driver = mongoose.model("Driver", driverSchema);

const create = async ({ name, email, passwordHash }) =>
  Driver.create({
    name: String(name || "Driver").trim() || "Driver",
    email,
    passwordHash,
    isOnline: false,
    latitude: null,
    longitude: null,
  });

const findByEmail = async (email) => Driver.findOne({ email: String(email || "").trim().toLowerCase() });

const findById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return Driver.findById(id);
};

const findAll = async () => Driver.find().sort({ createdAt: -1 });

const updateStatus = async (id, isOnline) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return Driver.findByIdAndUpdate(
    id,
    { isOnline: Boolean(isOnline) },
    { new: true, runValidators: true }
  );
};

const updateLocation = async (id, latitude, longitude) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return Driver.findByIdAndUpdate(
    id,
    { latitude: Number(latitude), longitude: Number(longitude) },
    { new: true, runValidators: true }
  );
};

const updateName = async (id, name) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  const normalizedName = String(name || '').trim();
  if (!normalizedName) {
    return null;
  }

  return Driver.findByIdAndUpdate(
    id,
    { name: normalizedName },
    { new: true, runValidators: true }
  );
};

module.exports = {
  create,
  findByEmail,
  findById,
  findAll,
  updateStatus,
  updateLocation,
  updateName,
  Driver,
};
