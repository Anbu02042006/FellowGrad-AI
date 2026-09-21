const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Support both /api/users/:userId and /api/users/:userId/profile as in Spring Boot
router.get('/:userId/profile', userController.getProfile);
router.put('/:userId/profile', userController.updateProfile);
router.get('/:userId', userController.getProfile);
router.put('/:userId', userController.updateProfile);

module.exports = router;
