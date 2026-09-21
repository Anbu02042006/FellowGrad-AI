/**
 * Memory Service for FellowGrad AI
 * Manages long-term personal user memories in Google Cloud Firestore.
 *
 * Firestore Path:
 * users/{userId}/memories/{memoryId}
 *
 * Categories:
 * - academic
 * - career
 * - project
 * - preference
 * - learning_style
 * - goals
 * - personal_context
 * - communication_preference
 */

const { v4: uuidv4 } = require('uuid');
const { getFirestore, FieldValue } = require('../config/firestore');
const geminiLiveConfig = require('../config/geminiLive');
const UserProfile = require('../models/UserProfile');
const ConversationService = require('./conversationService');

const VALID_CATEGORIES = [
  'academic',
  'career',
  'project',
  'preference',
  'learning_style',
  'goals',
  'personal_context',
  'communication_preference',
];

class MemoryService {
  /**
   * Save or update a long-term memory for a user.
   * Checks for duplicate / existing memories on the same topic and updates them to avoid clutter.
   *
   * @param {string} userId
   * @param {object} memoryData
   * @param {string} memoryData.category
   * @param {string} memoryData.content
   * @param {number} [memoryData.importance]
   * @param {string} [memoryData.sourceConversationId]
   */
  static async saveMemory(userId, { category, content, importance = 0.8, sourceConversationId = null }) {
    if (!userId || !content || !content.trim()) return null;

    const db = getFirestore();
    const cleanCategory = VALID_CATEGORIES.includes(category) ? category : 'personal_context';
    const cleanContent = content.trim();
    const cleanImportance = Math.min(1.0, Math.max(0.1, Number(importance) || 0.8));

    try {
      // 1. Fetch existing memories for this user to detect duplicates
      const existingMemories = await this.getMemories(userId);

      // 2. Check for duplicate or closely related memory
      const matchingMemory = existingMemories.find((mem) => {
        if (mem.category !== cleanCategory) return false;
        return this._isSemanticDuplicate(mem.content, cleanContent);
      });

      if (matchingMemory) {
        console.log(`[MemoryService] Updating existing memory (${matchingMemory.id}): "${cleanContent}"`);
        const memRef = db.doc(`users/${userId}/memories/${matchingMemory.id}`);
        await memRef.set(
          {
            content: cleanContent,
            importance: Math.max(matchingMemory.importance || 0.5, cleanImportance),
            sourceConversationId: sourceConversationId || matchingMemory.sourceConversationId,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return {
          ...matchingMemory,
          content: cleanContent,
          importance: Math.max(matchingMemory.importance || 0.5, cleanImportance),
        };
      }

      // 3. Insert new memory
      const memoryId = uuidv4();
      const memRef = db.doc(`users/${userId}/memories/${memoryId}`);

      const memoryDoc = {
        id: memoryId,
        category: cleanCategory,
        content: cleanContent,
        importance: cleanImportance,
        sourceConversationId: sourceConversationId || null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      await memRef.set(memoryDoc);
      console.log(`[MemoryService] Memory saved [${cleanCategory}]: "${cleanContent}" (id: ${memoryId})`);

      return {
        ...memoryDoc,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error(`[MemoryService] Error saving memory for ${userId}:`, err.message);
      return null;
    }
  }

  /**
   * Simple semantic duplicate detection helper
   */
  static _isSemanticDuplicate(strA, strB) {
    if (!strA || !strB) return false;
    const normA = strA.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const normB = strB.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

    if (normA === normB) return true;
    if (normA.includes(normB) || normB.includes(normA)) return true;

    // Word intersection ratio
    const wordsA = new Set(normA.split(/\s+/).filter((w) => w.length > 2));
    const wordsB = new Set(normB.split(/\s+/).filter((w) => w.length > 2));
    if (wordsA.size === 0 || wordsB.size === 0) return false;

    let overlap = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) overlap++;
    }

    const similarity = overlap / Math.min(wordsA.size, wordsB.size);
    return similarity >= 0.65;
  }

  /**
   * Get all memories for a user
   * @param {string} userId
   * @param {string} [category]
   */
  static async getMemories(userId, category = null) {
    if (!userId) return [];
    const db = getFirestore();

    try {
      const collRef = db.collection(`users/${userId}/memories`);
      let snapshot;

      try {
        if (category && VALID_CATEGORIES.includes(category)) {
          snapshot = await collRef.where('category', '==', category).get();
        } else {
          snapshot = await collRef.get();
        }
      } catch (_) {
        snapshot = await collRef.get();
      }

      const memories = [];
      snapshot.forEach((doc) => {
        memories.push({ id: doc.id, ...doc.data() });
      });

      // Sort by importance descending, then updatedAt descending
      memories.sort((a, b) => {
        const impA = a.importance || 0.5;
        const impB = b.importance || 0.5;
        if (impB !== impA) return impB - impA;

        const tA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : new Date(a.updatedAt || 0).getTime();
        const tB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : new Date(b.updatedAt || 0).getTime();
        return tB - tA;
      });

      return memories;
    } catch (err) {
      console.error(`[MemoryService] Error loading memories for ${userId}:`, err.message);
      return [];
    }
  }

  /**
   * Delete a memory
   * @param {string} userId
   * @param {string} memoryId
   */
  static async deleteMemory(userId, memoryId) {
    if (!userId || !memoryId) return false;
    const db = getFirestore();
    try {
      await db.doc(`users/${userId}/memories/${memoryId}`).delete();
      console.log(`[MemoryService] Deleted memory: ${memoryId} for user: ${userId}`);
      return true;
    } catch (err) {
      console.error(`[MemoryService] Error deleting memory ${memoryId}:`, err.message);
      return false;
    }
  }

  /**
   * Retrieve relevant memories based on conversation context or query
   * @param {string} userId
   * @param {string} [contextQuery]
   * @param {number} [limit]
   */
  static async getRelevantMemories(userId, contextQuery = null, limit = 8) {
    const all = await this.getMemories(userId);
    if (!contextQuery || !contextQuery.trim()) {
      return all.slice(0, limit);
    }

    const queryWords = new Set(
      contextQuery
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );

    // Score memories by keyword match + base importance
    const scored = all.map((mem) => {
      let score = (mem.importance || 0.5) * 1.5;
      const memWords = mem.content.toLowerCase().split(/\s+/);
      for (const w of memWords) {
        if (queryWords.has(w)) score += 2.0;
      }
      return { mem, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.mem);
  }

  /**
   * Asynchronously extract candidate memories from a completed conversation turn.
   * Runs in the background and NEVER blocks voice responses.
   *
   * @param {string} userId
   * @param {string} conversationId
   * @param {string} assistantText
   */
  static async extractMemoriesFromTurn(userId, conversationId, assistantText = '') {
    if (!userId || !conversationId) return;

    // Run completely in background
    setImmediate(async () => {
      try {
        // 1. Fetch recent messages
        const recentMsgs = await ConversationService.getRecentMessages(userId, conversationId, 4);
        if (!recentMsgs || recentMsgs.length < 2) return;

        const transcriptSnippet = recentMsgs
          .map((m) => `${m.role}: ${m.content}`)
          .join('\n');

        // Skip trivial / short conversation snippets
        if (transcriptSnippet.length < 35) return;

        console.log(`[MemoryService] Analyzing transcript turn for long-term memory candidates...`);

        // 2. Call Gemini for structured JSON extraction
        const candidates = await this._extractWithGemini(transcriptSnippet);

        if (Array.isArray(candidates) && candidates.length > 0) {
          for (const cand of candidates) {
            if (cand.content && cand.category) {
              console.log(`[MemoryService] Memory candidate detected: [${cand.category}] "${cand.content}"`);
              await this.saveMemory(userId, {
                category: cand.category,
                content: cand.content,
                importance: cand.importance || 0.8,
                sourceConversationId: conversationId,
              });
            }
          }
        }
      } catch (err) {
        console.warn(`[MemoryService] Background memory extraction note: ${err.message}`);
      }
    });
  }

  /**
   * Use Gemini / Vertex AI to extract structured personal memories from dialogue
   */
  static async _extractWithGemini(dialogueText) {
    try {
      const { GoogleGenAI } = require('@google/genai');

      const ai = new GoogleGenAI({
        vertexai: geminiLiveConfig.useEnterprise,
        project: geminiLiveConfig.project,
        location: geminiLiveConfig.location,
      });

      const prompt = `
You are FellowGrad AI's long-term memory extraction engine.
Analyze this short dialogue between a student and FellowGrad.
Identify if the student shared any meaningful, persistent personal context, goals, academic plans, projects, learning preferences, or career ambitions that would be valuable to remember in future conversations.

DO NOT extract temporary pleasantries, fleeting remarks, or trivial comments (e.g. "thanks", "hello", "okay", "yes").
Only extract concrete, durable personal facts.

Valid categories:
- academic (e.g., "Student is studying Data Structures and Algorithms")
- career (e.g., "Student is preparing for HCL placement interviews")
- project (e.g., "Student is building FellowGrad AI application")
- preference (e.g., "Student prefers step-by-step technical explanations")
- learning_style (e.g., "Student learns best with code examples")
- goals (e.g., "Student wants to score above 8.5 CGPA")
- personal_context (e.g., "Student is in 3rd year Computer Science at Anna University")
- communication_preference

Return ONLY valid JSON matching this schema:
{
  "memories": [
    {
      "category": "academic",
      "content": "One clear factual statement about the student",
      "importance": 0.9
    }
  ]
}
If no persistent memory is present, return {"memories": []}.

Dialogue:
${dialogueText}
`.trim();

      const result = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const responseText = result?.text || result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!responseText) return [];

      const parsed = JSON.parse(responseText);
      return Array.isArray(parsed.memories) ? parsed.memories : [];
    } catch (err) {
      // Graceful fallback: heuristic rule-based extractor if API/creds not reachable in local dev
      return this._heuristicMemoryExtractor(dialogueText);
    }
  }

  /**
   * Fallback rule-based extractor for local development when Vertex AI is offline
   */
  static _heuristicMemoryExtractor(dialogueText) {
    const memories = [];
    const lower = dialogueText.toLowerCase();

    // Check for placement / interview mentions
    const prepMatch = lower.match(/(?:preparing|studying|learning|working on)\s+for\s+([a-z0-9\s]+?)(?:\.|\n|$)/i);
    if (prepMatch && prepMatch[1].trim().length > 3) {
      memories.push({
        category: 'career',
        content: `Student is preparing for ${prepMatch[1].trim()}`,
        importance: 0.85,
      });
    }

    return memories;
  }

  /**
   * Fetch compact profile, long-term memories, and recent conversation memory for a user
   * @param {string} userId
   * @param {string} [conversationId]
   */
  static async getUserContext(userId, conversationId = null) {
    try {
      console.log(`[MemoryService] Loading user context for userId: ${userId}`);

      // 1. Fetch user profile
      let profile = null;
      try {
        profile = await UserProfile.findByUserId(userId);
      } catch (_) {}

      // 2. Fetch relevant long-term memories
      let memories = [];
      try {
        memories = await this.getRelevantMemories(userId, null, 6);
      } catch (memErr) {
        console.warn(`[MemoryService] Note loading memories: ${memErr.message}`);
      }

      // 3. Fetch recent conversation messages if conversationId is provided
      let recentMessages = [];
      if (conversationId) {
        try {
          recentMessages = await ConversationService.getRecentMessages(userId, conversationId, 8);
        } catch (msgErr) {
          console.warn(`[MemoryService] Could not load messages for conversation ${conversationId}: ${msgErr.message}`);
        }
      }

      // 3b. Fetch brief summaries of past conversations for historical continuity
      let pastConversationSummaries = [];
      try {
        const allConvs = await ConversationService.getConversationsByUser(userId, 6);
        const pastConvs = allConvs.filter((c) => c.id !== conversationId && c.lastMessage);
        for (const pastConv of pastConvs.slice(0, 4)) {
          const dateVal = pastConv.updatedAt || pastConv.createdAt;
          let dateStr = 'Earlier';
          if (dateVal) {
            try {
              const d = new Date(dateVal);
              const now = new Date();
              const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
              if (diffDays === 0) dateStr = 'Today';
              else if (diffDays === 1) dateStr = 'Yesterday';
              else if (diffDays === 2) dateStr = '2 days ago';
              else dateStr = `${diffDays} days ago`;
            } catch (_) {}
          }
          pastConversationSummaries.push(`• [${dateStr}] Discussion on "${pastConv.title || 'General'}": ${pastConv.lastMessage}`);
        }
      } catch (convErr) {
        console.warn(`[MemoryService] Note loading past conversation summaries: ${convErr.message}`);
      }

      // 4. Build compact context text for Gemini Live
      const contextLines = [];

      if (profile) {
        contextLines.push('--- STUDENT PROFILE ---');
        if (profile.name) contextLines.push(`Name: ${profile.name}`);
        if (profile.educationLevel) contextLines.push(`Education Level: ${profile.educationLevel}`);
        if (profile.college) contextLines.push(`College/University: ${profile.college}`);
        if (profile.course) contextLines.push(`Degree/Major: ${profile.course}`);
        if (profile.interests) contextLines.push(`Interests: ${profile.interests}`);
        if (profile.skills) contextLines.push(`Skills: ${profile.skills}`);
        if (profile.careerGoals) contextLines.push(`Career Goals: ${profile.careerGoals}`);
        contextLines.push('-----------------------');
      }

      if (memories.length > 0) {
        contextLines.push('--- STUDENT LONG-TERM MEMORIES & PREFERENCES ---');
        for (const m of memories) {
          contextLines.push(`• [${m.category}] ${m.content}`);
        }
        contextLines.push('------------------------------------------------');
      }

      if (pastConversationSummaries.length > 0) {
        contextLines.push('--- RECENT PAST CONVERSATIONS OVERVIEW (CHRONOLOGICAL) ---');
        for (const summary of pastConversationSummaries) {
          contextLines.push(summary);
        }
        contextLines.push('---------------------------------------------------------');
      }

      if (recentMessages.length > 0) {
        contextLines.push('--- CURRENT CONVERSATION CONTEXT ---');
        for (const msg of recentMessages) {
          const roleLabel = msg.role === 'USER' ? 'Student' : 'FellowGrad';
          const snippet = msg.content.length > 180 ? msg.content.slice(0, 180) + '...' : msg.content;
          contextLines.push(`${roleLabel}: ${snippet}`);
        }
        contextLines.push('-----------------------------------');
      }

      contextLines.push('--- PERSONAL ASSISTANT MEMORY BEHAVIOR ---');
      contextLines.push('1. You are the student\'s personal assistant with active memory across past days.');
      contextLines.push('2. If the student asks what you talked about "two days ago", "yesterday", or "earlier", use the past conversations and long-term memory above.');
      contextLines.push('3. Speak naturally in the first person (e.g. "Two days ago you told me that...", "Earlier you mentioned...").');
      contextLines.push('4. NEVER say "I searched my database", "Firestore", "records", or refer to internal systems.');
      contextLines.push('5. If you do not have a recorded conversation matching what the user asks about, honestly say you don\'t recall that specific conversation rather than inventing facts.');
      contextLines.push('------------------------------------------');

      const compactContext = contextLines.join('\n');
      console.log(`[MemoryService] Context loaded (${memories.length} memories, ${pastConversationSummaries.length} past convs, ${recentMessages.length} recent messages)`);

      return {
        profile: profile ? (profile.toJSON ? profile.toJSON() : profile) : null,
        memories,
        recentConversation: recentMessages,
        compactContext,
      };
    } catch (err) {
      console.error(`[MemoryService] Error loading user context for ${userId}:`, err.message);
      return {
        profile: null,
        memories: [],
        recentConversation: [],
        compactContext: '',
      };
    }
  }

  /**
   * Build complete system instruction string including persona and personal memory
   * @param {string} userId
   * @param {string} [conversationId]
   */
  /**
   * Build complete system instruction string including persona and personal memory
   * @param {string} userId
   * @param {string} [conversationId]
   */
  static async buildLiveSystemInstruction(userId, conversationId = null) {
    const basePrompt = geminiLiveConfig.systemPrompt;
    const { compactContext } = await this.getUserContext(userId, conversationId);

    if (!compactContext) {
      return basePrompt;
    }

    return `${basePrompt}\n\n${compactContext}\nUse this context naturally to personalize your spoken responses to the student. Never disclose or recite raw memory items unless relevant to what the student is talking about.`;
  }

  /**
   * Build system instruction specifically for Incognito sessions (no personal memory injected)
   */
  static buildIncognitoSystemInstruction() {
    return `${geminiLiveConfig.systemPrompt}\n\n--- INCOGNITO SESSION ACTIVE ---\nThis is an ephemeral, private incognito session. You are Maya, a modern, helpful, friendly personal AI companion. Answer the user's questions naturally and conversationally. Do not attempt to save, reference past personal records, or persist any conversation details.`;
  }
}

module.exports = MemoryService;
