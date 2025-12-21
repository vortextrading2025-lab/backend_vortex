const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/rateLimit');
const orderService = require('../../services/orderService');
const settlementService = require('../../services/settlementService');
const { sendResponse, sendError } = require('../../utils/response');
const database = require('../../config/database');

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// ============================================
// VENDOR ROUTES - Must come BEFORE user routes
// ============================================
/**
 * @swagger
 * /api/vendor/orders:
 *   get:
 *     summary: List vendor's orders
 *     tags: [Vendor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Orders list
 */
router.get('/', authenticate, authorize(['VENDOR']), async (req, res) => {
  try {
    // Double-check this is a vendor route
    if (!req.path.includes('/vendor/orders') && !req.originalUrl.includes('/vendor/orders')) {
      // This shouldn't happen, but just in case - skip to next route
      return;
    }
    
    const vendorId = req.user.id;
    const filters = {
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20,
      status: req.query.status || null,
      search: req.query.search || '',
    };

    // Debug logging
    console.log(`[GET /vendor/orders] Vendor ID: ${vendorId}, Email: ${req.user.email}, Role: ${req.user.role}, Filters:`, filters);
    
    // Verify vendor exists and get their actual ID
    const vendor = await database.getClient().user.findUnique({
      where: { id: vendorId },
      select: { id: true, email: true, role: true }
    });
    
    if (!vendor) {
      console.error(`[GET /vendor/orders] Vendor not found with ID: ${vendorId}`);
      return sendError(res, new Error('Vendor not found'), 404);
    }
    
    console.log(`[GET /vendor/orders] Verified vendor: ${vendor.email} (${vendor.id})`);

    const result = await orderService.listVendorOrders(vendorId, filters);

    console.log(`[GET /vendor/orders] Returning ${result.orders?.length || 0} orders`);
    
    // Additional debug: Check if orders exist for this vendor
    const orderCount = await database.getClient().order.count({
      where: { vendorId: vendorId }
    });
    console.log(`[GET /vendor/orders] Total orders in DB for vendor ${vendorId}: ${orderCount}`);

    sendResponse(res, 200, result, 'Orders retrieved successfully');
  } catch (error) {
    console.error('[GET /vendor/orders] Error:', error);
    sendError(res, error);
  }
});

// ============================================
// USER ROUTES
// ============================================
/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Create a new order (user)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Order created
 */
router.post('/', authenticate, authorize(['USER', 'VENDOR', 'MENTOR', 'ADMIN']), async (req, res) => {
  try {
    const userId = req.user.id;
    
    // If fromCart is true, create order from cart
    if (req.body.fromCart) {
      const order = await orderService.createOrderFromCart(userId, {
        shippingAddress: req.body.shippingAddress,
        shippingName: req.body.shippingName,
        shippingPhone: req.body.shippingPhone,
        notes: req.body.notes,
      });
      sendResponse(res, 201, order, 'Order(s) created successfully from cart');
    } else {
      // Create order directly
      const order = await orderService.createOrder(req.body, userId);
      sendResponse(res, 201, order, 'Order created successfully');
    }
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: List user's orders (accessible to all authenticated users)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Orders list
 */
// User orders route - accessible to USER, VENDOR, MENTOR, and ADMIN roles
// This route is mounted at /api/orders (not /api/vendor/orders)
router.get('/', authenticate, authorize(['USER', 'VENDOR', 'MENTOR', 'ADMIN']), async (req, res) => {
  try {
    // Skip if this is a vendor route (shouldn't happen since vendor route is mounted separately, but just in case)
    if (req.path.includes('/vendor/orders') || req.originalUrl.includes('/vendor/orders')) {
      return; // Let Express continue to next route
    }
    
    const userId = req.user.id;
    const filters = {
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20,
      status: req.query.status || null,
    };

    const result = await orderService.listUserOrders(userId, filters);

    sendResponse(res, 200, result, 'Orders retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/orders/:id:
 *   get:
 *     summary: Get order details (accessible to all authenticated users)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Order details
 */
router.get('/:id', authenticate, authorize(['USER', 'VENDOR', 'MENTOR', 'ADMIN']), async (req, res) => {
  try {
    const userId = req.user.id;
    const order = await orderService.getOrderById(req.params.id, userId);

    sendResponse(res, 200, order, 'Order retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/orders/:id/cancel:
 *   put:
 *     summary: Cancel order (accessible to all authenticated users)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Order cancelled
 */
router.put('/:id/cancel', authenticate, authorize(['USER', 'VENDOR', 'MENTOR', 'ADMIN']), async (req, res) => {
  try {
    const userId = req.user.id;
    const order = await orderService.cancelOrder(req.params.id, userId);

    sendResponse(res, 200, order, 'Order cancelled successfully');
  } catch (error) {
    sendError(res, error);
  }
});

// Vendor routes - MUST come before generic routes to avoid route conflicts
/**
 * @swagger
 * /api/vendor/orders:
 *   get:
 *     summary: List vendor's orders
 *     tags: [Vendor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Orders list
 */
// This route works when mounted at /api/vendor/orders (use '/' not '/vendor/orders')
// But we need to check the path to ensure it's the vendor route, not the user route
router.get('/', authenticate, authorize(['VENDOR']), async (req, res) => {
  try {
    // Double-check this is a vendor route
    if (!req.path.includes('/vendor/orders') && !req.originalUrl.includes('/vendor/orders')) {
      // This shouldn't happen, but just in case
      return res.status(404).json({ success: false, message: 'Route not found' });
    }
    
    const vendorId = req.user.id;
    const filters = {
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20,
      status: req.query.status || null,
      search: req.query.search || '',
    };

    // Debug logging
    console.log(`[GET /vendor/orders] Vendor ID: ${vendorId}, Email: ${req.user.email}, Role: ${req.user.role}, Filters:`, filters);
    
    // Verify vendor exists and get their actual ID
    const vendor = await database.getClient().user.findUnique({
      where: { id: vendorId },
      select: { id: true, email: true, role: true }
    });
    
    if (!vendor) {
      console.error(`[GET /vendor/orders] Vendor not found with ID: ${vendorId}`);
      return sendError(res, new Error('Vendor not found'), 404);
    }
    
    console.log(`[GET /vendor/orders] Verified vendor: ${vendor.email} (${vendor.id})`);

    const result = await orderService.listVendorOrders(vendorId, filters);

    console.log(`[GET /vendor/orders] Returning ${result.orders?.length || 0} orders`);
    
    // Additional debug: Check if orders exist for this vendor
    const orderCount = await database.getClient().order.count({
      where: { vendorId: vendorId }
    });
    console.log(`[GET /vendor/orders] Total orders in DB for vendor ${vendorId}: ${orderCount}`);

    sendResponse(res, 200, result, 'Orders retrieved successfully');
  } catch (error) {
    console.error('[GET /vendor/orders] Error:', error);
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/vendor/orders/:id:
 *   get:
 *     summary: Get vendor order details
 *     tags: [Vendor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Order details
 */
router.get('/vendor/orders/:id', authenticate, authorize(['VENDOR']), async (req, res) => {
  try {
    const vendorId = req.user.id;
    const order = await orderService.getOrderById(req.params.id, null, vendorId);

    sendResponse(res, 200, order, 'Order retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/vendor/orders/:id/accept:
 *   post:
 *     summary: Accept order (vendor)
 *     tags: [Vendor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Order accepted
 */
router.post('/:id/accept', authenticate, authorize(['VENDOR']), async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { deliveryDate } = req.body;

    if (!deliveryDate) {
      return sendError(res, new Error('Delivery date is required'), 400);
    }

    const order = await orderService.acceptOrder(req.params.id, vendorId, deliveryDate);

    sendResponse(res, 200, order, 'Order accepted with delivery date. Waiting for user approval.');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/vendor/orders/:id/reject:
 *   post:
 *     summary: Reject order (vendor)
 *     tags: [Vendor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Order rejected and refunded
 */
router.post('/:id/reject', authenticate, authorize(['VENDOR']), async (req, res) => {
  try {
    const vendorId = req.user.id;
    const reason = req.body.reason || null;
    const order = await orderService.rejectOrder(req.params.id, vendorId, reason);

    sendResponse(res, 200, order, 'Order rejected and refunded successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/vendor/orders/:id/status:
 *   put:
 *     summary: Update order status (vendor) - for ACCEPTED -> CONFIRMED -> SHIPPED -> DELIVERED
 *     tags: [Vendor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Order status updated
 */
router.put('/:id/status', authenticate, authorize(['VENDOR']), async (req, res) => {
  try {
    const vendorId = req.user.id;
    const order = await orderService.updateOrderStatus(
      req.params.id,
      vendorId,
      null,
      req.body
    );

    // If order is delivered, trigger automatic settlement (async, don't block response)
    if (order.status === 'DELIVERED') {
      // Process settlement asynchronously to not block the response
      setImmediate(async () => {
        try {
          await settlementService.processSettlement(order.id);
        } catch (settlementError) {
          console.error('Error processing settlement:', settlementError);
          // Don't fail the request if settlement fails, just log it
        }
      });
    }

    sendResponse(res, 200, order, 'Order status updated successfully');
  } catch (error) {
    sendError(res, error);
  }
});

// Settlements routes
/**
 * @swagger
 * /api/vendor/settlements:
 *   get:
 *     summary: List vendor settlements
 *     tags: [Vendor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settlements list
 */
router.get('/settlements', authenticate, authorize(['VENDOR']), async (req, res) => {
  try {
    const vendorId = req.user.id;
    const filters = {
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20,
      status: req.query.status || null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null,
    };

    const result = await settlementService.listVendorSettlements(vendorId, filters);

    sendResponse(res, 200, result, 'Settlements retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/vendor/settlements/:id:
 *   get:
 *     summary: Get settlement details
 *     tags: [Vendor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settlement details
 */
router.get('/settlements/:id', authenticate, authorize(['VENDOR']), async (req, res) => {
  try {
    const vendorId = req.user.id;
    const settlement = await settlementService.getSettlementById(req.params.id, vendorId);

    sendResponse(res, 200, settlement, 'Settlement retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = { router };
