const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/rateLimit');
const orderService = require('../../services/orderService');
const { sendResponse, sendError } = require('../../utils/response');

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

/**
 * @swagger
 * /api/user/orders:
 *   get:
 *     summary: List user's orders (USER and MENTOR roles only)
 *     tags: [User Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Orders list
 */
router.get('/', authenticate, authorize(['USER', 'MENTOR']), async (req, res) => {
  try {
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
 * /api/user/orders/:id:
 *   get:
 *     summary: Get order details (USER and MENTOR roles only)
 *     tags: [User Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order details
 */
router.get('/:id', authenticate, authorize(['USER', 'MENTOR']), async (req, res) => {
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
 * /api/user/orders/:id/cancel:
 *   put:
 *     summary: Cancel order (USER and MENTOR roles only)
 *     tags: [User Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order cancelled
 */
router.put('/:id/cancel', authenticate, authorize(['USER', 'MENTOR']), async (req, res) => {
  try {
    const userId = req.user.id;
    const order = await orderService.cancelOrder(req.params.id, userId);

    sendResponse(res, 200, order, 'Order cancelled successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/user/orders/:id/approve-delivery-date:
 *   post:
 *     summary: Approve delivery date (USER and MENTOR roles only)
 *     tags: [User Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Delivery date approved, order accepted
 */
router.post('/:id/approve-delivery-date', authenticate, authorize(['USER', 'MENTOR']), async (req, res) => {
  try {
    const userId = req.user.id;
    const order = await orderService.approveDeliveryDate(req.params.id, userId);

    sendResponse(res, 200, order, 'Delivery date approved. Order is now accepted.');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/user/orders/:id/reject-delivery-date:
 *   post:
 *     summary: Reject delivery date (USER and MENTOR roles only)
 *     tags: [User Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Delivery date rejected, order sent back to vendor
 */
router.post('/:id/reject-delivery-date', authenticate, authorize(['USER', 'MENTOR']), async (req, res) => {
  try {
    const userId = req.user.id;
    const order = await orderService.rejectDeliveryDate(req.params.id, userId);

    sendResponse(res, 200, order, 'Delivery date rejected. Order sent back to vendor for a new date.');
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = { router };
