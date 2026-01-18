const express = require('express');
const { z } = require('zod');
const database = require('../../config/database');
const { authenticate, authorize } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/rateLimit');
const { sendResponse, sendError } = require('../../utils/response');
const AuditLogger = require('../logging/auditLogger');

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('ADMIN'));

// Validation schemas
const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(['USER', 'VENDOR', 'MENTOR', 'ADMIN']).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']),
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(['USER', 'VENDOR', 'MENTOR', 'ADMIN']).default('USER'),
});

// Helper function to get client info
const getClientInfo = (req) => {
  const userAgent = req.get('User-Agent') || '';
  const ipAddress = req.ip || req.connection.remoteAddress;
  return { ipAddress, userAgent };
};

/**
 * @swagger
 * /api/admin/users:
 *   post:
 *     summary: Create new user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: User created
 */
router.post('/', async (req, res) => {
  try {
    const validatedData = createUserSchema.parse(req.body);
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

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName || null,
        lastName: validatedData.lastName || null,
        phone: validatedData.phone || null,
        role: validatedData.role,
        status: 'ACTIVE',
        emailVerified: true, // Admin-created users are auto-verified
      },
      include: {
        vendorProfile: true,
        mentorProfile: true,
      },
    });

    // Create wallet for user
    await prisma.wallet.create({
      data: {
        userId: user.id,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      },
    });

    // Log the action
    await AuditLogger.logUserAction(
      req.user.id,
      'CREATE_USER',
      'User',
      user.id,
      { email: user.email, role: user.role },
      ipAddress,
      userAgent
    );

    sendResponse(res, 201, user, 'User created successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`), 400);
    }
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List all users
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
 *           enum: [USER, VENDOR, MENTOR, ADMIN]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, SUSPENDED, PENDING_VERIFICATION]
 *     responses:
 *       200:
 *         description: Users list
 */
router.get('/', async (req, res) => {
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

    // Build where clause
    const where = {
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

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          vendorProfile: true,
          mentorProfile: true,
          wallet: {
            select: {
              balance: true,
              totalEarned: true,
              totalWithdrawn: true,
            },
          },
          _count: {
            select: {
              orders: true,
              ownedUnits: true,
              payouts: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit, 10),
      }),
      prisma.user.count({ where }),
    ]);

    sendResponse(res, 200, {
      users,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit, 10)),
      },
    }, 'Users retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/users/:id:
 *   get:
 *     summary: Get user details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const prisma = database.getClient();

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        vendorProfile: true,
        mentorProfile: true,
        wallet: true,
        bonusWallet: true,
        _count: {
          select: {
            orders: true,
            ownedUnits: true,
            payouts: true,
            bonuses: true,
          },
        },
      },
    });

    if (!user) {
      return sendError(res, new Error('User not found'), 404);
    }

    // Get stats
    const [totalOrders, totalContracts, totalEarnings, totalPayouts] = await Promise.all([
      prisma.order.count({ where: { userId: id } }),
      prisma.unit.count({ where: { ownerId: id } }),
      prisma.payout.aggregate({
        where: { userId: id, status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      prisma.payout.count({ where: { userId: id } }),
    ]);

    sendResponse(res, 200, {
      ...user,
      stats: {
        totalOrders,
        totalContracts,
        totalEarnings: totalEarnings._sum.amount || 0,
        totalPayouts,
      },
    }, 'User retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/users/:id:
 *   put:
 *     summary: Update user details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User updated
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateUserSchema.parse(req.body);
    const prisma = database.getClient();
    const { ipAddress, userAgent } = getClientInfo(req);

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return sendError(res, new Error('User not found'), 404);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: validatedData,
      include: {
        vendorProfile: true,
        mentorProfile: true,
      },
    });

    // Log the action
    await AuditLogger.logUserAction(
      req.user.id,
      'UPDATE_USER',
      'User',
      id,
      validatedData,
      ipAddress,
      userAgent
    );

    sendResponse(res, 200, updatedUser, 'User updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`), 400);
    }
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/users/:id/status:
 *   put:
 *     summary: Update user status (block/unblock)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User status updated
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = updateStatusSchema.parse(req.body);
    const prisma = database.getClient();
    const { ipAddress, userAgent } = getClientInfo(req);

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return sendError(res, new Error('User not found'), 404);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status },
    });

    // Log the action
    await AuditLogger.logUserAction(
      req.user.id,
      status === 'SUSPENDED' ? 'BLOCK_USER' : 'UNBLOCK_USER',
      'User',
      id,
      { status, previousStatus: user.status },
      ipAddress,
      userAgent
    );

    sendResponse(res, 200, updatedUser, `User ${status === 'SUSPENDED' ? 'blocked' : 'unblocked'} successfully`);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`), 400);
    }
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/users/:id/orders:
 *   get:
 *     summary: Get user's orders
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User orders
 */
router.get('/:id/orders', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, status = null } = req.query;

    // Verify user exists
    const user = await database.getClient().user.findUnique({
      where: { id },
    });

    if (!user) {
      return sendError(res, new Error('User not found'), 404);
    }

    const filters = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status: status || null,
    };

    const orderService = require('../../services/orderService');
    const result = await orderService.listUserOrders(id, filters);

    sendResponse(res, 200, result, 'User orders retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/users/:id/contracts:
 *   get:
 *     summary: Get user's contracts/units
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User contracts
 */
router.get('/:id/contracts', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const prisma = database.getClient();

    const [units, total] = await Promise.all([
      prisma.unit.findMany({
        where: { ownerId: id },
        include: {
          contractGame: {
            select: {
              id: true,
              name: true,
              downPayment: true,
            },
          },
          payouts: {
            select: {
              id: true,
              amount: true,
              stage: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit, 10),
      }),
      prisma.unit.count({ where: { ownerId: id } }),
    ]);

    sendResponse(res, 200, {
      contracts: units,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit, 10)),
      },
    }, 'User contracts retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/users/:id/earnings:
 *   get:
 *     summary: Get user's earnings breakdown
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User earnings
 */
router.get('/:id/earnings', async (req, res) => {
  try {
    const { id } = req.params;
    const prisma = database.getClient();

    const [payouts, bonuses, settlements] = await Promise.all([
      prisma.payout.aggregate({
        where: { userId: id },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.bonus.aggregate({
        where: { userId: id },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.settlement.aggregate({
        where: { vendorId: id },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const wallet = await prisma.wallet.findUnique({
      where: { userId: id },
      select: {
        balance: true,
        totalEarned: true,
        totalWithdrawn: true,
      },
    });

    sendResponse(res, 200, {
      payouts: {
        total: payouts._sum.amount || 0,
        count: payouts._count || 0,
      },
      bonuses: {
        total: bonuses._sum.amount || 0,
        count: bonuses._count || 0,
      },
      settlements: {
        total: settlements._sum.amount || 0,
        count: settlements._count || 0,
      },
      wallet: wallet || {
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      },
      totalEarnings: (payouts._sum.amount || 0) + (bonuses._sum.amount || 0) + (settlements._sum.amount || 0),
    }, 'User earnings retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/users/:id/wallet:
 *   get:
 *     summary: Get user's wallet details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User wallet
 */
router.get('/:id/wallet', async (req, res) => {
  try {
    const { id } = req.params;
    const prisma = database.getClient();

    const wallet = await prisma.wallet.findUnique({
      where: { userId: id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!wallet) {
      return sendError(res, new Error('Wallet not found'), 404);
    }

    // Get recent transactions (payouts)
    const recentPayouts = await prisma.payout.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    sendResponse(res, 200, {
      wallet,
      recentTransactions: recentPayouts,
    }, 'User wallet retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/users/:id/bonuses:
 *   get:
 *     summary: Get user's bonus history
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User bonuses
 */
router.get('/:id/bonuses', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const prisma = database.getClient();

    const [bonuses, total] = await Promise.all([
      prisma.bonus.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit, 10),
      }),
      prisma.bonus.count({ where: { userId: id } }),
    ]);

    sendResponse(res, 200, {
      bonuses,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit, 10)),
      },
    }, 'User bonuses retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/users/:id/settlements:
 *   get:
 *     summary: Get user's settlement history
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User settlements
 */
router.get('/:id/settlements', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const prisma = database.getClient();

    const [settlements, total] = await Promise.all([
      prisma.settlement.findMany({
        where: { vendorId: id },
        include: {
          vendor: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit, 10),
      }),
      prisma.settlement.count({ where: { vendorId: id } }),
    ]);

    sendResponse(res, 200, {
      settlements,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit, 10)),
      },
    }, 'User settlements retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/users/:id/audit-logs:
 *   get:
 *     summary: Get user's audit trail
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User audit logs
 */
router.get('/:id/audit-logs', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const prisma = database.getClient();

    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit, 10),
      }),
      prisma.auditLog.count({ where: { userId: id } }),
    ]);

    sendResponse(res, 200, {
      auditLogs,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit, 10)),
      },
    }, 'User audit logs retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = { router };
