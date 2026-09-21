/**
 * Conversation Search Service for FellowGrad AI
 * Performs date-aware and topic-based retrieval of previous conversations from Google Cloud Firestore.
 *
 * Scoped strictly under users/{verifiedUserId}/conversations/{conversationId}/messages/{messageId}
 */

const { getFirestore } = require('../config/firestore');
const ConversationService = require('./conversationService');

class ConversationSearchService {
  /**
   * Determine if a user's spoken utterance is inquiring about historical conversations/memories
   * @param {string} text
   * @returns {{ isHistorical: boolean, dateReference: string|null, topicKeywords: string[], rawQuery: string }}
   */
  static detectHistoricalQuery(text) {
    if (!text || typeof text !== 'string') {
      return { isHistorical: false, dateReference: null, topicKeywords: [], rawQuery: '' };
    }

    const lower = text.toLowerCase().trim();

    // Common memory and historical recall triggers
    const historicalTriggers = [
      /\b(?:what\s+did\s+(?:i|we)\s+(?:tell|say|talk\s+about|discuss|mention))/i,
      /\b(?:do\s+you\s+remember|remember\s+(?:what|when|the|about))/i,
      /\b(?:i\s+told\s+you\s+(?:earlier|before|previously|yesterday|last\s+week|two\s+days\s+ago))/i,
      /\b(?:what\s+was\s+(?:the\s+thing|the\s+project|the\s+problem|it\s+that))/i,
      /\b(?:what\s+happened\s+with\s+(?:my|the))/i,
      /\b(?:earlier\s+(?:today|this\s+week|conversation|we\s+talked))/i,
      /\b(?:two\s+days\s+ago|2\s+days\s+ago|three\s+days\s+ago|3\s+days\s+ago|yesterday|last\s+week|last\s+month)/i,
      /\b(?:can\s+you\s+recall|did\s+i\s+mention)/i,
    ];

    const isHistorical = historicalTriggers.some((pattern) => pattern.test(lower));

    // Extract date reference
    let dateReference = null;
    if (/\b(?:two|2)\s+days\s+ago\b/i.test(lower)) {
      dateReference = 'two days ago';
    } else if (/\b(?:three|3)\s+days\s+ago\b/i.test(lower)) {
      dateReference = 'three days ago';
    } else if (/\byesterday\b/i.test(lower)) {
      dateReference = 'yesterday';
    } else if (/\blast\s+week\b/i.test(lower)) {
      dateReference = 'last week';
    } else if (/\blast\s+month\b/i.test(lower)) {
      dateReference = 'last month';
    } else if (/\b(?:earlier|previously|before)\b/i.test(lower)) {
      dateReference = 'earlier';
    }

    // Extract topic keywords by removing stop words and question phrases
    const stopWords = new Set([
      'maya', 'fellowgrad', 'what', 'did', 'i', 'we', 'you', 'tell', 'say', 'talk', 'about',
      'discuss', 'mention', 'remember', 'recall', 'that', 'the', 'a', 'an', 'in', 'on', 'at',
      'to', 'for', 'with', 'from', 'my', 'me', 'our', 'something', 'thing', 'was', 'is', 'it',
      'can', 'could', 'please', 'yesterday', 'ago', 'days', 'two', 'three', 'week', 'last',
      'earlier', 'before', 'previously', 'have', 'had', 'been',
    ]);

    const words = lower
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    return {
      isHistorical,
      dateReference,
      topicKeywords: [...new Set(words)],
      rawQuery: text,
    };
  }

  /**
   * Parse relative date references into start and end Date objects in the user's timezone
   * @param {string|null} dateRef
   * @param {string} [timezone]
   * @returns {{ startDate: Date, endDate: Date, label: string }|null}
   */
  static parseDateReference(dateRef, timezone = 'Asia/Kolkata') {
    if (!dateRef) return null;

    const now = new Date();
    // Use target date offsets
    let daysBackStart = 0;
    let daysBackEnd = 0;
    let label = dateRef;

    const norm = dateRef.toLowerCase().trim();

    if (norm.includes('two days ago') || norm.includes('2 days ago')) {
      daysBackStart = 2;
      daysBackEnd = 2;
      label = '2 days ago';
    } else if (norm.includes('three days ago') || norm.includes('3 days ago')) {
      daysBackStart = 3;
      daysBackEnd = 3;
      label = '3 days ago';
    } else if (norm.includes('yesterday')) {
      daysBackStart = 1;
      daysBackEnd = 1;
      label = 'yesterday';
    } else if (norm.includes('last week')) {
      daysBackStart = 7;
      daysBackEnd = 1;
      label = 'last week';
    } else if (norm.includes('last month')) {
      daysBackStart = 30;
      daysBackEnd = 1;
      label = 'last month';
    } else if (norm.includes('earlier')) {
      daysBackStart = 14;
      daysBackEnd = 0;
      label = 'earlier';
    } else {
      daysBackStart = 3;
      daysBackEnd = 0;
    }

    // Calculate start and end range boundaries (midnight to end of day)
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBackStart, 0, 0, 0, 0);
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBackEnd, 23, 59, 59, 999);

    return { startDate, endDate, label };
  }

  /**
   * Search messages within a specific date range for a verified user
   * @param {string} userId
   * @param {Date} startDate
   * @param {Date} endDate
   */
  static async searchMessagesByDate(userId, startDate, endDate) {
    if (!userId) return [];
    const conversations = await ConversationService.getConversationsByUser(userId, 30);
    if (!conversations || conversations.length === 0) return [];

    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    const matchingMessages = [];

    for (const conv of conversations) {
      const convTime = this._getTimestampMillis(conv.updatedAt || conv.createdAt);

      // Expand window slightly (+/- 12 hours) to avoid timezone clipping
      if (convTime >= startTime - 43200000 && convTime <= endTime + 43200000) {
        const msgs = await ConversationService.getMessages(userId, conv.id, 50);
        for (const msg of msgs) {
          const msgTime = this._getTimestampMillis(msg.timestamp);
          if (msgTime >= startTime && msgTime <= endTime) {
            matchingMessages.push({
              ...msg,
              conversationId: conv.id,
              conversationTitle: conv.title,
            });
          }
        }
      }
    }

    return matchingMessages;
  }

  /**
   * Search messages by topic keywords for a verified user
   * @param {string} userId
   * @param {string|string[]} keywords
   * @param {number} [limit]
   */
  static async searchMessagesByTopic(userId, keywords, limit = 10) {
    if (!userId) return [];
    const termList = Array.isArray(keywords) ? keywords : [keywords];
    const cleanTerms = termList.map((t) => t.toLowerCase().trim()).filter(Boolean);

    if (cleanTerms.length === 0) return [];

    const conversations = await ConversationService.getConversationsByUser(userId, 20);
    if (!conversations || conversations.length === 0) return [];

    const scoredMessages = [];

    for (const conv of conversations) {
      const msgs = await ConversationService.getMessages(userId, conv.id, 50);
      const titleLower = (conv.title || '').toLowerCase();

      for (let i = 0; i < msgs.length; i++) {
        const msg = msgs[i];
        const contentLower = (msg.content || '').toLowerCase();
        let score = 0;

        for (const term of cleanTerms) {
          if (contentLower.includes(term)) score += 3.0;
          if (titleLower.includes(term)) score += 2.0;
        }

        if (score > 0) {
          scoredMessages.push({
            message: {
              ...msg,
              conversationId: conv.id,
              conversationTitle: conv.title,
            },
            score,
            // Include adjacent assistant message for context if this was a USER question
            adjacentResponse: (msg.role === 'USER' && msgs[i + 1]) ? msgs[i + 1].content : null,
          });
        }
      }
    }

    scoredMessages.sort((a, b) => b.score - a.score);
    return scoredMessages.slice(0, limit);
  }

  /**
   * High-level search for historical conversations based on user query
   * @param {string} userId
   * @param {string} query
   * @param {object} [options]
   */
  static async searchHistoricalConversations(userId, query, options = {}) {
    if (!userId || !query) return [];

    const detection = this.detectHistoricalQuery(query);
    const dateRange = detection.dateReference
      ? this.parseDateReference(detection.dateReference, options.timezone)
      : null;

    let candidateMessages = [];

    // Case 1: Date-specific query (e.g., "two days ago", "yesterday")
    if (dateRange) {
      console.log(`[ConversationSearch] Searching messages by date range (${dateRange.label}): ${dateRange.startDate.toISOString()} to ${dateRange.endDate.toISOString()}`);
      const dateMatches = await this.searchMessagesByDate(userId, dateRange.startDate, dateRange.endDate);

      if (dateMatches.length > 0) {
        // If topic keywords also exist, filter/rank by keywords
        if (detection.topicKeywords.length > 0) {
          const scored = dateMatches.map((msg) => {
            const lower = msg.content.toLowerCase();
            let score = 1;
            for (const kw of detection.topicKeywords) {
              if (lower.includes(kw)) score += 3;
            }
            return { msg, score };
          });
          scored.sort((a, b) => b.score - a.score);
          candidateMessages = scored.map((s) => s.msg);
        } else {
          candidateMessages = dateMatches;
        }
      }
    }

    // Case 2: Topic-specific query or fallback if date query produced no results
    if (candidateMessages.length === 0 && detection.topicKeywords.length > 0) {
      console.log(`[ConversationSearch] Searching messages by topic keywords: [${detection.topicKeywords.join(', ')}]`);
      const topicMatches = await this.searchMessagesByTopic(userId, detection.topicKeywords, 6);
      candidateMessages = topicMatches.map((t) => ({
        ...t.message,
        adjacentResponse: t.adjacentResponse,
      }));
    }

    // Case 3: Query asks about "previous conversation" generically without a specific topic
    const isGenericPreviousInquiry =
      detection.isHistorical &&
      detection.topicKeywords.length === 0 &&
      !detection.dateReference &&
      /\b(?:previous|last|earlier)\b/i.test(query);

    if (candidateMessages.length === 0 && isGenericPreviousInquiry) {
      const convs = await ConversationService.getConversationsByUser(userId, 2);
      const targetConv = convs[1] || convs[0];
      if (targetConv) {
        const msgs = await ConversationService.getMessages(userId, targetConv.id, 6);
        candidateMessages = msgs.map((m) => ({
          ...m,
          conversationId: targetConv.id,
          conversationTitle: targetConv.title,
        }));
      }
    }

    return candidateMessages;
  }

  /**
   * Generates a concise, structured memory context block for Gemini Live when a historical query is detected.
   * Returns null if the user's query is NOT historical.
   *
   * @param {string} userId
   * @param {string} query
   * @param {string} [timezone]
   * @returns {Promise<string|null>}
   */
  static async getRelevantConversationContext(userId, query, timezone = 'Asia/Kolkata') {
    if (!userId || !query) return null;

    const detection = this.detectHistoricalQuery(query);
    if (!detection.isHistorical) {
      return null;
    }

    console.log(`[ConversationSearch] Historical inquiry detected: "${query}" (dateRef: ${detection.dateReference || 'none'}, keywords: ${detection.topicKeywords.join(',')})`);

    try {
      const matches = await this.searchHistoricalConversations(userId, query, { timezone });

      if (!matches || matches.length === 0) {
        return `
--- HISTORICAL CONVERSATION RECALL ---
Search Query: "${query}"
Status: No matching previous conversation found in student's history for this timeframe or topic.
Assistant Guideline:
- Do NOT fabricate, invent, or assume any past conversation or details.
- Warmly, naturally acknowledge that you don't have a record of that specific conversation from that time.
- Say something conversational like: "I don't have enough context to reliably recall that conversation, so I don't want to guess. Could you remind me what you'd like to focus on?"
--------------------------------------`.trim();
      }

      // Build compact, highly focused historical context (max 3-5 message turns)
      const contextLines = [];
      const timeframeLabel = detection.dateReference || 'earlier conversation';
      contextLines.push(`--- RECALLED PREVIOUS CONVERSATION (VERIFIED HISTORICAL CONTEXT) ---`);
      contextLines.push(`Timeframe: ${timeframeLabel}`);

      // Take top 4 most relevant messages
      const topMatches = matches.slice(0, 4);
      for (const m of topMatches) {
        const roleName = m.role === 'USER' ? 'Student' : 'FellowGrad';
        const cleanContent = m.content.length > 250 ? m.content.slice(0, 250) + '...' : m.content;
        contextLines.push(`${roleName}: "${cleanContent}"`);

        if (m.adjacentResponse && m.role === 'USER') {
          const cleanResp = m.adjacentResponse.length > 200 ? m.adjacentResponse.slice(0, 200) + '...' : m.adjacentResponse;
          contextLines.push(`FellowGrad Response: "${cleanResp}"`);
        }
      }

      contextLines.push(`--- INSTRUCTIONS FOR FELLOWGRAD ---`);
      contextLines.push(`1. Use this verified conversation history directly to answer the student's question.`);
      contextLines.push(`2. Speak naturally in the first person (e.g. "Two days ago you told me that...", "Earlier you mentioned that...").`);
      contextLines.push(`3. NEVER say "I searched my database", "I looked up a Firestore document", or refer to technical systems.`);
      contextLines.push(`4. Be warm, accurate, and concise.`);
      contextLines.push(`---------------------------------------------------------------------`);

      const formattedContext = contextLines.join('\n');
      console.log(`[ConversationSearch] Found ${topMatches.length} historical message(s) for context recall.`);
      return formattedContext;
    } catch (err) {
      console.error('[ConversationSearch] Error searching historical conversations:', err.message);
      return null;
    }
  }

  /**
   * Helper to parse timestamp to milliseconds
   */
  static _getTimestampMillis(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts instanceof Date) return ts.getTime();
    return new Date(ts).getTime() || 0;
  }
}

module.exports = ConversationSearchService;
