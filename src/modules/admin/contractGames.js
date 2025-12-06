const express = require('express');
const { z } = require('zod');
const { authenticate, authorize } = require('../../middleware/auth');
const { successResponse, errorResponse, validationErrorResponse } = require('../../utils/response');
const ContractGameService = require('../../services/contractGameService');
const PurchaseService = require('../../services/purchaseService');
const database = require('../../config/database');
const logger = require('../../modules/logging/logger');

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(authorize('ADMIN'));

// Validation schemas
const createContractGameSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  downPayment: z.number().positive('Down payment must be positive'),
  payoutStage1: z.number().nonnegative('Payout Stage 1 must be non-negative'),
  payoutStage2: z.number().nonnegative('Payout Stage 2 must be non-negative'),
  payoutStage3: z.number().nonnegative('Payout Stage 3 must be non-negative')
});

const updateContractGameSchema = z.object({
  name: z.string().min(1).optional(),
  downPayment: z.number().positive().optional(),
  payoutStage1: z.number().nonnegative().optional(),
  payoutStage2: z.number().nonnegative().optional(),
  payoutStage3: z.number().nonnegative().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED']).optional()
});

/**
 * POST /api/admin/contract-games
 * Create a new contract game
 */
router.post('/', async (req, res) => {
  try {
    const validatedData = createContractGameSchema.parse(req.body);
    const adminId = req.user.id;

    const contractGame = await ContractGameService.createContractGame(
      adminId,
      validatedData.name,
      validatedData.downPayment,
      {
        payoutStage1: validatedData.payoutStage1,
        payoutStage2: validatedData.payoutStage2,
        payoutStage3: validatedData.payoutStage3
      }
    );

    return successResponse(res, 201, 'Contract game created successfully', contractGame);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse(res, error.errors);
    }
    logger.error('Error creating contract game:', error);
    return errorResponse(res, 400, error.message);
  }
});

/**
 * GET /api/admin/contract-games
 * List all contract games
 */
router.get('/', async (req, res) => {
  try {
    const status = req.query.status || null;
    const contractGames = await ContractGameService.listContractGames(status);

    return successResponse(res, 200, 'Contract games retrieved successfully', contractGames);
  } catch (error) {
    logger.error('Error listing contract games:', error);
    return errorResponse(res, 500, error.message);
  }
});

/**
 * GET /api/admin/contract-games/:id/tree
 * Get full tree structure for a contract game
 * NOTE: This route must come BEFORE /:id to avoid route conflicts
 */
router.get('/:id/tree', async (req, res) => {
  try {
    const contractGameId = req.params.id;
    const PlacementService = require('../../services/placementService');

    // Get system root for stage 1 (main tree)
    const stage1Root = await database.getClient().unit.findFirst({
      where: {
        contractGameId: contractGameId,
        stage: 1,
        isSystemRoot: true
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        contractGame: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!stage1Root) {
      return errorResponse(res, 404, 'Contract game tree not found. Game may not have been initialized.');
    }

    // Build full tree from root (this will include all relations)
    const tree = await PlacementService.buildUnitSubtree(stage1Root.id);

    return successResponse(res, 200, 'Contract game tree retrieved successfully', {
      root: stage1Root,
      tree: tree
    });
  } catch (error) {
    logger.error('Error getting contract game tree:', error);
    return errorResponse(res, 500, error.message);
  }
});

/**
 * GET /api/admin/contract-games/:id
 * Get contract game details
 */
router.get('/:id', async (req, res) => {
  try {
    const contractGame = await ContractGameService.getContractGame(req.params.id);

    if (!contractGame) {
      return errorResponse(res, 404, 'Contract game not found');
    }

    return successResponse(res, 200, 'Contract game retrieved successfully', contractGame);
  } catch (error) {
    logger.error('Error getting contract game:', error);
    return errorResponse(res, 500, error.message);
  }
});

/**
 * PUT /api/admin/contract-games/:id
 * Update contract game
 */
router.put('/:id', async (req, res) => {
  try {
    const validatedData = updateContractGameSchema.parse(req.body);

    const contractGame = await ContractGameService.updateContractGame(
      req.params.id,
      validatedData
    );

    return successResponse(res, 200, 'Contract game updated successfully', contractGame);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse(res, error.errors);
    }
    logger.error('Error updating contract game:', error);
    return errorResponse(res, 400, error.message);
  }
});

/**
 * GET /api/admin/purchase-requests
 * View all purchase requests
 */
router.get('/purchase-requests', async (req, res) => {
  try {
    const status = req.query.status || null;
    const where = status ? { status: status } : {};

    const requests = await database.getClient().purchaseRequest.findMany({
      where: where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        mentor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        contractGame: {
          select: {
            id: true,
            name: true,
            downPayment: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return successResponse(res, 200, 'Purchase requests retrieved successfully', requests);
  } catch (error) {
    logger.error('Error getting purchase requests:', error);
    return errorResponse(res, 500, error.message);
  }
});

/**
 * GET /api/admin/payouts
 * View payout history
 */
router.get('/payouts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const payouts = await database.getClient().payout.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        unit: {
          select: {
            id: true,
            unitName: true,
            unitNumber: true,
            contractGame: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    });

    const total = await database.getClient().payout.count();

    return successResponse(res, 200, 'Payouts retrieved successfully', {
      payouts,
      total,
      limit,
      offset
    });
  } catch (error) {
    logger.error('Error getting payouts:', error);
    return errorResponse(res, 500, error.message);
  }
});

/**
 * GET /api/admin/stats
 * System statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      totalMentors,
      totalContractGames,
      totalUnits,
      totalPayouts,
      totalPurchaseRequests
    ] = await Promise.all([
      database.getClient().user.count({ where: { role: 'USER' } }),
      database.getClient().user.count({ where: { role: 'MENTOR' } }),
      database.getClient().contractGame.count(),
      database.getClient().unit.count(),
      database.getClient().payout.aggregate({
        _sum: { amount: true },
        where: { status: 'CREDITED' }
      }),
      database.getClient().purchaseRequest.count()
    ]);

    return successResponse(res, 200, 'Statistics retrieved successfully', {
      totalUsers,
      totalMentors,
      totalContractGames,
      totalUnits,
      totalPayouts: totalPayouts._sum.amount || 0,
      totalPurchaseRequests
    });
  } catch (error) {
    logger.error('Error getting statistics:', error);
    return errorResponse(res, 500, error.message);
  }
});

module.exports = { router };

