/**
 * Gemini Live Service for FellowGrad AI
 * Manages real-time bidirectional audio streaming session with Vertex AI Gemini Live API.
 * Uses official @google/genai SDK.
 */

const { GoogleGenAI } = require('@google/genai');
const geminiLiveConfig = require('../config/geminiLive');

class GeminiLiveSession {
  /**
   * @param {object} params
   * @param {string} params.userId
   * @param {string} [params.conversationId]
   * @param {string} params.systemInstruction
   * @param {Function} params.onAudioChunk - Called with base64 PCM 24kHz audio string
   * @param {Function} params.onInterrupted - Called when model detects barge-in
   * @param {Function} params.onTranscript - Called when partial or final text transcript is available
   * @param {Function} params.onError - Called on session error
   * @param {Function} params.onClose - Called when session ends
   */
  constructor({
    userId,
    conversationId,
    systemInstruction,
    onAudioChunk,
    onInterrupted,
    onTranscript,
    onError,
    onClose,
  }) {
    this.userId = userId;
    this.conversationId = conversationId;
    this.systemInstruction = systemInstruction;
    this.onAudioChunk = onAudioChunk || (() => {});
    this.onInterrupted = onInterrupted || (() => {});
    this.onTranscript = onTranscript || (() => {});
    this.onError = onError || (() => {});
    this.onClose = onClose || (() => {});

    this.ai = null;
    this.session = null;
    this.isConnected = false;
    this.assistantTranscriptBuffer = '';
  }

  /**
   * Initialize and connect to Gemini Live via Vertex AI
   */
  async connect() {
    try {
      console.log(`[GeminiLive] Initializing Vertex AI client for project: ${geminiLiveConfig.project}, location: ${geminiLiveConfig.location}`);

      this.ai = new GoogleGenAI({
        vertexai: geminiLiveConfig.useEnterprise,
        project: geminiLiveConfig.project,
        location: geminiLiveConfig.location,
      });

      const model = geminiLiveConfig.model;
      console.log(`[GeminiLive] Connecting to Live model: ${model}`);

      const liveConfig = {
        responseModalities: ['AUDIO'],
        systemInstruction: {
          parts: [{ text: this.systemInstruction }],
        },
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: geminiLiveConfig.voiceConfig.voiceName,
            },
          },
        },
      };

      this.session = await this.ai.live.connect({
        model,
        config: liveConfig,
        callbacks: {
          onopen: () => {
            console.log(`[GeminiLive] Session established with Vertex AI for user ${this.userId}`);
            this.isConnected = true;
          },
          onmessage: (message) => {
            this._handleIncomingMessage(message);
          },
          onerror: (err) => {
            console.error(`[GeminiLive] Error in Live session:`, err?.message || err);
            this.onError(err);
          },
          onclose: (e) => {
            console.log(`[GeminiLive] Session closed:`, e?.reason || 'Normal close');
            this.isConnected = false;
            this.onClose(e);
          },
        },
      });

      return this.session;
    } catch (err) {
      console.error(`[GeminiLive] Failed to connect to Gemini Live:`, err.message);
      this.onError(err);
      throw err;
    }
  }

  /**
   * Parse incoming serverContent from Gemini Live
   * @private
   */
  _handleIncomingMessage(message) {
    if (!message) return;

    const serverContent = message.serverContent;
    if (!serverContent) return;

    // 1. Check for barge-in / user interruption
    if (serverContent.interrupted) {
      console.log('[GeminiLive] User interruption detected by model (barge-in)');
      this.assistantTranscriptBuffer = '';
      this.onInterrupted();
      return;
    }

    // 2. Extract model turn parts (audio and transcripts)
    if (serverContent.modelTurn && serverContent.modelTurn.parts) {
      for (const part of serverContent.modelTurn.parts) {
        // Audio chunk (24kHz 16-bit PCM base64)
        if (part.inlineData && part.inlineData.data) {
          this.onAudioChunk(part.inlineData.data);
        }

        // Text transcript (if emitted by model)
        if (part.text) {
          this.assistantTranscriptBuffer += part.text;
          this.onTranscript({
            role: 'ASSISTANT',
            content: part.text,
            isComplete: false,
          });
        }
      }
    }

    // 3. Check for turn completion
    if (serverContent.turnComplete) {
      console.log('[GeminiLive] Assistant turn complete');
      if (this.assistantTranscriptBuffer) {
        this.onTranscript({
          role: 'ASSISTANT',
          content: this.assistantTranscriptBuffer,
          isComplete: true,
        });
        this.assistantTranscriptBuffer = '';
      }
    }
  }

  /**
   * Stream raw microphone PCM chunk to Gemini Live
   * @param {string} base64AudioChunk - 16kHz 16-bit mono PCM base64 string
   */
  sendAudioChunk(base64AudioChunk) {
    if (!this.session || !this.isConnected) {
      console.warn('[GeminiLive] Cannot send audio: session is not connected');
      return;
    }

    try {
      // Support both sendRealtimeInput and fallback session.send formats
      if (typeof this.session.sendRealtimeInput === 'function') {
        this.session.sendRealtimeInput({
          mediaChunks: [
            {
              mimeType: geminiLiveConfig.audio.input.mimeType,
              data: base64AudioChunk,
            },
          ],
        });
      } else if (typeof this.session.send === 'function') {
        this.session.send({
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: geminiLiveConfig.audio.input.mimeType,
                data: base64AudioChunk,
              },
            ],
          },
        });
      }
    } catch (err) {
      console.error('[GeminiLive] Error sending audio chunk:', err.message);
    }
  }

  /**
   * Send text message turn to Gemini Live
   * @param {string} text
   */
  sendTextMessage(text) {
    if (!this.session || !this.isConnected) {
      console.warn('[GeminiLive] Cannot send text: session is not connected');
      return;
    }

    try {
      if (typeof this.session.send === 'function') {
        this.session.send({
          clientContent: {
            turns: [
              {
                role: 'user',
                parts: [{ text }],
              },
            ],
            turnComplete: true,
          },
        });
      }
    } catch (err) {
      console.error('[GeminiLive] Error sending text message:', err.message);
    }
  }

  /**
   * Cleanly close active session
   */
  async close() {
    this.isConnected = false;
    if (this.session) {
      try {
        if (typeof this.session.close === 'function') {
          await this.session.close();
        }
      } catch (err) {
        console.warn(`[GeminiLive] Error during session close: ${err.message}`);
      }
      this.session = null;
    }
  }
}

class GeminiLiveService {
  /**
   * Factory method to create and connect a live session
   */
  static async createSession(options) {
    const session = new GeminiLiveSession(options);
    await session.connect();
    return session;
  }
}

module.exports = {
  GeminiLiveService,
  GeminiLiveSession,
};
