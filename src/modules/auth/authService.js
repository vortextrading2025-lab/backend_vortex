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
  username: z.string().optional(),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  pinCode: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  taxId: z.string().optional(),
  cinNumber: z.string().optional(),
  role: z.enum(['USER', 'VENDOR', 'MENTOR']).default('USER'), // Default to USER for signup form
  inviteCode: z.string().optional() // Optional invite code
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
  static async createSession(userId, deviceInfo, ipAddress, userAgent, refreshToken) {
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

    // Store in database with refreshToken
    await database.getClient().session.create({
      data: {
        sessionId,
        userId,
        deviceInfo: JSON.stringify(deviceInfo),
        ipAddress,
        userAgent,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    return sessionId;
  }

  // Register new user
  static async register(userData, files, ipAddress, userAgent) {
    try {
      const validatedData = registerSchema.parse(userData);

      // Check if user already exists
      const existingUser = await database.getClient().user.findUnique({
        where: { email: validatedData.email }
      });

      if (existingUser) {
        throw new Error('User already exists with this email');
      }

      // Check if username already exists (if provided)
      if (validatedData.username) {
        const existingUsername = await database.getClient().user.findUnique({
          where: { username: validatedData.username }
        });
        if (existingUsername) {
          throw new Error('Username already taken');
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 12);

      // Prepare file paths
      const taxIdProofPath = files?.taxIdProof?.[0]?.path || null;
      const cinProofPath = files?.cinProof?.[0]?.path || null;

      // Handle invite code if provided
      let inviteLink = null;
      if (validatedData.inviteCode) {
        const InviteService = require('../contract/inviteService');
        try {
          inviteLink = await InviteService.getInviteLinkByCode(validatedData.inviteCode);
          if (!inviteLink) {
            throw new Error('Invalid invite code');
          }
        } catch (error) {
          throw new Error(`Invalid invite code: ${error.message}`);
        }
      }

      // Create user first
      const user = await database.getClient().user.create({
        data: {
          email: validatedData.email,
          password: hashedPassword,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          username: validatedData.username || null,
          phone: validatedData.phone || null,
          role: validatedData.role,
          status: 'PENDING_VERIFICATION'
        }
      });
      console.log("user ==>", user);

      // Link user to invite if provided (inviter becomes mentor)
      if (inviteLink) {
        const InviteService = require('../contract/inviteService');
        await InviteService.useInviteLink(validatedData.inviteCode, user.id);
        logger.info(`User ${user.id} registered via invite code ${validatedData.inviteCode} from user ${inviteLink.inviterId}`);
      } else if (validatedData.role === 'USER') {
        // Auto-assign mentor for regular users (if no invite link)
        try {
          const PurchaseService = require('../../services/purchaseService');
          await PurchaseService.assignDefaultMentor(user.id);
        } catch (error) {
          logger.warn(`Could not auto-assign mentor to user: ${error.message}`);
          // Continue registration even if mentor assignment fails
        }
      }

      // Create profile based on role
      if (validatedData.role === 'VENDOR') {
        await database.getClient().vendorProfile.create({
          data: {
            userId: user.id,
            businessName: `${validatedData.firstName} ${validatedData.lastName}`,
            businessType: 'General',
            address: validatedData.addressLine1 || null,
            city: validatedData.addressLine2 || null, // Using addressLine2 as city
            state: validatedData.state || null,
            country: validatedData.country || null,
            zipCode: validatedData.pinCode || null,
            taxId: validatedData.taxId || null,
            taxIdProof: taxIdProofPath ? taxIdProofPath.replace(/\\/g, '/') : null, // Normalize path separators
            cinNumber: validatedData.cinNumber || null,
            cinProof: cinProofPath ? cinProofPath.replace(/\\/g, '/') : null // Normalize path separators
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

      // Generate sessionId and tokens (auto-login after registration)
      const sessionId = uuidv4();
      const { accessToken, refreshToken } = this.generateTokens(user.id, sessionId, user.role);

      // Create session data for Redis
      const sessionData = {
        sessionId,
        userId: user.id,
        deviceInfo: {
          userAgent,
          ip: ipAddress,
          timestamp: new Date().toISOString()
        },
        ipAddress,
        userAgent,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString()
      };

      // Store in Redis
      await redisClient.setSession(sessionId, sessionData, 7 * 24 * 60 * 60); // 7 days

      // Store in database WITH refreshToken
      await database.getClient().session.create({
        data: {
          sessionId,
          userId: user.id,
          deviceInfo: JSON.stringify(sessionData.deviceInfo),
          ipAddress,
          userAgent,
          refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      });

      // Store refresh token in RefreshToken table
      await database.getClient().refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      });

      // Send welcome email with verification link (best-effort)
      try {
        console.log('[Registration] Attempting to send welcome email to:', user.email);
        
        // Check if email service is enabled
        if (!EmailService.enabled) {
          console.warn('[Registration] Email service is disabled. BREVO_API_KEY may not be set.');
          logger.warn('Email service disabled - welcome email not sent');
        } else {
          const verificationToken = await this.createEmailVerificationToken(user.id);
          const verificationUrl = `${process.env.FRONTEND_URL || process.env.API_URL || 'http://localhost:3001'}/verify-email?token=${encodeURIComponent(verificationToken)}`;
          
          console.log('[Registration] Verification URL generated:', verificationUrl);
          
          // Send welcome email with verification link
          const emailResult = await EmailService.sendWelcomeEmail({
            to: user.email,
            firstName: user.firstName || 'there',
            verificationUrl
          });
          
          if (emailResult.sent) {
            console.log('[Registration] Welcome email sent successfully to:', user.email);
            logger.info(`Welcome email sent to: ${user.email}`);
          } else {
            console.error('[Registration] Failed to send welcome email:', emailResult.reason || emailResult.error);
            logger.error(`Failed to send welcome email to ${user.email}:`, emailResult.reason || emailResult.error);
          }
        }
      } catch (e) {
        console.error('[Registration] Error sending welcome email:', e?.message || e);
        console.error('[Registration] Error stack:', e?.stack);
        logger.error('Failed to send welcome email:', e);
      }

      return {
        success: true,
        message: 'User registered successfully',
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

  // Helper creates a short-lived email verification token and stores it in DB
  // Implemented using RefreshToken table for simplicity (separate type could be added)
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

  // Verify email using token
  static async verifyEmail(token) {
    try {
      // Find the verification token
      const tokenRecord = await database.getClient().refreshToken.findFirst({
        where: {
          token,
          isRevoked: false,
          expiresAt: { gt: new Date() }
        },
        include: { user: true }
      });

      if (!tokenRecord) {
        throw new Error('Invalid or expired verification token');
      }

      // Update user email as verified
      await database.getClient().user.update({
        where: { id: tokenRecord.userId },
        data: { emailVerified: true }
      });

      // Revoke the verification token
      await database.getClient().refreshToken.update({
        where: { id: tokenRecord.id },
        data: { isRevoked: true, revokedAt: new Date() }
      });

      // Log verification
      await AuditLogger.log({
        userId: tokenRecord.userId,
        action: 'UPDATE_PROFILE',
        message: 'Email verified successfully',
        details: { email: tokenRecord.user.email }
      });

      logger.info(`Email verified for user: ${tokenRecord.user.email}`);

      return {
        success: true,
        message: 'Email verified successfully',
        user: {
          id: tokenRecord.user.id,
          email: tokenRecord.user.email,
          emailVerified: true
        }
      };
    } catch (error) {
      logger.error('Email verification error:', error);
      throw error;
    }
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

      // Check user status - only block SUSPENDED accounts
      // Rate limiting already handles abuse, so we allow PENDING_VERIFICATION and INACTIVE to login
      if (user.status === 'SUSPENDED') {
        await AuditLogger.log({
          userId: user.id,
          action: 'LOGIN',
          level: 'WARN',
          message: 'Failed login attempt - account suspended',
          ipAddress,
          userAgent,
          details: { status: user.status }
        });
        throw new Error('Your account has been suspended. Please contact support for assistance.');
      }

      // Log non-active status logins for monitoring (but allow them to proceed)
      if (user.status !== 'ACTIVE') {
        await AuditLogger.log({
          userId: user.id,
          action: 'LOGIN',
          level: 'INFO',
          message: `Login with non-active status: ${user.status}`,
          ipAddress,
          userAgent,
          details: { status: user.status }
        });
        // Allow login to proceed - rate limiting will handle any abuse
      }

      // Generate sessionId first
      const sessionId = uuidv4();

      // Generate tokens with the sessionId
      const { accessToken, refreshToken } = this.generateTokens(user.id, sessionId, user.role);

      // Create session data for Redis
      const sessionData = {
        sessionId,
        userId: user.id,
        deviceInfo,
        ipAddress,
        userAgent,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString()
      };

      // Store in Redis
      await redisClient.setSession(sessionId, sessionData, 7 * 24 * 60 * 60); // 7 days

      // Store in database WITH refreshToken
      await database.getClient().session.create({
        data: {
          sessionId,
          userId: user.id,
          deviceInfo: JSON.stringify(deviceInfo),
          ipAddress,
          userAgent,
          refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      });

      // Store refresh token in RefreshToken table
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
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          throw new Error('Refresh token expired. Please log in again.');
        }
        if (error.name === 'JsonWebTokenError') {
          throw new Error('Invalid refresh token');
        }
        throw error;
      }
      
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

      // Only block SUSPENDED users from refreshing tokens
      if (tokenRecord.user.status === 'SUSPENDED') {
        throw new Error('Your account has been suspended. Please contact support for assistance.');
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

  // Logout user - clear all sessions
  static async logout(userId, sessionId, ipAddress, userAgent) {
    try {
      // Get all active sessions for this user
      const allSessions = await database.getClient().session.findMany({
        where: { userId, status: 'ACTIVE' }
      });

      // Revoke all sessions in Redis
      for (const session of allSessions) {
        await redisClient.deleteSession(session.sessionId);
      }

      // Update all sessions in database to REVOKED
      await database.getClient().session.updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { status: 'REVOKED' }
      });

      // Revoke all refresh tokens for this user
      await database.getClient().refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() }
      });

      // Log logout
      await AuditLogger.logLogout(userId, ipAddress, userAgent);

      logger.info(`User logged out from all sessions: ${userId}`);

      return {
        success: true,
        message: 'Logout successful - all sessions cleared'
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