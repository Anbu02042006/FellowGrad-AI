const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || '404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970';

/**
 * Authentication middleware that verifies the Bearer JWT
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized: Missing or invalid Authorization header',
      message: 'Unauthorized: Missing or invalid Authorization header',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Find user by email (stored in subject/email in JWT)
    const email = decoded.sub || decoded.email;
    const user = await User.findByEmail(email);

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized: User does not exist',
        message: 'Unauthorized: User does not exist',
      });
    }

    req.user = {
      id: user.id,
      userId: user.id,
      name: user.name,
      email: user.email,
    };

    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or expired token',
      message: 'Unauthorized: Invalid or expired token',
    });
  }
};

module.exports = authMiddleware;
