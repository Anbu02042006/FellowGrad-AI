const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

const optionalAuth = (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return authMiddleware(req, res, next);
  }
  next();
};

// Modern protected user profile & preference endpoints (scoped to req.user.id)
router.get('/profile', authMiddleware, userController.getProfile);
router.put('/profile', authMiddleware, userController.updateProfile);
router.get('/preferences', authMiddleware, userController.getPreferences);
router.put('/preferences', authMiddleware, userController.updatePreferences);

// Legacy routes: /api/users/:userId/profile and /api/users/:userId
router.get('/:userId/profile', optionalAuth, userController.getProfile);
router.put('/:userId/profile', optionalAuth, userController.updateProfile);
router.get('/:userId', optionalAuth, userController.getProfile);
router.put('/:userId', optionalAuth, userController.updateProfile);

module.exports = router;
