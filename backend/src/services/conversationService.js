/**
 * Conversation Service for FellowGrad AI
 * Manages conversation history and messages in Google Cloud Firestore.
 *
 * Firestore Data Structure:
 * users/{userId}
 * users/{userId}/conversations/{conversationId}
 * users/{userId}/conversations/{conversationId}/messages/{messageId}
 */

const { v4: uuidv4 } = require('uuid');
const { getFirestore, FieldValue } = require('../config/firestore');

class ConversationService {
  static conversationUserMap = new Map();
  /**
   * Helper to ensure user document exists in Firestore without overwriting profile data
   */
  static async ensureUserDoc(userId) {
    try {
      const db = getFirestore();
      const userRef = db.doc(`users/${userId}`);
      await userRef.set(
        {
          userId,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn(`[Firestore] ensureUserDoc note for ${userId}: ${err.message}`);
    }
  }

  /**
   * Create a new conversation document under users/{userId}/conversations/{conversationId}
   * @param {object} param0
   * @param {string} param0.userId
   * @param {string} [param0.title]
   * @param {string} [param0.conversationId]
   */
  static async createConversation({ userId, title = 'New Conversation', conversationId = null }) {
    if (!userId) {
      throw new Error('Cannot create conversation without verified userId');
    }

    const db = getFirestore();
    const id = conversationId || uuidv4();
    await this.ensureUserDoc(userId);

    const convRef = db.doc(`users/${userId}/conversations/${id}`);
    const conversationData = {
      id,
      userId,
      title: title || 'New Conversation',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastMessage: '',
      messageCount: 0,
      status: 'active',
    };

    ConversationService.conversationUserMap.set(id, userId);
    await convRef.set(conversationData, { merge: true });
    console.log(`[Firestore] Conversation created: id=${id}, user=${userId}, title="${title}"`);

    // Return plain object with string timestamps for immediate consumer usage
    return {
      ...conversationData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get all conversations for a user ordered by updatedAt descending
   * @param {string} userId
   * @param {number} [limit]
   */
  static async getConversationsByUser(userId, limit = 50) {
    if (!userId) return [];
    const db = getFirestore();

    try {
      const collRef = db.collection(`users/${userId}/conversations`);
      let snapshot;

      try {
        snapshot = await collRef.orderBy('updatedAt', 'desc').limit(limit).get();
      } catch (orderErr) {
        // Fallback without index if needed
        snapshot = await collRef.get();
      }

      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });

      // In-memory sort fallback if order was not applied
      list.sort((a, b) => {
        const tA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : new Date(a.updatedAt || 0).getTime();
        const tB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : new Date(b.updatedAt || 0).getTime();
        return tB - tA;
      });

      return list.slice(0, limit);
    } catch (err) {
      console.error(`[ConversationService] Failed to get conversations for ${userId}:`, err.message);
      return [];
    }
  }

  /**
   * Get a conversation by ID for a specific user (verifying ownership)
   * @param {string} userId
   * @param {string} conversationId
   */
  static async getConversation(userId, conversationId) {
    if (!conversationId) {
      const err = new Error('Missing conversationId');
      err.status = 400;
      throw err;
    }

    const db = getFirestore();

    // Direct path lookup when userId is provided (Strict 1-to-1 data isolation)
    if (userId) {
      const docRef = db.doc(`users/${userId}/conversations/${conversationId}`);
      const doc = await docRef.get();

      if (!doc.exists) {
        const err = new Error('Conversation not found');
        err.status = 404;
        throw err;
      }

      return { id: doc.id, ...doc.data() };
    }

    // Fallback only when userId was not provided by legacy callers
    const mappedUserId = this.conversationUserMap.get(conversationId);
    if (mappedUserId) {
      const docRef = db.doc(`users/${mappedUserId}/conversations/${conversationId}`);
      const doc = await docRef.get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() };
      }
    }

    const notFound = new Error('Conversation not found');
    notFound.status = 404;
    throw notFound;
  }

  /**
   * Delete a conversation and its messages
   * @param {string} userId
   * @param {string} conversationId
   */
  static async deleteConversation(userId, conversationId) {
    if (!userId || !conversationId) {
      throw new Error('userId and conversationId are required to delete a conversation');
    }

    const db = getFirestore();
    const convRef = db.doc(`users/${userId}/conversations/${conversationId}`);

    // Delete messages subcollection
    try {
      const msgsSnapshot = await convRef.collection('messages').get();
      const batch = db.batch ? db.batch() : null;

      if (batch) {
        msgsSnapshot.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      } else {
        const deletes = [];
        msgsSnapshot.forEach((doc) => deletes.push(doc.ref.delete()));
        await Promise.all(deletes);
      }
    } catch (msgErr) {
      console.warn(`[ConversationService] Note deleting messages for ${conversationId}: ${msgErr.message}`);
    }

    await convRef.delete();
    console.log(`[Firestore] Conversation deleted: id=${conversationId}, user=${userId}`);
    return { success: true, conversationId };
  }

  /**
   * Save a user message to Firestore
   * users/{userId}/conversations/{conversationId}/messages/{messageId}
   * @param {string} userId
   * @param {string} conversationId
   * @param {string} content
   * @param {string} [type]
   */
  static async saveUserMessage(userId, conversationId, content, type = 'voice') {
    if (!content || !content.trim()) return null;
    return await this._saveMessageInternal({
      userId,
      conversationId,
      role: 'USER',
      content: content.trim(),
      type,
    });
  }

  /**
   * Save an assistant message to Firestore
   * users/{userId}/conversations/{conversationId}/messages/{messageId}
   * @param {string} userId
   * @param {string} conversationId
   * @param {string} content
   * @param {string} [type]
   */
  static async saveAssistantMessage(userId, conversationId, content, type = 'voice') {
    if (!content || !content.trim()) return null;
    return await this._saveMessageInternal({
      userId,
      conversationId,
      role: 'ASSISTANT',
      content: content.trim(),
      type,
    });
  }

  /**
   * Internal message persistence logic
   */
  static async _saveMessageInternal({ userId, conversationId, role, content, type = 'voice' }) {
    if (!conversationId) return null;

    try {
      const db = getFirestore();
      const messageId = uuidv4();
      const messageType = (type || 'voice').toUpperCase();

      // If userId wasn't provided, attempt to retrieve it from conversationUserMap or conversation doc
      let targetUserId = userId || this.conversationUserMap.get(conversationId);
      if (!targetUserId) {
        try {
          const conv = await this.getConversation(null, conversationId);
          targetUserId = conv?.userId;
          if (targetUserId) {
            this.conversationUserMap.set(conversationId, targetUserId);
          }
        } catch (_) {}
      }

      if (!targetUserId) {
        console.warn(`[ConversationService] Cannot persist message without userId for conversation ${conversationId}`);
        return null;
      }

      const convRef = db.doc(`users/${targetUserId}/conversations/${conversationId}`);
      const msgRef = convRef.collection('messages').doc(messageId);

      const messageDoc = {
        id: messageId,
        conversationId,
        role,
        content,
        type: type.toLowerCase(),
        messageType,
        timestamp: FieldValue.serverTimestamp(),
      };

      await msgRef.set(messageDoc);

      // Asynchronously update conversation header (lastMessage, messageCount, updatedAt)
      const snippet = content.length > 150 ? content.slice(0, 150) + '...' : content;
      convRef.set(
        {
          lastMessage: snippet,
          messageCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      ).catch((err) => {
        console.warn(`[ConversationService] Note updating conversation header: ${err.message}`);
      });

      console.log(`[Firestore] ${role} message saved: conv=${conversationId}, len=${content.length}`);

      // Auto-update conversation title if it's the first message and title is default
      if (role === 'USER') {
        this._checkAndAutoUpdateTitle(targetUserId, conversationId, content).catch(() => {});
      }

      return {
        ...messageDoc,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      console.error(`[ConversationService] Error saving ${role} message:`, err.message);
      return null;
    }
  }

  /**
   * Backward-compatible message saving for legacy endpoints/tests
   * @param {string} conversationId
   * @param {object} param1
   */
  static async saveMessage(conversationId, { role, content, messageType = 'TEXT', userId = null }) {
    const type = (messageType || 'text').toLowerCase();
    if (role === 'USER') {
      return await this.saveUserMessage(userId, conversationId, content, type);
    } else {
      return await this.saveAssistantMessage(userId, conversationId, content, type);
    }
  }

  /**
   * Get all messages for a conversation ordered chronologically (oldest first)
   * @param {string} userId
   * @param {string} conversationId
   * @param {number} [limit]
   */
  static async getMessages(userId, conversationId, limit = 100) {
    if (!conversationId) return [];
    const db = getFirestore();

    let targetUserId = userId || this.conversationUserMap.get(conversationId);
    if (!targetUserId) {
      try {
        const conv = await this.getConversation(null, conversationId);
        targetUserId = conv?.userId;
        if (targetUserId) {
          this.conversationUserMap.set(conversationId, targetUserId);
        }
      } catch (_) {}
    }

    if (!targetUserId) return [];

    try {
      const msgsColl = db.collection(`users/${targetUserId}/conversations/${conversationId}/messages`);
      let snapshot;

      try {
        snapshot = await msgsColl.orderBy('timestamp', 'asc').limit(limit).get();
      } catch (_) {
        snapshot = await msgsColl.get();
      }

      const messages = [];
      snapshot.forEach((doc) => {
        messages.push({ id: doc.id, ...doc.data() });
      });

      messages.sort((a, b) => {
        const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp || 0).getTime();
        const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp || 0).getTime();
        return tA - tB;
      });

      return messages;
    } catch (err) {
      console.error(`[ConversationService] Failed to get messages: ${err.message}`);
      return [];
    }
  }

  /**
   * Get recent messages for a conversation ordered chronologically
   * @param {string} userId
   * @param {string} conversationId
   * @param {number} [limit]
   */
  static async getRecentMessages(userId, conversationId, limit = 10) {
    if (!conversationId) return [];
    const db = getFirestore();

    let targetUserId = userId || this.conversationUserMap.get(conversationId);
    if (!targetUserId) {
      try {
        const conv = await this.getConversation(null, conversationId);
        targetUserId = conv?.userId;
        if (targetUserId) {
          this.conversationUserMap.set(conversationId, targetUserId);
        }
      } catch (_) {}
    }

    if (!targetUserId) return [];

    try {
      const msgsColl = db.collection(`users/${targetUserId}/conversations/${conversationId}/messages`);
      let snapshot;

      try {
        snapshot = await msgsColl.orderBy('timestamp', 'desc').limit(parseInt(limit, 10)).get();
      } catch (_) {
        snapshot = await msgsColl.get();
      }

      const messages = [];
      snapshot.forEach((doc) => {
        messages.push({ id: doc.id, ...doc.data() });
      });

      // Sort chronological (oldest first)
      messages.sort((a, b) => {
        const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp || 0).getTime();
        const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp || 0).getTime();
        return tA - tB;
      });

      return messages;
    } catch (err) {
      console.error(`[ConversationService] Error loading recent messages: ${err.message}`);
      return [];
    }
  }

  /**
   * Automatically generate and update a concise conversation title from initial user message
   */
  static async _checkAndAutoUpdateTitle(userId, conversationId, userText) {
    if (!userId || !conversationId || !userText) return;

    try {
      const db = getFirestore();
      const convRef = db.doc(`users/${userId}/conversations/${conversationId}`);
      const convDoc = await convRef.get();

      if (!convDoc.exists) return;
      const currentTitle = convDoc.data()?.title || '';

      // Only auto-update if title is still default
      const isDefault =
        !currentTitle ||
        currentTitle.toLowerCase().includes('new conversation') ||
        currentTitle.toLowerCase().startsWith('chat with');

      if (!isDefault) return;

      // Extract 3-6 meaningful words for the title
      const clean = userText.replace(/[^a-zA-Z0-9\s]/g, '').trim();
      const words = clean.split(/\s+/).slice(0, 5);
      if (words.length === 0) return;

      const generatedTitle = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      if (generatedTitle.length >= 3) {
        await convRef.set({ title: generatedTitle }, { merge: true });
        console.log(`[ConversationService] Title updated to: "${generatedTitle}" for ${conversationId}`);
      }
    } catch (_) {}
  }
}

module.exports = ConversationService;
