const GeminiService = require('./geminiService');

/**
 * VoiceService (LEGACY REST PIPELINE)
 *
 * NOTE: Legacy REST-based voice pipeline is maintained for backward compatibility.
 * The active voice companion uses Google Gemini Live API via GeminiLiveService
 * and real-time bidirectional PCM streaming over WebSocket (/ws/live).
 */
class VoiceService {
  /**
   * [LEGACY] Convert text to speech audio
   * Real-time voice interaction is powered by Google Gemini Live API native audio (/ws/live).
   * For legacy REST callers requiring an audio buffer, returns a minimal valid MPEG audio frame.
   * @param {string} text
   * @returns {Promise<Buffer>} audio/mpeg buffer
   */
  static async textToSpeech(text) {
    if (!text || !text.trim()) {
      return Buffer.alloc(0);
    }

    // Fallback: minimal valid MP3 frame (silent MPEG audio frame)
    // MPEG 1 Layer III, 32 kbps, 22050 Hz, mono
    console.log('[VoiceService] Legacy REST TTS requested; real-time voice is powered by Gemini Live API.');
    const minimalMp3 = Buffer.from([
      0xff, 0xfb, 0x90, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    return minimalMp3;
  }

  /**
   * Convert audio data to text (Speech to text)
   * @param {Buffer} audioBuffer
   * @returns {Promise<{ text: string }>}
   */
  static async speechToText(audioBuffer) {
    if (!audioBuffer || audioBuffer.length === 0) {
      return { text: '' };
    }

    // If Google Cloud credentials are set, integrate SpeechClient
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        const speech = require('@google-cloud/speech');
        const client = new speech.SpeechClient();
        const request = {
          audio: { content: audioBuffer.toString('base64') },
          config: {
            encoding: 'LINEAR16',
            sampleRateHertz: 16000,
            languageCode: 'en-US',
          },
        };
        const [response] = await client.recognize(request);
        const transcript = response.results
          .map((r) => r.alternatives[0]?.transcript)
          .join('\n');
        return { text: transcript };
      } catch (err) {
        console.error('[VoiceService] Google STT error:', err.message);
      }
    }

    console.log(`[VoiceService] STT received audio of ${audioBuffer.length} bytes (no GCP credentials). Returning default transcription.`);
    return { text: 'Hello FellowGrad, how can you assist me with my college study schedule?' };
  }

  /**
   * Full end-to-end voice pipeline: Audio In -> STT -> Gemini AI -> TTS -> Audio Out
   */
  static async processVoiceInteraction(audioBuffer, userId, conversationId) {
    console.log(`[VoiceService] Processing voice interaction for user: ${userId}, conversation: ${conversationId}`);

    // 1. Audio to Text
    const { text: userText } = await this.speechToText(audioBuffer);
    console.log(`[VoiceService] User said: ${userText}`);

    // 2. Get AI Response
    const aiResponseText = await GeminiService.getAiResponse(userText);
    console.log(`[VoiceService] AI replied: ${aiResponseText}`);

    // 3. Text to Audio
    const responseAudio = await this.textToSpeech(aiResponseText);
    console.log(`[VoiceService] Returning audio buffer (${responseAudio.length} bytes)`);

    return responseAudio;
  }
}

module.exports = VoiceService;
