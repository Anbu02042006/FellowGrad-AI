const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const conversationRoutes = require('./conversationRoutes');
const aiRoutes = require('./aiRoutes');
const voiceRoutes = require('./voiceRoutes');
const liveVoiceRoutes = require('./liveVoiceRoutes');
const notificationRoutes = require('./notificationRoutes');
const memoryRoutes = require('./memoryRoutes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/conversations', conversationRoutes);
router.use('/memories', memoryRoutes);
router.use('/ai', aiRoutes);
router.use('/voice/live', liveVoiceRoutes);
router.use('/voice', voiceRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;
