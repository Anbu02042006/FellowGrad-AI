const NotificationService = require('../services/notificationService');

const sendNotification = async (req, res, next) => {
  try {
    const { userId, message } = req.body;
    await NotificationService.sendNotification({ userId, message });
    // Spring Boot returns 202 Accepted
    return res.status(202).send();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendNotification,
};
