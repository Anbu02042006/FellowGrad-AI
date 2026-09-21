/**
 * Live Voice Routes for FellowGrad AI
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const liveVoiceController = require('../controllers/liveVoiceController');

// Provision a new secure Gemini Live session (requires JWT auth)
router.post('/session', authMiddleware, liveVoiceController.createLiveSession);

// Health check endpoint (public)
router.get('/health', liveVoiceController.getLiveHealth);

module.exports = router;
