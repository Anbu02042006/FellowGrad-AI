const ConversationService = require('../services/conversationService');

/**
 * Helper to obtain verified userId from req.user with fallback for test compatibility
 */
const getVerifiedUserId = (req) => {
  return req.user?.userId || req.user?.id || req.body?.userId || req.params?.userId || null;
};

/**
 * POST /api/conversations
 */
const createConversation = async (req, res, next) => {
  try {
    const userId = getVerifiedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Missing user identification' });
    }

    const title = req.body?.title || 'New Conversation';
    const conversation = await ConversationService.createConversation({ userId, title });
    return res.status(200).json(conversation);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/conversations
 * GET /api/conversations/user/:userId
 */
const getConversations = async (req, res, next) => {
  try {
    const authenticatedUserId = req.user?.userId || req.user?.id;
    const requestedUserId = req.params?.userId || req.query?.userId || authenticatedUserId;

    // Strict 1-to-1 data isolation: User cannot request another user's conversations
    if (authenticatedUserId && requestedUserId && authenticatedUserId !== requestedUserId) {
      return res.status(403).json({ error: 'Forbidden: Access denied to other user data' });
    }

    const targetUserId = authenticatedUserId || requestedUserId;
    if (!targetUserId) {
      return res.status(401).json({ error: 'Unauthorized: User not identified' });
    }

    const limit = parseInt(req.query?.limit, 10) || 50;
    const conversations = await ConversationService.getConversationsByUser(targetUserId, limit);
    return res.status(200).json(conversations);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/conversations/:conversationId
 */
const getConversation = async (req, res, next) => {
  try {
    const userId = getVerifiedUserId(req);
    const { conversationId } = req.params;

    const conversation = await ConversationService.getConversation(userId, conversationId);
    return res.status(200).json(conversation);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    next(err);
  }
};

/**
 * DELETE /api/conversations/:conversationId
 */
const deleteConversation = async (req, res, next) => {
  try {
    const userId = getVerifiedUserId(req);
    const { conversationId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User not identified' });
    }

    const result = await ConversationService.deleteConversation(userId, conversationId);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/conversations/:conversationId/messages
 */
const sendMessage = async (req, res, next) => {
  try {
    const userId = getVerifiedUserId(req);
    const { conversationId } = req.params;
    const { role, content, messageType } = req.body;

    const message = await ConversationService.saveMessage(conversationId, {
      role,
      content,
      messageType,
      userId,
    });
    return res.status(200).json(message);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/conversations/:conversationId/messages
 */
const getMessages = async (req, res, next) => {
  try {
    const userId = getVerifiedUserId(req);
    const { conversationId } = req.params;
    const limit = parseInt(req.query?.limit, 10) || 100;

    const messages = await ConversationService.getMessages(userId, conversationId, limit);
    return res.status(200).json(messages);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/conversations/:conversationId/recent
 */
const getRecentMessages = async (req, res, next) => {
  try {
    const userId = getVerifiedUserId(req);
    const { conversationId } = req.params;
    const limit = parseInt(req.query?.limit, 10) || 10;

    const messages = await ConversationService.getRecentMessages(userId, conversationId, limit);
    return res.status(200).json(messages);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createConversation,
  getConversations,
  getConversationsByUser: getConversations,
  getConversation,
  deleteConversation,
  sendMessage,
  getMessages,
  getRecentMessages,
};
