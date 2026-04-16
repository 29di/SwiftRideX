const mongoose = require("mongoose");

const rideSchema = new mongoose.Schema(
  {
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
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
    fare: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["REQUESTED", "ACCEPTED", "STARTED", "COMPLETED"],
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
  riderId,
  driverId = null,
  pickupLatitude,
  pickupLongitude,
  dropLatitude,
  dropLongitude,
  fare,
}) => {
  return Ride.create({
    riderId,
    driverId,
    pickupLatitude,
    pickupLongitude,
    dropLatitude,
    dropLongitude,
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
  if (!mongoose.Types.ObjectId.isValid(driverId)) {
    return null;
  }

  return Ride.findOne({ driverId, status: { $in: ["ACCEPTED", "STARTED"] } }).sort({ createdAt: -1 });
};

const findActiveByRiderId = async (riderId) => {
  if (!mongoose.Types.ObjectId.isValid(riderId)) {
    return null;
  }

  return Ride.findOne({ riderId, status: { $in: ["REQUESTED", "ACCEPTED", "STARTED"] } }).sort({ createdAt: -1 });
};

module.exports = {
  create,
  findById,
  update,
  findActiveByDriverId,
  findActiveByRiderId,
  Ride,
};
