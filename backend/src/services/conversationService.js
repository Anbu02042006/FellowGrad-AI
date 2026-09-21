const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

class ConversationService {
  /**
   * Create a new conversation
   */
  static async createConversation({ userId, title }) {
    return await Conversation.create({ userId, title });
  }

  /**
   * Get conversations for a user ordered by updatedAt descending
   */
  static async getConversationsByUser(userId) {
    return await Conversation.findByUserIdOrderByUpdatedAtDesc(userId);
  }

  /**
   * Get a conversation by ID
   */
  static async getConversation(id) {
    const conversation = await Conversation.findById(id);
    if (!conversation) {
      const err = new Error('Conversation not found');
      err.status = 404;
      throw err;
    }
    return conversation;
  }

  /**
   * Save a message to a conversation
   */
  static async saveMessage(conversationId, { role, content, messageType = 'TEXT' }) {
    // Ensure conversation exists
    await this.getConversation(conversationId);

    const message = await Message.create({
      conversationId,
      role,
      content,
      messageType,
    });

    // Update conversation timestamp
    await Conversation.updateTimestamp(conversationId);

    return message;
  }

  /**
   * Get all messages for a conversation ordered by timestamp ascending
   */
  static async getMessages(conversationId) {
    // Ensure conversation exists
    await this.getConversation(conversationId);
    return await Message.findByConversationIdOrderByTimestampAsc(conversationId);
  }

  /**
   * Get recent messages for a conversation ordered by timestamp descending
   */
  static async getRecentMessages(conversationId, limit = 10) {
    // Ensure conversation exists
    await this.getConversation(conversationId);
    return await Message.findByConversationIdOrderByTimestampDesc(conversationId, parseInt(limit, 10));
  }
}

module.exports = ConversationService;
