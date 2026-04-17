const rideModel = require('../models/rideModel');
const rideChatMessageModel = require('../models/rideChatMessageModel');
const { createTextEmbedding, cosineSimilarity } = require('./embeddingService');

const ACTIVE_CHAT_STATUSES = new Set(['REQUESTED', 'ACCEPTED', 'STARTED']);

const QUICK_MESSAGE_LIBRARY = {
  rider: [
    'I am at the pickup point.',
    'I will arrive in 2 minutes.',
    'Please call me when you arrive.',
    'I am wearing a blue shirt.',
    'Please take the main gate pickup.',
    'I am running a few minutes late.',
    'Please drive safely.',
    'Thank you!'
  ],
  driver: [
    'I have reached the pickup point.',
    'I will arrive in 2 minutes.',
    'Please share your exact pickup spot.',
    'I am near the main gate.',
    'I am waiting at the pickup location.',
    'Ride has started. We are heading to destination.',
    'Traffic is heavy. ETA may increase slightly.',
    'Thank you for riding with us.'
  ],
};

const resolveRiderId = (ride) => {
  if (ride?.rider?.id) {
    return String(ride.rider.id);
  }

  return ride?.riderId ? String(ride.riderId) : null;
};

const resolveDriverId = (ride) => {
  if (ride?.driver?.id) {
    return String(ride.driver.id);
  }

  return ride?.driverId ? String(ride.driverId) : null;
};

const sanitizeMessage = (message) => ({
  id: String(message.id),
  rideId: String(message.rideId),
  senderRole: message.senderRole,
  senderId: message.senderId || null,
  text: message.text,
  createdAt: message.createdAt,
  metadata: message.metadata || null,
});

const assertRideChatAccess = async ({ role, userId, rideId }) => {
  const ride = await rideModel.findById(rideId);

  if (!ride) {
    const error = new Error('Ride not found');
    error.statusCode = 404;
    throw error;
  }

  const riderId = resolveRiderId(ride);
  const driverId = resolveDriverId(ride);
  const status = String(ride.status || '').toUpperCase();

  if (!ACTIVE_CHAT_STATUSES.has(status)) {
    const error = new Error('Ride chat is only available for active rides');
    error.statusCode = 400;
    throw error;
  }

  if (role === 'rider') {
    if (String(riderId || '') !== String(userId || '')) {
      const error = new Error('You are not allowed to access this ride chat');
      error.statusCode = 403;
      throw error;
    }
  } else if (role === 'driver') {
    if (!driverId) {
      const error = new Error('Ride is not assigned to a driver yet');
      error.statusCode = 400;
      throw error;
    }

    if (String(driverId) !== String(userId || '')) {
      const error = new Error('You are not allowed to access this ride chat');
      error.statusCode = 403;
      throw error;
    }
  } else {
    const error = new Error('Unsupported role for ride chat');
    error.statusCode = 403;
    throw error;
  }

  return {
    ride,
    audience: {
      riderId,
      driverId,
    },
  };
};

const getMessages = async ({ role, userId, rideId, limit = 50 }) => {
  await assertRideChatAccess({ role, userId, rideId });

  const records = await rideChatMessageModel.findByRideId(rideId, { limit });
  return records.reverse().map((item) => sanitizeMessage(item));
};

const sendMessage = async ({ role, userId, rideId, text, metadata = null }) => {
  const normalizedText = String(text || '').trim();

  if (!normalizedText) {
    const error = new Error('Message text is required');
    error.statusCode = 400;
    throw error;
  }

  if (normalizedText.length > 1000) {
    const error = new Error('Message text cannot exceed 1000 characters');
    error.statusCode = 400;
    throw error;
  }

  const { audience } = await assertRideChatAccess({ role, userId, rideId });

  const created = await rideChatMessageModel.create({
    rideId,
    senderRole: role,
    senderId: String(userId),
    text: normalizedText,
    embedding: createTextEmbedding(normalizedText),
    metadata,
  });

  return {
    message: sanitizeMessage(created),
    audience,
  };
};

const getQuickReplies = async ({ role, userId, rideId, contextText = '', limit = 5 }) => {
  await assertRideChatAccess({ role, userId, rideId });

  const candidates = QUICK_MESSAGE_LIBRARY[role] || QUICK_MESSAGE_LIBRARY.rider;
  const normalizedLimit = Math.min(8, Math.max(1, Number(limit) || 5));

  const trimmedContext = String(contextText || '').trim();
  const contextVector = trimmedContext ? createTextEmbedding(trimmedContext) : null;

  if (!contextVector) {
    return candidates.slice(0, normalizedLimit);
  }

  const ranked = candidates
    .map((value) => {
      const candidateVector = createTextEmbedding(value);
      return {
        value,
        score: cosineSimilarity(contextVector, candidateVector),
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, normalizedLimit)
    .map((item) => item.value);

  return ranked;
};

module.exports = {
  getMessages,
  sendMessage,
  getQuickReplies,
};
