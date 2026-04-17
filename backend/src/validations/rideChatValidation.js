const { body, query } = require('express-validator');

const rideChatMessageValidation = [
  body('text')
    .notEmpty()
    .withMessage('text is required')
    .isString()
    .withMessage('text must be a string')
    .isLength({ min: 1, max: 1000 })
    .withMessage('text must be between 1 and 1000 characters')
    .trim(),
];

const rideChatQuickRepliesValidation = [
  query('context')
    .optional()
    .isString()
    .withMessage('context must be a string')
    .isLength({ max: 1000 })
    .withMessage('context cannot exceed 1000 characters')
    .trim(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 8 })
    .withMessage('limit must be an integer between 1 and 8')
    .toInt(),
];

module.exports = {
  rideChatMessageValidation,
  rideChatQuickRepliesValidation,
};
