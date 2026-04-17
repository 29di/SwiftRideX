const mongoose = require("mongoose");

const embeddedRiderSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      index: true,
    },
    email: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },
    fullName: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { _id: false }
);

const embeddedDriverSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      index: true,
    },
    email: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { _id: false }
);

const rideSchema = new mongoose.Schema(
  {
    rider: {
      type: embeddedRiderSchema,
      required: true,
    },
    driver: {
      type: embeddedDriverSchema,
      default: null,
    },
    // Legacy fields kept for old documents; new writes rely on embedded rider/driver.
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
      default: null,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
      index: true,
    },
    pickupLatitude: {
      type: Number,
      required: true,
    },
    pickupLongitude: {
      type: Number,
      required: true,
    },
    dropLatitude: {
      type: Number,
      required: true,
    },
    dropLongitude: {
      type: Number,
      required: true,
    },
    pickupAddress: {
      type: String,
      default: null,
      trim: true,
    },
    dropAddress: {
      type: String,
      default: null,
      trim: true,
    },
    fare: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["REQUESTED", "ACCEPTED", "STARTED", "COMPLETED", "CANCELLED"],
      default: "REQUESTED",
      index: true,
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

const Ride = mongoose.model("Ride", rideSchema);

const create = async ({
  rider,
  driver = null,
  riderId = null,
  driverId = null,
  pickupLatitude,
  pickupLongitude,
  dropLatitude,
  dropLongitude,
  pickupAddress = null,
  dropAddress = null,
  fare,
}) => {
  return Ride.create({
    rider,
    driver,
    riderId,
    driverId,
    pickupLatitude,
    pickupLongitude,
    dropLatitude,
    dropLongitude,
    pickupAddress,
    dropAddress,
    fare,
    status: "REQUESTED",
  });
};

const findById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return Ride.findById(id);
};

const update = async (id, fields) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return Ride.findByIdAndUpdate(id, fields, { new: true, runValidators: true });
};

const findActiveByDriverId = async (driverId) => {
  const normalizedDriverId = String(driverId || "").trim();
  if (!normalizedDriverId) {
    return null;
  }

  return Ride.findOne({
    status: { $in: ["ACCEPTED", "STARTED"] },
    $or: [{ "driver.id": normalizedDriverId }, { driverId: normalizedDriverId }],
  }).sort({ createdAt: -1 });
};

const findActiveByRiderId = async (riderId) => {
  const normalizedRiderId = String(riderId || "").trim();
  if (!normalizedRiderId) {
    return null;
  }

  return Ride.findOne({
    status: { $in: ["REQUESTED", "ACCEPTED", "STARTED"] },
    $or: [{ "rider.id": normalizedRiderId }, { riderId: normalizedRiderId }],
  }).sort({ createdAt: -1 });
};

const findOpenRequests = async () =>
  Ride.find({
    status: "REQUESTED",
    $or: [{ driver: null }, { "driver.id": null }, { "driver.id": { $exists: false } }, { driverId: null }],
  }).sort({ createdAt: -1 });

const findByRiderId = async (riderId) => {
  const normalizedRiderId = String(riderId || "").trim();
  if (!normalizedRiderId) {
    return [];
  }

  return Ride.find({
    $or: [{ "rider.id": normalizedRiderId }, { riderId: normalizedRiderId }],
  }).sort({ createdAt: -1 });
};

const findByDriverId = async (driverId) => {
  const normalizedDriverId = String(driverId || '').trim();
  if (!normalizedDriverId) {
    return [];
  }

  return Ride.find({
    $or: [{ 'driver.id': normalizedDriverId }, { driverId: normalizedDriverId }],
  }).sort({ createdAt: -1 });
};

module.exports = {
  create,
  findById,
  update,
  findActiveByDriverId,
  findActiveByRiderId,
  findOpenRequests,
  findByRiderId,
  findByDriverId,
  Ride,
};
