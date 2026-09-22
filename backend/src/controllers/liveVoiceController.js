/**
 * Live Voice Controller for FellowGrad AI
 * Handles provisioning of short-lived live sessions and health check for Gemini Live.
 */

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const geminiLiveConfig = require('../config/geminiLive');
const MemoryService = require('../services/memoryService');
const ConversationService = require('../services/conversationService');

const JWT_SECRET = process.env.JWT_SECRET || '404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970';

/**
 * Provision a new Gemini Live voice session
 * POST /api/voice/live/session
 */
const createLiveSession = async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: User not identified',
      });
    }

    const isIncognito = Boolean(req.body?.incognito ?? req.query?.incognito ?? false);

    let conversationId = req.body?.conversationId || req.query?.conversationId || null;
    if (!isIncognito && !conversationId) {
      try {
        const autoConv = await ConversationService.createConversation({ userId, title: 'Voice Session' });
        conversationId = autoConv.id;
      } catch (e) {
        console.warn(`[VoiceSession] Note creating conversation: ${e.message}`);
      }
    }

    const requestedVoice = req.body?.voice || req.query?.voice;
    let fallbackVoice = geminiLiveConfig.DEFAULT_VOICE;
    try {
      const User = require('../models/User');
      const user = await User.findById(userId);
      if (user?.preferences?.voice && geminiLiveConfig.ALLOWED_VOICES.includes(user.preferences.voice)) {
        fallbackVoice = user.preferences.voice;
      }
    } catch (_) {}

    const voice = (requestedVoice && geminiLiveConfig.ALLOWED_VOICES.includes(requestedVoice))
      ? requestedVoice
      : fallbackVoice;

    const sessionId = uuidv4();

    console.log(`[VoiceSession] Creating Live session ${sessionId} for user ${userId} with voice: ${voice} (Conversation: ${conversationId || (isIncognito ? 'INCOGNITO' : 'new')}, incognito: ${isIncognito})`);

    // Fetch user context ahead of time (empty for incognito)
    const userContext = isIncognito
      ? { profile: null, memories: [], recentMessages: [] }
      : await MemoryService.getUserContext(userId, conversationId);

    // Create a short-lived token specifically for the Live WebSocket connection (expires in 10 minutes)
    const sessionToken = jwt.sign(
      {
        sessionId,
        userId,
        conversationId: isIncognito ? null : conversationId,
        voice,
        incognito: isIncognito,
        type: 'gemini_live_session',
      },
      JWT_SECRET,
      { expiresIn: '10m' }
    );

    return res.status(200).json({
      success: true,
      sessionId,
      sessionToken,
      conversationId: isIncognito ? null : conversationId,
      voice,
      incognito: isIncognito,
      wsEndpoint: '/ws/live',
      model: geminiLiveConfig.model,
      audioConfig: {
        inputSampleRate: geminiLiveConfig.audio.input.sampleRate,
        inputChannels: geminiLiveConfig.audio.input.channels,
        outputSampleRate: geminiLiveConfig.audio.output.sampleRate,
        outputChannels: geminiLiveConfig.audio.output.channels,
      },
      profileLoaded: isIncognito ? false : !!userContext.profile,
    });
  } catch (err) {
    console.error('[VoiceSession] Error creating live session:', err);
    next(err);
  }
};

/**
 * Health check endpoint for Gemini Live service
 * GET /api/voice/live/health
 */
const getLiveHealth = async (req, res) => {
  return res.status(200).json({
    success: true,
    service: 'gemini-live',
    configured: true,
    model: geminiLiveConfig.model,
    project: geminiLiveConfig.project,
  });
};

module.exports = {
  createLiveSession,
  getLiveHealth,
};
