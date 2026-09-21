const express = require('express');
const multer = require('multer');
const router = express.Router();
const voiceController = require('../controllers/voiceController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

router.post(
  '/speech-to-text',
  upload.single('audio'),
  express.raw({ type: 'application/octet-stream', limit: '25mb' }),
  voiceController.speechToText
);

router.post('/text-to-speech', voiceController.textToSpeech);

router.post(
  '/process',
  upload.single('audio'),
  express.raw({ type: 'application/octet-stream', limit: '25mb' }),
  voiceController.processVoice
);

module.exports = router;
