const express = require('express');
const { z } = require('zod');
const database = require('../../config/database');
const { authenticate, authorize, requirePermission } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/rateLimit');
const AuditLogger = require('../logging/auditLogger');
const AuthService = require('../auth/authService');
const { 
  successResponse, 
  errorResponse, 
  validationErrorResponse, 
  authErrorResponse,
  notFoundErrorResponse,
  serverErrorResponse,
  databaseErrorResponse,
  paginationMeta 
} = require('../../utils/response');

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// Validation schemas
const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  avatar: z.string().url().optional()
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get user profile
 *     description: Get detailed user profile with permissions and role-specific profiles
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "User profile retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     avatar:
 *                       type: string
 *                     role:
 *                       type: string
 *                     status:
 *                       type: string
 *                     emailVerified:
 *                       type: boolean
 *                     phoneVerified:
 *                       type: boolean
 *                     vendorProfile:
 *                       type: object
 *                       nullable: true
 *                     mentorProfile:
 *                       type: object
 *                       nullable: true
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await database.getClient().user.findUnique({
      where: { id: req.user.id },
      include: {
        vendorProfile: true,
        mentorProfile: true,
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    if (!user) {
      return notFoundErrorResponse(res, 'User');
    }

    return successResponse(
      res,
      200,
      'User profile retrieved successfully',
      {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        vendorProfile: user.vendorProfile,
        mentorProfile: user.mentorProfile,
        permissions: user.permissions.map(p => ({
          resource: p.permission.resource,
          action: p.permission.action
        }))
      }
    );
  } catch (error) {
    if (error.code && error.code.startsWith('P')) {
      return databaseErrorResponse(res, error);
    }
    return serverErrorResponse(res, 'Failed to retrieve user profile', error);
  }
});

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update user profile
 *     description: Update user profile information including avatar
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *           example:
 *             firstName: "John"
 *             lastName: "Doe"
 *             phone: "+1234567890"
 *             avatar: "https://example.com/new-avatar.jpg"
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               success: true
 *               message: "Profile updated successfully"
 *               data:
 *                 id: "clx1234567890abcdef"
 *                 email: "user@example.com"
 *                 firstName: "John"
 *                 lastName: "Doe"
 *                 phone: "+1234567890"
 *                 avatar: "https://example.com/new-avatar.jpg"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "Validation error: Invalid email format"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "Access token required"
 */
router.put('/profile', authenticate, async (req, res) => {
  try {
    const validatedData = updateProfileSchema.parse(req.body);
    const { ipAddress, userAgent } = getClientInfo(req);

    const user = await database.getClient().user.update({
      where: { id: req.user.id },
      data: validatedData
    });

    // Log the action
    await AuditLogger.logUserAction(
      req.user.id,
      'UPDATE_PROFILE',
      'User',
      req.user.id,
      validatedData,
      ipAddress,
      userAgent
    );

    return successResponse(
      res,
      200,
      'Profile updated successfully',
      {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatar: user.avatar
      }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse(res, error.errors);
    }
    
    if (error.code && error.code.startsWith('P')) {
      return databaseErrorResponse(res, error);
    }
    
    return serverErrorResponse(res, 'Failed to update profile', error);
  }
});

/**
 * @swagger
 * /api/users/change-password:
 *   post:
 *     summary: Change user password
 *     description: Change the authenticated user's password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *           example:
 *             currentPassword: "OldPassword123!"
 *             newPassword: "NewPassword123!"
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Validation error or incorrect current password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const validatedData = changePasswordSchema.parse(req.body);
    const { ipAddress, userAgent } = getClientInfo(req);

    // Get current user with password
    const user = await database.getClient().user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const bcrypt = require('bcryptjs');
    const isCurrentPasswordValid = await bcrypt.compare(
      validatedData.currentPassword, 
      user.password
    );

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(validatedData.newPassword, 12);

    // Update password
    await database.getClient().user.update({
      where: { id: req.user.id },
      data: { password: hashedNewPassword }
    });

    // Log the action
    await AuditLogger.logUserAction(
      req.user.id,
      'CHANGE_PASSWORD',
      'User',
      req.user.id,
      { passwordChanged: true },
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: `Validation error: ${error.errors.map(e => e.message).join(', ')}`
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     description: Get paginated list of all users with filtering options
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [USER, VENDOR, MENTOR, ADMIN]
 *         description: Filter by role
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, SUSPENDED, PENDING_VERIFICATION]
 *         description: Filter by status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by email, first name, or last name
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { page = 1, limit = 10, role, status, search } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [users, total] = await Promise.all([
      database.getClient().user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          emailVerified: true,
          phoneVerified: true,
          lastLoginAt: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        skip: parseInt(skip),
        take: parseInt(limit)
      }),
      database.getClient().user.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID (Admin only)
 *     description: Get detailed user information by user ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: User not found
 */
router.get('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const user = await database.getClient().user.findUnique({
      where: { id: req.params.id },
      include: {
        vendorProfile: true,
        mentorProfile: true,
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/users/{id}/status:
 *   put:
 *     summary: Update user status (Admin only)
 *     description: Update a user's status (ACTIVE, INACTIVE, SUSPENDED, PENDING_VERIFICATION)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, SUSPENDED, PENDING_VERIFICATION]
 *                 example: ACTIVE
 *     responses:
 *       200:
 *         description: User status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: User not found
 */
router.put('/:id/status', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { status } = req.body;
    const { ipAddress, userAgent } = getClientInfo(req);

    if (!['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const user = await database.getClient().user.update({
      where: { id: req.params.id },
      data: { status }
    });

    // Log the action
    await AuditLogger.logUserAction(
      req.user.id,
      'UPDATE_USER',
      'User',
      req.params.id,
      { status },
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      message: 'User status updated successfully',
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/users/{id}/role:
 *   put:
 *     summary: Update user role (Admin only)
 *     description: Update a user's role (USER, VENDOR, MENTOR, ADMIN)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [USER, VENDOR, MENTOR, ADMIN]
 *                 example: VENDOR
 *     responses:
 *       200:
 *         description: User role updated successfully
 *       400:
 *         description: Invalid role
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: User not found
 */
router.put('/:id/role', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { role } = req.body;
    const { ipAddress, userAgent } = getClientInfo(req);

    if (!['USER', 'VENDOR', 'MENTOR', 'ADMIN'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    // Get current user to check if they have vendor/mentor profile
    const currentUser = await database.getClient().user.findUnique({
      where: { id: req.params.id },
      include: {
        vendorProfile: true,
        mentorProfile: true
      }
    });

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user role
    const user = await database.getClient().user.update({
      where: { id: req.params.id },
      data: { role }
    });

    // Create or remove role-specific profiles
    if (role === 'VENDOR' && !currentUser.vendorProfile) {
      await database.getClient().vendorProfile.create({
        data: {
          userId: user.id,
          businessName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Business',
          businessType: 'General'
        }
      });
    } else if (role === 'MENTOR' && !currentUser.mentorProfile) {
      await database.getClient().mentorProfile.create({
        data: {
          userId: user.id,
          expertise: [],
          experience: 0
        }
      });
    }

    // Log the action
    await AuditLogger.logUserAction(
      req.user.id,
      'ASSIGN_ROLE',
      'User',
      req.params.id,
      { role, previousRole: currentUser.role },
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/users/avatar:
 *   put:
 *     summary: Update user avatar
 *     description: Update only the user's avatar image URL
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AvatarUpdateRequest'
 *           example:
 *             avatar: "https://example.com/new-avatar.jpg"
 *     responses:
 *       200:
 *         description: Avatar updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *             example:
 *               success: true
 *               message: "Avatar updated successfully"
 *               data:
 *                 id: "clx1234567890abcdef"
 *                 avatar: "https://example.com/new-avatar.jpg"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "Validation error: Invalid URL format"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "Access token required"
 */
router.put('/avatar', authenticate, async (req, res) => {
  try {
    const { avatar } = req.body;
    
    if (!avatar) {
      return errorResponse(res, 400, 'Avatar URL is required');
    }

    // Validate URL format
    try {
      new URL(avatar);
    } catch (error) {
      return errorResponse(res, 400, 'Invalid avatar URL format');
    }

    const { ipAddress, userAgent } = getClientInfo(req);

    const user = await database.getClient().user.update({
      where: { id: req.user.id },
      data: { avatar }
    });

    // Log the action
    await AuditLogger.logUserAction(
      req.user.id,
      'UPDATE_PROFILE',
      'User',
      req.user.id,
      { avatar },
      ipAddress,
      userAgent
    );

    return successResponse(
      res,
      200,
      'Avatar updated successfully',
      {
        id: user.id,
        avatar: user.avatar
      }
    );
  } catch (error) {
    if (error.code && error.code.startsWith('P')) {
      return databaseErrorResponse(res, error);
    }
    return serverErrorResponse(res, 'Failed to update avatar', error);
  }
});

/**
 * @swagger
 * /api/users/active-sessions:
 *   get:
 *     summary: Get active sessions
 *     description: Get all active sessions for the current user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active sessions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActiveSessionsResponse'
 *             example:
 *               success: true
 *               message: "Active sessions retrieved successfully"
 *               data:
 *                 sessions:
 *                   - sessionId: "sess_1234567890abcdef"
 *                     deviceInfo:
 *                       userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
 *                       ip: "192.168.1.1"
 *                       timestamp: "2024-01-15T10:30:00Z"
 *                     ipAddress: "192.168.1.1"
 *                     userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
 *                     location: "New York, US"
 *                     lastUsedAt: "2024-01-15T10:30:00Z"
 *                     createdAt: "2024-01-15T09:00:00Z"
 *                 totalSessions: 3
 *                 currentSession: "sess_1234567890abcdef"
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
router.get('/active-sessions', authenticate, async (req, res) => {
  try {
    const sessions = await AuthService.getUserSessions(req.user.id);
    
    return successResponse(
      res,
      200,
      'Active sessions retrieved successfully',
      {
        sessions,
        totalSessions: sessions.length,
        currentSession: req.sessionId
      }
    );
  } catch (error) {
    return serverErrorResponse(res, 'Failed to retrieve active sessions', error);
  }
});

// Helper function to get client info
const getClientInfo = (req) => {
  const userAgent = req.get('User-Agent') || '';
  const ipAddress = req.ip || req.connection.remoteAddress;
  
  return { ipAddress, userAgent };
};

module.exports = { router };
