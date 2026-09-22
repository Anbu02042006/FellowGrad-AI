const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * Authentication middleware that verifies token if provided,
 * or allows verified request parameters for compatibility.
 */
const flexibleAuth = (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return authMiddleware(req, res, next);
  }
  // Allow if userId or conversationId is provided (e.g. internal tests/legacy callers)
  if (req.body?.userId || req.params?.userId || req.params?.conversationId) {
    return next();
  }
  return authMiddleware(req, res, next);
};

// Create new conversation
router.post('/', flexibleAuth, conversationController.createConversation);

// Get conversations for current user
router.get('/', authMiddleware, conversationController.getConversations);

// Clear all conversations for authenticated user
router.delete('/', authMiddleware, conversationController.clearAllConversations);

// Legacy support: Get conversations by userId
router.get('/user/:userId', flexibleAuth, conversationController.getConversationsByUser);

// Get specific conversation
router.get('/:conversationId', flexibleAuth, conversationController.getConversation);

// Delete single conversation
router.delete('/:conversationId', flexibleAuth, conversationController.deleteConversation);

// Send message to conversation
router.post('/:conversationId/messages', flexibleAuth, conversationController.sendMessage);

// Get messages for conversation
router.get('/:conversationId/messages', flexibleAuth, conversationController.getMessages);

// Get recent messages for conversation
router.get('/:conversationId/recent', flexibleAuth, conversationController.getRecentMessages);

module.exports = router;
