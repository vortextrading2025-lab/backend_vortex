const express = require('express');
const WalletService = require('./walletService');
const { authenticate } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/rateLimit');
const { 
  successResponse, 
  errorResponse, 
  serverErrorResponse 
} = require('../../utils/response');

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/wallet:
 *   get:
 *     summary: Get user wallet
 *     description: Get wallet balance and information for the authenticated user
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet retrieved successfully
 */
router.get('/', async (req, res) => {
  try {
    const wallet = await WalletService.getWallet(req.user.id);
    return successResponse(res, 200, 'Wallet retrieved successfully', { wallet });
  } catch (error) {
    return serverErrorResponse(res, 'Failed to retrieve wallet', error);
  }
});

/**
 * @swagger
 * /api/wallet/transactions:
 *   get:
 *     summary: Get wallet transactions
 *     description: Get transaction history for the authenticated user's wallet
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 */
router.get('/transactions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const result = await WalletService.getTransactions(req.user.id, limit, offset);
    return successResponse(res, 200, 'Transactions retrieved successfully', result);
  } catch (error) {
    return serverErrorResponse(res, 'Failed to retrieve transactions', error);
  }
});

/**
 * @swagger
 * /api/wallet/withdraw:
 *   post:
 *     summary: Withdraw from wallet
 *     description: Withdraw funds from the authenticated user's wallet
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Withdrawal successful
 */
router.post('/withdraw', async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return errorResponse(res, 400, 'Invalid withdrawal amount');
    }

    const wallet = await WalletService.withdraw(req.user.id, amount);
    return successResponse(res, 200, 'Withdrawal successful', { wallet });
  } catch (error) {
    return errorResponse(res, 400, error.message);
  }
});

module.exports = { router };

