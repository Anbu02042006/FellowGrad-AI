import { NativeModules, Platform } from 'react-native';
import apiClient from './api/apiClient';

const { ReminderModule } = NativeModules;

export interface ReminderItem {
  id: string;
  userId?: string;
  title: string;
  scheduledAt: string;
  timezone?: string;
  recurrence?: {
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'INTERVAL';
    intervalMinutes?: number;
    daysOfWeek?: number[];
  } | null;
  status?: 'SCHEDULED' | 'TRIGGERED' | 'CANCELLED' | 'COMPLETED';
  notificationId?: number;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  ephemeral?: boolean;
}

class ReminderService {
  /**
   * Request Android 13+ POST_NOTIFICATIONS runtime permission
   */
  async requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS !== 'android' || !ReminderModule?.requestNotificationPermission) {
      return true;
    }
    try {
      return await ReminderModule.requestNotificationPermission();
    } catch (err) {
      console.warn('[ReminderService] Failed to request notification permission:', err);
      return false;
    }
  }

  /**
   * Get device timezone identifier (e.g., 'Asia/Kolkata')
   */
  async getDeviceTimezone(): Promise<string> {
    if (Platform.OS === 'android' && ReminderModule?.getDeviceTimezone) {
      try {
        return await ReminderModule.getDeviceTimezone();
      } catch (e) {
        console.warn('[ReminderService] Error getting device timezone from native module:', e);
      }
    }
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    } catch {
      return 'Asia/Kolkata';
    }
  }

  /**
   * Check if app was launched / opened by tapping a reminder notification
   */
  async checkInitialReminderTap(): Promise<ReminderItem | null> {
    if (Platform.OS !== 'android' || !ReminderModule?.getInitialReminder) {
      return null;
    }
    try {
      const initial = await ReminderModule.getInitialReminder();
      if (initial && initial.id) {
        console.log('[ReminderService] App opened from reminder tap:', initial);
        return initial as ReminderItem;
      }
    } catch (e) {
      console.warn('[ReminderService] Error checking initial reminder:', e);
    }
    return null;
  }

  /**
   * Schedule exact alarm on Android AlarmManager (survives app close & reboot)
   */
  async scheduleLocalAlarm(reminder: ReminderItem): Promise<boolean> {
    if (Platform.OS !== 'android' || !ReminderModule?.scheduleReminder) {
      console.log('[ReminderService] Native ReminderModule not available on this platform/build');
      return false;
    }

    try {
      const scheduledTimeMs = new Date(reminder.scheduledAt).getTime();
      if (isNaN(scheduledTimeMs)) {
        console.error('[ReminderService] Invalid scheduledAt time:', reminder.scheduledAt);
        return false;
      }

      const frequency = reminder.recurrence?.frequency || null;
      const success = await ReminderModule.scheduleReminder({
        id: reminder.id,
        title: reminder.title,
        scheduledAt: reminder.scheduledAt,
        scheduledTimeMs: scheduledTimeMs,
        recurrence: frequency,
        notificationId: reminder.notificationId || (Math.abs(reminder.id.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0)) % 1000000000),
      });

      console.log(`[ReminderService] Local exact alarm scheduled for "${reminder.title}" at ${reminder.scheduledAt}: ${success}`);
      return success;
    } catch (err) {
      console.error('[ReminderService] Failed to schedule local alarm:', err);
      return false;
    }
  }

  /**
   * Cancel exact alarm on Android AlarmManager
   */
  async cancelLocalAlarm(reminderId: string): Promise<boolean> {
    if (Platform.OS !== 'android' || !ReminderModule?.cancelReminder) {
      return false;
    }
    try {
      const success = await ReminderModule.cancelReminder(reminderId);
      console.log(`[ReminderService] Local alarm cancelled for id ${reminderId}: ${success}`);
      return success;
    } catch (err) {
      console.error('[ReminderService] Failed to cancel local alarm:', err);
      return false;
    }
  }

  /**
   * Cancel all exact alarms on Android AlarmManager
   */
  async cancelAllLocalAlarms(): Promise<boolean> {
    if (Platform.OS !== 'android' || !ReminderModule?.cancelAllReminders) {
      return false;
    }
    try {
      return await ReminderModule.cancelAllReminders();
    } catch (err) {
      console.error('[ReminderService] Failed to cancel all local alarms:', err);
      return false;
    }
  }

  // ============================================================
  // Backend REST API Methods
  // ============================================================

  async getReminders(includeCompleted = false): Promise<ReminderItem[]> {
    try {
      const res = await apiClient.get('/reminders', {
        params: { includeCompleted: includeCompleted ? 'true' : 'false' }
      });
      return res.data?.reminders || [];
    } catch (err) {
      console.error('[ReminderService] Error fetching reminders from API:', err);
      return [];
    }
  }

  async createReminder(payload: {
    title: string;
    scheduledAt: string;
    timezone?: string;
    recurrence?: any;
    ephemeral?: boolean;
  }): Promise<ReminderItem> {
    const timezone = payload.timezone || (await this.getDeviceTimezone());
    const res = await apiClient.post('/reminders', {
      ...payload,
      timezone,
    });
    const created: ReminderItem = res.data?.reminder;

    // Schedule native alarm
    if (created && !payload.ephemeral) {
      await this.scheduleLocalAlarm(created);
    }
    return created;
  }

  async cancelReminder(reminderId: string): Promise<boolean> {
    try {
      await apiClient.post(`/reminders/${reminderId}/cancel`);
    } catch (err) {
      console.warn('[ReminderService] API cancel call error (might be ephemeral):', err);
    }
    await this.cancelLocalAlarm(reminderId);
    return true;
  }

  async snoozeReminder(reminderId: string, minutes = 10): Promise<ReminderItem | null> {
    try {
      const res = await apiClient.post(`/reminders/${reminderId}/snooze`, { minutes });
      const snoozed: ReminderItem = res.data?.reminder;
      if (snoozed) {
        await this.scheduleLocalAlarm(snoozed);
        return snoozed;
      }
    } catch (err) {
      console.error('[ReminderService] Snooze error:', err);
    }
    return null;
  }

  async deleteReminder(reminderId: string): Promise<boolean> {
    try {
      await apiClient.delete(`/reminders/${reminderId}`);
    } catch (err) {
      console.warn('[ReminderService] API delete call error:', err);
    }
    await this.cancelLocalAlarm(reminderId);
    return true;
  }

  /**
   * Handle real-time WebSocket reminder event from Gemini Live backend
   */
  async handleSocketReminderAction(actionData: {
    action: 'SCHEDULE' | 'CANCEL' | 'CANCEL_ALL';
    reminder?: any;
    reminderId?: string;
    reminderIds?: string[];
  }): Promise<void> {
    console.log('[ReminderService] Handling socket reminder action:', actionData.action);
    switch (actionData.action) {
      case 'SCHEDULE':
        if (actionData.reminder) {
          await this.scheduleLocalAlarm(actionData.reminder);
        }
        break;
      case 'CANCEL':
        if (actionData.reminder?.id) {
          await this.cancelLocalAlarm(actionData.reminder.id);
        } else if (actionData.reminderId) {
          await this.cancelLocalAlarm(actionData.reminderId);
        } else if (actionData.reminderIds && Array.isArray(actionData.reminderIds)) {
          for (const id of actionData.reminderIds) {
            await this.cancelLocalAlarm(id);
          }
        }
        break;
      case 'CANCEL_ALL':
        if (actionData.reminderIds && Array.isArray(actionData.reminderIds)) {
          for (const id of actionData.reminderIds) {
            await this.cancelLocalAlarm(id);
          }
        } else {
          await this.cancelAllLocalAlarms();
        }
        break;
      default:
        break;
    }
  }
}

export const reminderService = new ReminderService();
export default reminderService;
