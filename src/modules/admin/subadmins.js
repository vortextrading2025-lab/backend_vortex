const express = require('express');
const { z } = require('zod');
const database = require('../../config/database');
const { authenticate, authorize, requirePermission } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/rateLimit');
const AuditLogger = require('../logging/auditLogger');
const { sendResponse, sendError } = require('../../utils/response');

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('ADMIN'));

// Helper function to get client info
const getClientInfo = (req) => {
  const userAgent = req.get('User-Agent') || '';
  const ipAddress = req.ip || req.connection.remoteAddress;
  return { ipAddress, userAgent };
};

// Validation schemas
const createSubadminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(['MODERATOR', 'SUPPORT', 'ANALYST']),
  permissionIds: z.array(z.string()).optional()
});

const updateSubadminSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(['MODERATOR', 'SUPPORT', 'ANALYST']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional()
});

/**
 * @swagger
 * /api/admin/subadmins:
 *   get:
 *     summary: List all subadmin users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [MODERATOR, SUPPORT, ANALYST]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, SUSPENDED]
 *     responses:
 *       200:
 *         description: Subadmins list
 */
router.get('/', requirePermission('users', 'view'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      role = null,
      status = null,
    } = req.query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const prisma = database.getClient();

    // Build where clause - only subadmin roles
    const where = {
      role: {
        in: ['MODERATOR', 'SUPPORT', 'ANALYST']
      },
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(role && { role }),
      ...(status && { status }),
    };

    const [subadmins, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          permissions: {
            include: {
              permission: true
            }
          },
          _count: {
            select: {
              auditLogs: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit, 10),
      }),
      prisma.user.count({ where }),
    ]);

    sendResponse(res, 200, {
      subadmins,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit, 10)),
      },
    }, 'Subadmins retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/subadmins:
 *   post:
 *     summary: Create new subadmin user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Subadmin created
 */
router.post('/', requirePermission('users', 'create'), async (req, res) => {
  try {
    const validatedData = createSubadminSchema.parse(req.body);
    const prisma = database.getClient();
    const { ipAddress, userAgent } = getClientInfo(req);
    const bcrypt = require('bcryptjs');

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return sendError(res, new Error('Email already exists'), 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    // Create subadmin user
    const subadmin = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName || null,
        lastName: validatedData.lastName || null,
        phone: validatedData.phone || null,
        role: validatedData.role,
        status: 'ACTIVE',
        emailVerified: true,
      },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    // Assign permissions if provided
    if (validatedData.permissionIds && validatedData.permissionIds.length > 0) {
      for (const permissionId of validatedData.permissionIds) {
        await prisma.userPermission.create({
          data: {
            userId: subadmin.id,
            permissionId,
            grantedBy: req.user.id
          }
        });
      }
    }

    // Log the action
    await AuditLogger.logUserAction(
      req.user.id,
      'CREATE_SUBADMIN',
      'User',
      subadmin.id,
      { email: subadmin.email, role: subadmin.role },
      ipAddress,
      userAgent
    );

    sendResponse(res, 201, subadmin, 'Subadmin created successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`), 400);
    }
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/subadmins/:id:
 *   get:
 *     summary: Get subadmin details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subadmin details
 */
router.get('/:id', requirePermission('users', 'viewDetails'), async (req, res) => {
  try {
    const { id } = req.params;
    const prisma = database.getClient();

    const subadmin = await prisma.user.findUnique({
      where: { 
        id,
        role: {
          in: ['MODERATOR', 'SUPPORT', 'ANALYST']
        }
      },
      include: {
        permissions: {
          include: {
            permission: true
          }
        },
        _count: {
          select: {
            auditLogs: true
          }
        }
      }
    });

    if (!subadmin) {
      return sendError(res, new Error('Subadmin not found'), 404);
    }

    // Get role permissions
    const role = await prisma.role.findUnique({
      where: { name: subadmin.role },
      include: {
        permissions: true
      }
    });

    sendResponse(res, 200, {
      ...subadmin,
      rolePermissions: role?.permissions || []
    }, 'Subadmin details retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/subadmins/:id:
 *   put:
 *     summary: Update subadmin
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subadmin updated
 */
router.put('/:id', requirePermission('users', 'update'), async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateSubadminSchema.parse(req.body);
    const prisma = database.getClient();
    const { ipAddress, userAgent } = getClientInfo(req);

    // Check if subadmin exists
    const existingSubadmin = await prisma.user.findUnique({
      where: { 
        id,
        role: {
          in: ['MODERATOR', 'SUPPORT', 'ANALYST']
        }
      }
    });

    if (!existingSubadmin) {
      return sendError(res, new Error('Subadmin not found'), 404);
    }

    // Update subadmin
    const subadmin = await prisma.user.update({
      where: { id },
      data: validatedData,
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    // Log the action
    await AuditLogger.logUserAction(
      req.user.id,
      'UPDATE_SUBADMIN',
      'User',
      id,
      validatedData,
      ipAddress,
      userAgent
    );

    sendResponse(res, 200, subadmin, 'Subadmin updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`), 400);
    }
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/subadmins/:id/permissions:
 *   put:
 *     summary: Assign/revoke permissions for subadmin
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permissions updated
 */
router.put('/:id/permissions', requirePermission('permissions', 'assign'), async (req, res) => {
  try {
    const { id } = req.params;
    const { permissionIds } = z.object({
      permissionIds: z.array(z.string())
    }).parse(req.body);
    
    const prisma = database.getClient();
    const { ipAddress, userAgent } = getClientInfo(req);

    // Check if subadmin exists
    const subadmin = await prisma.user.findUnique({
      where: { 
        id,
        role: {
          in: ['MODERATOR', 'SUPPORT', 'ANALYST']
        }
      }
    });

    if (!subadmin) {
      return sendError(res, new Error('Subadmin not found'), 404);
    }

    // Remove all existing permissions
    await prisma.userPermission.deleteMany({
      where: { userId: id }
    });

    // Add new permissions
    if (permissionIds.length > 0) {
      await prisma.userPermission.createMany({
        data: permissionIds.map(permissionId => ({
          userId: id,
          permissionId,
          grantedBy: req.user.id
        }))
      });
    }

    // Get updated subadmin with permissions
    const updatedSubadmin = await prisma.user.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    // Log the action
    await AuditLogger.logUserAction(
      req.user.id,
      'UPDATE_SUBADMIN_PERMISSIONS',
      'User',
      id,
      { permissionIds },
      ipAddress,
      userAgent
    );

    sendResponse(res, 200, updatedSubadmin, 'Subadmin permissions updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`), 400);
    }
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/subadmins/:id:
 *   delete:
 *     summary: Remove subadmin access (change role to USER)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subadmin access removed
 */
router.delete('/:id', requirePermission('users', 'delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const prisma = database.getClient();
    const { ipAddress, userAgent } = getClientInfo(req);

    // Check if subadmin exists
    const subadmin = await prisma.user.findUnique({
      where: { 
        id,
        role: {
          in: ['MODERATOR', 'SUPPORT', 'ANALYST']
        }
      }
    });

    if (!subadmin) {
      return sendError(res, new Error('Subadmin not found'), 404);
    }

    // Remove all permissions
    await prisma.userPermission.deleteMany({
      where: { userId: id }
    });

    // Change role to USER
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role: 'USER' },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    // Log the action
    await AuditLogger.logUserAction(
      req.user.id,
      'REMOVE_SUBADMIN',
      'User',
      id,
      { previousRole: subadmin.role, newRole: 'USER' },
      ipAddress,
      userAgent
    );

    sendResponse(res, 200, updatedUser, 'Subadmin access removed successfully');
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = { router };
