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

    // Find user by ID or email
    let user = null;
    const candidateId = decoded.userId || decoded.sub;
    if (candidateId && !candidateId.includes('@')) {
      user = await User.findById(candidateId);
    }

    if (!user) {
      const candidateEmail = decoded.email || (decoded.sub && decoded.sub.includes('@') ? decoded.sub : null);
      if (candidateEmail) {
        user = await User.findByEmail(candidateEmail);
      }
    }

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized: User does not exist',
        message: 'Unauthorized: User does not exist',
      });
    }

    req.user = {
      id: user.id,
      userId: user.id,
      name: user.fullName || user.name,
      fullName: user.fullName || user.name,
      email: user.email,
      preferences: user.preferences,
      academicProfile: user.academicProfile,
      sessionId: decoded.sessionId || null,
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
