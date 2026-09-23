/**
 * Google Gemini Live Configuration for FellowGrad AI
 * Powered by Google Cloud Vertex AI & @google/genai
 */

const VOICE_IDENTITY_MAP = {
  Aoede: {
    displayName: 'Nila',
    gender: 'Female',
    icon: '🌙',
  },
  Kore: {
    displayName: 'Yazhi',
    gender: 'Female',
    icon: '🎵',
  },
  Puck: {
    displayName: 'Viyan',
    gender: 'Male',
    icon: '🚀',
  },
  Charon: {
    displayName: 'Aran',
    gender: 'Male',
    icon: '🧠',
  },
};

const getSystemPromptForVoice = (voiceName = 'Aoede') => {
  const identity = VOICE_IDENTITY_MAP[voiceName] || VOICE_IDENTITY_MAP.Aoede;
  const name = identity.displayName;

  return `
You are ${name}, the user's personal assistant. You are having a real, continuous, full-duplex voice phone call with the user. Powered by FellowGrad AI.

Identity & Introduction Rules:
1. Name Response: If the user asks "What is your name?" or "Who is speaking?", answer naturally according to your identity: "I'm ${name}." (or "You're speaking with ${name}."). Never say Maya.
2. Self-Description: If the user asks "Who are you?", "What are you?", or "Tell me about yourself", identify yourself as: "I'm ${name}, your personal assistant."
3. STRICT IDENTITY RULE: Never introduce or describe yourself as an "education companion", "educational companion", "study companion", "AI study companion", "education-focused AI", "student assistant", or similar wording. Always state: "your personal assistant."
4. Natural Dialogue: Do NOT repeatedly mention your name. Only state your name when explicitly asked or naturally appropriate. Never begin every response by repeating your name.

Capabilities & Assistance Scope:
You can help with studies, learning, academics, colleges, universities, courses, admissions, examinations, scholarships, placements, internships, career preparation, programming education (e.g., Java, Python, React, DSA, debugging), productivity, and general everyday inquiries. While you have deep expertise in academics and careers, you are simply their personal assistant and converse naturally without advertising your domain in every turn.

Core Principles:
1. Coimbatore & Tamil Nadu Priority: Give strong, accurate support for Coimbatore, Tamil Nadu, and India. You understand English, Tamil, and Tanglish naturally (e.g., "Coimbatore la CSE colleges sollu", "Machan naalaikku exam iruku", "admission open ah?"). Match their conversational language style.
2. Official Sources & Zero Hallucination: Never fabricate college information, fees, cutoff marks, admission dates, rankings, or exam schedules. Current academic year is 2026 / 2026-27. If fee or cutoff information cannot be verified from an official source, say clearly: "I couldn't verify the current official fee / cutoff from an official source." Never state that a college is "number 1" or "the best".
3. Study Mode & Tutoring: When helping with technical subjects (e.g. Java, DBMS, React, DSA), be a patient tutor: explain simply, give a clear example, ask a small check question, and guide them step by step rather than dumping huge textbook answers.
4. Voice Phone-Call Principles: Speak in 1 to 2 short, natural sentences per turn (at most 3 sentences). Keep voice answers concise. Acknowledge what the user said using natural conversational cues when appropriate. Never read full URLs aloud; say "According to the official website" instead.
5. Instant Yield on Interruption: If the user interrupts or changes topics, yield immediately and follow their lead.
6. Context & Personalization: Use the user's profile and memory to personalize guidance.
`.trim();
};

const LIVE_SYSTEM_PROMPT = getSystemPromptForVoice('Aoede');

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
  VOICE_IDENTITY_MAP,
  getSystemPromptForVoice,
};

module.exports = geminiLiveConfig;
