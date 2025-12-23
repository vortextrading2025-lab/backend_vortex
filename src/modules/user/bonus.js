const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/rateLimit');
const BonusService = require('../../services/bonusService');
const { sendResponse, sendError } = require('../../utils/response');

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/user/bonus/wallet:
 *   get:
 *     summary: Get user's bonus wallet
 *     tags: [User Bonus]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bonus wallet retrieved successfully
 */
router.get('/wallet', authorize(['USER', 'MENTOR']), async (req, res) => {
  try {
    const userId = req.user.id;
    const bonusWallet = await BonusService.getUserBonusWallet(userId);
    sendResponse(res, 200, bonusWallet, 'Bonus wallet retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/user/bonus/stats:
 *   get:
 *     summary: Get user's bonus statistics
 *     tags: [User Bonus]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bonus statistics retrieved successfully
 */
router.get('/stats', authorize(['USER', 'MENTOR']), async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await BonusService.getBonusStats(userId);
    sendResponse(res, 200, stats, 'Bonus statistics retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/user/bonus:
 *   get:
 *     summary: List user's bonuses
 *     tags: [User Bonus]
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
 *           enum: [ACTIVE, REDEEMED, EXPIRED, CANCELLED]
 *     responses:
 *       200:
 *         description: Bonuses list
 */
router.get('/', authorize(['USER', 'MENTOR']), async (req, res) => {
  try {
    const userId = req.user.id;
    const filters = {
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20,
      status: req.query.status || null,
      orderId: req.query.orderId || null,
    };

    const result = await BonusService.listUserBonuses(userId, filters);
    sendResponse(res, 200, result, 'Bonuses retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/user/bonus/:id:
 *   get:
 *     summary: Get bonus details
 *     tags: [User Bonus]
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
 *         description: Bonus details
 */
router.get('/:id', authorize(['USER', 'MENTOR']), async (req, res) => {
  try {
    const userId = req.user.id;
    const bonus = await BonusService.getBonusById(req.params.id, userId);
    sendResponse(res, 200, bonus, 'Bonus retrieved successfully');
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * @swagger
 * /api/user/bonus/:id/redeem:
 *   post:
 *     summary: Redeem bonus (transfer to main wallet)
 *     tags: [User Bonus]
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
 *         description: Bonus redeemed successfully
 */
router.post('/:id/redeem', authorize(['USER', 'MENTOR']), async (req, res) => {
  try {
    const userId = req.user.id;
    const bonus = await BonusService.redeemBonus(req.params.id, userId);
    sendResponse(res, 200, bonus, 'Bonus redeemed successfully');
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;

