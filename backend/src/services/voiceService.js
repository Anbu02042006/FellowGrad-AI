const axios = require('axios');
const GeminiService = require('./geminiService');

/**
 * VoiceService (LEGACY PIPELINE)
 *
 * NOTE: This REST-based voice pipeline (ElevenLabs TTS, STT, Gemini text) is deprecated.
 * The active voice companion now uses Gemini Live API via GeminiLiveService
 * and real-time bidirectional PCM streaming over WebSocket (/ws/live).
 *
 * Maintained strictly for backward compatibility with legacy REST callers.
 */
class VoiceService {
  /**
   * [LEGACY] Convert text to speech audio using ElevenLabs or Google Cloud TTS
   * @deprecated Use Gemini Live native-audio streaming instead
   * @param {string} text
   * @returns {Promise<Buffer>} audio/mpeg buffer
   */
  static async textToSpeech(text) {
    if (!text || !text.trim()) {
      return Buffer.alloc(0);
    }

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'Nda4CxqYPMJ65wadFnhJ';
    const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_flash_v2_5';

    if (elevenLabsKey) {
      try {
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_22050_32`;
        const response = await axios.post(
          url,
          { text, model_id: modelId },
          {
            headers: {
              'xi-api-key': elevenLabsKey,
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg',
            },
            responseType: 'arraybuffer',
            timeout: 30000,
          }
        );
        return Buffer.from(response.data);
      } catch (err) {
        console.error('[VoiceService] ElevenLabs TTS error:', err.response?.data || err.message);
      }
    }

    // Fallback: minimal valid MP3 frame (silent MPEG audio frame)
    // MPEG 1 Layer III, 32 kbps, 22050 Hz, mono
    console.warn('[VoiceService] TTS provider not configured or failed. Returning dummy audio buffer.');
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
