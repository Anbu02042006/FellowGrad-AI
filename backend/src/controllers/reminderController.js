/**
 * Reminder Controller for FellowGrad AI
 *
 * Exposes REST API endpoints for user reminders.
 * All endpoints require authentication via authMiddleware.
 */

const { ReminderService } = require('../services/reminderService');
const { ReminderIntentService } = require('../services/reminderIntentService');

class ReminderController {
  /**
   * POST /api/reminders
   * Create a new reminder
   */
  static async createReminder(req, res) {
    try {
      const userId = req.user.userId;
      const { title, scheduledAt, timezone, recurrence, notificationId } = req.body;

      if (!title || !scheduledAt) {
        return res.status(400).json({
          error: 'Title and scheduledAt are required fields',
        });
      }

      const reminder = await ReminderService.createReminder(userId, {
        title,
        scheduledAt,
        timezone,
        recurrence,
        notificationId,
      });

      return res.status(201).json({
        success: true,
        data: reminder,
      });
    } catch (err) {
      console.error('[ReminderController] Create error:', err.message);
      return res.status(500).json({
        error: err.message || 'Failed to create reminder',
      });
    }
  }

  /**
   * GET /api/reminders
   * List reminders for authenticated user
   */
  static async getReminders(req, res) {
    try {
      const userId = req.user.userId;
      const { status } = req.query;

      const reminders = await ReminderService.getReminders(userId, { status });

      return res.status(200).json({
        success: true,
        count: reminders.length,
        data: reminders,
      });
    } catch (err) {
      console.error('[ReminderController] List error:', err.message);
      return res.status(500).json({
        error: err.message || 'Failed to retrieve reminders',
      });
    }
  }

  /**
   * GET /api/reminders/:id
   * Get single reminder
   */
  static async getReminderById(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;

      const reminder = await ReminderService.getReminderById(userId, id);
      if (!reminder) {
        return res.status(404).json({
          error: 'Reminder not found',
        });
      }

      return res.status(200).json({
        success: true,
        data: reminder,
      });
    } catch (err) {
      console.error('[ReminderController] Get error:', err.message);
      return res.status(500).json({
        error: err.message || 'Failed to retrieve reminder',
      });
    }
  }

  /**
   * PATCH /api/reminders/:id
   * Update reminder
   */
  static async updateReminder(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;

      const updated = await ReminderService.updateReminder(userId, id, req.body);
      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      console.error('[ReminderController] Update error:', err.message);
      const statusCode = err.message.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({
        error: err.message || 'Failed to update reminder',
      });
    }
  }

  /**
   * DELETE /api/reminders/:id
   * Delete reminder
   */
  static async deleteReminder(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;

      await ReminderService.deleteReminder(userId, id);
      return res.status(200).json({
        success: true,
        message: 'Reminder deleted successfully',
      });
    } catch (err) {
      console.error('[ReminderController] Delete error:', err.message);
      const statusCode = err.message.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({
        error: err.message || 'Failed to delete reminder',
      });
    }
  }

  /**
   * POST /api/reminders/:id/cancel
   * Cancel reminder
   */
  static async cancelReminder(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;

      const cancelled = await ReminderService.cancelReminder(userId, id);
      return res.status(200).json({
        success: true,
        data: cancelled,
      });
    } catch (err) {
      console.error('[ReminderController] Cancel error:', err.message);
      const statusCode = err.message.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({
        error: err.message || 'Failed to cancel reminder',
      });
    }
  }

  /**
   * POST /api/reminders/:id/snooze
   * Snooze reminder
   */
  static async snoozeReminder(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;
      const minutes = parseInt(req.body.minutes || 10, 10);

      const snoozed = await ReminderService.snoozeReminder(userId, id, minutes);
      return res.status(200).json({
        success: true,
        data: snoozed,
      });
    } catch (err) {
      console.error('[ReminderController] Snooze error:', err.message);
      const statusCode = err.message.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({
        error: err.message || 'Failed to snooze reminder',
      });
    }
  }

  /**
   * POST /api/reminders/parse-intent
   * Parse natural language command into structured reminder intent
   */
  static async parseIntent(req, res) {
    try {
      const { text, timezone, now } = req.body;
      if (!text) {
        return res.status(400).json({
          error: 'Text is required',
        });
      }

      const analysis = ReminderIntentService.analyze(text, {
        timezone: timezone || 'Asia/Kolkata',
        now: now ? new Date(now) : new Date(),
      });

      return res.status(200).json({
        success: true,
        data: analysis,
      });
    } catch (err) {
      console.error('[ReminderController] Parse intent error:', err.message);
      return res.status(500).json({
        error: err.message || 'Failed to parse reminder intent',
      });
    }
  }
}

module.exports = ReminderController;
