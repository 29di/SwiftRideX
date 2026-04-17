const rideChatService = require('../services/rideChatService');
const { emitRideChatMessageToParticipants } = require('../socket/socketServer');

const getRideChatMessages = async (req, res, next) => {
  try {
    const messages = await rideChatService.getMessages({
      role: req.user.role,
      userId: req.user.id,
      rideId: req.params.rideId,
      limit: req.query.limit,
    });

    res.status(200).json({ messages });
  } catch (error) {
    next(error);
  }
};

const sendRideChatMessage = async (req, res, next) => {
  try {
    const { message, audience } = await rideChatService.sendMessage({
      role: req.user.role,
      userId: req.user.id,
      rideId: req.params.rideId,
      text: req.body.text,
      metadata: {
        via: 'http',
      },
    });

    emitRideChatMessageToParticipants(audience, message);

    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
};

const getRideChatQuickReplies = async (req, res, next) => {
  try {
    const quickReplies = await rideChatService.getQuickReplies({
      role: req.user.role,
      userId: req.user.id,
      rideId: req.params.rideId,
      contextText: req.query.context,
      limit: req.query.limit,
    });

    res.status(200).json({ quickReplies });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRideChatMessages,
  sendRideChatMessage,
  getRideChatQuickReplies,
};
