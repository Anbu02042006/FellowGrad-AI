const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const { requireFields } = require('../middleware/validationMiddleware');

router.post('/', requireFields(['userId', 'title']), conversationController.createConversation);
router.get('/user/:userId', conversationController.getConversationsByUser);
router.get('/:conversationId', conversationController.getConversation);
router.post('/:conversationId/messages', requireFields(['role', 'content']), conversationController.sendMessage);
router.get('/:conversationId/messages', conversationController.getMessages);
router.get('/:conversationId/recent', conversationController.getRecentMessages);

module.exports = router;
