const express = require('express');

const rideChatController = require('../controllers/rideChatController');
const chatAuthMiddleware = require('../middlewares/chatAuthMiddleware');
const validateRequest = require('../middlewares/validateRequest');
const {
  rideIdParamValidation,
  rideChatMessageValidation,
  rideChatQuickRepliesValidation,
} = require('../validations');

const router = express.Router();

router.get(
  '/rides/:rideId/messages',
  chatAuthMiddleware,
  rideIdParamValidation,
  validateRequest,
  rideChatController.getRideChatMessages
);

router.post(
  '/rides/:rideId/messages',
  chatAuthMiddleware,
  rideIdParamValidation,
  rideChatMessageValidation,
  validateRequest,
  rideChatController.sendRideChatMessage
);

router.get(
  '/rides/:rideId/quick-replies',
  chatAuthMiddleware,
  rideIdParamValidation,
  rideChatQuickRepliesValidation,
  validateRequest,
  rideChatController.getRideChatQuickReplies
);

module.exports = router;
