package com.fellowgrad.reminder

import android.Manifest
import android.app.Activity
import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.TimeZone

class ReminderModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ReminderModule"

    init {
        // Initialize channel early
        ReminderReceiver.createNotificationChannel(reactContext)
    }

    private fun generateNotificationId(idStr: String): Int {
        var hash = 0
        for (i in 0 until idStr.length) {
            hash = ((hash shl 5) - hash + idStr[i].code)
        }
        return Math.abs(hash % 2147483647)
    }

    @ReactMethod
    fun scheduleReminder(
        reminderId: String,
        title: String,
        timestampMs: Double,
        recurrenceJson: String?,
        promise: Promise
    ) {
        try {
            val targetTimeMs = timestampMs.toLong()
            val notificationId = generateNotificationId(reminderId)

            val scheduledReminder = ScheduledReminder(
                reminderId = reminderId,
                title = title,
                timestampMs = targetTimeMs,
                notificationId = notificationId,
                recurrenceJson = recurrenceJson
            )

            // 1. Save persistently to SharedPreferences
            ReminderStorage.saveReminder(reactContext, scheduledReminder)

            // 2. Schedule via Android AlarmManager
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            if (alarmManager == null) {
                promise.reject("ALARM_ERROR", "AlarmManager not available on this device")
                return
            }

            val alarmIntent = Intent(reactContext, ReminderReceiver::class.java).apply {
                action = ReminderReceiver.ACTION_TRIGGER_REMINDER
                putExtra("reminderId", reminderId)
                putExtra("title", title)
                putExtra("notificationId", notificationId)
                putExtra("recurrenceJson", recurrenceJson)
                putExtra("timestampMs", targetTimeMs)
            }

            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }

            val pendingIntent = PendingIntent.getBroadcast(
                reactContext,
                notificationId,
                alarmIntent,
                flags
            )

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

            val result = Arguments.createMap().apply {
                putString("reminderId", reminderId)
                putInt("notificationId", notificationId)
                putDouble("timestampMs", targetTimeMs.toDouble())
                putBoolean("scheduled", true)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("SCHEDULE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun cancelReminder(reminderId: String, notificationId: Double, promise: Promise) {
        try {
            val notifId = if (notificationId > 0) notificationId.toInt() else generateNotificationId(reminderId)

            // 1. Cancel AlarmManager pending intent
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            if (alarmManager != null) {
                val alarmIntent = Intent(reactContext, ReminderReceiver::class.java).apply {
                    action = ReminderReceiver.ACTION_TRIGGER_REMINDER
                }
                val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                } else {
                    PendingIntent.FLAG_UPDATE_CURRENT
                }
                val pendingIntent = PendingIntent.getBroadcast(reactContext, notifId, alarmIntent, flags)
                alarmManager.cancel(pendingIntent)
                pendingIntent.cancel()
            }

            // 2. Cancel any displayed notification
            val notifManager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            notifManager?.cancel(notifId)

            // 3. Remove from persistent storage
            ReminderStorage.removeReminder(reactContext, reminderId)

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun cancelAllReminders(promise: Promise) {
        try {
            val all = ReminderStorage.getAllReminders(reactContext)
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            val notifManager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager

            for (rem in all) {
                if (alarmManager != null) {
                    val alarmIntent = Intent(reactContext, ReminderReceiver::class.java).apply {
                        action = ReminderReceiver.ACTION_TRIGGER_REMINDER
                    }
                    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    } else {
                        PendingIntent.FLAG_UPDATE_CURRENT
                    }
                    val pendingIntent = PendingIntent.getBroadcast(reactContext, rem.notificationId, alarmIntent, flags)
                    alarmManager.cancel(pendingIntent)
                    pendingIntent.cancel()
                }
                notifManager?.cancel(rem.notificationId)
            }

            ReminderStorage.clearAll(reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_ALL_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getScheduledReminders(promise: Promise) {
        try {
            val all = ReminderStorage.getAllReminders(reactContext)
            val array = Arguments.createArray()
            for (rem in all) {
                val map = Arguments.createMap().apply {
                    putString("reminderId", rem.reminderId)
                    putString("title", rem.title)
                    putDouble("timestampMs", rem.timestampMs.toDouble())
                    putInt("notificationId", rem.notificationId)
                    if (rem.recurrenceJson != null) {
                        putString("recurrenceJson", rem.recurrenceJson)
                    }
                }
                array.pushMap(map)
            }
            promise.resolve(array)
        } catch (e: Exception) {
            promise.reject("GET_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getDeviceTimezone(promise: Promise) {
        try {
            val tz = TimeZone.getDefault().id
            promise.resolve(tz)
        } catch (e: Exception) {
            promise.resolve("Asia/Kolkata")
        }
    }

    @ReactMethod
    fun getInitialReminder(promise: Promise) {
        try {
            val activity: Activity? = reactApplicationContext.currentActivity
            val intent: Intent? = activity?.intent
            if (intent != null && intent.getBooleanExtra("fromReminder", false)) {
                val reminderId = intent.getStringExtra("reminderId")
                val reminderTitle = intent.getStringExtra("reminderTitle")

                // Clear flag so subsequent opens don't re-trigger
                intent.removeExtra("fromReminder")
                intent.removeExtra("reminderId")
                intent.removeExtra("reminderTitle")

                val map = Arguments.createMap().apply {
                    putString("reminderId", reminderId)
                    putString("reminderTitle", reminderTitle)
                }
                promise.resolve(map)
                return
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun requestNotificationPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= 33) { // Android 13 (Tiramisu)
                val status = ContextCompat.checkSelfPermission(
                    reactContext,
                    Manifest.permission.POST_NOTIFICATIONS
                )
                if (status == PackageManager.PERMISSION_GRANTED) {
                    promise.resolve(true)
                } else {
                    val activity: Activity? = reactApplicationContext.currentActivity
                    if (activity != null) {
                        ActivityCompat.requestPermissions(
                            activity,
                            arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                            101
                        )
                        promise.resolve(false)
                    } else {
                        promise.resolve(false)
                    }
                }
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.resolve(true)
        }
    }
}
