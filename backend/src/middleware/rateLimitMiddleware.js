/**
 * In-memory rate limiting middleware for authentication endpoints
 * Protects against brute-force and credential stuffing attacks.
 * Automatically bypassed in test mode to allow automated test suites to run cleanly.
 */

const rateLimitMap = new Map();

/**
 * Creates a rate limiter middleware
 * @param {object} options
 * @param {number} options.windowMs Window size in milliseconds
 * @param {number} options.max Maximum requests per windowMs
 * @param {string} options.message Error message returned on rate limit breach
 */
const createRateLimiter = ({
  windowMs = 15 * 60 * 1000, // 15 minutes default
  max = 20, // 20 requests default
  message = 'Too many requests, please try again later.',
} = {}) => {
  return (req, res, next) => {
    // Bypass in test environment
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const key = `${req.ip}_${req.baseUrl}${req.path}`;
    const now = Date.now();

    const record = rateLimitMap.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }

    record.count++;
    rateLimitMap.set(key, record);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      return res.status(429).json({
        success: false,
        error: message,
        message,
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    next();
  };
};

// Rate limiter instances for auth endpoints
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 requests per 15 minutes
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
});

const passwordRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 password changes/resets per 15 minutes
  message: 'Too many password attempts. Please try again later.',
});

module.exports = {
  createRateLimiter,
  authRateLimiter,
  passwordRateLimiter,
};
