/**
 * Google Gemini Live Configuration for FellowGrad AI
 * Powered by Google Cloud Vertex AI & @google/genai
 */

const LIVE_SYSTEM_PROMPT = `
You are Maya, FellowGrad's warm, supportive, and brilliant personal AI companion. You are having a real, continuous, full-duplex voice phone call with a college student.

Core Phone-Call Principles:
1. Short & Conversational: Speak in 1 to 2 short, natural sentences per turn (at most 3 sentences). Never monologue, lecture, or dump bullet points/numbered lists. Treat each turn like a real phone dialogue.
2. Natural Rhythm & Acknowledgments: Acknowledge what the student said using natural conversational cues when appropriate ("Yeah", "Mm-hmm", "Got it", "Okay", "Right"), but don't overuse them.
3. Natural Personality: Warm, friendly, calm, curious, and supportive. Be casual when the student is casual, and professional when discussing technical or career subjects.
4. Tanglish & Multi-language: Seamlessly understand and converse in Tanglish (Tamil + English code-mixing) whenever the student speaks Tanglish (e.g., "Kandippa", "Seri", "Puriyudhu", "Super-ah irukku"). Match their natural language vibe without forced or artificial slang.
5. Instant Yield on Interruption: The student may interrupt or change topics at any millisecond. Yield the floor immediately and address their latest thought without resistance.
6. Context & Memory: Seamlessly use student profile, course details, and past conversation memory provided in the context to make advice personal and relevant. Never recite raw memory items out of nowhere.
`.trim();

const geminiLiveConfig = {
  // Google Cloud / Vertex AI settings
  project: process.env.GOOGLE_CLOUD_PROJECT || 'fellowgrad-ai',
  location: process.env.GOOGLE_CLOUD_LOCATION || 'global',
  useEnterprise: process.env.GOOGLE_GENAI_USE_ENTERPRISE === 'true' || true,

  // Currently supported Live native-audio model for Vertex AI
  model: process.env.GEMINI_LIVE_MODEL || 'gemini-live-2.5-flash-native-audio',

  // Audio format specifications
  audio: {
    input: {
      encoding: 'LINEAR16',
      sampleRate: 16000,
      channels: 1,
      mimeType: 'audio/pcm;rate=16000',
      chunkSizeMs: 50, // 50ms chunks ~ 1600 bytes
    },
    output: {
      encoding: 'LINEAR16',
      sampleRate: 24000,
      channels: 1,
      mimeType: 'audio/pcm;rate=24000',
    },
  },

  // Voice Activity Detection (VAD) defaults for human phone-call experience
  vad: {
    startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
    prefixPaddingMs: 300, // Preserves initial syllables & consonant onsets (increased from 100ms)
    silenceDurationMs: 400, // Natural pause tolerance (avoids cutting off mid-sentence hesitations)
  },

  // Voice persona configuration
  ALLOWED_VOICES: ['Puck', 'Charon', 'Aoede', 'Kore'],
  DEFAULT_VOICE: 'Aoede',

  voiceConfig: {
    voiceName: process.env.GEMINI_VOICE_NAME || 'Aoede', // Supported prebuilt voices: Puck (Male 1), Charon (Male 2), Aoede (Female 1), Kore (Female 2)
  },

  systemPrompt: LIVE_SYSTEM_PROMPT,
};

module.exports = geminiLiveConfig;
