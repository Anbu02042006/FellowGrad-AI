let socketEmitter = null;

class NotificationService {
  static setSocketEmitter(emitter) {
    socketEmitter = emitter;
  }

  static async sendNotification({ userId, message }) {
    console.log(`[NotificationService] Sending notification to user ${userId}: ${message}`);

    // If real-time socket connection is present, emit to user's room
    if (socketEmitter) {
      socketEmitter(`user:${userId}`, 'notification', {
        userId,
        message,
        timestamp: new Date().toISOString(),
      });
    }

    return true;
  }
}

module.exports = NotificationService;
