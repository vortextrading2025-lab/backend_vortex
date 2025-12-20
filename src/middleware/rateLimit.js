const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const redisClient = require('../config/redis');

// General rate limiting (increased for development)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // limit each IP to 10000 requests per windowMs (increased for development)
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000)
    });
  }
});

// Auth rate limiting (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 auth requests per windowMs (increased for better UX)
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, please try again later.',
      retryAfter: Math.round((req.rateLimit.resetTime - Date.now()) / 1000)
    });
  }
});

// Password reset rate limiting
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 password reset requests per hour
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later.'
  }
});

// API rate limiting based on user (increased for development)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => {
    // Different limits based on user role (increased for development)
    if (req.user?.role === 'ADMIN') return 10000;
    if (req.user?.role === 'MENTOR') return 5000;
    if (req.user?.role === 'VENDOR') return 2000;
    return 5000; // Default for regular users (increased for development)
  },
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?.id || req.ip;
  },
  message: {
    success: false,
    message: 'API rate limit exceeded for your account.'
  }
});

// Slow down after rate limit
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes, then...
  delayMs: () => 500, // begin adding 500ms of delay per request above 50
  maxDelayMs: 20000, // max delay of 20 seconds
});

// Custom rate limiter using Redis
const createRedisRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    keyGenerator = (req) => req.ip,
    message = 'Too many requests'
  } = options;

  return async (req, res, next) => {
    try {
      const key = keyGenerator(req);
      const window = Math.floor(windowMs / 1000);
      
      const result = await redisClient.checkRateLimit(key, req.path, max, window);
      
      if (result.count > max) {
        return res.status(429).json({
          success: false,
          message,
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });
      }

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': max,
        'X-RateLimit-Remaining': result.remaining,
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
      });

      next();
    } catch (error) {
      console.error('Rate limit error:', error);
      next(); // Continue on Redis errors
    }
  };
};

module.exports = {
  generalLimiter,
  authLimiter,
  passwordResetLimiter,
  apiLimiter,
  speedLimiter,
  createRedisRateLimit
};
