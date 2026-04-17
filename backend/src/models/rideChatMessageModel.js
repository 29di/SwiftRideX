const mongoose = require('mongoose');

const rideChatMessageSchema = new mongoose.Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ride',
      required: true,
      index: true,
    },
    senderRole: {
      type: String,
      enum: ['rider', 'driver', 'system'],
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      default: null,
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    embedding: {
      type: [Number],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    versionKey: false,
  }
);

rideChatMessageSchema.index({ rideId: 1, createdAt: -1 });

const RideChatMessage = mongoose.model('RideChatMessage', rideChatMessageSchema);

const create = async ({ rideId, senderRole, senderId, text, embedding, metadata = null }) =>
  RideChatMessage.create({
    rideId,
    senderRole,
    senderId,
    text,
    embedding,
    metadata,
  });

const findByRideId = async (rideId, { limit = 50 } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(rideId)) {
    return [];
  }

  const normalizedLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  return RideChatMessage.find({ rideId }).sort({ createdAt: -1 }).limit(normalizedLimit);
};

module.exports = {
  RideChatMessage,
  create,
  findByRideId,
};
