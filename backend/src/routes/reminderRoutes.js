const express = require('express');
const router = express.Router();
const ReminderController = require('../controllers/reminderController');
const authMiddleware = require('../middleware/authMiddleware');

// All reminder endpoints require authentication
router.use(authMiddleware);

router.post('/', ReminderController.createReminder);
router.get('/', ReminderController.getReminders);
router.post('/parse-intent', ReminderController.parseIntent);
router.get('/:id', ReminderController.getReminderById);
router.patch('/:id', ReminderController.updateReminder);
router.delete('/:id', ReminderController.deleteReminder);
router.post('/:id/cancel', ReminderController.cancelReminder);
router.post('/:id/snooze', ReminderController.snoozeReminder);

module.exports = router;
