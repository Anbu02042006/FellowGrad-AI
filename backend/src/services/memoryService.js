/**
 * Memory Service for FellowGrad AI
 * Retrieves and formats user profile and conversation context for personal companion sessions.
 */

const UserProfile = require('../models/UserProfile');
const Message = require('../models/Message');
const geminiLiveConfig = require('../config/geminiLive');

class MemoryService {
  /**
   * Fetch compact profile and recent conversation memory for a user
   * @param {string} userId
   * @param {string} [conversationId]
   * @returns {Promise<{ profile: object|null, recentConversation: Array, compactContext: string }>}
   */
  static async getUserContext(userId, conversationId = null) {
    try {
      console.log(`[Memory] Loading user context for userId: ${userId}`);

      // 1. Fetch user profile
      const profile = await UserProfile.findByUserId(userId);

      // 2. Fetch recent conversation messages if conversationId is provided
      let recentMessages = [];
      if (conversationId) {
        try {
          const rawMessages = await Message.findByConversationIdOrderByTimestampDesc(conversationId, 15);
          // Reverse so chronological order (oldest first)
          recentMessages = (rawMessages || []).reverse();
        } catch (msgErr) {
          console.warn(`[Memory] Could not load messages for conversation ${conversationId}: ${msgErr.message}`);
        }
      }

      // 3. Build compact context text for Gemini Live
      const contextLines = [];

      if (profile) {
        contextLines.push('--- STUDENT PROFILE ---');
        if (profile.name) contextLines.push(`Name: ${profile.name}`);
        if (profile.educationLevel) contextLines.push(`Education Level: ${profile.educationLevel}`);
        if (profile.college) contextLines.push(`College/University: ${profile.college}`);
        if (profile.course) contextLines.push(`Degree/Major: ${profile.course}`);
        if (profile.interests) contextLines.push(`Academic & Personal Interests: ${profile.interests}`);
        if (profile.skills) contextLines.push(`Skills: ${profile.skills}`);
        if (profile.careerGoals) contextLines.push(`Career Goals: ${profile.careerGoals}`);
        contextLines.push('-----------------------');
      }

      if (recentMessages.length > 0) {
        contextLines.push('--- RECENT CONVERSATION CONTEXT ---');
        for (const msg of recentMessages) {
          const roleLabel = msg.role === 'USER' ? 'Student' : 'FellowGrad';
          // Truncate long past messages to preserve token budget
          const snippet = msg.content.length > 200 ? msg.content.slice(0, 200) + '...' : msg.content;
          contextLines.push(`${roleLabel}: ${snippet}`);
        }
        contextLines.push('----------------------------------');
      }

      const compactContext = contextLines.join('\n');
      console.log(`[Memory] Context prepared (${contextLines.length} lines)`);

      return {
        profile: profile ? profile.toJSON() : null,
        recentConversation: recentMessages,
        compactContext,
      };
    } catch (err) {
      console.error(`[Memory] Error loading user context for ${userId}:`, err.message);
      return {
        profile: null,
        recentConversation: [],
        compactContext: '',
      };
    }
  }

  /**
   * Build complete system instruction string including persona and personal memory
   * @param {string} userId
   * @param {string} [conversationId]
   * @returns {Promise<string>}
   */
  static async buildLiveSystemInstruction(userId, conversationId = null) {
    const basePrompt = geminiLiveConfig.systemPrompt;
    const { compactContext } = await this.getUserContext(userId, conversationId);

    if (!compactContext) {
      return basePrompt;
    }

    return `${basePrompt}\n\n${compactContext}\nUse this context to naturally personalize your dialogue with the student.`;
  }
}

module.exports = MemoryService;
