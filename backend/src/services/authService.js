const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || '404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (JWT_SECRET + '_refresh');
const JWT_EXPIRATION = parseInt(process.env.JWT_EXPIRATION || '86400000', 10); // 1 day in ms
const REFRESH_EXPIRATION = 30 * 24 * 60 * 60; // 30 days in seconds

class AuthService {
  /**
   * Validate email format
   */
  static isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Validate password complexity:
   * Minimum 8 characters, at least one uppercase, one lowercase, one number
   */
  static isValidPassword(password) {
    if (!password || typeof password !== 'string') return false;
    if (password.length < 8) return false;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return hasUpper && hasLower && hasNumber;
  }

  /**
   * Generate short-lived access JWT token
   */
  static generateToken(user) {
    const payload = {
      sub: user.id,
      userId: user.id,
      name: user.fullName || user.name,
      email: user.email,
    };
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: Math.floor(JWT_EXPIRATION / 1000), // seconds
    });
  }

  /**
   * Generate long-lived refresh token
   */
  static generateRefreshToken(user) {
    const payload = {
      sub: user.id,
      userId: user.id,
      email: user.email,
      type: 'refresh',
    };
    return jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: REFRESH_EXPIRATION,
    });
  }

  /**
   * Register a new user
   */
  static async register({ fullName, name, email, password, confirmPassword }) {
    const resolvedName = (fullName || name || '').trim();
    if (!resolvedName) {
      const err = new Error('Full name is required');
      err.status = 400;
      throw err;
    }

    if (resolvedName.length < 2 || resolvedName.length > 100) {
      const err = new Error('Full name must be between 2 and 100 characters');
      err.status = 400;
      throw err;
    }

    if (!this.isValidEmail(email)) {
      const err = new Error('Enter a valid email address');
      err.status = 400;
      throw err;
    }

    if (!this.isValidPassword(password)) {
      const err = new Error('Password must be at least 8 characters and include uppercase, lowercase, and a number');
      err.status = 400;
      throw err;
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      const err = new Error('Passwords do not match');
      err.status = 400;
      throw err;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findByEmail(normalizedEmail);
    if (existing) {
      const err = new Error('Email already registered');
      err.status = 400; // 400 for backward compatibility with existing tests
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const savedUser = await User.create({
      fullName: resolvedName,
      name: resolvedName,
      email: normalizedEmail,
      password: hashedPassword,
      passwordHash: hashedPassword,
    });

    const token = this.generateToken(savedUser);
    const refreshToken = this.generateRefreshToken(savedUser);

    return {
      token,
      refreshToken,
      userId: savedUser.id,
      id: savedUser.id,
      name: savedUser.fullName,
      fullName: savedUser.fullName,
      email: savedUser.email,
      user: savedUser.toSafeJSON(),
    };
  }

  /**
   * Login existing user
   */
  static async login({ email, password }) {
    if (!email || !password) {
      const err = new Error('Email and password are required');
      err.status = 400;
      throw err;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findByEmail(normalizedEmail);
    if (!user) {
      const err = new Error('Invalid email or password');
      err.status = 400;
      throw err;
    }

    const userPasswordHash = user.passwordHash || user.password;
    const isMatch = await bcrypt.compare(password, userPasswordHash);
    if (!isMatch) {
      const err = new Error('Invalid email or password');
      err.status = 400;
      throw err;
    }

    // Update lastLoginAt
    await User.update(user.id, { lastLoginAt: new Date().toISOString() }).catch(() => {});

    const token = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      token,
      refreshToken,
      userId: user.id,
      id: user.id,
      name: user.fullName || user.name,
      fullName: user.fullName || user.name,
      email: user.email,
      user: user.toSafeJSON(),
    };
  }

  /**
   * Refresh session access token
   */
  static async refreshSession(refreshToken) {
    if (!refreshToken) {
      const err = new Error('Refresh token is required');
      err.status = 400;
      throw err;
    }

    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
      const user = await User.findById(decoded.userId || decoded.sub);
      if (!user) {
        const err = new Error('Invalid session or user not found');
        err.status = 401;
        throw err;
      }

      const newToken = this.generateToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      return {
        token: newToken,
        refreshToken: newRefreshToken,
        user: user.toSafeJSON(),
      };
    } catch (err) {
      const error = new Error('Invalid or expired refresh token');
      error.status = 401;
      throw error;
    }
  }

  /**
   * Change password for authenticated user
   */
  static async changePassword(userId, { currentPassword, newPassword, confirmNewPassword }) {
    if (!currentPassword || !newPassword) {
      const err = new Error('Current and new password are required');
      err.status = 400;
      throw err;
    }

    if (confirmNewPassword !== undefined && newPassword !== confirmNewPassword) {
      const err = new Error('New passwords do not match');
      err.status = 400;
      throw err;
    }

    if (!this.isValidPassword(newPassword)) {
      const err = new Error('New password must be at least 8 characters with uppercase, lowercase, and a number');
      err.status = 400;
      throw err;
    }

    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }

    const currentHash = user.passwordHash || user.password;
    const isMatch = await bcrypt.compare(currentPassword, currentHash);
    if (!isMatch) {
      const err = new Error('Current password is incorrect');
      err.status = 400;
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await User.update(userId, { password: newHash, passwordHash: newHash });

    return {
      success: true,
      message: 'Password successfully changed',
    };
  }

  /**
   * Delete account and all associated user data
   */
  static async deleteAccount(userId, passwordConfirmation = null) {
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }

    // If password confirmation is provided, verify it
    if (passwordConfirmation) {
      const currentHash = user.passwordHash || user.password;
      const isMatch = await bcrypt.compare(passwordConfirmation, currentHash);
      if (!isMatch) {
        const err = new Error('Incorrect password');
        err.status = 400;
        throw err;
      }
    }

    // 1. Clear conversations
    try {
      const ConversationService = require('./conversationService');
      const conversations = await ConversationService.getConversationsByUser(userId);
      for (const conv of conversations) {
        await ConversationService.deleteConversation(userId, conv.id);
      }
    } catch (e) {
      console.warn(`[AuthService] Note cleaning conversations on account deletion: ${e.message}`);
    }

    // 2. Clear memories
    try {
      const MemoryService = require('./memoryService');
      await MemoryService.clearAllMemories(userId);
    } catch (e) {
      console.warn(`[AuthService] Note cleaning memories on account deletion: ${e.message}`);
    }

    // 3. Delete user
    await User.delete(userId);

    return {
      success: true,
      message: 'Account and associated data deleted successfully',
    };
  }

  /**
   * Get safe profile for authenticated user
   */
  static async getMe(userId) {
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    return user.toSafeJSON();
  }

  /**
   * Validate token (legacy & modern)
   */
  static async validateToken(token) {
    if (!token) return false;
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = (decoded.userId || decoded.sub)
        ? await User.findById(decoded.userId || decoded.sub)
        : null;
      if (user) return true;

      const email = decoded.email || (decoded.sub && decoded.sub.includes('@') ? decoded.sub : null);
      if (email) {
        const userByEmail = await User.findByEmail(email);
        return !!userByEmail;
      }
      return false;
    } catch (err) {
      return false;
    }
  }
}

module.exports = AuthService;
