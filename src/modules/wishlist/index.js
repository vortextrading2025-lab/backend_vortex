const express = require('express');
const { authenticate } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/rateLimit');
const wishlistService = require('../../services/wishlistService');
const { sendResponse, sendError } = require('../../utils/response');

const router = express.Router();

router.use(apiLimiter);
router.use(authenticate);

/**
 * @swagger
 * /api/wishlist:
 *   get:
 *     summary: Get user's wishlist items
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const wishlistItems = await wishlistService.getWishlistItems(userId);
    sendResponse(res, 200, wishlistItems, 'Wishlist retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/wishlist:
 *   post:
 *     summary: Add product to wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;

    if (!productId) {
      return sendError(res, new Error('Product ID is required'), 400);
    }

    const wishlistItem = await wishlistService.addToWishlist(userId, productId);
    sendResponse(res, 201, wishlistItem, 'Product added to wishlist successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/wishlist/:productId:
 *   delete:
 *     summary: Remove product from wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:productId', async (req, res) => {
  try {
    const userId = req.user.id;
    await wishlistService.removeFromWishlist(userId, req.params.productId);
    sendResponse(res, 200, null, 'Product removed from wishlist successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/wishlist/:productId/check:
 *   get:
 *     summary: Check if product is in wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:productId/check', async (req, res) => {
  try {
    const userId = req.user.id;
    const isInWishlist = await wishlistService.isInWishlist(userId, req.params.productId);
    sendResponse(res, 200, { isInWishlist }, 'Wishlist status retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/wishlist/clear:
 *   delete:
 *     summary: Clear user's wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/clear', async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await wishlistService.clearWishlist(userId);
    sendResponse(res, 200, { removed: count }, 'Wishlist cleared successfully');
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = { router };
