const express = require('express');
const { z } = require('zod');
const AuthService = require('./authService');
const { authenticate, authorize } = require('../../middleware/auth');
const { authLimiter, passwordResetLimiter } = require('../../middleware/rateLimit');
const AuditLogger = require('../logging/auditLogger');
const { 
  successResponse, 
  errorResponse, 
  validationErrorResponse, 
  authErrorResponse,
  serverErrorResponse,
  databaseErrorResponse 
} = require('../../utils/response');

const router = express.Router();

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

// Helper function to get client info
const getClientInfo = (req) => {
  const userAgent = req.get('User-Agent') || '';
  const ipAddress = req.ip || req.connection.remoteAddress;
  
  return {
    ipAddress,
    userAgent,
    deviceInfo: {
      userAgent,
      ip: ipAddress,
      timestamp: new Date().toISOString()
    }
  };
};

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Create a new user account with email, password, and basic information
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *           examples:
 *             user:
 *               summary: Regular user registration
 *               value:
 *                 email: "user@example.com"
 *                 password: "SecurePass123!"
 *                 firstName: "John"
 *                 lastName: "Doe"
 *                 role: "USER"
 *             vendor:
 *               summary: Vendor registration
 *               value:
 *                 email: "vendor@example.com"
 *                 password: "SecurePass123!"
 *                 firstName: "Jane"
 *                 lastName: "Smith"
 *                 role: "VENDOR"
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *             example:
 *               success: true
 *               message: "User registered successfully"
 *               data:
 *                 user:
 *                   id: "clx1234567890abcdef"
 *                   email: "user@example.com"
 *                   firstName: "John"
 *                   lastName: "Doe"
 *                   role: "USER"
 *                   status: "ACTIVE"
 *                   emailVerified: false
 *                   phoneVerified: false
 *                   createdAt: "2024-01-01T00:00:00Z"
 *                 accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 sessionId: "sess_1234567890abcdef"
 *       400:
 *         description: Validation error or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "Email already exists"
 *       429:
 *         description: Too many registration attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "Too many registration attempts, please try again later"
 */
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { ipAddress, userAgent, deviceInfo } = getClientInfo(req);
    
    const result = await AuthService.register(req.body, ipAddress, userAgent);
    console.log("result ==>",result)
    return successResponse(
      res, 
      201, 
      'User registered successfully', 
      {
        user: result.data.user,
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        sessionId: result.data.sessionId
      }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse(res, error.errors);
    }
    
    if (error.code && error.code.startsWith('P')) {
      return databaseErrorResponse(res, error);
    }
    
    return errorResponse(res, 400, error.message);
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticate user with email and password, returns access token and sets refresh token cookie
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           example:
 *             email: "user@example.com"
 *             password: "SecurePass123!"
 *     responses:
 *       200:
 *         description: Login successful
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               example: refreshToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; HttpOnly; Secure; SameSite=Strict
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *             example:
 *               success: true
 *               message: "Login successful"
 *               data:
 *                 user:
 *                   id: "clx1234567890abcdef"
 *                   email: "user@example.com"
 *                   firstName: "John"
 *                   lastName: "Doe"
 *                   role: "USER"
 *                   status: "ACTIVE"
 *                   emailVerified: true
 *                   phoneVerified: false
 *                   lastLoginAt: "2024-01-15T10:30:00Z"
 *                   createdAt: "2024-01-01T00:00:00Z"
 *                 accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 sessionId: "sess_1234567890abcdef"
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "Invalid email or password"
 *       429:
 *         description: Too many login attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "Too many authentication attempts, please try again later"
 */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { ipAddress, userAgent, deviceInfo } = getClientInfo(req);
    
    const result = await AuthService.login(req.body, ipAddress, userAgent, deviceInfo);
    
    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return successResponse(
      res,
      200,
      'Login successful',
      {
        user: result.data.user,
        accessToken: result.data.accessToken,
        sessionId: result.data.sessionId
      }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse(res, error.errors);
    }
    
    if (error.code && error.code.startsWith('P')) {
      return databaseErrorResponse(res, error);
    }
    
    return authErrorResponse(res, error.message);
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
    
    if (!refreshToken) {
      return authErrorResponse(res, 'Refresh token required');
    }

    const result = await AuthService.refreshToken({ refreshToken });
    
    return successResponse(
      res,
      200,
      'Token refreshed successfully',
      result.data
    );
  } catch (error) {
    return authErrorResponse(res, error.message);
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', authenticate, async (req, res) => {
  try {
    const { ipAddress, userAgent } = getClientInfo(req);
    
    const result = await AuthService.logout(
      req.user.id, 
      req.sessionId, 
      ipAddress, 
      userAgent
    );
    
    // Clear refresh token cookie
    res.clearCookie('refreshToken');
    
    return successResponse(
      res,
      200,
      'Logout successful',
      result.data
    );
  } catch (error) {
    return serverErrorResponse(res, 'Logout failed', error);
  }
});

// @route   POST /api/auth/logout-all
// @desc    Logout from all sessions
// @access  Private
router.post('/logout-all', authenticate, async (req, res) => {
  try {
    const { ipAddress, userAgent } = getClientInfo(req);
    
    const result = await AuthService.logoutAllSessions(
      req.user.id, 
      ipAddress, 
      userAgent
    );
    
    // Clear refresh token cookie
    res.clearCookie('refreshToken');
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/auth/sessions:
 *   get:
 *     summary: Get user sessions
 *     description: Get all active sessions for the current user with device information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sessions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SessionInfo'
 *             example:
 *               success: true
 *               data:
 *                 - sessionId: "sess_1234567890abcdef"
 *                   deviceInfo:
 *                     userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
 *                     ip: "192.168.1.1"
 *                     timestamp: "2024-01-15T10:30:00Z"
 *                   ipAddress: "192.168.1.1"
 *                   userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
 *                   location: "New York, US"
 *                   lastUsedAt: "2024-01-15T10:30:00Z"
 *                   createdAt: "2024-01-15T09:00:00Z"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "Access token required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "Internal server error"
 */
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const sessions = await AuthService.getUserSessions(req.user.id);
    
    return successResponse(
      res,
      200,
      'Sessions retrieved successfully',
      { sessions }
    );
  } catch (error) {
    return serverErrorResponse(res, 'Failed to retrieve sessions', error);
  }
});

// @route   DELETE /api/auth/sessions/:sessionId
// @desc    Revoke specific session
// @access  Private
router.delete('/sessions/:sessionId', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { ipAddress, userAgent } = getClientInfo(req);
    
    const result = await AuthService.revokeSession(
      req.user.id, 
      sessionId, 
      ipAddress, 
      userAgent
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await req.user;
    
    return successResponse(
      res,
      200,
      'User profile retrieved successfully',
      {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt
      }
    );
  } catch (error) {
    return serverErrorResponse(res, 'Failed to retrieve user profile', error);
  }
});

module.exports = { router };
