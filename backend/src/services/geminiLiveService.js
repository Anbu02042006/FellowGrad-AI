/**
 * Gemini Live Service for FellowGrad AI
 *
 * Real-time bidirectional audio streaming with
 * Vertex AI Gemini Live API.
 */

const { GoogleGenAI } = require('@google/genai');

const geminiLiveConfig = require('../config/geminiLive');

class GeminiLiveSession {
  constructor({
    userId,
    conversationId,
    systemInstruction,
    onAudioChunk,
    onInterrupted,
    onTranscript,
    onTurnComplete,
    onError,
    onClose,
  }) {
    this.userId = userId;
    this.conversationId = conversationId;
    this.systemInstruction = systemInstruction;

    this.onAudioChunk = onAudioChunk || (() => { });
    this.onInterrupted = onInterrupted || (() => { });
    this.onTranscript = onTranscript || (() => { });
    this.onTurnComplete = onTurnComplete || (() => { });
    this.onError = onError || (() => { });
    this.onClose = onClose || (() => { });

    this.ai = null;
    this.session = null;
    this.isConnected = false;

    this.assistantTranscriptBuffer = '';
    this.userTranscriptBuffer = '';

    this.inputAudioChunkCount = 0;
    this.outputAudioChunkCount = 0;

    this.inputAudioBytes = 0;
    this.outputAudioBytes = 0;

    // Latency tracking
    this.lastInputAudioTime = 0;
    this.isAwaitingTurnResponse = true;
  }

  /**
   * Connect to Gemini Live.
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

      /**
       * IMPORTANT:
       *
       * inputAudioTranscription allows us to verify
       * whether Gemini is actually understanding
       * the PCM audio coming from the phone.
       */
      const liveConfig = {
        responseModalities: ['AUDIO'],

        systemInstruction: {
          parts: [
            {
              text:
                this.systemInstruction ||
                `
You are FellowGrad AI, a helpful personal academic companion.

Speak naturally and concisely.
Listen carefully to the user's voice.
Answer the user's questions conversationally.
Do not wait for text input.
Respond using voice.
              `.trim(),
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

        /**
         * Enable user speech transcription and assistant speech transcription.
         */
        inputAudioTranscription: {},
        outputAudioTranscription: {},

        /**
         * Keep automatic VAD enabled.
         *
         * Gemini automatically detects when the
         * user starts and stops speaking.
         */
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,

            /**
             * Lower start-of-speech sensitivity so speaker bleed
             * or quiet ambient noise does not cause false barge-in
             * interruptions.
             */
            startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',

            /**
             * Small prefix buffer so the beginning
             * of words is not lost.
             */
            prefixPaddingMs: 100,

            /**
             * End the user's turn after silence (reduced from 700ms to 400ms for responsiveness).
             */
            silenceDurationMs: 400,
          },
        },
      };

      console.log(
        '[GeminiLive] Live configuration prepared'
      );

      this.session = await this.ai.live.connect({
        model,
        config: liveConfig,

        callbacks: {
          onopen: () => {
            console.log(
              `[GeminiLive] Session established with Vertex AI for user ${this.userId}`
            );

            this.isConnected = true;

            console.log(
              '[GeminiLive] Audio streaming ready. Waiting for PCM input...'
            );
          },

          onmessage: (message) => {
            this._handleIncomingMessage(message);
          },

          onerror: (err) => {
            console.error(
              '[GeminiLive] ERROR from Gemini:',
              err?.message || err
            );

            this.onError(err);
          },

          onclose: (event) => {
            console.log(
              '[GeminiLive] Session closed:',
              event?.reason || 'Normal close'
            );

            console.log(
              `[GeminiLive] FINAL STATS -> input chunks: ${this.inputAudioChunkCount}, output chunks: ${this.outputAudioChunkCount}`
            );

            console.log(
              `[GeminiLive] FINAL BYTES -> input: ${this.inputAudioBytes}, output: ${this.outputAudioBytes}`
            );

            this.isConnected = false;

            this.onClose(event);
          },
        },
      });

      return this.session;
    } catch (err) {
      console.error(
        '[GeminiLive] Failed to connect to Gemini Live:',
        err?.message || err
      );

      this.onError(err);

      throw err;
    }
  }

  /**
   * Handle messages coming from Gemini Live.
   */
  _handleIncomingMessage(message) {
    if (!message) {
      return;
    }

    /**
     * DEBUG:
     *
     * Log the top-level message structure once
     * so we know exactly what Gemini is returning.
     */
    if (!this._receivedFirstGeminiMessage) {
      this._receivedFirstGeminiMessage = true;

      try {
        console.log(
          '[GeminiLive] First Gemini message:',
          JSON.stringify(message).slice(0, 2000)
        );
      } catch (err) {
        console.log(
          '[GeminiLive] First Gemini message received'
        );
      }
    }

    const serverContent = message.serverContent;

    if (!serverContent) {
      return;
    }

    // ============================================================
    // USER INTERRUPTION
    // ============================================================

    if (serverContent.interrupted) {
      console.log(
        '[GeminiLive] User interruption detected'
      );

      this.assistantTranscriptBuffer = '';

      this.onInterrupted();

      return;
    }

    // ============================================================
    // USER INPUT TRANSCRIPTION
    // ============================================================

    if (serverContent.inputTranscription) {
      const transcript =
        serverContent.inputTranscription.text || '';

      if (transcript) {
        console.log(
          `[GeminiLive] USER TRANSCRIPT: ${transcript}`
        );

        this.userTranscriptBuffer += transcript;

        this.onTranscript({
          role: 'USER',
          content: transcript,
          isComplete: false,
        });
      }

      if (
        serverContent.inputTranscription.finished
      ) {
        console.log(
          `[Latency] TURN_COMPLETE: user finished speaking -> "${this.userTranscriptBuffer}"`
        );

        if (this.userTranscriptBuffer) {
          this.onTranscript({
            role: 'USER',
            content: this.userTranscriptBuffer,
            isComplete: true,
          });

          this.userTranscriptBuffer = '';
        }
      }
    }

    // ============================================================
    // MODEL TURN
    // ============================================================

    if (
      serverContent.modelTurn &&
      serverContent.modelTurn.parts
    ) {
      for (const part of serverContent.modelTurn.parts) {
        // --------------------------------------------------------
        // GEMINI AUDIO
        // --------------------------------------------------------

        if (
          part.inlineData &&
          part.inlineData.data
        ) {
          const audioData =
            part.inlineData.data;

          this.outputAudioChunkCount++;

          const approximateBytes =
            Math.floor(
              (audioData.length * 3) / 4
            );

          this.outputAudioBytes +=
            approximateBytes;

          if (this.isAwaitingTurnResponse) {
            this.isAwaitingTurnResponse = false;
            const now = Date.now();
            const elapsed = this.lastInputAudioTime ? (now - this.lastInputAudioTime) : 0;
            console.log(
              `[Latency] FIRST_GEMINI_AUDIO -> chunk #1 generated in ${elapsed}ms from last input audio (bytes: ${approximateBytes})`
            );
          }

          if (
            this.outputAudioChunkCount === 1 ||
            this.outputAudioChunkCount % 50 === 0
          ) {
            console.log(
              `[GeminiLive] RECEIVED AUDIO FROM GEMINI #${this.outputAudioChunkCount}, base64 length: ${audioData.length}, approximate bytes: ${approximateBytes}`
            );
          }

          this.onAudioChunk(audioData);
        }

        // --------------------------------------------------------
        // GEMINI TEXT (if returned via content part)
        // --------------------------------------------------------

        if (part.text) {
          console.log(
            `[GeminiLive] MODEL TEXT: ${part.text}`
          );

          this.assistantTranscriptBuffer +=
            part.text;

          this.onTranscript({
            role: 'ASSISTANT',
            content: part.text,
            isComplete: false,
          });
        }
      }
    }

    // ============================================================
    // ASSISTANT OUTPUT AUDIO TRANSCRIPTION (streaming text caption)
    // ============================================================

    if (serverContent.outputTranscription) {
      const transcript =
        serverContent.outputTranscription.text || '';

      if (transcript) {
        console.log(
          `[GeminiLive] ASSISTANT TRANSCRIPT: ${transcript}`
        );

        this.assistantTranscriptBuffer += transcript;

        this.onTranscript({
          role: 'ASSISTANT',
          content: transcript,
          isComplete: false,
        });
      }
    }

    // ============================================================
    // TURN COMPLETE
    // ============================================================

    if (serverContent.turnComplete) {
      console.log(
        '[GeminiLive] ASSISTANT TURN COMPLETE'
      );
      this.isAwaitingTurnResponse = true;

      if (this.assistantTranscriptBuffer) {
        this.onTranscript({
          role: 'ASSISTANT',
          content:
            this.assistantTranscriptBuffer,
          isComplete: true,
        });

        this.assistantTranscriptBuffer = '';
      }

      this.onTurnComplete();
    }
  }

  /**
   * Send microphone PCM to Gemini.
   *
   * Expected:
   * 16-bit PCM
   * 16kHz
   * mono
   * little-endian
   */
  sendAudioChunk(base64AudioChunk) {
    if (
      !this.session ||
      !this.isConnected
    ) {
      console.warn(
        '[GeminiLive] Cannot send audio: session is not connected'
      );

      return;
    }

    if (!base64AudioChunk) {
      console.warn(
        '[GeminiLive] Empty audio chunk'
      );

      return;
    }

    this.inputAudioChunkCount++;
    this.lastInputAudioTime = Date.now();
    this.isAwaitingTurnResponse = true;

    const approximateBytes =
      Math.floor(
        (base64AudioChunk.length * 3) / 4
      );

    this.inputAudioBytes +=
      approximateBytes;

    if (
      this.inputAudioChunkCount === 1 ||
      this.inputAudioChunkCount % 50 === 0
    ) {
      console.log(
        `[GeminiLive] INPUT AUDIO #${this.inputAudioChunkCount} -> base64: ${base64AudioChunk.length}, bytes: ${approximateBytes}`
      );
    }

    try {
      if (
        typeof this.session.sendRealtimeInput === 'function'
      ) {
        this.session.sendRealtimeInput({
          audio: {
            data: base64AudioChunk,
            mimeType: 'audio/pcm;rate=16000',
          },
        });

        console.log(
          `[GeminiLive] sendRealtimeInput SUCCESS #${this.inputAudioChunkCount}`
        );
      } else {
        const err = new Error('sendRealtimeInput() is not available on Gemini session');
        console.error(
          `[GeminiLive] ERROR: ${err.message}`
        );
        this.onError(err);
      }
    } catch (err) {
      console.error(
        `[GeminiLive] ERROR sending audio chunk #${this.inputAudioChunkCount}:`,
        err?.message || err
      );

      this.onError(err);
    }
  }

  /**
   * Send text turn to Gemini.
   *
   * Useful as a diagnostic:
   * if this produces audio, Gemini output is working.
   */
  sendTextMessage(text) {
    if (
      !this.session ||
      !this.isConnected
    ) {
      console.warn(
        '[GeminiLive] Cannot send text: session is not connected'
      );

      return;
    }

    if (!text || !text.trim()) {
      return;
    }

    try {
      console.log(
        `[GeminiLive] Sending diagnostic text: ${text}`
      );

      if (
        typeof this.session.sendRealtimeInput === 'function'
      ) {
        this.session.sendRealtimeInput({
          text: text.trim(),
        });

        console.log(
          '[GeminiLive] Diagnostic text sent successfully'
        );
      } else {
        console.error(
          '[GeminiLive] sendRealtimeInput() is not available for text message'
        );
      }
    } catch (err) {
      console.error(
        '[GeminiLive] Error sending text:',
        err?.message || err
      );
    }
  }

  /**
   * Explicitly tell Gemini the microphone stream ended.
   *
   * This is useful when the user stops the voice session.
   */
  endAudioStream() {
    if (
      !this.session ||
      !this.isConnected
    ) {
      return;
    }

    try {
      console.log(
        '[GeminiLive] Sending audioStreamEnd'
      );

      this.session.sendRealtimeInput({
        audioStreamEnd: true,
      });

      console.log(
        '[GeminiLive] audioStreamEnd SENT successfully'
      );
    } catch (err) {
      console.warn(
        '[GeminiLive] Could not send audioStreamEnd:',
        err?.message || err
      );
    }
  }

  /**
   * Close Gemini Live session.
   */
  async close() {
    console.log(
      `[GeminiLive] Closing session -> input chunks: ${this.inputAudioChunkCount}, output chunks: ${this.outputAudioChunkCount}`
    );

    try {
      this.endAudioStream();
    } catch (err) {
      console.warn(
        '[GeminiLive] Error ending audio stream:',
        err?.message || err
      );
    }

    this.isConnected = false;

    if (this.session) {
      try {
        if (
          typeof this.session.close === 'function'
        ) {
          await this.session.close();
        }
      } catch (err) {
        console.warn(
          '[GeminiLive] Error closing session:',
          err?.message || err
        );
      }

      this.session = null;
    }

    console.log(
      '[GeminiLive] Gemini Live session cleanup complete'
    );
  }
}

class GeminiLiveService {
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