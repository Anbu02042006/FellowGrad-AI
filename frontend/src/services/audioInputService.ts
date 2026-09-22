/**
 * Audio Input Service for FellowGrad AI
 * Captures raw 16kHz 16-bit PCM audio from mobile microphone using native AudioStreamModule.
 */

import {
  DeviceEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
  EmitterSubscription,
} from 'react-native';

const { AudioStream } = NativeModules;

export class AudioInputService {
  private subscription: EmitterSubscription | null = null;
  private isCapturing = false;
  private hasPermissionCached = false;

  /**
   * Pre-check or prepare microphone permissions early to avoid startup delay
   */
  async prepare(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      this.hasPermissionCached = true;
      return true;
    }

    try {
      const alreadyGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      if (alreadyGranted) {
        this.hasPermissionCached = true;
        return true;
      }
    } catch (err) {
      console.warn('[AudioInput] Error pre-checking microphone permission:', err);
    }
    return false;
  }

  /**
   * Request Android runtime RECORD_AUDIO permission with fast-path if already granted
   */
  async requestPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      this.hasPermissionCached = true;
      return true;
    }

    if (this.hasPermissionCached) {
      return true;
    }

    try {
      const alreadyGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      if (alreadyGranted) {
        this.hasPermissionCached = true;
        return true;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'FellowGrad AI needs microphone access for real-time voice conversations.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );
      const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
      if (isGranted) {
        this.hasPermissionCached = true;
      }
      return isGranted;
    } catch (err) {
      console.warn('[AudioInput] Error requesting microphone permission:', err);
      return false;
    }
  }

  /**
   * Start microphone audio capture and stream PCM chunks to callback
   * @param onChunk Callback receiving base64-encoded 16kHz 16-bit mono PCM chunks
   * @param sampleRate Default 16000 Hz
   * @param chunkSizeMs Default 100 ms (~3200 bytes per chunk)
   */
  async startCapture(
    onChunk: (base64Chunk: string) => void,
    sampleRate: number = 16000,
    chunkSizeMs: number = 50
  ): Promise<boolean> {
    if (this.isCapturing) {
      return true;
    }

    if (!this.hasPermissionCached) {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        throw new Error('Microphone permission denied');
      }
    }

    if (!AudioStream) {
      console.warn('[AudioInput] AudioStream native module not available');
      return false;
    }

    // Clean up any stale subscription
    this.stopCapture();

    // Listen to native AudioStream chunk events
    this.subscription = DeviceEventEmitter.addListener(
      'onAudioChunk',
      (event: { data: string }) => {
        if (event?.data && this.isCapturing) {
          onChunk(event.data);
        }
      }
    );

    try {
      await AudioStream.startRecording(sampleRate, chunkSizeMs);
      this.isCapturing = true;
      console.log(`[AudioInput] Started recording (${sampleRate}Hz, ${chunkSizeMs}ms chunks)`);
      return true;
    } catch (err: any) {
      console.error('[AudioInput] Failed to start recording:', err);
      this.stopCapture();
      throw err;
    }
  }

  /**
   * Stop microphone audio capture
   */
  async stopCapture(): Promise<void> {
    this.isCapturing = false;

    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }

    if (AudioStream) {
      try {
        await AudioStream.stopRecording();
        console.log('[AudioInput] Stopped recording');
      } catch (err) {
        console.warn('[AudioInput] Error stopping recording:', err);
      }
    }
  }

  get isActive(): boolean {
    return this.isCapturing;
  }
}

const audioInputService = new AudioInputService();
export default audioInputService;
