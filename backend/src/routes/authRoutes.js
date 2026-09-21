const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireFields } = require('../middleware/validationMiddleware');

router.post('/register', requireFields(['name', 'email', 'password']), authController.register);
router.post('/login', requireFields(['email', 'password']), authController.login);
router.get('/validate', authController.validateToken);

module.exports = router;
