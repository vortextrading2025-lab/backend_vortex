const jwt = require('jsonwebtoken');
const { z } = require('zod');
const database = require('../config/database');
const redisClient = require('../config/redis');
const logger = require('../modules/logging/logger');

// JWT token validation schema
const tokenSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
  role: z.enum(['USER', 'VENDOR', 'MENTOR', 'ADMIN', 'MODERATOR', 'SUPPORT', 'ANALYST']),
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

    // Check if session exists - try Redis first, fallback to database
    let session = null;
    let useDatabaseFallback = false;
    
    try {
      session = await redisClient.getSession(validatedToken.sessionId);
      
      // If Redis is not configured or session not in Redis, try database
      if (!session) {
        useDatabaseFallback = true;
        const dbSession = await database.getClient().session.findUnique({
          where: { 
            sessionId: validatedToken.sessionId,
            status: 'ACTIVE'
          }
        });
        
        if (dbSession && dbSession.expiresAt > new Date()) {
          // Convert database session to Redis session format
          session = {
            sessionId: dbSession.sessionId,
            userId: dbSession.userId,
            deviceInfo: dbSession.deviceInfo ? JSON.parse(dbSession.deviceInfo) : null,
            ipAddress: dbSession.ipAddress,
            userAgent: dbSession.userAgent,
            createdAt: dbSession.createdAt.toISOString(),
            lastUsedAt: dbSession.lastUsedAt?.toISOString() || dbSession.createdAt.toISOString()
          };
          
          // Try to sync back to Redis if available (non-blocking)
          try {
            await redisClient.setSession(validatedToken.sessionId, session, 7 * 24 * 60 * 60);
          } catch (syncError) {
            logger.debug('Failed to sync session to Redis (non-critical):', syncError.message);
          }
        }
      }
    } catch (redisError) {
      // Redis error - fallback to database
      logger.warn('Redis session retrieval error, falling back to database:', redisError.message);
      useDatabaseFallback = true;
      
      try {
        const dbSession = await database.getClient().session.findUnique({
          where: { 
            sessionId: validatedToken.sessionId,
            status: 'ACTIVE'
          }
        });
        
        if (dbSession && dbSession.expiresAt > new Date()) {
          session = {
            sessionId: dbSession.sessionId,
            userId: dbSession.userId,
            deviceInfo: dbSession.deviceInfo ? JSON.parse(dbSession.deviceInfo) : null,
            ipAddress: dbSession.ipAddress,
            userAgent: dbSession.userAgent,
            createdAt: dbSession.createdAt.toISOString(),
            lastUsedAt: dbSession.lastUsedAt?.toISOString() || dbSession.createdAt.toISOString()
          };
        }
      } catch (dbError) {
        logger.error('Database session retrieval error:', dbError);
        return res.status(500).json({
          success: false,
          message: 'Session service unavailable. Please try again later.'
        });
      }
    }
    
    // Validate session
    if (!session || session.userId !== validatedToken.userId) {
      logger.warn(`Session not found or mismatch for sessionId: ${validatedToken.sessionId}, userId: ${validatedToken.userId}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid session. Please log in again.'
      });
    }

    // Get user from database with permissions and role
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

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // IMPORTANT: Use the role from the database, not from the token
    // This ensures that if a user's role changes, they don't need to re-login
    // The token role is validated, but we use the database role for authorization
    // This prevents "Insufficient permissions" errors when role is updated
    
    // Log role mismatch for debugging (token role vs database role)
    if (validatedToken.role !== user.role) {
      logger.warn(`Role mismatch detected: Token has role ${validatedToken.role}, but database has role ${user.role} for user ${user.email}. Using database role.`);
    }

    // Only block SUSPENDED users - allow PENDING_VERIFICATION and INACTIVE
    // Rate limiting already handles abuse prevention
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Please contact support for assistance.'
      });
    }

    // Update session last used (non-blocking - don't fail auth if this fails)
    const updatedSession = {
      ...session,
      lastUsedAt: new Date().toISOString()
    };
    
    // Try to update in Redis first
    try {
      await redisClient.setSession(validatedToken.sessionId, updatedSession, 7 * 24 * 60 * 60);
    } catch (redisError) {
      logger.debug('Failed to update session in Redis (non-critical):', redisError.message);
    }
    
    // Always update in database (fallback and primary source)
    try {
      await database.getClient().session.update({
        where: { sessionId: validatedToken.sessionId },
        data: { lastUsedAt: new Date() }
      });
    } catch (dbError) {
      logger.warn('Failed to update session last used in database:', dbError.message);
      // Continue with authentication even if session update fails
    }

    req.user = user;
    req.sessionId = validatedToken.sessionId;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.warn('JWT verification failed:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      logger.warn('Token expired:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    // Handle Zod validation errors
    if (error.name === 'ZodError') {
      logger.warn('Token validation failed:', error.errors);
      return res.status(401).json({
        success: false,
        message: 'Invalid token format',
        details: error.errors
      });
    }

    logger.error('Authentication error:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // Return more specific error message
    const errorMessage = error.message || 'Authentication failed';
    const statusCode = error.statusCode || 500;
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage
    });
  }
};

// Helper function to check if user has permission (checks both role permissions and direct permissions)
const hasPermission = async (userId, resource, action) => {
  const user = await database.getClient().user.findUnique({
    where: { id: userId },
    include: {
      permissions: {
        include: {
          permission: true
        }
      }
    }
  });

  if (!user) return false;

  // ADMIN has all permissions
  if (user.role === 'ADMIN') {
    return true;
  }

  // Check direct user permissions
  const hasDirectPermission = user.permissions.some(
    userPerm => 
      userPerm.permission.resource === resource && 
      userPerm.permission.action === action
  );

  if (hasDirectPermission) {
    return true;
  }

  // Check role-based permissions
  // Find role by name matching user's role
  const role = await database.getClient().role.findUnique({
    where: { name: user.role },
    include: {
      permissions: true
    }
  });

  if (role) {
    const hasRolePermission = role.permissions.some(
      perm => perm.resource === resource && perm.action === action
    );
    if (hasRolePermission) {
      return true;
    }
  }

  return false;
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

    // Get the role from the database user object (not from token)
    // This ensures role changes take effect immediately without re-login
    const userRole = req.user.role;

    // Flatten roles array in case it's nested (e.g., authorize(['VENDOR']) creates [['VENDOR']])
    const flatRoles = roles.flat();

    // ADMIN can access any route guarded by authorize()
    if (userRole === 'ADMIN') {
      return next();
    }

    // Debug logging
    logger.debug(`Authorization check: User ${req.user.id} (${req.user.email}) has role ${userRole}, required roles: ${flatRoles.join(', ')}`);

    if (!flatRoles.includes(userRole)) {
      logger.warn(`Authorization failed: User ${req.user.id} (${req.user.email}) with role ${userRole} attempted to access route requiring roles: ${flatRoles.join(', ')}`);
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        details: {
          userRole,
          requiredRoles: flatRoles,
          userId: req.user.id,
          userEmail: req.user.email
        }
      });
    }

    next();
  };
};

// Permission-based authorization
const requirePermission = (resource, action) => {
  return async (req, res, next) => {
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

    // Check direct user permissions first
    const hasDirectPermission = req.user.permissions.some(
      userPerm => 
        userPerm.permission.resource === resource && 
        userPerm.permission.action === action
    );

    if (hasDirectPermission) {
      return next();
    }

    // Check role-based permissions
    const role = await database.getClient().role.findUnique({
      where: { name: req.user.role },
      include: {
        permissions: true
      }
    });

    if (role) {
      const hasRolePermission = role.permissions.some(
        perm => perm.resource === resource && perm.action === action
      );
      if (hasRolePermission) {
        return next();
      }
    }

    logger.warn(`Permission denied: User ${req.user.id} (${req.user.email}) with role ${req.user.role} attempted ${action} on ${resource}`);
    return res.status(403).json({
      success: false,
      message: `Permission denied: ${action} ${resource}`,
      details: {
        resource,
        action,
        userRole: req.user.role,
        userId: req.user.id
      }
    });
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

        // Allow non-SUSPENDED users for optional auth
        if (user && user.status !== 'SUSPENDED') {
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
  optionalAuth,
  hasPermission
};
