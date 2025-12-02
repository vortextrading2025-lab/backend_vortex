const express = require('express');
const { z } = require('zod');
const database = require('../../config/database');
const { authenticate, authorize, requirePermission } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/rateLimit');
const AuditLogger = require('../logging/auditLogger');

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('ADMIN'));

// Validation schemas
const createPermissionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  resource: z.string().min(1),
  action: z.string().min(1)
});

const assignPermissionSchema = z.object({
  userId: z.string().min(1),
  permissionId: z.string().min(1)
});

const createRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).optional()
});

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get system statistics
 *     description: Get comprehensive system statistics including user counts, sessions, and audit logs
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
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
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         active:
 *                           type: integer
 *                         byRole:
 *                           type: array
 *                     sessions:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         active:
 *                           type: integer
 *                     auditLogs:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                     recentLogins:
 *                       type: array
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalSessions,
      activeSessions,
      totalAuditLogs,
      usersByRole,
      recentLogins
    ] = await Promise.all([
      database.getClient().user.count(),
      database.getClient().user.count({ where: { status: 'ACTIVE' } }),
      database.getClient().session.count(),
      database.getClient().session.count({ where: { status: 'ACTIVE' } }),
      database.getClient().auditLog.count(),
      database.getClient().user.groupBy({
        by: ['role'],
        _count: { role: true }
      }),
      database.getClient().user.findMany({
        where: { lastLoginAt: { not: null } },
        orderBy: { lastLoginAt: 'desc' },
        take: 10,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          lastLoginAt: true
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          byRole: usersByRole
        },
        sessions: {
          total: totalSessions,
          active: activeSessions
        },
        auditLogs: {
          total: totalAuditLogs
        },
        recentLogins
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
 * /api/admin/audit-logs:
 *   get:
 *     summary: Get audit logs
 *     description: Get paginated audit logs with filtering options
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action
 *       - in: query
 *         name: resource
 *         schema:
 *           type: string
 *         description: Filter by resource
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [INFO, WARN, ERROR]
 *         description: Filter by log level
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date filter
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date filter
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
 *           default: 50
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     auditLogs:
 *                       type: array
 *                     pagination:
 *                       type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const {
      userId,
      action,
      resource,
      level,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    const offset = (page - 1) * limit;

    const auditLogs = await AuditLogger.getAuditLogs({
      userId,
      action,
      resource,
      level,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const total = await database.getClient().auditLog.count({
      where: {
        ...(userId && { userId }),
        ...(action && { action }),
        ...(resource && { resource }),
        ...(level && { level }),
        ...(startDate || endDate ? {
          createdAt: {
            ...(startDate && { gte: new Date(startDate) }),
            ...(endDate && { lte: new Date(endDate) })
          }
        } : {})
      }
    });

    res.json({
      success: true,
      data: {
        auditLogs,
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
 * /api/admin/permissions:
 *   get:
 *     summary: Get all permissions
 *     description: Get list of all available permissions
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permissions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/permissions', async (req, res) => {
  try {
    const permissions = await database.getClient().permission.findMany({
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      data: permissions
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
 * /api/admin/permissions:
 *   post:
 *     summary: Create new permission
 *     description: Create a new permission with resource and action
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, resource, action]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Read Users"
 *               description:
 *                 type: string
 *                 example: "Permission to read user data"
 *               resource:
 *                 type: string
 *                 example: "users"
 *               action:
 *                 type: string
 *                 example: "read"
 *     responses:
 *       201:
 *         description: Permission created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post('/permissions', async (req, res) => {
  try {
    const validatedData = createPermissionSchema.parse(req.body);
    const { ipAddress, userAgent } = getClientInfo(req);

    const permission = await database.getClient().permission.create({
      data: validatedData
    });

    // Log the action
    await AuditLogger.logUserAction(
      req.user.id,
      'CREATE_PERMISSION',
      'Permission',
      permission.id,
      validatedData,
      ipAddress,
      userAgent
    );

    res.status(201).json({
      success: true,
      message: 'Permission created successfully',
      data: permission
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
 * /api/admin/permissions/assign:
 *   post:
 *     summary: Assign permission to user
 *     description: Assign a permission to a specific user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, permissionId]
 *             properties:
 *               userId:
 *                 type: string
 *                 example: "clx1234567890abcdef"
 *               permissionId:
 *                 type: string
 *                 example: "clx9876543210fedcba"
 *     responses:
 *       201:
 *         description: Permission assigned successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: User or permission not found
 */
router.post('/permissions/assign', async (req, res) => {
  try {
    const validatedData = assignPermissionSchema.parse(req.body);
    const { ipAddress, userAgent } = getClientInfo(req);

    // Check if user exists
    const user = await database.getClient().user.findUnique({
      where: { id: validatedData.userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if permission exists
    const permission = await database.getClient().permission.findUnique({
      where: { id: validatedData.permissionId }
    });

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Permission not found'
      });
    }

    // Assign permission
    const userPermission = await database.getClient().userPermission.create({
      data: {
        userId: validatedData.userId,
        permissionId: validatedData.permissionId,
        grantedBy: req.user.id
      }
    });

    // Log the action
    await AuditLogger.logUserAction(
      req.user.id,
      'ASSIGN_PERMISSION',
      'UserPermission',
      userPermission.id,
      validatedData,
      ipAddress,
      userAgent
    );

    res.status(201).json({
      success: true,
      message: 'Permission assigned successfully',
      data: userPermission
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
 * /api/admin/permissions/{userId}/{permissionId}:
 *   delete:
 *     summary: Revoke permission from user
 *     description: Revoke a permission from a specific user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: path
 *         name: permissionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Permission ID
 *     responses:
 *       200:
 *         description: Permission revoked successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.delete('/permissions/:userId/:permissionId', async (req, res) => {
  try {
    const { userId, permissionId } = req.params;
    const { ipAddress, userAgent } = getClientInfo(req);

    await database.getClient().userPermission.deleteMany({
      where: {
        userId,
        permissionId
      }
    });

    // Log the action
    await AuditLogger.logUserAction(
      req.user.id,
      'REVOKE_PERMISSION',
      'UserPermission',
      `${userId}-${permissionId}`,
      { userId, permissionId },
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      message: 'Permission revoked successfully'
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
 * /api/admin/roles:
 *   get:
 *     summary: Get all roles
 *     description: Get list of all roles with their permissions
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Roles retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/roles', async (req, res) => {
  try {
    const roles = await database.getClient().role.findMany({
      include: {
        permissions: true
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      data: roles
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
 * /api/admin/roles:
 *   post:
 *     summary: Create new role
 *     description: Create a new role with optional permissions
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Moderator"
 *               description:
 *                 type: string
 *                 example: "Moderator role with limited permissions"
 *               permissionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["perm1", "perm2"]
 *     responses:
 *       201:
 *         description: Role created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post('/roles', async (req, res) => {
  try {
    const validatedData = createRoleSchema.parse(req.body);
    const { ipAddress, userAgent } = getClientInfo(req);

    const role = await database.getClient().role.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        permissions: validatedData.permissionIds ? {
          connect: validatedData.permissionIds.map(id => ({ id }))
        } : undefined
      }
    });

    // Log the action
    await AuditLogger.logUserAction(
      req.user.id,
      'CREATE_ROLE',
      'Role',
      role.id,
      validatedData,
      ipAddress,
      userAgent
    );

    res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: role
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
 * /api/admin/sessions:
 *   get:
 *     summary: Get all active sessions
 *     description: Get paginated list of all active user sessions
 *     tags: [Admin]
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
 *           default: 50
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Sessions retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get('/sessions', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      database.getClient().session.findMany({
        where: { status: 'ACTIVE' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true
            }
          }
        },
        orderBy: { lastUsedAt: 'desc' },
        skip: parseInt(offset),
        take: parseInt(limit)
      }),
      database.getClient().session.count({ where: { status: 'ACTIVE' } })
    ]);

    res.json({
      success: true,
      data: {
        sessions: sessions.map(session => ({
          ...session,
          deviceInfo: session.deviceInfo ? JSON.parse(session.deviceInfo) : null
        })),
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
 * /api/admin/sessions/{sessionId}:
 *   delete:
 *     summary: Revoke session (Admin only)
 *     description: Revoke a specific user session by session ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID to revoke
 *     responses:
 *       200:
 *         description: Session revoked successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { ipAddress, userAgent } = getClientInfo(req);

    // Update session status
    await database.getClient().session.updateMany({
      where: { sessionId },
      data: { status: 'REVOKED' }
    });

    // Log the action
    await AuditLogger.logUserAction(
      req.user.id,
      'REVOKE_SESSION',
      'Session',
      sessionId,
      { sessionId },
      ipAddress,
      userAgent
    );

    res.json({
      success: true,
      message: 'Session revoked successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Helper function to get client info
const getClientInfo = (req) => {
  const userAgent = req.get('User-Agent') || '';
  const ipAddress = req.ip || req.connection.remoteAddress;
  
  return { ipAddress, userAgent };
};

module.exports = { router };
