const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { isMongoConnected, inMemoryStore } = require('../config/database');

const messageSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuidv4 },
    conversationId: { type: String, required: true, index: true },
    role: { type: String, enum: ['USER', 'ASSISTANT', 'SYSTEM'], required: true },
    content: { type: String, required: true },
    messageType: { type: String, enum: ['TEXT', 'VOICE'], default: 'TEXT' },
    timestamp: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const MongooseMessage = mongoose.models.Message || mongoose.model('Message', messageSchema);

class Message {
  static async create({ conversationId, role, content, messageType = 'TEXT' }) {
    const now = new Date().toISOString();
    if (isMongoConnected()) {
      const doc = await MongooseMessage.create({
        conversationId,
        role,
        content,
        messageType,
        timestamp: new Date(),
      });
      return {
        id: doc._id.toString(),
        conversationId: doc.conversationId,
        role: doc.role,
        content: doc.content,
        messageType: doc.messageType,
        timestamp: doc.timestamp.toISOString(),
      };
    }

    // In-memory fallback
    const item = {
      id: uuidv4(),
      conversationId,
      role,
      content,
      messageType,
      timestamp: now,
    };
    inMemoryStore.messages.set(item.id, item);
    return item;
  }

  static async findByConversationIdOrderByTimestampAsc(conversationId) {
    if (isMongoConnected()) {
      const docs = await MongooseMessage.find({ conversationId }).sort({ timestamp: 1 });
      return docs.map((doc) => ({
        id: doc._id.toString(),
        conversationId: doc.conversationId,
        role: doc.role,
        content: doc.content,
        messageType: doc.messageType,
        timestamp: doc.timestamp.toISOString(),
      }));
    }

    return Array.from(inMemoryStore.messages.values())
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  static async findByConversationIdOrderByTimestampDesc(conversationId, limit = 10) {
    if (isMongoConnected()) {
      const docs = await MongooseMessage.find({ conversationId })
        .sort({ timestamp: -1 })
        .limit(limit);
      return docs.map((doc) => ({
        id: doc._id.toString(),
        conversationId: doc.conversationId,
        role: doc.role,
        content: doc.content,
        messageType: doc.messageType,
        timestamp: doc.timestamp.toISOString(),
      }));
    }

    return Array.from(inMemoryStore.messages.values())
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }
}

module.exports = Message;
