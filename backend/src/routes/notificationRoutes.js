const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { requireFields } = require('../middleware/validationMiddleware');

router.post('/', requireFields(['userId', 'message']), notificationController.sendNotification);

module.exports = router;
