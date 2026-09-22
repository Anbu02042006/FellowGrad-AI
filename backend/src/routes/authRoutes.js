const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { authRateLimiter, passwordRateLimiter } = require('../middleware/rateLimitMiddleware');

// Public authentication routes with brute-force protection
router.post('/register', authRateLimiter, authController.register);
router.post('/login', authRateLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/validate', authController.validateToken);

// Password recovery routes
router.post('/forgot-password', passwordRateLimiter, authController.forgotPassword);
router.post('/reset-password', passwordRateLimiter, authController.resetPassword);

// Protected authenticated routes
router.get('/me', authMiddleware, authController.getMe);
router.post('/change-password', authMiddleware, passwordRateLimiter, authController.changePassword);
router.delete('/account', authMiddleware, authController.deleteAccount);

module.exports = router;
