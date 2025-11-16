const jwt = require('jsonwebtoken');
const { z } = require('zod');
const database = require('../config/database');
const redisClient = require('../config/redis');
const logger = require('../modules/logging/logger');

// JWT token validation schema
const tokenSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
  role: z.enum(['USER', 'VENDOR', 'MENTOR', 'ADMIN']),
  iat: z.number(),
  exp: z.number()
});

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                  req.cookies?.accessToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const validatedToken = tokenSchema.parse(decoded);

    // Check if session exists in Redis
    const session = await redisClient.getSession(validatedToken.sessionId);
    if (!session || session.userId !== validatedToken.userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session'
      });
    }

    // Get user from database
    const user = await database.getClient().user.findUnique({
      where: { id: validatedToken.userId },
      include: {
        permissions: {
          include: {
            permission: true
          }
        },
        vendorProfile: true,
        mentorProfile: true
      }
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    // Update session last used
    await redisClient.setSession(validatedToken.sessionId, {
      ...session,
      lastUsedAt: new Date().toISOString()
    });

    req.user = user;
    req.sessionId = validatedToken.sessionId;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// Role-based authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Permission-based authorization
const requirePermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Admin has all permissions
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Check user permissions
    const hasPermission = req.user.permissions.some(
      userPerm => 
        userPerm.permission.resource === resource && 
        userPerm.permission.action === action
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Permission denied: ${action} ${resource}`
      });
    }

    next();
  };
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                  req.cookies?.accessToken;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const validatedToken = tokenSchema.parse(decoded);

      const session = await redisClient.getSession(validatedToken.sessionId);
      if (session && session.userId === validatedToken.userId) {
        const user = await database.getClient().user.findUnique({
          where: { id: validatedToken.userId },
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        });

        if (user && user.status === 'ACTIVE') {
          req.user = user;
          req.sessionId = validatedToken.sessionId;
        }
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  requirePermission,
  optionalAuth
};
