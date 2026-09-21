/**
 * Audio Output Service for FellowGrad AI
 * Low-latency streaming playback of 24kHz 16-bit PCM audio returned by Gemini Live.
 * Supports instant buffer flush for seamless barge-in/interruption.
 */

import { NativeModules } from 'react-native';

const { AudioStream } = NativeModules;

export class AudioOutputService {
  private isInitialized = false;
  private isFirstChunkInTurn = true;

  /**
   * Initialize native AudioTrack player for Gemini Live 24kHz output
   * @param sampleRate Default 24000 Hz
   */
  async init(sampleRate: number = 24000): Promise<boolean> {
    if (!AudioStream) {
      console.warn('[AudioOutput] AudioStream native module not available');
      return false;
    }

    try {
      await AudioStream.initPlayer(sampleRate);
      this.isInitialized = true;
      this.isFirstChunkInTurn = true;
      console.log(`[AudioOutput] PLAYER INITIALIZED -> sampleRate=${sampleRate}`);
      return true;
    } catch (err) {
      console.error('[AudioOutput] Failed to initialize audio player:', err);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Stream a 24kHz PCM audio chunk to speaker
   * @param base64Chunk Base64-encoded PCM audio bytes from Gemini Live
   */
  async playChunk(base64Chunk: string): Promise<void> {
    if (!this.isInitialized) {
      const ok = await this.init();
      if (!ok) return;
    }

    if (!AudioStream) return;

    try {
      if (this.isFirstChunkInTurn) {
        this.isFirstChunkInTurn = false;
        console.log(`[Latency] FIRST_AUDIO_PLAY -> passing chunk (${base64Chunk?.length} chars) to AudioTrack at ${Date.now()}`);
      } else {
        console.log(`[AudioOutput] PLAY CHUNK -> base64 length: ${base64Chunk?.length || 0}`);
      }
      await AudioStream.playChunk(base64Chunk);
    } catch (err) {
      console.error('[AudioOutput] PLAY ERROR ->', err);
    }
  }

  /**
   * Instantly flush audio buffer when user interrupts (barge-in)
   * Stops the current speech from playing immediately.
   */
  async flush(): Promise<void> {
    this.isFirstChunkInTurn = true;
    if (!this.isInitialized || !AudioStream) return;

    try {
      console.log('[AudioOutput] FLUSH CALLED');
      await AudioStream.flushPlayer();
    } catch (err) {
      console.warn('[AudioOutput] Error flushing audio player:', err);
    }
  }

  /**
   * Stop audio playback completely
   */
  async stop(): Promise<void> {
    this.isFirstChunkInTurn = true;
    this.isInitialized = false;
    if (AudioStream) {
      try {
        await AudioStream.stopPlayer();
        console.log('[AudioOutput] Stopped audio player');
      } catch (err) {
        console.warn('[AudioOutput] Error stopping audio player:', err);
      }
    }
  }
}

const audioOutputService = new AudioOutputService();
export default audioOutputService;
