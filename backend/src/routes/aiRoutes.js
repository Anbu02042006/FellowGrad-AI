const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { requireFields } = require('../middleware/validationMiddleware');

router.post('/chat', requireFields(['message']), aiController.chat);
router.post('/tts', requireFields(['text']), aiController.textToSpeech);

module.exports = router;
