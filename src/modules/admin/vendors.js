const express = require('express');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const database = require('../../config/database');
const { authenticate, authorize } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/rateLimit');
const { sendResponse, sendError } = require('../../utils/response');
const AuditLogger = require('../logging/auditLogger');
const productService = require('../../services/productService');
const orderService = require('../../services/orderService');
const settlementService = require('../../services/settlementService');

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('ADMIN'));

// Validation schemas
const createVendorSchema = z.object({
  // User info
  email: z.string().email(),
  password: z.string().min(8).optional(), // Optional - can auto-generate
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  // Business info
  businessName: z.string().min(1),
  businessType: z.string().min(1),
  description: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  // Address
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  zipCode: z.string().optional(),
  // Tax info
  taxId: z.string().optional(),
  cinNumber: z.string().optional(),
  licenseNumber: z.string().optional(),
});

const updateVendorSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  businessName: z.string().min(1).optional(),
  businessType: z.string().min(1).optional(),
  description: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  zipCode: z.string().optional(),
  taxId: z.string().optional(),
  cinNumber: z.string().optional(),
  licenseNumber: z.string().optional(),
  isVerified: z.boolean().optional(),
});

/**
 * @swagger
 * /api/admin/vendors:
 *   get:
 *     summary: List all vendors
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, SUSPENDED]
 *       - in: query
 *         name: verified
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Vendors list
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = null,
      verified = null,
    } = req.query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const prisma = database.getClient();

    // Build where clause
    const where = {
      role: 'VENDOR',
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { vendorProfile: { businessName: { contains: search, mode: 'insensitive' } } },
        ],
      }),
      ...(status && { status }),
      ...(verified !== null && {
        vendorProfile: { isVerified: verified === 'true' || verified === true },
      }),
    };

    const [vendors, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          vendorProfile: true,
          _count: {
            select: {
              products: true,
              vendorOrders: true,
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
      vendors,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit, 10)),
      },
    }, 'Vendors retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/vendors/:id:
 *   get:
 *     summary: Get vendor details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vendor details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const prisma = database.getClient();

    const vendor = await prisma.user.findUnique({
      where: { id },
      include: {
        vendorProfile: true,
        _count: {
          select: {
            products: true,
            vendorOrders: true,
          },
        },
      },
    });

    if (!vendor || vendor.role !== 'VENDOR') {
      return sendError(res, new Error('Vendor not found'), 404);
    }

    // Get stats
    const [totalProducts, totalOrders, totalRevenue] = await Promise.all([
      prisma.product.count({ where: { vendorId: id } }),
      prisma.order.count({ where: { vendorId: id } }),
      prisma.settlement.aggregate({
        where: {
          vendorId: id,
          status: 'COMPLETED',
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    sendResponse(res, 200, {
      ...vendor,
      stats: {
        totalProducts,
        totalOrders,
        totalRevenue: totalRevenue._sum.amount || 0,
      },
    }, 'Vendor retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/vendors:
 *   post:
 *     summary: Create/onboard new vendor
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, firstName, lastName, businessName, businessType]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               businessName:
 *                 type: string
 *               businessType:
 *                 type: string
 *               description:
 *                 type: string
 *               website:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               country:
 *                 type: string
 *               zipCode:
 *                 type: string
 *               taxId:
 *                 type: string
 *               cinNumber:
 *                 type: string
 *               licenseNumber:
 *                 type: string
 *     responses:
 *       201:
 *         description: Vendor created successfully
 */
router.post('/', async (req, res) => {
  try {
    const validatedData = createVendorSchema.parse(req.body);
    const prisma = database.getClient();
    const { ipAddress, userAgent } = getClientInfo(req);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return sendError(res, new Error('Email already exists'), 400);
    }

    // Generate password if not provided
    const password = validatedData.password || generateRandomPassword();
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user and vendor profile in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: validatedData.email,
          password: hashedPassword,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          phone: validatedData.phone || null,
          role: 'VENDOR',
          status: 'ACTIVE',
          emailVerified: true, // Admin-created vendors are auto-verified
        },
      });

      // Create vendor profile
      const vendorProfile = await tx.vendorProfile.create({
        data: {
          userId: user.id,
          businessName: validatedData.businessName,
          businessType: validatedData.businessType,
          description: validatedData.description || null,
          website: validatedData.website || null,
          address: validatedData.address || null,
          city: validatedData.city || null,
          state: validatedData.state || null,
          country: validatedData.country || null,
          zipCode: validatedData.zipCode || null,
          taxId: validatedData.taxId || null,
          cinNumber: validatedData.cinNumber || null,
          licenseNumber: validatedData.licenseNumber || null,
          isVerified: false, // Admin can verify later
        },
      });

      // Create wallet for vendor
      await tx.wallet.create({
        data: {
          userId: user.id,
        },
      });

      return { user, vendorProfile, password };
    });

    // Log the action
    await AuditLogger.logUserAction(
      req.user.id,
      'CREATE_VENDOR',
      'Vendor',
      result.user.id,
      { email: validatedData.email, businessName: validatedData.businessName },
      ipAddress,
      userAgent
    );

    sendResponse(res, 201, {
      vendor: {
        ...result.user,
        vendorProfile: result.vendorProfile,
      },
      password: validatedData.password ? undefined : password, // Only return if auto-generated
    }, 'Vendor created successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`), 400);
    }
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/vendors/:id:
 *   put:
 *     summary: Update vendor details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vendor updated
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateVendorSchema.parse(req.body);
    const prisma = database.getClient();
    const { ipAddress, userAgent } = getClientInfo(req);

    // Check if vendor exists
    const vendor = await prisma.user.findUnique({
      where: { id },
      include: { vendorProfile: true },
    });

    if (!vendor || vendor.role !== 'VENDOR') {
      return sendError(res, new Error('Vendor not found'), 404);
    }

    // Separate user and vendor profile updates
    const userUpdate = {};
    const profileUpdate = {};

    if (validatedData.firstName) userUpdate.firstName = validatedData.firstName;
    if (validatedData.lastName) userUpdate.lastName = validatedData.lastName;
    if (validatedData.phone !== undefined) userUpdate.phone = validatedData.phone;

    if (validatedData.businessName) profileUpdate.businessName = validatedData.businessName;
    if (validatedData.businessType) profileUpdate.businessType = validatedData.businessType;
    if (validatedData.description !== undefined) profileUpdate.description = validatedData.description;
    if (validatedData.website !== undefined) profileUpdate.website = validatedData.website || null;
    if (validatedData.address !== undefined) profileUpdate.address = validatedData.address;
    if (validatedData.city !== undefined) profileUpdate.city = validatedData.city;
    if (validatedData.state !== undefined) profileUpdate.state = validatedData.state;
    if (validatedData.country !== undefined) profileUpdate.country = validatedData.country;
    if (validatedData.zipCode !== undefined) profileUpdate.zipCode = validatedData.zipCode;
    if (validatedData.taxId !== undefined) profileUpdate.taxId = validatedData.taxId;
    if (validatedData.cinNumber !== undefined) profileUpdate.cinNumber = validatedData.cinNumber;
    if (validatedData.licenseNumber !== undefined) profileUpdate.licenseNumber = validatedData.licenseNumber;
    if (validatedData.isVerified !== undefined) profileUpdate.isVerified = validatedData.isVerified;

    // Update in transaction
    const updatedVendor = await prisma.$transaction(async (tx) => {
      const updates = [];
      
      if (Object.keys(userUpdate).length > 0) {
        updates.push(
          tx.user.update({
            where: { id },
            data: userUpdate,
          })
        );
      }

      if (Object.keys(profileUpdate).length > 0) {
        updates.push(
          tx.vendorProfile.update({
            where: { userId: id },
            data: profileUpdate,
          })
        );
      }

      const results = await Promise.all(updates);
      return results[0] || vendor;
    });

    // Fetch updated vendor with profile
    const vendorWithProfile = await prisma.user.findUnique({
      where: { id },
      include: { vendorProfile: true },
    });

    // Log the action
    await AuditLogger.logUserAction(
      req.user.id,
      'UPDATE_VENDOR',
      'Vendor',
      id,
      validatedData,
      ipAddress,
      userAgent
    );

    sendResponse(res, 200, vendorWithProfile, 'Vendor updated successfully');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`), 400);
    }
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/vendors/:id/verify:
 *   put:
 *     summary: Verify vendor
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vendor verified
 */
router.put('/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const prisma = database.getClient();
    const { ipAddress, userAgent } = getClientInfo(req);

    const vendor = await prisma.user.findUnique({
      where: { id },
      include: { vendorProfile: true },
    });

    if (!vendor || vendor.role !== 'VENDOR') {
      return sendError(res, new Error('Vendor not found'), 404);
    }

    if (!vendor.vendorProfile) {
      return sendError(res, new Error('Vendor profile not found'), 404);
    }

    const updatedProfile = await prisma.vendorProfile.update({
      where: { userId: id },
      data: { isVerified: true },
    });

    // Log the action
    await AuditLogger.logUserAction(
      req.user.id,
      'VERIFY_VENDOR',
      'Vendor',
      id,
      { isVerified: true },
      ipAddress,
      userAgent
    );

    sendResponse(res, 200, {
      ...vendor,
      vendorProfile: updatedProfile,
    }, 'Vendor verified successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/vendors/:id:
 *   delete:
 *     summary: Deactivate/suspend vendor
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vendor deactivated
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const prisma = database.getClient();
    const { ipAddress, userAgent } = getClientInfo(req);

    const vendor = await prisma.user.findUnique({
      where: { id },
    });

    if (!vendor || vendor.role !== 'VENDOR') {
      return sendError(res, new Error('Vendor not found'), 404);
    }

    // Update status to SUSPENDED instead of deleting
    const updatedVendor = await prisma.user.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });

    // Log the action
    await AuditLogger.logUserAction(
      req.user.id,
      'SUSPEND_VENDOR',
      'Vendor',
      id,
      { status: 'SUSPENDED' },
      ipAddress,
      userAgent
    );

    sendResponse(res, 200, updatedVendor, 'Vendor suspended successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/vendors/:id/products:
 *   get:
 *     summary: List vendor's products
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
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Products list
 */
router.get('/:id/products', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, isActive = null } = req.query;

    // Verify vendor exists
    const vendor = await database.getClient().user.findUnique({
      where: { id },
    });

    if (!vendor || vendor.role !== 'VENDOR') {
      return sendError(res, new Error('Vendor not found'), 404);
    }

    const filters = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      isActive: isActive !== null ? isActive === 'true' : null,
    };

    const result = await productService.listVendorProducts(id, filters);

    sendResponse(res, 200, result, 'Products retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/vendors/:id/orders:
 *   get:
 *     summary: List vendor's orders
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
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Orders list
 */
router.get('/:id/orders', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, status = null } = req.query;

    // Verify vendor exists
    const vendor = await database.getClient().user.findUnique({
      where: { id },
    });

    if (!vendor || vendor.role !== 'VENDOR') {
      return sendError(res, new Error('Vendor not found'), 404);
    }

    const filters = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status: status || null,
    };

    const result = await orderService.listVendorOrders(id, filters);

    sendResponse(res, 200, result, 'Orders retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/admin/vendors/:id/settlements:
 *   get:
 *     summary: List vendor's settlements
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
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Settlements list
 */
router.get('/:id/settlements', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, status = null } = req.query;

    // Verify vendor exists
    const vendor = await database.getClient().user.findUnique({
      where: { id },
    });

    if (!vendor || vendor.role !== 'VENDOR') {
      return sendError(res, new Error('Vendor not found'), 404);
    }

    const filters = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status: status || null,
    };

    const result = await settlementService.listVendorSettlements(id, filters);

    sendResponse(res, 200, result, 'Settlements retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

// Helper function to generate random password
function generateRandomPassword() {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// Helper function to get client info
function getClientInfo(req) {
  const userAgent = req.get('User-Agent') || '';
  const ipAddress = req.ip || req.connection.remoteAddress;
  return { ipAddress, userAgent };
}

module.exports = { router };
