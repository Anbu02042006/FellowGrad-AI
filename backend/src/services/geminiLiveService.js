/**
 * Gemini Live Service for FellowGrad AI
 *
 * Manages real-time bidirectional audio streaming session
 * with Vertex AI Gemini Live API.
 *
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
   * @param {Function} params.onAudioChunk
   * @param {Function} params.onInterrupted
   * @param {Function} params.onTranscript
   * @param {Function} params.onError
   * @param {Function} params.onClose
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

    this.onAudioChunk = onAudioChunk || (() => { });
    this.onInterrupted = onInterrupted || (() => { });
    this.onTranscript = onTranscript || (() => { });
    this.onError = onError || (() => { });
    this.onClose = onClose || (() => { });

    this.ai = null;
    this.session = null;
    this.isConnected = false;

    this.assistantTranscriptBuffer = '';

    // ============================================================
    // AUDIO DEBUG COUNTERS
    // ============================================================

    // Number of PCM chunks received from mobile client.
    this.inputAudioChunkCount = 0;

    // Number of audio chunks received back from Gemini.
    this.outputAudioChunkCount = 0;

    // Total input bytes received from mobile.
    this.inputAudioBytes = 0;

    // Total output bytes received from Gemini.
    this.outputAudioBytes = 0;
  }

  /**
   * Initialize and connect to Gemini Live via Vertex AI.
   */
  async connect() {
    try {
      console.log(
        `[GeminiLive] Initializing Vertex AI client for project: ${geminiLiveConfig.project}, location: ${geminiLiveConfig.location}`
      );

      this.ai = new GoogleGenAI({
        vertexai: geminiLiveConfig.useEnterprise,
        project: geminiLiveConfig.project,
        location: geminiLiveConfig.location,
      });

      const model = geminiLiveConfig.model;

      console.log(
        `[GeminiLive] Connecting to Live model: ${model}`
      );

      const liveConfig = {
        responseModalities: ['AUDIO'],

        systemInstruction: {
          parts: [
            {
              text: this.systemInstruction,
            },
          ],
        },

        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName:
                geminiLiveConfig.voiceConfig.voiceName,
            },
          },
        },
      };

      this.session = await this.ai.live.connect({
        model,
        config: liveConfig,

        callbacks: {
          // ========================================================
          // GEMINI CONNECTION OPEN
          // ========================================================

          onopen: () => {
            console.log(
              `[GeminiLive] Session established with Vertex AI for user ${this.userId}`
            );

            this.isConnected = true;

            console.log(
              '[GeminiLive] Audio streaming ready. Waiting for PCM input...'
            );
          },

          // ========================================================
          // GEMINI MESSAGE
          // ========================================================

          onmessage: (message) => {
            this._handleIncomingMessage(message);
          },

          // ========================================================
          // GEMINI ERROR
          // ========================================================

          onerror: (err) => {
            console.error(
              '[GeminiLive] Error in Live session:',
              err?.message || err
            );

            this.onError(err);
          },

          // ========================================================
          // GEMINI CLOSE
          // ========================================================

          onclose: (e) => {
            console.log(
              '[GeminiLive] Session closed:',
              e?.reason || 'Normal close'
            );

            console.log(
              `[GeminiLive] Final audio stats - input chunks: ${this.inputAudioChunkCount}, output chunks: ${this.outputAudioChunkCount}`
            );

            this.isConnected = false;

            this.onClose(e);
          },
        },
      });

      return this.session;
    } catch (err) {
      console.error(
        '[GeminiLive] Failed to connect to Gemini Live:',
        err.message
      );

      this.onError(err);

      throw err;
    }
  }

  /**
   * Parse incoming serverContent from Gemini Live.
   *
   * @private
   */
  _handleIncomingMessage(message) {
    if (!message) {
      return;
    }

    const serverContent = message.serverContent;

    if (!serverContent) {
      return;
    }

    // ============================================================
    // 1. BARGE-IN / USER INTERRUPTION
    // ============================================================

    if (serverContent.interrupted) {
      console.log(
        '[GeminiLive] User interruption detected by model (barge-in)'
      );

      this.assistantTranscriptBuffer = '';

      this.onInterrupted();

      return;
    }

    // ============================================================
    // 2. MODEL TURN
    // ============================================================

    if (
      serverContent.modelTurn &&
      serverContent.modelTurn.parts
    ) {
      for (const part of serverContent.modelTurn.parts) {
        // --------------------------------------------------------
        // AUDIO RESPONSE FROM GEMINI
        // --------------------------------------------------------

        if (
          part.inlineData &&
          part.inlineData.data
        ) {
          const audioData = part.inlineData.data;

          this.outputAudioChunkCount++;

          // Base64 -> approximate raw byte size.
          const approximateBytes = Math.floor(
            (audioData.length * 3) / 4
          );

          this.outputAudioBytes += approximateBytes;

          if (
            this.outputAudioChunkCount === 1 ||
            this.outputAudioChunkCount % 50 === 0
          ) {
            console.log(
              `[GeminiLive] Received audio chunk #${this.outputAudioChunkCount} from Gemini, base64 length: ${audioData.length}`
            );
          }

          this.onAudioChunk(audioData);
        }

        // --------------------------------------------------------
        // TEXT TRANSCRIPT FROM GEMINI
        // --------------------------------------------------------

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

    // ============================================================
    // 3. TURN COMPLETE
    // ============================================================

    if (serverContent.turnComplete) {
      console.log(
        '[GeminiLive] Assistant turn complete'
      );

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
   * Stream raw microphone PCM chunk to Gemini Live.
   *
   * Input:
   * 16kHz
   * 16-bit
   * mono
   * LINEAR16 PCM
   *
   * @param {string} base64AudioChunk
   */
  sendAudioChunk(base64AudioChunk) {
    // ============================================================
    // CHECK GEMINI CONNECTION
    // ============================================================

    if (!this.session || !this.isConnected) {
      console.warn(
        '[GeminiLive] Cannot send audio: session is not connected'
      );

      return;
    }

    // ============================================================
    // CHECK AUDIO DATA
    // ============================================================

    if (!base64AudioChunk) {
      console.warn(
        '[GeminiLive] Empty audio chunk received'
      );

      return;
    }

    // ============================================================
    // COUNT INPUT AUDIO
    // ============================================================

    this.inputAudioChunkCount++;

    // Approximate decoded PCM bytes.
    const approximateBytes = Math.floor(
      (base64AudioChunk.length * 3) / 4
    );

    this.inputAudioBytes += approximateBytes;

    // Log first chunk and every 50 chunks.
    //
    // 100ms chunks:
    //
    // #1   = first 100ms
    // #50  = approximately 5 seconds
    // #100 = approximately 10 seconds
    // #150 = approximately 15 seconds
    //
    if (
      this.inputAudioChunkCount === 1 ||
      this.inputAudioChunkCount % 50 === 0
    ) {
      console.log(
        `[GeminiLive] Received input audio chunk #${this.inputAudioChunkCount}, base64 length: ${base64AudioChunk.length}, approximate PCM bytes: ${approximateBytes}`
      );
    }

    // ============================================================
    // SEND AUDIO TO GEMINI LIVE
    // ============================================================

    try {
      if (
        typeof this.session.sendRealtimeInput ===
        'function'
      ) {
        this.session.sendRealtimeInput({
          audio: {
            data: base64AudioChunk,
            mimeType:
              geminiLiveConfig.audio.input.mimeType,
          },
        });

        // Log successful forwarding periodically.
        if (
          this.inputAudioChunkCount === 1 ||
          this.inputAudioChunkCount % 50 === 0
        ) {
          console.log(
            `[GeminiLive] Forwarded input audio chunk #${this.inputAudioChunkCount} to Gemini`
          );
        }
      } else {
        console.error(
          '[GeminiLive] sendRealtimeInput() is not available on Gemini session'
        );
      }
    } catch (err) {
      console.error(
        '[GeminiLive] Error sending audio chunk:',
        err?.message || err
      );

      this.onError(err);
    }
  }

  /**
   * Send text message turn to Gemini Live.
   *
   * @param {string} text
   */
  sendTextMessage(text) {
    if (!this.session || !this.isConnected) {
      console.warn(
        '[GeminiLive] Cannot send text: session is not connected'
      );

      return;
    }

    try {
      if (
        typeof this.session.send === 'function'
      ) {
        this.session.send({
          clientContent: {
            turns: [
              {
                role: 'user',
                parts: [
                  {
                    text,
                  },
                ],
              },
            ],
            turnComplete: true,
          },
        });
      }
    } catch (err) {
      console.error(
        '[GeminiLive] Error sending text message:',
        err.message
      );
    }
  }

  /**
   * Cleanly close active session.
   */
  async close() {
    this.isConnected = false;

    console.log(
      `[GeminiLive] Closing session. Input chunks: ${this.inputAudioChunkCount}, Output chunks: ${this.outputAudioChunkCount}`
    );

    if (this.session) {
      try {
        if (
          typeof this.session.close ===
          'function'
        ) {
          await this.session.close();
        }
      } catch (err) {
        console.warn(
          `[GeminiLive] Error during session close: ${err.message}`
        );
      }

      this.session = null;
    }
  }
}

class GeminiLiveService {
  /**
   * Factory method to create and connect a live session.
   */
  static async createSession(options) {
    const session =
      new GeminiLiveSession(options);

    await session.connect();

    return session;
  }
}

module.exports = {
  GeminiLiveService,
  GeminiLiveSession,
};