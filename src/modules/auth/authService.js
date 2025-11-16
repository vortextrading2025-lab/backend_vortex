const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const database = require('../../config/database');
const redisClient = require('../../config/redis');
const AuditLogger = require('../logging/auditLogger');
const logger = require('../logging/logger');
const EmailService = require('../../services/emailService');

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['USER', 'VENDOR', 'MENTOR']).default('USER')
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1)
});

class AuthService {
  // Generate JWT tokens
  static generateTokens(userId, sessionId, role) {
    const accessToken = jwt.sign(
      { userId, sessionId, role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '15m' }
    );

    const refreshToken = jwt.sign(
      { userId, sessionId, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
    );

    return { accessToken, refreshToken };
  }

  // Create session
  static async createSession(userId, deviceInfo, ipAddress, userAgent) {
    const sessionId = uuidv4();
    const sessionData = {
      sessionId,
      userId,
      deviceInfo,
      ipAddress,
      userAgent,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString()
    };

    // Store in Redis
    await redisClient.setSession(sessionId, sessionData, 7 * 24 * 60 * 60); // 7 days

    // Store in database
    await database.getClient().session.create({
      data: {
        sessionId,
        userId,
        deviceInfo: JSON.stringify(deviceInfo),
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    return sessionId;
  }

  // Register new user
  static async register(userData, ipAddress, userAgent) {
    try {
      const validatedData = registerSchema.parse(userData);

      // Check if user already exists
      const existingUser = await database.getClient().user.findUnique({
        where: { email: validatedData.email }
      });

      if (existingUser) {
        throw new Error('User already exists with this email');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 12);

      // Create user
      const user = await database.getClient().user.create({
        data: {
          email: validatedData.email,
          password: hashedPassword,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          role: validatedData.role,
          status: 'PENDING_VERIFICATION'
        }
      });
      console.log("user ==>",user)
      // Create profile based on role
      if (validatedData.role === 'VENDOR') {
        await database.getClient().vendorProfile.create({
          data: {
            userId: user.id,
            businessName: `${validatedData.firstName} ${validatedData.lastName}`,
            businessType: 'General'
          }
        });
      } else if (validatedData.role === 'MENTOR') {
        await database.getClient().mentorProfile.create({
          data: {
            userId: user.id,
            expertise: [],
            experience: 0
          }
        });
      }

      // Log registration
      await AuditLogger.log({
        userId: user.id,
        action: 'REGISTER',
        message: 'User registered successfully',
        ipAddress,
        userAgent,
        details: { role: validatedData.role }
      });

      logger.info(`New user registered: ${user.email} with role: ${user.role}`);

      // Send verification email (best-effort)
      try {
        const verificationUrl = `${process.env.API_URL || 'http://localhost:3000'}/api/auth/verify-email?token=${encodeURIComponent(
          await this.createEmailVerificationToken(user.id)
        )}`;
        await EmailService.sendVerificationEmail({
          to: user.email,
          verificationUrl,
          firstName: user.firstName || 'there'
        });
      } catch (e) {
        console.warn('Failed to send verification email:', e?.message || e);
      }

      return {
        success: true,
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: user.status
        }
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
      // helper creates a short-lived email verification token and stores it in DB
      // Implemented using RefreshToken table for simplicity (separate type could be added)
  }

  static async createEmailVerificationToken(userId) {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
    await database.getClient().refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
        isRevoked: false
      }
    });
    return token;
  }

  // Login user
  static async login(credentials, ipAddress, userAgent, deviceInfo) {
    try {
      const validatedData = loginSchema.parse(credentials);

      // Find user
      const user = await database.getClient().user.findUnique({
        where: { email: validatedData.email },
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        }
      });

      if (!user) {
        await AuditLogger.log({
          action: 'LOGIN',
          level: 'WARN',
          message: 'Failed login attempt - user not found',
          ipAddress,
          userAgent,
          details: { email: validatedData.email }
        });
        throw new Error('Invalid credentials');
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(validatedData.password, user.password);
      if (!isPasswordValid) {
        await AuditLogger.log({
          userId: user.id,
          action: 'LOGIN',
          level: 'WARN',
          message: 'Failed login attempt - invalid password',
          ipAddress,
          userAgent
        });
        throw new Error('Invalid credentials');
      }

      // Check user status
     
        await AuditLogger.log({
          userId: user.id,
          action: 'LOGIN',
          level: 'WARN',
          message: 'Failed login attempt - user not active',
          ipAddress,
          userAgent,
          details: { status: user.status }
        });
      

      // Create session
      const sessionId = await this.createSession(user.id, deviceInfo, ipAddress, userAgent);

      // Generate tokens
      const { accessToken, refreshToken } = this.generateTokens(user.id, sessionId, user.role);

      // Store refresh token
      await database.getClient().refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      });

      // Update user last login
      await database.getClient().user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          lastLoginIp: ipAddress,
          lastLoginUserAgent: userAgent
        }
      });

      // Log successful login
      await AuditLogger.logLogin(user.id, ipAddress, userAgent, true);

      logger.info(`User logged in: ${user.email}`);

      return {
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            status: user.status
          },
          accessToken,
          refreshToken,
          sessionId
        }
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  // Refresh access token
  static async refreshToken(refreshTokenData) {
    try {
      const { refreshToken } = refreshTokenSchema.parse(refreshTokenData);

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      // Check if refresh token exists in database
      const tokenRecord = await database.getClient().refreshToken.findFirst({
        where: {
          token: refreshToken,
          isRevoked: false,
          expiresAt: { gt: new Date() }
        },
        include: { user: true }
      });

      if (!tokenRecord) {
        throw new Error('Invalid or expired refresh token');
      }

      // Check if user is still active
      if (tokenRecord.user.status !== 'ACTIVE') {
        throw new Error('User account is not active');
      }

      // Get session
      const session = await redisClient.getSession(decoded.sessionId);
      if (!session || session.userId !== decoded.userId) {
        throw new Error('Invalid session');
      }

      // Generate new access token
      const { accessToken } = this.generateTokens(
        decoded.userId, 
        decoded.sessionId, 
        tokenRecord.user.role
      );

      // Update session last used
      await redisClient.setSession(decoded.sessionId, {
        ...session,
        lastUsedAt: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Token refreshed successfully',
        data: { accessToken }
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  // Logout user
  static async logout(userId, sessionId, ipAddress, userAgent) {
    try {
      // Revoke session in Redis
      await redisClient.deleteSession(sessionId);

      // Update session in database
      await database.getClient().session.updateMany({
        where: { sessionId, userId },
        data: { status: 'REVOKED' }
      });

      // Revoke all refresh tokens for this user
      await database.getClient().refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true, revokedAt: new Date() }
      });

      // Log logout
      await AuditLogger.logLogout(userId, ipAddress, userAgent);

      logger.info(`User logged out: ${userId}`);

      return {
        success: true,
        message: 'Logout successful'
      };
    } catch (error) {
      logger.error('Logout error:', error);
      throw error;
    }
  }

  // Logout from all sessions
  static async logoutAllSessions(userId, ipAddress, userAgent) {
    try {
      // Get all active sessions
      const sessions = await database.getClient().session.findMany({
        where: { userId, status: 'ACTIVE' }
      });

      // Revoke all sessions in Redis
      for (const session of sessions) {
        await redisClient.deleteSession(session.sessionId);
      }

      // Update all sessions in database
      await database.getClient().session.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'REVOKED' }
      });

      // Revoke all refresh tokens
      await database.getClient().refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true, revokedAt: new Date() }
      });

      // Log action
      await AuditLogger.log({
        userId,
        action: 'LOGOUT',
        message: 'User logged out from all sessions',
        ipAddress,
        userAgent
      });

      logger.info(`User logged out from all sessions: ${userId}`);

      return {
        success: true,
        message: 'Logged out from all sessions successfully'
      };
    } catch (error) {
      logger.error('Logout all sessions error:', error);
      throw error;
    }
  }

  // Get user sessions
  static async getUserSessions(userId) {
    try {
      const sessions = await database.getClient().session.findMany({
        where: { userId, status: 'ACTIVE' },
        orderBy: { lastUsedAt: 'desc' }
      });

      return sessions.map(session => ({
        sessionId: session.sessionId,
        deviceInfo: session.deviceInfo ? JSON.parse(session.deviceInfo) : null,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        location: session.location,
        lastUsedAt: session.lastUsedAt,
        createdAt: session.createdAt
      }));
    } catch (error) {
      logger.error('Get user sessions error:', error);
      throw error;
    }
  }

  // Revoke specific session
  static async revokeSession(userId, sessionId, ipAddress, userAgent) {
    try {
      // Revoke session in Redis
      await redisClient.deleteSession(sessionId);

      // Update session in database
      await database.getClient().session.updateMany({
        where: { sessionId, userId },
        data: { status: 'REVOKED' }
      });

      // Log action
      await AuditLogger.log({
        userId,
        action: 'REVOKE_SESSION',
        message: 'Session revoked',
        ipAddress,
        userAgent,
        details: { sessionId }
      });

      return {
        success: true,
        message: 'Session revoked successfully'
      };
    } catch (error) {
      logger.error('Revoke session error:', error);
      throw error;
    }
  }
}

module.exports = AuthService;
