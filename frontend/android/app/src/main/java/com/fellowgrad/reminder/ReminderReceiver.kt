package com.fellowgrad.reminder

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.fellowgrad.MainActivity
import com.fellowgrad.R
import org.json.JSONObject

class ReminderReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_TRIGGER_REMINDER = "com.fellowgrad.ACTION_TRIGGER_REMINDER"
        const val CHANNEL_ID = "fellowgrad_reminders"
        const val CHANNEL_NAME = "FellowGrad Reminders"
        const val CHANNEL_DESCRIPTION = "Alerts and scheduled reminders from your FellowGrad AI assistant"

        fun createNotificationChannel(context: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val importance = NotificationManager.IMPORTANCE_HIGH
                val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, importance).apply {
                    description = CHANNEL_DESCRIPTION
                    enableLights(true)
                    enableVibration(true)
                }
                val notificationManager =
                    context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                notificationManager.createNotificationChannel(channel)
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent == null) return

        val reminderId = intent.getStringExtra("reminderId") ?: return
        val title = intent.getStringExtra("title") ?: "Reminder"
        val notificationId = intent.getIntExtra("notificationId", 1001)
        val recurrenceJson = intent.getStringExtra("recurrenceJson")
        val timestampMs = intent.getLongExtra("timestampMs", System.currentTimeMillis())

        // Ensure notification channel exists
        createNotificationChannel(context)

        // PendingIntent to launch FellowGrad app on notification tap
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("fromReminder", true)
            putExtra("reminderId", reminderId)
            putExtra("reminderTitle", title)
        }

        val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val contentPendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            launchIntent,
            pendingIntentFlags
        )

        // Build native high-priority reminder notification
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("FellowGrad Reminder")
            .setContentText(title)
            .setStyle(NotificationCompat.BigTextStyle().bigText(title))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(contentPendingIntent)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(notificationId, notification)
        } catch (e: SecurityException) {
            e.printStackTrace()
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Handle recurrence scheduling or cleanup
        handleRecurrenceOrCleanup(context, reminderId, title, notificationId, recurrenceJson, timestampMs)
    }

    private fun handleRecurrenceOrCleanup(
        context: Context,
        reminderId: String,
        title: String,
        notificationId: Int,
        recurrenceJson: String?,
        lastTimestampMs: Long
    ) {
        if (!recurrenceJson.isNullOrEmpty()) {
            try {
                val json = JSONObject(recurrenceJson)
                val freq = json.optString("frequency", "").uppercase()
                var nextTimeMs = 0L

                when (freq) {
                    "DAILY" -> {
                        nextTimeMs = lastTimestampMs + 86400000L // 24 hours
                    }
                    "WEEKLY" -> {
                        nextTimeMs = lastTimestampMs + 7 * 86400000L // 7 days
                    }
                }

                if (nextTimeMs > System.currentTimeMillis()) {
                    val updated = ScheduledReminder(
                        reminderId = reminderId,
                        title = title,
                        timestampMs = nextTimeMs,
                        notificationId = notificationId,
                        recurrenceJson = recurrenceJson
                    )
                    ReminderStorage.saveReminder(context, updated)

                    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
                    if (alarmManager != null) {
                        val alarmIntent = Intent(context, ReminderReceiver::class.java).apply {
                            action = ACTION_TRIGGER_REMINDER
                            putExtra("reminderId", reminderId)
                            putExtra("title", title)
                            putExtra("notificationId", notificationId)
                            putExtra("recurrenceJson", recurrenceJson)
                            putExtra("timestampMs", nextTimeMs)
                        }

                        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                        } else {
                            PendingIntent.FLAG_UPDATE_CURRENT
                        }

                        val pIntent = PendingIntent.getBroadcast(context, notificationId, alarmIntent, flags)
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextTimeMs, pIntent)
                        } else {
                            alarmManager.setExact(AlarmManager.RTC_WAKEUP, nextTimeMs, pIntent)
                        }
                    }
                    return
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // Non-recurring: remove from persistent scheduled store
        ReminderStorage.removeReminder(context, reminderId)
    }
}
