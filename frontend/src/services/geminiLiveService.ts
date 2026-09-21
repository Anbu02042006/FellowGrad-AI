/**
 * Gemini Live Service for React Native Client
 * Manages the live session lifecycle, WebSocket streaming, microphone input,
 * speaker output, and instant barge-in / interruption handling.
 */

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
  onTranscript?: (transcript: { role: 'USER' | 'ASSISTANT'; content: string; isComplete: boolean }) => void;
  onInterrupted?: () => void;
}

export class GeminiLiveService {
  private ws: WebSocket | null = null;
  private isSessionActive = false;
  private callbacks: LiveSessionCallbacks | null = null;
  private currentConversationId: string | null = null;

  /**
   * Start a real-time voice session with Gemini Live
   * @param conversationId
   * @param callbacks
   */
  async startSession(
    conversationId: string | null,
    callbacks: LiveSessionCallbacks
  ): Promise<boolean> {
    if (this.isSessionActive) {
      console.log('[GeminiLive] Session already active. Stopping previous session first.');
      await this.closeSession();
    }

    this.callbacks = callbacks;
    this.currentConversationId = conversationId;
    this.isSessionActive = true;

    try {
      this.callbacks.onStateChange('CONNECTING');

      // 1. Request secure short-lived live session token from FellowGrad backend
      console.log('[GeminiLive] Requesting live session credential from backend...');
      const sessionResponse = await voiceApi.createLiveSession(conversationId);
      const { sessionToken, wsEndpoint, audioConfig } = sessionResponse.data;

      if (!sessionToken) {
        throw new Error('Failed to obtain live session token');
      }

      // 2. Initialize native AudioTrack player for Gemini 24kHz output
      const outputSampleRate = audioConfig?.outputSampleRate || 24000;
      await audioOutputService.init(outputSampleRate);

      // 3. Connect to backend WebSocket proxy
      const wsBase = getWsBaseUrl();
      const wsUrl = `${wsBase}${wsEndpoint}?token=${sessionToken}`;
      console.log(`[GeminiLive] Connecting to WebSocket proxy: ${wsBase}${wsEndpoint}`);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = async () => {
        console.log('[GeminiLive] WebSocket connection established');
        if (!this.isSessionActive) return;

        // 4. Start native microphone capture (16kHz 16-bit mono PCM)
        try {
          const inputSampleRate = audioConfig?.inputSampleRate || 16000;
          await audioInputService.startCapture((base64Chunk: string) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({
                type: 'audio',
                data: base64Chunk,
              }));
            }
          }, inputSampleRate, 100);

          console.log('[GeminiLive] Microphone stream active. Listening...');
          this.callbacks?.onStateChange('LISTENING');
        } catch (micErr: any) {
          console.error('[GeminiLive] Error starting microphone capture:', micErr);
          this.callbacks?.onError(micErr?.message || 'Microphone permission denied');
          this.callbacks?.onStateChange('ERROR');
          await this.closeSession();
        }
      };

      this.ws.onmessage = async (event: WebSocketMessageEvent) => {
        try {
          const parsed = JSON.parse(event.data);

          switch (parsed.type) {
            case 'status':
              if (parsed.status === 'LISTENING') {
                this.callbacks?.onStateChange('LISTENING');
              } else if (parsed.status === 'CONNECTING') {
                this.callbacks?.onStateChange('CONNECTING');
              }
              break;

            case 'audio':
              // Streaming audio chunk from Gemini Live
              if (parsed.data) {
                this.callbacks?.onStateChange('SPEAKING');
                await audioOutputService.playChunk(parsed.data);
              }
              break;

            case 'interrupted':
              // Barge-in detected by Gemini Live! Instantly flush speaker buffer
              console.log('[GeminiLive] Model was interrupted. Flushing audio buffer.');
              await audioOutputService.flush();
              this.callbacks?.onInterrupted?.();
              this.callbacks?.onStateChange('LISTENING');
              break;

            case 'transcript':
              if (parsed.content) {
                this.callbacks?.onTranscript?.({
                  role: parsed.role,
                  content: parsed.content,
                  isComplete: parsed.isComplete || false,
                });
              }
              break;

            case 'error':
              console.error('[GeminiLive] Error received from server:', parsed.message);
              this.callbacks?.onError(parsed.message || 'Gemini Live encountered an error');
              break;

            case 'closed':
              console.log('[GeminiLive] Server notified session closed:', parsed.reason);
              await this.closeSession();
              break;
          }
        } catch (msgErr) {
          console.error('[GeminiLive] Error parsing WebSocket message:', msgErr);
        }
      };

      this.ws.onerror = (event: WebSocketErrorEvent) => {
        console.error('[GeminiLive] WebSocket transport error:', event);
        this.callbacks?.onError('Network error communicating with voice server');
        this.callbacks?.onStateChange('ERROR');
      };

      this.ws.onclose = async (event: WebSocketCloseEvent) => {
        console.log(`[GeminiLive] WebSocket closed (code: ${event.code}, reason: ${event.reason})`);
        await this.cleanup();
        this.callbacks?.onStateChange('IDLE');
      };

      return true;
    } catch (err: any) {
      console.error('[GeminiLive] Failed to start live session:', err);
      const message = err?.response?.data?.message || err?.message || 'Unable to connect to voice assistant';
      this.callbacks?.onError(message);
      this.callbacks?.onStateChange('ERROR');
      await this.closeSession();
      return false;
    }
  }

  /**
   * Send a text message turn to Gemini Live
   */
  sendTextMessage(text: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'text',
        text,
      }));
    }
  }

  /**
   * Stop current audio playback immediately
   */
  async stopSpeaking(): Promise<void> {
    await audioOutputService.flush();
  }

  /**
   * Cleanly terminate session and release audio hardware
   */
  async closeSession(): Promise<void> {
    this.isSessionActive = false;
    await this.cleanup();
    this.callbacks?.onStateChange('IDLE');
  }

  private async cleanup(): Promise<void> {
    this.isSessionActive = false;

    // 1. Stop microphone capture
    await audioInputService.stopCapture();

    // 2. Stop audio playback
    await audioOutputService.stop();

    // 3. Close WebSocket connection
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close(1000, 'User ended session');
        }
      } catch (wsErr) {
        console.warn('[GeminiLive] Error closing WebSocket:', wsErr);
      }
      this.ws = null;
    }
  }

  get isActive(): boolean {
    return this.isSessionActive;
  }
}

const geminiLiveService = new GeminiLiveService();
export default geminiLiveService;
