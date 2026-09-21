import voiceApi from './api/voiceApi';
import audioInputService from './audioInputService';
import audioOutputService from './audioOutputService';
import { getWsBaseUrl } from '../config/apiConfig';

export type LiveAssistantState =
  | 'IDLE'
  | 'CONNECTING'
  | 'LISTENING'
  | 'PROCESSING'
  | 'THINKING'
  | 'SPEAKING'
  | 'INTERRUPTED'
  | 'ERROR';

export interface LiveSessionCallbacks {
  onStateChange: (state: LiveAssistantState) => void;
  onError: (errorMessage: string) => void;
  onTranscript?: (transcript: {
    role: 'USER' | 'ASSISTANT';
    content: string;
    isComplete: boolean;
  }) => void;
  onInterrupted?: () => void;
}

export class GeminiLiveService {
  private ws: WebSocket | null = null;
  private isSessionActive = false;
  private callbacks: LiveSessionCallbacks | null = null;
  private currentConversationId: string | null = null;

  // Prevents old/racing sessions from affecting a new session.
  private sessionGeneration = 0;

  // Latency diagnostics
  private lastUserAudioSentTime = 0;
  private isAwaitingFirstAudio = true;

  async startSession(
    conversationId: string | null,
    callbacks: LiveSessionCallbacks
  ): Promise<boolean> {
    const generation = ++this.sessionGeneration;

    console.log(
      `[GeminiLive] Starting session generation ${generation}`
    );

    // Close any existing session first.
    if (this.isSessionActive || this.ws) {
      console.log(
        '[GeminiLive] Existing session detected. Closing it first.'
      );

      await this.closeSession();

      // Another startSession() may have started while
      // the previous session was being closed.
      if (generation !== this.sessionGeneration) {
        console.log(
          `[GeminiLive] Session generation ${generation} became stale.`
        );

        return false;
      }
    }

    this.callbacks = callbacks;
    this.currentConversationId = conversationId;
    this.isSessionActive = true;

    try {
      this.callbacks.onStateChange('CONNECTING');

      // ============================================================
      // 1. Get secure short-lived Gemini Live session credentials
      // ============================================================

      console.log(
        '[GeminiLive] Requesting live session credential from backend...'
      );

      const sessionResponse =
        await voiceApi.createLiveSession(conversationId);

      // Make sure this request still belongs to the active session.
      if (generation !== this.sessionGeneration) {
        console.log(
          `[GeminiLive] Ignoring stale session ${generation} after token response.`
        );

        return false;
      }

      const {
        sessionToken,
        wsEndpoint,
        audioConfig,
      } = sessionResponse.data;

      if (!sessionToken) {
        throw new Error(
          'Failed to obtain live session token'
        );
      }

      // ============================================================
      // 2. Initialize native AudioTrack for Gemini 24kHz output
      // ============================================================

      const outputSampleRate =
        audioConfig?.outputSampleRate || 24000;

      console.log(
        `[GeminiLive] Initializing audio output at ${outputSampleRate}Hz`
      );

      await audioOutputService.init(outputSampleRate);

      if (generation !== this.sessionGeneration) {
        console.log(
          `[GeminiLive] Session ${generation} became stale after audio initialization.`
        );

        await audioOutputService.stop();

        return false;
      }

      // ============================================================
      // 3. Connect to Cloud Run WebSocket proxy
      // ============================================================

      const wsBase = getWsBaseUrl();

      const wsUrl =
        `${wsBase}${wsEndpoint}` +
        `?token=${encodeURIComponent(sessionToken)}`;

      console.log(
        `[GeminiLive] Connecting to WebSocket proxy: ${wsBase}${wsEndpoint}`
      );

      const ws = new WebSocket(wsUrl);

      // This WebSocket belongs to this specific session generation.
      this.ws = ws;

      // ============================================================
      // WEBSOCKET OPEN
      // ============================================================

      ws.onopen = async () => {
        console.log(
          `[GeminiLive] WebSocket connected (generation ${generation})`
        );

        // Ignore an old/stale WebSocket.
        if (
          generation !== this.sessionGeneration ||
          this.ws !== ws ||
          !this.isSessionActive
        ) {
          console.log(
            `[GeminiLive] Ignoring stale WebSocket open (${generation})`
          );

          try {
            ws.close(1000, 'Stale session');
          } catch { }

          return;
        }

        try {
          // ========================================================
          // 4. Start native microphone capture
          // ========================================================

          const inputSampleRate =
            audioConfig?.inputSampleRate || 16000;

          console.log(
            `[GeminiLive] Starting microphone at ${inputSampleRate}Hz`
          );

          // Debug counter for microphone PCM chunks.
          let audioChunkCount = 0;

          await audioInputService.startCapture(
            (base64Chunk: string) => {
              // Never send audio through an old socket.
              if (
                generation !== this.sessionGeneration ||
                this.ws !== ws ||
                ws.readyState !== WebSocket.OPEN ||
                !this.isSessionActive
              ) {
                return;
              }

              audioChunkCount++;

              // Print first chunk and then every 50 chunks.
              //
              // 100ms chunks:
              // 50 chunks ≈ 5 seconds of audio.
              if (
                audioChunkCount === 1 ||
                audioChunkCount % 50 === 0
              ) {
                console.log(
                  `[GeminiLive] Sending audio chunk #${audioChunkCount}, base64 length: ${base64Chunk.length}`
                );
              }

              // Send PCM audio to Cloud Run WebSocket.
              this.lastUserAudioSentTime = Date.now();
              this.isAwaitingFirstAudio = true;

              ws.send(
                JSON.stringify({
                  type: 'audio',
                  data: base64Chunk,
                })
              );
            },
            inputSampleRate,
            50
          );

          // Check again after microphone initialization.
          if (
            generation !== this.sessionGeneration ||
            this.ws !== ws ||
            !this.isSessionActive
          ) {
            return;
          }

          console.log(
            '[GeminiLive] Microphone stream active. Listening...'
          );

          this.callbacks?.onStateChange('LISTENING');
        } catch (micErr: any) {
          console.error(
            '[GeminiLive] Error starting microphone capture:',
            micErr
          );

          this.callbacks?.onError(
            micErr?.message ||
            'Microphone permission denied'
          );

          this.callbacks?.onStateChange('ERROR');

          if (generation === this.sessionGeneration) {
            await this.closeSession();
          }
        }
      };

      // ============================================================
      // WEBSOCKET MESSAGE
      // ============================================================

      ws.onmessage = async (
        event: WebSocketMessageEvent
      ) => {
        // Ignore messages from stale sockets.
        if (
          generation !== this.sessionGeneration ||
          this.ws !== ws
        ) {
          return;
        }

        try {
          const parsed = JSON.parse(event.data);

          switch (parsed.type) {
            // ------------------------------------------------------
            // Server status
            // ------------------------------------------------------

            case 'status':
              if (parsed.status === 'LISTENING') {
                this.callbacks?.onStateChange(
                  'LISTENING'
                );
              } else if (
                parsed.status === 'CONNECTING'
              ) {
                this.callbacks?.onStateChange(
                  'CONNECTING'
                );
              }

              break;

            // ------------------------------------------------------
            // Gemini audio response
            // ------------------------------------------------------

            case 'audio':
              if (parsed.data) {
                const now = Date.now();
                if (this.isAwaitingFirstAudio) {
                  this.isAwaitingFirstAudio = false;
                  const tTurnaround = this.lastUserAudioSentTime ? (now - this.lastUserAudioSentTime) : 0;
                  const tTransit = parsed.tServer ? (now - parsed.tServer) : 0;
                  console.log(
                    `[Latency] FIRST_GEMINI_AUDIO received (turnaround: ${tTurnaround}ms, WS transit: ${tTransit}ms, length: ${parsed.data.length})`
                  );
                } else {
                  console.log(
                    `[GeminiLive] OUTPUT AUDIO -> base64 length: ${parsed.data.length}`
                  );
                }

                this.callbacks?.onStateChange(
                  'SPEAKING'
                );

                await audioOutputService.playChunk(
                  parsed.data
                );
              }

              break;

            // ------------------------------------------------------
            // Gemini interrupted
            // ------------------------------------------------------

            case 'interrupted':
              this.isAwaitingFirstAudio = true;
              console.log(
                '[GeminiLive] Model interrupted. Flushing audio buffer.'
              );

              await audioOutputService.flush();

              this.callbacks?.onInterrupted?.();

              this.callbacks?.onStateChange(
                'LISTENING'
              );

              break;

            // ------------------------------------------------------
            // Transcript
            // ------------------------------------------------------

            case 'transcript':
              if (parsed.content) {
                this.callbacks?.onTranscript?.({
                  role: parsed.role,
                  content: parsed.content,
                  isComplete:
                    parsed.isComplete || false,
                });
              }

              break;

            // ------------------------------------------------------
            // Server error
            // ------------------------------------------------------

            case 'error':
              console.error(
                '[GeminiLive] Server error:',
                parsed.message
              );

              this.callbacks?.onError(
                parsed.message ||
                'Gemini Live encountered an error'
              );

              break;

            // ------------------------------------------------------
            // Server closed
            // ------------------------------------------------------

            case 'closed':
              console.log(
                '[GeminiLive] Server closed session:',
                parsed.reason
              );

              if (
                generation === this.sessionGeneration
              ) {
                await this.closeSession();
              }

              break;
          }
        } catch (msgErr) {
          console.error(
            '[GeminiLive] Error parsing WebSocket message:',
            msgErr
          );
        }
      };

      // ============================================================
      // WEBSOCKET ERROR
      // ============================================================

      ws.onerror = (
        event: WebSocketErrorEvent
      ) => {
        // Ignore errors from stale sockets.
        if (
          generation !== this.sessionGeneration ||
          this.ws !== ws
        ) {
          return;
        }

        console.error(
          '[GeminiLive] WebSocket transport error:',
          event
        );

        this.callbacks?.onError(
          'Network error communicating with voice server'
        );

        this.callbacks?.onStateChange('ERROR');
      };

      // ============================================================
      // WEBSOCKET CLOSE
      // ============================================================

      ws.onclose = async (
        event: WebSocketCloseEvent
      ) => {
        console.log(
          `[GeminiLive] WebSocket closed ` +
          `(generation ${generation}, ` +
          `code: ${event.code}, ` +
          `reason: ${event.reason})`
        );

        // IMPORTANT:
        // An old socket must never clean up a newer session.
        if (
          generation !== this.sessionGeneration ||
          this.ws !== ws
        ) {
          console.log(
            `[GeminiLive] Ignoring close from stale WebSocket ${generation}`
          );

          return;
        }

        await this.cleanup(ws);

        this.callbacks?.onStateChange('IDLE');
      };

      return true;
    } catch (err: any) {
      // Ignore errors from stale session attempts.
      if (generation !== this.sessionGeneration) {
        return false;
      }

      console.error(
        '[GeminiLive] Failed to start live session:',
        err
      );

      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to connect to voice assistant';

      this.callbacks?.onError(message);

      this.callbacks?.onStateChange('ERROR');

      await this.closeSession();

      return false;
    }
  }

  // ================================================================
  // SEND TEXT MESSAGE
  // ================================================================

  sendTextMessage(text: string): void {
    if (
      this.ws &&
      this.ws.readyState === WebSocket.OPEN &&
      this.isSessionActive
    ) {
      this.ws.send(
        JSON.stringify({
          type: 'text',
          text,
        })
      );
    }
  }

  // ================================================================
  // STOP SPEAKING / BARGE-IN
  // ================================================================

  async stopSpeaking(): Promise<void> {
    console.log(
      '[GeminiLive] Flushing assistant audio playback'
    );

    await audioOutputService.flush();
  }

  // ================================================================
  // CLOSE SESSION
  // ================================================================

  async closeSession(): Promise<void> {
    // Invalidate all previous asynchronous operations.
    ++this.sessionGeneration;

    this.isSessionActive = false;

    const ws = this.ws;

    await this.cleanup(ws);

    this.callbacks?.onStateChange('IDLE');
  }

  // ================================================================
  // CLEANUP
  // ================================================================

  private async cleanup(
    socket?: WebSocket | null
  ): Promise<void> {
    this.isSessionActive = false;

    // Stop microphone.
    await audioInputService.stopCapture();

    // Stop speaker.
    await audioOutputService.stop();

    const wsToClose = socket || this.ws;

    if (wsToClose) {
      try {
        if (
          wsToClose.readyState ===
          WebSocket.OPEN ||
          wsToClose.readyState ===
          WebSocket.CONNECTING
        ) {
          wsToClose.close(
            1000,
            'User ended session'
          );
        }
      } catch (wsErr) {
        console.warn(
          '[GeminiLive] Error closing WebSocket:',
          wsErr
        );
      }
    }

    // Only clear the global WebSocket if this is
    // actually the socket we are cleaning up.
    if (
      !socket ||
      this.ws === socket
    ) {
      this.ws = null;
    }
  }

  // ================================================================
  // SESSION STATUS
  // ================================================================

  get isActive(): boolean {
    return this.isSessionActive;
  }
}

const geminiLiveService =
  new GeminiLiveService();

export default geminiLiveService;