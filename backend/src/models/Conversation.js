const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { isMongoConnected, inMemoryStore } = require('../config/database');

const conversationSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuidv4 },
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
  },
  {
    timestamps: true,
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

const MongooseConversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);

class Conversation {
  static async create({ userId, title }) {
    const now = new Date().toISOString();
    if (isMongoConnected()) {
      const doc = await MongooseConversation.create({ userId, title });
      return {
        id: doc._id.toString(),
        userId: doc.userId,
        title: doc.title,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      };
    }

    // In-memory fallback
    const item = {
      id: uuidv4(),
      userId,
      title,
      createdAt: now,
      updatedAt: now,
    };
    inMemoryStore.conversations.set(item.id, item);
    return item;
  }

  static async findById(id) {
    if (isMongoConnected()) {
      const doc = await MongooseConversation.findById(id);
      if (!doc) return null;
      return {
        id: doc._id.toString(),
        userId: doc.userId,
        title: doc.title,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      };
    }

    const item = inMemoryStore.conversations.get(id);
    return item || null;
  }

  static async findByUserIdOrderByUpdatedAtDesc(userId) {
    if (isMongoConnected()) {
      const docs = await MongooseConversation.find({ userId }).sort({ updatedAt: -1 });
      return docs.map((doc) => ({
        id: doc._id.toString(),
        userId: doc.userId,
        title: doc.title,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      }));
    }

    const list = Array.from(inMemoryStore.conversations.values())
      .filter((c) => c.userId === userId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return list;
  }

  static async updateTimestamp(id) {
    const now = new Date().toISOString();
    if (isMongoConnected()) {
      await MongooseConversation.findByIdAndUpdate(id, { updatedAt: new Date() });
    } else {
      const conv = inMemoryStore.conversations.get(id);
      if (conv) {
        conv.updatedAt = now;
      }
    }
  }
}

module.exports = Conversation;
