import voiceApi from './api/voiceApi';
import audioInputService from './audioInputService';
import audioOutputService from './audioOutputService';
import reminderService from './reminderService';
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
  onReminderAction?: (action: any) => void;
}

export class GeminiLiveService {
  private ws: WebSocket | null = null;
  private isSessionActive = false;
  private callbacks: LiveSessionCallbacks | null = null;
  private currentConversationId: string | null = null;

  // Prevents old/racing sessions from affecting a new session.
  private sessionGeneration = 0;

  // Latency diagnostics
  private t0 = 0;
  private t2 = 0;
  private t3 = 0;
  private t4 = 0;
  private lastUserAudioSentTime = 0;
  private isAwaitingFirstAudio = true;

  async startSession(
    conversationId: string | null,
    callbacks: LiveSessionCallbacks,
    voice?: string,
    incognito?: boolean
  ): Promise<boolean> {
    const generation = ++this.sessionGeneration;
    this.t0 = Date.now();
    this.isAwaitingFirstAudio = true;

    console.log(
      `[Latency] T0: User started voice session (generation ${generation}) at ${this.t0}ms`
    );

    // Close any existing session first.
    if (this.isSessionActive || this.ws) {
      console.log('[GeminiLive] Existing session detected. Closing it first.');
      await this.closeSession();

      if (generation !== this.sessionGeneration) {
        console.log(`[GeminiLive] Session generation ${generation} became stale.`);
        return false;
      }
    }

    this.callbacks = callbacks;
    this.currentConversationId = conversationId;
    this.isSessionActive = true;
    this.callbacks.onStateChange('CONNECTING');

    // Pre-buffer for early PCM chunks while WebSocket connects
    const pendingAudioQueue: string[] = [];
    let firstChunkSent = false;
    let audioChunkCount = 0;

    // ============================================================
    // STEP 1 (IMMEDIATE): Start native microphone capture (<20ms)
    // Audio capture begins immediately without waiting for network or WS.
    // ============================================================
    const inputSampleRate = 16000;
    const chunkMs = 50;

    audioInputService
      .startCapture(
        (base64Chunk: string) => {
          if (generation !== this.sessionGeneration || !this.isSessionActive) {
            return;
          }

          audioChunkCount++;
          this.lastUserAudioSentTime = Date.now();

          // If WebSocket is open, send chunk immediately
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            if (!firstChunkSent) {
              firstChunkSent = true;
              this.t4 = Date.now();
              console.log(
                `[Latency] T4: First PCM chunk sent to WebSocket (T4 - T0 = ${this.t4 - this.t0}ms)`
              );
            }

            if (audioChunkCount === 1 || audioChunkCount % 50 === 0) {
              console.log(
                `[GeminiLive] Sending audio chunk #${audioChunkCount}, length: ${base64Chunk.length}`
              );
            }

            this.ws.send(
              JSON.stringify({
                type: 'audio',
                data: base64Chunk,
              })
            );
          } else {
            // Buffer early audio chunks before WebSocket handshake completes (max ~50 chunks = 2.5s)
            if (pendingAudioQueue.length < 50) {
              pendingAudioQueue.push(base64Chunk);
            }
          }
        },
        inputSampleRate,
        chunkMs
      )
      .then(() => {
        this.t2 = Date.now();
        console.log(
          `[Latency] T2: Microphone capture active (T2 - T0 = ${this.t2 - this.t0}ms, sampleRate=${inputSampleRate}Hz)`
        );
      })
      .catch((micErr: any) => {
        console.error('[GeminiLive] Error starting immediate microphone capture:', micErr);
        if (generation === this.sessionGeneration) {
          this.callbacks?.onError(micErr?.message || 'Microphone permission denied');
          this.callbacks?.onStateChange('ERROR');
          this.closeSession();
        }
      });

    try {
      // ============================================================
      // STEP 2: Concurrently request session token & init AudioTrack
      // ============================================================
      const t1 = Date.now();
      console.log(
        `[Latency] T1: Requesting session token & initializing audio output at ${t1}ms...`
      );

      const [sessionResponse] = await Promise.all([
        voiceApi.createLiveSession(conversationId, voice, incognito),
        audioOutputService.init(24000),
      ]);

      if (generation !== this.sessionGeneration) {
        console.log(`[GeminiLive] Session ${generation} became stale during initialization.`);
        await audioOutputService.stop();
        return false;
      }

      const { sessionToken, wsEndpoint, audioConfig } = sessionResponse.data;
      if (!sessionToken) {
        throw new Error('Failed to obtain live session token');
      }

      // ============================================================
      // STEP 3: Connect to Cloud Run WebSocket proxy
      // ============================================================
      const wsBase = getWsBaseUrl();
      const wsUrl = `${wsBase}${wsEndpoint}?token=${encodeURIComponent(sessionToken)}`;
      console.log(`[GeminiLive] Connecting to WebSocket proxy: ${wsBase}${wsEndpoint}`);

      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      // ============================================================
      // WEBSOCKET OPEN
      // ============================================================
      ws.onopen = async () => {
        this.t3 = Date.now();
        console.log(
          `[Latency] T3: WebSocket connected (T3 - T0 = ${this.t3 - this.t0}ms, generation ${generation})`
        );

        if (
          generation !== this.sessionGeneration ||
          this.ws !== ws ||
          !this.isSessionActive
        ) {
          console.log(`[GeminiLive] Ignoring stale WebSocket open (${generation})`);
          try {
            ws.close(1000, 'Stale session');
          } catch {}
          return;
        }

        // Flush any pre-buffered audio chunks immediately
        if (pendingAudioQueue.length > 0) {
          console.log(
            `[GeminiLive] Flushing ${pendingAudioQueue.length} pre-buffered audio chunks immediately`
          );
          while (pendingAudioQueue.length > 0) {
            const chunk = pendingAudioQueue.shift();
            if (chunk && ws.readyState === WebSocket.OPEN) {
              if (!firstChunkSent) {
                firstChunkSent = true;
                this.t4 = Date.now();
                console.log(
                  `[Latency] T4: First PCM chunk sent to WebSocket (T4 - T0 = ${this.t4 - this.t0}ms)`
                );
              }
              ws.send(JSON.stringify({ type: 'audio', data: chunk }));
            }
          }
        }

        console.log('[GeminiLive] Voice stream established. Listening for speech...');
        this.callbacks?.onStateChange('LISTENING');
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
                this.isAwaitingFirstAudio = true;
                this.callbacks?.onStateChange('LISTENING');
              } else if (parsed.status === 'CONNECTING') {
                this.callbacks?.onStateChange('CONNECTING');
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
                  console.log(
                    `[Latency] T7: First Gemini audio received (T7 - T6 turnaround: ${tTurnaround}ms, chunk size: ${parsed.data.length})`
                  );
                }

                this.callbacks?.onStateChange('SPEAKING');
                await audioOutputService.playChunk(parsed.data);
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
              this.callbacks?.onStateChange('LISTENING');
              break;

            // ------------------------------------------------------
            // Transcript (triggers THINKING when user finishes turn)
            // ------------------------------------------------------

            case 'transcript':
              if (parsed.content) {
                if (parsed.role === 'USER' && parsed.isComplete) {
                  console.log(`[Latency] T6: User turn completed -> "${parsed.content}"`);
                  this.callbacks?.onStateChange('THINKING');
                }

                this.callbacks?.onTranscript?.({
                  role: parsed.role,
                  content: parsed.content,
                  isComplete: parsed.isComplete || false,
                });
              }
              break;

            // ------------------------------------------------------
            // Reminder actions (Schedule / Cancel from voice assistant)
            // ------------------------------------------------------

            case 'reminder_action':
              console.log('[GeminiLive] Received reminder_action:', parsed);
              reminderService.handleSocketReminderAction(parsed).catch((err) => {
                console.error('[GeminiLive] Error handling reminder_action:', err);
              });
              this.callbacks?.onReminderAction?.(parsed);
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