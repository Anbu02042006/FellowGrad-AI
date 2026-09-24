package com.fellowgrad.reminder

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class ReminderBootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action
        if (action != Intent.ACTION_BOOT_COMPLETED && action != "android.intent.action.MY_PACKAGE_REPLACED") {
            return
        }

        // Reschedule all persistent reminders stored in SharedPreferences
        val scheduledReminders = ReminderStorage.getAllReminders(context)
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return

        for (reminder in scheduledReminders) {
            var targetTimeMs = reminder.timestampMs
            val now = System.currentTimeMillis()

            // If a recurring reminder passed while phone was off, compute next occurrence
            if (targetTimeMs <= now && !reminder.recurrenceJson.isNullOrEmpty()) {
                if (reminder.recurrenceJson.contains("DAILY", ignoreCase = true)) {
                    while (targetTimeMs <= now) {
                        targetTimeMs += 86400000L
                    }
                } else if (reminder.recurrenceJson.contains("WEEKLY", ignoreCase = true)) {
                    while (targetTimeMs <= now) {
                        targetTimeMs += 7 * 86400000L
                    }
                }
            }

            if (targetTimeMs > now) {
                val alarmIntent = Intent(context, ReminderReceiver::class.java).apply {
                    this.action = ReminderReceiver.ACTION_TRIGGER_REMINDER
                    putExtra("reminderId", reminder.reminderId)
                    putExtra("title", reminder.title)
                    putExtra("notificationId", reminder.notificationId)
                    putExtra("recurrenceJson", reminder.recurrenceJson)
                    putExtra("timestampMs", targetTimeMs)
                }

                val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                } else {
                    PendingIntent.FLAG_UPDATE_CURRENT
                }

                val pendingIntent = PendingIntent.getBroadcast(
                    context,
                    reminder.notificationId,
                    alarmIntent,
                    flags
                )

                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        alarmManager.setExactAndAllowWhileIdle(
                            AlarmManager.RTC_WAKEUP,
                            targetTimeMs,
                            pendingIntent
                        )
                    } else {
                        alarmManager.setExact(
                            AlarmManager.RTC_WAKEUP,
                            targetTimeMs,
                            pendingIntent
                        )
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            } else if (reminder.recurrenceJson.isNullOrEmpty()) {
                // Expired non-recurring reminder, clean up
                ReminderStorage.removeReminder(context, reminder.reminderId)
            }
        }
    }
}
