const GeminiService = require('../services/geminiService');
const VoiceService = require('../services/voiceService');

const chat = async (req, res, next) => {
  try {
    const { message } = req.body;
    const reply = await GeminiService.getAiResponse(message);
    return res.status(200).json({ reply });
  } catch (err) {
    next(err);
  }
};

const textToSpeech = async (req, res, next) => {
  try {
    const { text } = req.body;
    const audioBuffer = await VoiceService.textToSpeech(text);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    return res.status(200).send(audioBuffer);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  chat,
  textToSpeech,
};
