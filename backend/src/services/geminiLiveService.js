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
    voice,
    vadConfig,
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
    this.vadConfig = vadConfig || null;

    // Validate voice against whitelist, fallback to default
    this.voice = (voice && geminiLiveConfig.ALLOWED_VOICES.includes(voice))
      ? voice
      : (geminiLiveConfig.voiceConfig?.voiceName || geminiLiveConfig.DEFAULT_VOICE);

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

    // Turn Latency Tracking (Full Duplex Phone Call Model)
    this.lastInputAudioTime = 0;
    this.turnIndex = 0;
    this.isAwaitingTurnResponse = true;
    this.turnMetrics = [];
    this.currentTurn = {
      turnIndex: 0,
      speechStartTime: 0,
      lastInputAudioTime: 0,
      geminiEndOfTurnTime: 0,
      firstGeminiAudioTime: 0,
      userText: '',
      assistantText: '',
      interrupted: false,
    };
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
        `[GeminiLive] Connecting to Live model: ${model} with voice: ${this.voice}`
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
              voiceName: this.voice,
            },
          },
        },

        /**
         * Enable user speech transcription and assistant speech transcription.
         */
        inputAudioTranscription: {},
        outputAudioTranscription: {},

        /**
         * Automatic Voice Activity Detection (VAD)
         *
         * - prefixPaddingMs: 300ms lookback preserves initial syllables & consonant onsets
         * - silenceDurationMs: 400ms preserves natural mid-thought pauses without cutoffs
         * - startOfSpeechSensitivity: calibrated with hardware AEC to prevent false triggers
         */
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity:
              this.vadConfig?.startOfSpeechSensitivity ||
              geminiLiveConfig.vad?.startOfSpeechSensitivity ||
              'START_SENSITIVITY_LOW',
            prefixPaddingMs:
              this.vadConfig?.prefixPaddingMs ??
              geminiLiveConfig.vad?.prefixPaddingMs ??
              300,
            silenceDurationMs:
              this.vadConfig?.silenceDurationMs ??
              geminiLiveConfig.vad?.silenceDurationMs ??
              400,
          },
        },
      };

      console.log(
        `[GeminiLive] Live configuration prepared (VAD: prefixPadding=${liveConfig.realtimeInputConfig.automaticActivityDetection.prefixPaddingMs}ms, silenceDuration=${liveConfig.realtimeInputConfig.automaticActivityDetection.silenceDurationMs}ms, sensitivity=${liveConfig.realtimeInputConfig.automaticActivityDetection.startOfSpeechSensitivity})`
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
        `[GeminiLive] User interruption detected on Turn #${this.turnIndex}`
      );

      if (this.currentTurn) {
        this.currentTurn.interrupted = true;
      }

      this.assistantTranscriptBuffer = '';
      this.isAwaitingTurnResponse = true;

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
        if (this.currentTurn) {
          this.currentTurn.userText = this.userTranscriptBuffer;
        }

        this.onTranscript({
          role: 'USER',
          content: transcript,
          isComplete: false,
        });
      }

      if (
        serverContent.inputTranscription.finished
      ) {
        const geminiEot = Date.now();
        if (this.currentTurn) {
          this.currentTurn.geminiEndOfTurnTime = geminiEot;
          this.currentTurn.userText = this.userTranscriptBuffer;
        }

        const vadLatency = this.currentTurn?.lastInputAudioTime
          ? geminiEot - this.currentTurn.lastInputAudioTime
          : 0;

        console.log(
          `[Latency] TURN #${this.turnIndex} END_OF_TURN: VAD committed in ${vadLatency}ms -> "${this.userTranscriptBuffer}"`
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

          const now = Date.now();

          // Turn latency measurement for first response chunk
          if (this.currentTurn && !this.currentTurn.firstGeminiAudioTime) {
            this.currentTurn.firstGeminiAudioTime = now;
            const speechEndTime = this.currentTurn.lastInputAudioTime || this.lastInputAudioTime || now;
            const eotTime = this.currentTurn.geminiEndOfTurnTime || speechEndTime;

            const vadLatencyMs = Math.max(0, eotTime - speechEndTime);
            const genLatencyMs = Math.max(0, now - eotTime);
            const totalTurnaroundMs = Math.max(0, now - speechEndTime);

            this.currentTurn.vadLatencyMs = vadLatencyMs;
            this.currentTurn.genLatencyMs = genLatencyMs;
            this.currentTurn.totalTurnaroundMs = totalTurnaroundMs;

            this.turnMetrics.push({
              turnIndex: this.turnIndex,
              userText: this.currentTurn.userText,
              speechEndTime,
              geminiEndOfTurnTime: eotTime,
              firstGeminiAudioTime: now,
              vadLatencyMs,
              genLatencyMs,
              totalTurnaroundMs,
              interrupted: false,
            });

            console.log(
              `[TurnLatency] TURN #${this.turnIndex} LATENCY BREAKDOWN: speechEnd->GeminiEndOfTurn (VAD): ${vadLatencyMs}ms | GeminiEndOfTurn->firstAudio (Gen): ${genLatencyMs}ms | speechEnd->firstPlayback: ${totalTurnaroundMs}ms (bytes: ${approximateBytes})`
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

          // Forward chunk immediately with zero buffering
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
        `[GeminiLive] ASSISTANT TURN #${this.turnIndex} COMPLETE`
      );
      this.isAwaitingTurnResponse = true;

      if (this.currentTurn) {
        this.currentTurn.assistantText = this.assistantTranscriptBuffer;
      }

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

    const now = Date.now();
    this.inputAudioChunkCount++;

    if (this.isAwaitingTurnResponse) {
      this.isAwaitingTurnResponse = false;
      this.turnIndex++;
      this.currentTurn = {
        turnIndex: this.turnIndex,
        speechStartTime: now,
        lastInputAudioTime: now,
        geminiEndOfTurnTime: 0,
        firstGeminiAudioTime: 0,
        userText: '',
        assistantText: '',
        interrupted: false,
      };
    }

    this.lastInputAudioTime = now;
    if (this.currentTurn) {
      this.currentTurn.lastInputAudioTime = now;
    }

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
        `[GeminiLive] INPUT AUDIO #${this.inputAudioChunkCount} -> base64: ${base64AudioChunk.length}, bytes: ${approximateBytes} (Turn #${this.turnIndex})`
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

  /**
   * Get all recorded turn latency metrics
   */
  getTurnMetrics() {
    return [...this.turnMetrics];
  }

  /**
   * Calculate summary latency statistics (avg, median, P90)
   */
  getSummaryStats() {
    if (this.turnMetrics.length === 0) {
      return {
        totalTurns: 0,
        averageTurnaroundMs: 0,
        medianTurnaroundMs: 0,
        p90TurnaroundMs: 0,
        averageVadMs: 0,
        averageGenMs: 0,
        interruptedTurns: 0,
      };
    }

    const turnarounds = this.turnMetrics
      .map((t) => t.totalTurnaroundMs)
      .filter((v) => typeof v === 'number' && !isNaN(v))
      .sort((a, b) => a - b);

    const vads = this.turnMetrics
      .map((t) => t.vadLatencyMs)
      .filter((v) => typeof v === 'number' && !isNaN(v));

    const gens = this.turnMetrics
      .map((t) => t.genLatencyMs)
      .filter((v) => typeof v === 'number' && !isNaN(v));

    const sum = turnarounds.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / (turnarounds.length || 1));

    const mid = Math.floor(turnarounds.length / 2);
    const median = turnarounds.length % 2 !== 0
      ? turnarounds[mid]
      : Math.round((turnarounds[mid - 1] + turnarounds[mid]) / 2);

    const p90Index = Math.min(
      turnarounds.length - 1,
      Math.floor(turnarounds.length * 0.9)
    );
    const p90 = turnarounds[p90Index] || 0;

    const avgVad = Math.round(
      vads.reduce((a, b) => a + b, 0) / (vads.length || 1)
    );
    const avgGen = Math.round(
      gens.reduce((a, b) => a + b, 0) / (gens.length || 1)
    );

    const interruptedCount = this.turnMetrics.filter((t) => t.interrupted).length;

    return {
      totalTurns: this.turnMetrics.length,
      averageTurnaroundMs: avg,
      medianTurnaroundMs: median,
      p90TurnaroundMs: p90,
      averageVadMs: avgVad,
      averageGenMs: avgGen,
      interruptedTurns: interruptedCount,
      minTurnaroundMs: turnarounds[0] || 0,
      maxTurnaroundMs: turnarounds[turnarounds.length - 1] || 0,
    };
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