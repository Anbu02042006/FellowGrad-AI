/**
 * Reminder Service for FellowGrad AI
 *
 * Manages user reminders in Google Cloud Firestore:
 * users/{userId}/reminders/{reminderId}
 *
 * Strict 1-to-1 User Data Isolation: Every query enforces authenticated userId.
 */

const { v4: uuidv4 } = require('uuid');
const { getFirestore, FieldValue } = require('../config/firestore');

const REMINDER_STATUS = {
  SCHEDULED: 'SCHEDULED',
  TRIGGERED: 'TRIGGERED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
};

class ReminderService {
  /**
   * Generate an integer notification ID for Android AlarmManager / NotificationManager
   */
  static generateNotificationId(idStr) {
    let hash = 0;
    for (let i = 0; i < idStr.length; i++) {
      hash = ((hash << 5) - hash + idStr.charCodeAt(i)) | 0;
    }
    return Math.abs(hash % 2147483647);
  }

  /**
   * Helper to ensure user document exists in Firestore
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
   * Create a new reminder under users/{userId}/reminders/{reminderId}
   * @param {string} userId
   * @param {object} param1
   */
  static async createReminder(userId, {
    title,
    scheduledAt,
    timezone = 'Asia/Kolkata',
    recurrence = null,
    notificationId = null,
    id = null,
  }) {
    if (!userId) {
      throw new Error('Cannot create reminder without verified userId');
    }
    if (!title || typeof title !== 'string') {
      throw new Error('Reminder title is required');
    }
    if (!scheduledAt) {
      throw new Error('Reminder scheduledAt timestamp is required');
    }

    const db = getFirestore();
    const reminderId = id || uuidv4();
    const notifId = notificationId || this.generateNotificationId(reminderId);

    await this.ensureUserDoc(userId);

    const reminderRef = db.doc(`users/${userId}/reminders/${reminderId}`);
    const reminderData = {
      id: reminderId,
      userId,
      title: title.trim(),
      scheduledAt: new Date(scheduledAt).toISOString(),
      timezone: timezone || 'Asia/Kolkata',
      recurrence: recurrence || null,
      status: REMINDER_STATUS.SCHEDULED,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      completedAt: null,
      notificationId: notifId,
    };

    await reminderRef.set(reminderData);

    console.log(`[ReminderService] Reminder created: id=${reminderId}, user=${userId}, title="${title}", at=${reminderData.scheduledAt}`);
    return reminderData;
  }

  /**
   * List reminders for a specific user
   * @param {string} userId
   * @param {object} [options]
   * @param {string} [options.status]
   */
  static async getReminders(userId, options = {}) {
    if (!userId) {
      throw new Error('Cannot get reminders without verified userId');
    }

    const db = getFirestore();
    const snapshot = await db.collection(`users/${userId}/reminders`).get();

    const reminders = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data && data.userId === userId) {
        if (!options.status || data.status === options.status) {
          reminders.push(data);
        }
      }
    });

    // Sort by scheduledAt asc
    reminders.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    return reminders;
  }

  /**
   * Get single reminder by ID with strict ownership validation
   * @param {string} userId
   * @param {string} reminderId
   */
  static async getReminderById(userId, reminderId) {
    if (!userId || !reminderId) return null;

    const db = getFirestore();
    const docRef = db.doc(`users/${userId}/reminders/${reminderId}`);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    if (data.userId !== userId) {
      // 1-to-1 User Isolation: User cannot access another user's reminder
      return null;
    }

    return data;
  }

  /**
   * Update a reminder
   * @param {string} userId
   * @param {string} reminderId
   * @param {object} updates
   */
  static async updateReminder(userId, reminderId, updates = {}) {
    const existing = await this.getReminderById(userId, reminderId);
    if (!existing) {
      throw new Error('Reminder not found or unauthorized');
    }

    const db = getFirestore();
    const docRef = db.doc(`users/${userId}/reminders/${reminderId}`);

    const safeUpdates = {
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Prevent overwriting userId or id
    delete safeUpdates.userId;
    delete safeUpdates.id;

    if (safeUpdates.scheduledAt) {
      safeUpdates.scheduledAt = new Date(safeUpdates.scheduledAt).toISOString();
    }

    await docRef.update(safeUpdates);
    return { ...existing, ...safeUpdates };
  }

  /**
   * Cancel a reminder
   * @param {string} userId
   * @param {string} reminderId
   */
  static async cancelReminder(userId, reminderId) {
    return this.updateReminder(userId, reminderId, {
      status: REMINDER_STATUS.CANCELLED,
    });
  }

  /**
   * Cancel all scheduled reminders for user
   * @param {string} userId
   */
  static async cancelAllReminders(userId) {
    const scheduled = await this.getReminders(userId, { status: REMINDER_STATUS.SCHEDULED });
    const cancelled = [];
    for (const rem of scheduled) {
      await this.cancelReminder(userId, rem.id);
      cancelled.push(rem.id);
    }
    return cancelled;
  }

  /**
   * Delete a reminder permanently
   * @param {string} userId
   * @param {string} reminderId
   */
  static async deleteReminder(userId, reminderId) {
    const existing = await this.getReminderById(userId, reminderId);
    if (!existing) {
      throw new Error('Reminder not found or unauthorized');
    }

    const db = getFirestore();
    const docRef = db.doc(`users/${userId}/reminders/${reminderId}`);
    await docRef.delete();
    return true;
  }

  /**
   * Snooze a reminder by minutes
   * @param {string} userId
   * @param {string} reminderId
   * @param {number} [minutes]
   */
  static async snoozeReminder(userId, reminderId, minutes = 10) {
    const existing = await this.getReminderById(userId, reminderId);
    if (!existing) {
      throw new Error('Reminder not found or unauthorized');
    }

    const newTime = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    return this.updateReminder(userId, reminderId, {
      scheduledAt: newTime,
      status: REMINDER_STATUS.SCHEDULED,
    });
  }

  /**
   * Find matching active reminder by keyword (for voice cancellation/update)
   * @param {string} userId
   * @param {string} query
   */
  static async findMatchingReminder(userId, query) {
    const active = await this.getReminders(userId, { status: REMINDER_STATUS.SCHEDULED });
    if (active.length === 0) return null;

    if (!query) {
      return active[0]; // Nearest upcoming reminder
    }

    const lowerQuery = query.toLowerCase();
    const match = active.find((r) => r.title.toLowerCase().includes(lowerQuery));
    return match || null;
  }
}

module.exports = {
  ReminderService,
  REMINDER_STATUS,
};
