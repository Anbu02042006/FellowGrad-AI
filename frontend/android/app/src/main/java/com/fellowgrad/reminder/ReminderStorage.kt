package com.fellowgrad.reminder

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

data class ScheduledReminder(
    val reminderId: String,
    val title: String,
    val timestampMs: Long,
    val notificationId: Int,
    val recurrenceJson: String?
) {
    fun toJsonObject(): JSONObject {
        return JSONObject().apply {
            put("reminderId", reminderId)
            put("title", title)
            put("timestampMs", timestampMs)
            put("notificationId", notificationId)
            if (recurrenceJson != null) {
                put("recurrenceJson", recurrenceJson)
            }
        }
    }

    companion object {
        fun fromJsonObject(json: JSONObject): ScheduledReminder {
            return ScheduledReminder(
                reminderId = json.getString("reminderId"),
                title = json.getString("title"),
                timestampMs = json.getLong("timestampMs"),
                notificationId = json.getInt("notificationId"),
                recurrenceJson = if (json.has("recurrenceJson")) json.getString("recurrenceJson") else null
            )
        }
    }
}

object ReminderStorage {
    private const val PREFS_NAME = "fellowgrad_reminders_store"
    private const val KEY_REMINDERS = "scheduled_reminders_list"

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    @Synchronized
    fun saveReminder(context: Context, reminder: ScheduledReminder) {
        val list = getAllReminders(context).toMutableList()
        // Remove existing with same id if any
        list.removeAll { it.reminderId == reminder.reminderId }
        list.add(reminder)

        val jsonArray = JSONArray()
        for (item in list) {
            jsonArray.put(item.toJsonObject())
        }

        getPrefs(context).edit().putString(KEY_REMINDERS, jsonArray.toString()).apply()
    }

    @Synchronized
    fun removeReminder(context: Context, reminderId: String) {
        val list = getAllReminders(context).toMutableList()
        list.removeAll { it.reminderId == reminderId }

        val jsonArray = JSONArray()
        for (item in list) {
            jsonArray.put(item.toJsonObject())
        }

        getPrefs(context).edit().putString(KEY_REMINDERS, jsonArray.toString()).apply()
    }

    @Synchronized
    fun getAllReminders(context: Context): List<ScheduledReminder> {
        val jsonStr = getPrefs(context).getString(KEY_REMINDERS, null) ?: return emptyList()
        val result = mutableListOf<ScheduledReminder>()
        try {
            val jsonArray = JSONArray(jsonStr)
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                result.add(ScheduledReminder.fromJsonObject(obj))
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return result
    }

    @Synchronized
    fun clearAll(context: Context) {
        getPrefs(context).edit().remove(KEY_REMINDERS).apply()
    }
}
