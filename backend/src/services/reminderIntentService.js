/**
 * Reminder Intent Analysis & Natural Language Date/Time Parser
 *
 * Supports English, Tamil, and Tanglish.
 * Timezone-aware relative and absolute scheduling with ambiguity and past-time detection.
 */

const INTENT_TYPES = {
  CREATE_REMINDER: 'CREATE_REMINDER',
  LIST_REMINDERS: 'LIST_REMINDERS',
  CANCEL_REMINDER: 'CANCEL_REMINDER',
  UPDATE_REMINDER: 'UPDATE_REMINDER',
  SNOOZE_REMINDER: 'SNOOZE_REMINDER',
  NONE: 'NONE',
};

const DEFAULT_TIMEZONE = 'Asia/Kolkata';

class ReminderIntentService {
  /**
   * Get current date parts in the given IANA timezone
   * @param {Date} date
   * @param {string} timezone
   */
  static getTimezoneDateParts(date, timezone = DEFAULT_TIMEZONE) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
      });

      const parts = formatter.formatToParts(date);
      const values = {};
      for (const p of parts) {
        if (p.type !== 'literal') {
          values[p.type] = parseInt(p.value, 10);
        }
      }

      // Convert 24-hour hour if needed
      if (values.hour === 24) values.hour = 0;

      return {
        year: values.year,
        month: values.month, // 1-12
        day: values.day, // 1-31
        hour: values.hour, // 0-23
        minute: values.minute, // 0-59
        second: values.second,
      };
    } catch (_) {
      return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds(),
      };
    }
  }

  /**
   * Construct an ISO timestamp for a specific target date/time in user's timezone
   * @param {object} param0
   * @param {number} param0.year
   * @param {number} param0.month 1-12
   * @param {number} param0.day 1-31
   * @param {number} param0.hour 0-23
   * @param {number} param0.minute 0-59
   * @param {string} timezone
   */
  static constructTimezoneIsoString({ year, month, day, hour = 0, minute = 0, second = 0 }, timezone = DEFAULT_TIMEZONE) {
    // Determine offset by checking difference between local string representation and UTC
    const pad = (n) => String(n).padStart(2, '0');
    const localIsoGuess = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}`;

    // Calculate timezone offset for the given date in target timezone
    try {
      const utcDate = new Date(`${localIsoGuess}Z`);
      const targetParts = this.getTimezoneDateParts(utcDate, timezone);
      const targetUtcEquivalent = Date.UTC(
        targetParts.year,
        targetParts.month - 1,
        targetParts.day,
        targetParts.hour,
        targetParts.minute,
        targetParts.second
      );

      const offsetMs = targetUtcEquivalent - utcDate.getTime();
      const actualUtcTimestamp = new Date(Date.UTC(year, month - 1, day, hour, minute, second) - offsetMs);
      return actualUtcTimestamp.toISOString();
    } catch (_) {
      return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();
    }
  }

  /**
   * Main analysis method for user transcript
   * @param {string} text
   * @param {object} options
   * @param {string} [options.timezone]
   * @param {Date} [options.now]
   * @returns {object}
   */
  static analyze(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return { isReminder: false, intent: INTENT_TYPES.NONE };
    }

    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();
    const timezone = options.timezone || DEFAULT_TIMEZONE;
    const now = options.now instanceof Date ? options.now : new Date();

    // 1. Detect LIST REMINDERS
    if (
      /\b(show|list|view|what|get|tell me)\b.*\breminders?\b/i.test(lower) ||
      /\bwhat reminders do i have\b/i.test(lower) ||
      /\benna reminders?\b/i.test(lower) ||
      /\breminders? (kaatu|solle|iruku)\b/i.test(lower)
    ) {
      return {
        isReminder: true,
        intent: INTENT_TYPES.LIST_REMINDERS,
        rawQuery: text,
      };
    }

    // 2. Detect CANCEL / DELETE REMINDER
    if (
      /\b(cancel|delete|remove|clear)\b.*\breminders?\b/i.test(lower) ||
      /\breminders?\b.*\b(cancel|delete|remove|clear)\b/i.test(lower) ||
      /\b(cancel|delete) pannu\b/i.test(lower)
    ) {
      const isAll = /\b(all|everything|ellarume)\b/i.test(lower);
      let targetQuery = null;

      if (!isAll) {
        // Extract title target (e.g. "Cancel my DBMS reminder" -> "DBMS")
        const match = lower.match(/(?:cancel|delete|remove)\s+(?:my\s+)?([a-z0-9\s]+?)\s+reminder/i) ||
                      lower.match(/en\s+([a-z0-9\s]+?)\s+reminder\s+(?:cancel|delete)/i) ||
                      lower.match(/reminder\s+(?:for\s+)?([a-z0-9\s]+?)\s+(?:cancel|delete)/i);
        if (match && match[1]) {
          targetQuery = match[1].trim();
        }
      }

      return {
        isReminder: true,
        intent: INTENT_TYPES.CANCEL_REMINDER,
        all: isAll,
        targetQuery,
        rawQuery: text,
      };
    }

    // 3. Detect SNOOZE REMINDER
    if (/\bsnooze\b/i.test(lower)) {
      let minutes = 10;
      const minMatch = lower.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i);
      if (minMatch) {
        minutes = parseInt(minMatch[1], 10);
      }
      return {
        isReminder: true,
        intent: INTENT_TYPES.SNOOZE_REMINDER,
        minutes,
        rawQuery: text,
      };
    }

    // 4. Detect UPDATE / CHANGE REMINDER
    if (
      /\b(change|reschedule|update|move)\b.*\breminder\b/i.test(lower) ||
      /\breminder\b.*\b(maathu|change pannu)\b/i.test(lower)
    ) {
      let targetQuery = null;
      const titleMatch = lower.match(/(?:change|update|move)\s+(?:my\s+)?([a-z0-9\s]+?)\s+reminder\s+to\s+(.+)/i);
      let newTimeStr = null;
      if (titleMatch) {
        targetQuery = titleMatch[1].trim();
        newTimeStr = titleMatch[2].trim();
      }

      return {
        isReminder: true,
        intent: INTENT_TYPES.UPDATE_REMINDER,
        targetQuery,
        newTimeStr,
        rawQuery: text,
      };
    }

    // 5. Detect CREATE REMINDER
    const isCreateReminder =
      /\bremind me\b/i.test(lower) ||
      /\bset (?:a )?reminder\b/i.test(lower) ||
      /\bremind pannu\b/i.test(lower) ||
      /\breminder vei\b/i.test(lower) ||
      /\bpadikka remind\b/i.test(lower) ||
      /\bnyabagam paduthu\b/i.test(lower);

    if (!isCreateReminder) {
      return { isReminder: false, intent: INTENT_TYPES.NONE };
    }

    // Parse CREATE REMINDER details
    return this._parseCreateReminder(text, lower, timezone, now);
  }

  /**
   * Internal parser for CREATE_REMINDER
   */
  static _parseCreateReminder(rawText, lower, timezone, now) {
    const tzNow = this.getTimezoneDateParts(now, timezone);

    // A. Detect Recurrence
    let recurrence = null;
    if (/\bevery day\b|\bdaily\b|\bdhinamum\b|\bevery morning\b|\bevery night\b/i.test(lower)) {
      recurrence = { frequency: 'DAILY' };
    } else if (/\bevery weekday\b|\bweekdays\b/i.test(lower)) {
      recurrence = { frequency: 'WEEKDAY' };
    } else {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      for (let i = 0; i < days.length; i++) {
        const dayRegex = new RegExp(`\\bevery\\s+${days[i]}\\b`, 'i');
        if (dayRegex.test(lower)) {
          recurrence = { frequency: 'WEEKLY', dayOfWeek: days[i] };
          break;
        }
      }
    }

    // B. Detect Relative Duration (e.g. "in 30 minutes", "after 10 minutes", "30 minutes la")
    const relativeMatch =
      lower.match(/(?:in|after)\s+(\d+)\s*(?:minutes?|mins?|nimisham)\b/i) ||
      lower.match(/(\d+)\s*(?:minutes?|mins?|nimisham)\s*la\b/i) ||
      lower.match(/(?:in|after)\s+(\d+)\s*(?:hours?|hrs?|mani)\b/i) ||
      lower.match(/(\d+)\s*(?:hours?|hrs?|mani)\s*la\b/i) ||
      lower.match(/(?:in|after)\s+(an?|one)\s*hour\b/i) ||
      lower.match(/(?:in|after)\s+(?:a\s+)?half(?:\s+an)?\s*hour\b/i);

    if (relativeMatch) {
      let addMinutes = 0;
      if (lower.includes('half')) {
        addMinutes = 30;
      } else if (lower.includes('an hour') || lower.includes('one hour')) {
        addMinutes = 60;
      } else if (relativeMatch[0].includes('hour') || relativeMatch[0].includes('mani') || relativeMatch[0].includes('hr')) {
        addMinutes = parseInt(relativeMatch[1], 10) * 60;
      } else {
        addMinutes = parseInt(relativeMatch[1], 10);
      }

      const scheduledDate = new Date(now.getTime() + addMinutes * 60 * 1000);
      const title = this._extractReminderTitle(rawText, lower, relativeMatch[0]);

      return {
        isReminder: true,
        intent: INTENT_TYPES.CREATE_REMINDER,
        title: title || 'Reminder',
        scheduledAt: scheduledDate.toISOString(),
        timezone,
        recurrence,
        rawQuery: rawText,
      };
    }

    // C. Detect Specific Time of Day (e.g. "at 8 AM", "8:30 PM", "6 manikku", "at 6")
    const timeMatch =
      lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i) ||
      lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) ||
      lower.match(/\b(\d{1,2})\s*manikku\b/i);

    // D. Detect Day Specifier ("today", "tomorrow", "naalaikku", "next monday", etc.)
    const isTomorrow = /\btomorrow\b|\bnaalaikku\b/i.test(lower);
    const isToday = /\btoday\b|\binnikku\b|\bthis evening\b|\btonight\b/i.test(lower);

    // E. Ambiguity check: user says "tomorrow morning" or "tomorrow" without time
    if ((isTomorrow || isToday) && !timeMatch) {
      if (/\bmorning\b/i.test(lower)) {
        return {
          isReminder: true,
          intent: INTENT_TYPES.CREATE_REMINDER,
          needsClarification: true,
          clarificationPrompt: 'What time tomorrow morning?',
          rawQuery: rawText,
        };
      }
      return {
        isReminder: true,
        intent: INTENT_TYPES.CREATE_REMINDER,
        needsClarification: true,
        clarificationPrompt: 'What time should I set the reminder for?',
        rawQuery: rawText,
      };
    }

    if (!timeMatch) {
      // If user says "Remind me to study DBMS" without any time:
      return {
        isReminder: true,
        intent: INTENT_TYPES.CREATE_REMINDER,
        needsClarification: true,
        clarificationPrompt: 'What time would you like me to remind you?',
        rawQuery: rawText,
      };
    }

    // Parse hour and minute
    let targetHour = parseInt(timeMatch[1], 10);
    const targetMinute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridian = timeMatch[3] ? timeMatch[3].toLowerCase() : null;

    if (meridian === 'pm' && targetHour < 12) {
      targetHour += 12;
    } else if (meridian === 'am' && targetHour === 12) {
      targetHour = 0;
    } else if (!meridian) {
      // Contextual AM/PM inference:
      if (/\b(morning|kaalai)\b/i.test(lower) && targetHour <= 12) {
        if (targetHour === 12) targetHour = 0;
      } else if (/\b(evening|night|tonight|afternoon|maas|iravu)\b/i.test(lower) && targetHour < 12) {
        targetHour += 12;
      } else if (targetHour >= 1 && targetHour <= 7) {
        // Typical colloquial hours: 6 -> 6 PM unless morning was stated
        targetHour += 12;
      }
    }

    // Calculate target date
    let targetYear = tzNow.year;
    let targetMonth = tzNow.month;
    let targetDay = tzNow.day;

    if (isTomorrow) {
      // Add 1 day
      const d = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay + 1));
      targetYear = d.getUTCFullYear();
      targetMonth = d.getUTCMonth() + 1;
      targetDay = d.getUTCDate();
    } else if (!isTomorrow && !isToday && !recurrence) {
      // Check for day of week (e.g. "next Monday", "on Friday")
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      let targetDayIdx = -1;
      for (let i = 0; i < dayNames.length; i++) {
        if (new RegExp(`\\b${dayNames[i]}\\b`, 'i').test(lower)) {
          targetDayIdx = i;
          break;
        }
      }

      if (targetDayIdx !== -1) {
        const currentDayIdx = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay)).getUTCDay();
        let daysAhead = (targetDayIdx - currentDayIdx + 7) % 7;
        if (daysAhead === 0) daysAhead = 7; // next week
        const d = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay + daysAhead));
        targetYear = d.getUTCFullYear();
        targetMonth = d.getUTCMonth() + 1;
        targetDay = d.getUTCDate();
      } else {
        // If neither today nor tomorrow was specified and time has passed today, default to next day or check past
        if (
          targetHour < tzNow.hour ||
          (targetHour === tzNow.hour && targetMinute <= tzNow.minute)
        ) {
          const d = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay + 1));
          targetYear = d.getUTCFullYear();
          targetMonth = d.getUTCMonth() + 1;
          targetDay = d.getUTCDate();
        }
      }
    }

    // Past Time Validation (Section 17: "If user says Remind me today at 8 AM and 8 AM has already passed today...")
    if (isToday) {
      const isPast =
        targetHour < tzNow.hour ||
        (targetHour === tzNow.hour && targetMinute <= tzNow.minute);

      if (isPast) {
        const timeDisplay = `${timeMatch[1]}${timeMatch[2] ? `:${timeMatch[2]}` : ''} ${meridian ? meridian.toUpperCase() : (targetHour >= 12 ? 'PM' : 'AM')}`;
        return {
          isReminder: true,
          intent: INTENT_TYPES.CREATE_REMINDER,
          isPastTime: true,
          pastTimePrompt: `${timeDisplay} has already passed today. Do you want me to set it for tomorrow at ${timeDisplay}?`,
          rawQuery: rawText,
        };
      }
    }

    const scheduledIso = this.constructTimezoneIsoString({
      year: targetYear,
      month: targetMonth,
      day: targetDay,
      hour: targetHour,
      minute: targetMinute,
      second: 0,
    }, timezone);

    const title = this._extractReminderTitle(rawText, lower, timeMatch[0]);

    return {
      isReminder: true,
      intent: INTENT_TYPES.CREATE_REMINDER,
      title: title || 'Reminder',
      scheduledAt: scheduledIso,
      timezone,
      recurrence,
      rawQuery: rawText,
    };
  }

  /**
   * Helper to extract clean reminder title
   */
  static _extractReminderTitle(rawText, lower, timeToken) {
    let clean = rawText;

    // Remove trigger words
    clean = clean.replace(/remind me\s+(?:to\s+)?/i, '');
    clean = clean.replace(/set (?:a )?reminder\s+(?:to\s+)?/i, '');
    clean = clean.replace(/remind pannu/i, '');
    clean = clean.replace(/reminder vei/i, '');
    clean = clean.replace(/nyabagam paduthu/i, '');
    clean = clean.replace(/padikka remind/i, 'padikka');

    // Remove day/time patterns
    clean = clean.replace(/\b(tomorrow|today|tonight|this evening|naalaikku|innikku)\b/gi, '');
    clean = clean.replace(/\b(every day|daily|dhinamum|every weekday|every morning|every night)\b/gi, '');
    clean = clean.replace(/\bevery\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '');
    clean = clean.replace(/\b(?:in|after)\s+\d+\s*(?:minutes?|mins?|hours?|hrs?|mani|nimisham)\b/gi, '');
    clean = clean.replace(/\b\d+\s*(?:minutes?|mins?|nimisham)\s*la\b/gi, '');
    clean = clean.replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, '');
    clean = clean.replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '');
    clean = clean.replace(/\b\d{1,2}\s*manikku\b/gi, '');
    clean = clean.replace(/\b(morning|evening|afternoon|night|kaalai)\b/gi, '');

    // Remove dangling "to", "for", "ku"
    clean = clean.replace(/^\s*(?:to|for)\s+/i, '');
    clean = clean.replace(/\s+(?:to|for|ku|la)\s*$/i, '');
    clean = clean.replace(/[?.!]+$/, '').trim();

    // Capitalize first letter
    if (clean.length > 0) {
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }
    return 'Reminder';
  }
}

module.exports = {
  ReminderIntentService,
  INTENT_TYPES,
  DEFAULT_TIMEZONE,
};
