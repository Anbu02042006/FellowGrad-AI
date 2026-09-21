/**
 * Audio Output Service for FellowGrad AI
 * Low-latency streaming playback of 24kHz 16-bit PCM audio returned by Gemini Live.
 * Supports instant buffer flush for seamless barge-in/interruption.
 */

import { NativeModules } from 'react-native';

const { AudioStream } = NativeModules;

export class AudioOutputService {
  private isInitialized = false;

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
      console.log(`[AudioOutput] Initialized AudioTrack player (${sampleRate}Hz)`);
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
      await AudioStream.playChunk(base64Chunk);
    } catch (err) {
      console.warn('[AudioOutput] Error playing audio chunk:', err);
    }
  }

  /**
   * Instantly flush audio buffer when user interrupts (barge-in)
   * Stops the current speech from playing immediately.
   */
  async flush(): Promise<void> {
    if (!this.isInitialized || !AudioStream) return;

    try {
      console.log('[AudioOutput] Flushing audio player buffer (barge-in)');
      await AudioStream.flushPlayer();
    } catch (err) {
      console.warn('[AudioOutput] Error flushing audio player:', err);
    }
  }

  /**
   * Stop audio playback completely
   */
  async stop(): Promise<void> {
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
