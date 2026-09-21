const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || '404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970';
const JWT_EXPIRATION = parseInt(process.env.JWT_EXPIRATION || '86400000', 10); // 1 day in ms

class AuthService {
  /**
   * Generate JWT token matching Spring Boot JwtService format
   */
  static generateToken(user) {
    const payload = {
      sub: user.email,
      userId: user.id,
      name: user.name,
      email: user.email,
    };
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: Math.floor(JWT_EXPIRATION / 1000), // seconds
    });
  }

  /**
   * Register a new user
   */
  static async register({ name, email, password }) {
    const existing = await User.findByEmail(email);
    if (existing) {
      const err = new Error('Email already registered');
      err.status = 400;
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const savedUser = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    const token = this.generateToken(savedUser);

    return {
      token,
      userId: savedUser.id,
      name: savedUser.name,
      email: savedUser.email,
    };
  }

  /**
   * Login existing user
   */
  static async login({ email, password }) {
    const user = await User.findByEmail(email);
    if (!user) {
      const err = new Error('User not found');
      err.status = 400;
      throw err;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const err = new Error('Bad credentials');
      err.status = 400;
      throw err;
    }

    const token = this.generateToken(user);

    return {
      token,
      userId: user.id,
      name: user.name,
      email: user.email,
    };
  }

  /**
   * Validate token
   */
  static async validateToken(token) {
    if (!token) return false;
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const email = decoded.sub || decoded.email;
      const user = await User.findByEmail(email);
      return !!user;
    } catch (err) {
      return false;
    }
  }
}

module.exports = AuthService;
