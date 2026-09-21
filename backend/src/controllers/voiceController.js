/**
 * VoiceController (LEGACY REST PIPELINE)
 *
 * NOTE: These endpoints (/speech-to-text, /text-to-speech, /process) are legacy REST handlers.
 * The active FellowGrad AI voice companion uses the real-time Gemini Live WebSocket pipeline
 * (/api/voice/live/session and /ws/live).
 */
const VoiceService = require('../services/voiceService');

const speechToText = async (req, res, next) => {
  try {
    let audioBuffer = null;

    if (req.file && req.file.buffer) {
      audioBuffer = req.file.buffer;
    } else if (Buffer.isBuffer(req.body)) {
      audioBuffer = req.body;
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    const result = await VoiceService.speechToText(audioBuffer);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const textToSpeech = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const audioBuffer = await VoiceService.textToSpeech(text);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    return res.status(200).send(audioBuffer);
  } catch (err) {
    next(err);
  }
};

const processVoice = async (req, res, next) => {
  try {
    const userId = req.query.userId || req.body?.userId;
    const conversationId = req.query.conversationId || req.body?.conversationId;

    let audioBuffer = null;
    if (req.file && req.file.buffer) {
      audioBuffer = req.file.buffer;
    } else if (Buffer.isBuffer(req.body)) {
      audioBuffer = req.body;
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    const responseAudio = await VoiceService.processVoiceInteraction(audioBuffer, userId, conversationId);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', responseAudio.length);
    return res.status(200).send(responseAudio);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  speechToText,
  textToSpeech,
  processVoice,
};
