const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/rateLimit');
const cartService = require('../../services/cartService');
const { sendResponse, sendError } = require('../../utils/response');

const router = express.Router();

router.use(apiLimiter);
router.use(authenticate);

/**
 * @swagger
 * /api/cart:
 *   get:
 *     summary: Get user's cart items
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    // Get cart items once
    const cartItems = await cartService.getCartItems(userId);
    // Calculate summary from items (no duplicate query)
    const summary = await cartService.getCartSummary(userId, cartItems);

    sendResponse(res, 200, { items: cartItems, summary }, 'Cart retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/cart:
 *   post:
 *     summary: Add item to cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      return sendError(res, new Error('Product ID is required'), 400);
    }

    const cartItem = await cartService.addToCart(userId, productId, quantity);
    sendResponse(res, 201, cartItem, 'Item added to cart successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/cart/:id:
 *   put:
 *     summary: Update cart item quantity
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return sendError(res, new Error('Valid quantity is required'), 400);
    }

    const cartItem = await cartService.updateCartItem(req.params.id, userId, quantity);
    sendResponse(res, 200, cartItem, 'Cart item updated successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/cart/:id:
 *   delete:
 *     summary: Remove item from cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    await cartService.removeFromCart(req.params.id, userId);
    sendResponse(res, 200, null, 'Item removed from cart successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/cart/clear:
 *   delete:
 *     summary: Clear user's cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/clear', async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await cartService.clearCart(userId);
    sendResponse(res, 200, { removed: count }, 'Cart cleared successfully');
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = { router };
