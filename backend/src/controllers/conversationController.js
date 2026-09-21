const ConversationService = require('../services/conversationService');

const createConversation = async (req, res, next) => {
  try {
    const { userId, title } = req.body;
    const conversation = await ConversationService.createConversation({ userId, title });
    return res.status(200).json(conversation);
  } catch (err) {
    next(err);
  }
};

const getConversationsByUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const conversations = await ConversationService.getConversationsByUser(userId);
    return res.status(200).json(conversations);
  } catch (err) {
    next(err);
  }
};

const getConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const conversation = await ConversationService.getConversation(conversationId);
    return res.status(200).json(conversation);
  } catch (err) {
    next(err);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { role, content, messageType } = req.body;
    const message = await ConversationService.saveMessage(conversationId, {
      role,
      content,
      messageType,
    });
    return res.status(200).json(message);
  } catch (err) {
    next(err);
  }
};

const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const messages = await ConversationService.getMessages(conversationId);
    return res.status(200).json(messages);
  } catch (err) {
    next(err);
  }
};

const getRecentMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const limit = req.query.limit || 10;
    const messages = await ConversationService.getRecentMessages(conversationId, limit);
    return res.status(200).json(messages);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createConversation,
  getConversationsByUser,
  getConversation,
  sendMessage,
  getMessages,
  getRecentMessages,
};
