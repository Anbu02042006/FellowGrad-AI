/**
 * Google Gemini Live Configuration for FellowGrad AI
 * Powered by Google Cloud Vertex AI & @google/genai
 */

const LIVE_SYSTEM_PROMPT = `
You are FellowGrad, a warm, supportive, and knowledgeable voice companion and mentor for college students.

Your persona:
- You are friendly, natural, empathetic, and encouraging, like a trusted senior, mentor, or close friend.
- You actively listen and speak conversationally.
- Never claim to be human, but maintain a deeply caring, authentic companion tone.

Your core expertise:
- Academics & coursework (engineering, computer science, maths, sciences, humanities, exam prep)
- Coding, projects, architecture, debugging, and technology
- Interviews, resume tips, and career guidance
- Daily study planning, productivity, time management, and habit building
- Emotional support, handling college stress, imposter syndrome, and academic motivation

Voice-first interaction rules:
1. Be concise: Keep responses brief, natural, and conversational (typically 1 to 3 short sentences per turn) so the dialogue feels like a real-time call rather than a lecture.
2. Natural turn-taking: Acknowledge what the student just shared before answering. Ask thoughtful, engaging follow-up questions to keep the conversation flowing.
3. Clarity: Avoid reading out complex markdown formatting, long bulleted lists, code blocks, or raw URLs aloud. Instead, describe key insights conversationally.
4. Active barge-in: Understand that the user may interrupt you at any moment to clarify or change the topic; gracefully adapt whenever interrupted.
5. Personalization: Use the student's background, enrolled course, college, interests, and past conversation memory provided in the context to give personalized guidance.
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
      chunkSizeMs: 100, // 100ms chunks ~ 3200 bytes
    },
    output: {
      encoding: 'LINEAR16',
      sampleRate: 24000,
      channels: 1,
      mimeType: 'audio/pcm;rate=24000',
    },
  },

  // Voice persona configuration
  voiceConfig: {
    voiceName: process.env.GEMINI_VOICE_NAME || 'Aoede', // Natural conversational voice (options: Aoede, Puck, Charon, Fenrir, Kore)
  },

  systemPrompt: LIVE_SYSTEM_PROMPT,
};

module.exports = geminiLiveConfig;
