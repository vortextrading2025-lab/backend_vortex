const express = require('express');
const { z } = require('zod');
const { authenticate } = require('../../middleware/auth');
const { successResponse, errorResponse, validationErrorResponse } = require('../../utils/response');
const PurchaseService = require('../../services/purchaseService');
const ContractGameService = require('../../services/contractGameService');
const PlacementService = require('../../services/placementService');
const database = require('../../config/database');
const logger = require('../logging/logger');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const purchaseRequestSchema = z.object({
  contractGameId: z.string().min(1, 'Contract game ID is required'),
  unitCount: z.number().int().min(1, 'At least 1 unit is required').max(4, 'Maximum 4 units per purchase')
});

/**
 * POST /api/units/purchase
 * Request to purchase units (DEMO MODE: Auto-approves and auto-places)
 */
router.post('/purchase', async (req, res) => {
  try {
    const validatedData = purchaseRequestSchema.parse(req.body);
    const userId = req.user.id;

    // DEMO MODE: Create request, auto-approve, and auto-place
    const request = await PurchaseService.createPurchaseRequest(
      userId,
      validatedData.contractGameId,
      validatedData.unitCount
    );

    // Auto-approve the request (demo mode - no payment gateway)
    const approvedRequest = await PurchaseService.approvePurchase(request.id, request.mentorId);

    // Auto-place the units
    const placementResult = await PurchaseService.processPlacement(approvedRequest.id);

    // Get wallet service to simulate payment deduction (optional in demo mode)
    const WalletService = require('../../modules/wallet/walletService');
    try {
      // In demo mode, we can skip actual payment or just log it
      logger.info(`DEMO MODE: Simulated payment of $${approvedRequest.totalAmount} for purchase request ${request.id}`);
    } catch (walletError) {
      // Ignore wallet errors in demo mode
      logger.warn('Wallet service not available in demo mode, skipping payment');
    }

    return successResponse(res, 201, 'Units purchased successfully (Demo Mode)', {
      request: placementResult.request,
      units: placementResult.units,
      activeUnit: placementResult.units.find(u => u.isActive) || placementResult.units[0] || null
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse(res, error.errors);
    }
    logger.error('Error processing purchase:', error);
    return errorResponse(res, 400, error.message);
  }
});

/**
 * GET /api/units/my-units
 * View own units and tree
 */
router.get('/my-units', async (req, res) => {
  try {
    const userId = req.user.id;
    const contractGameId = req.query.contractGameId || null;

    const where = {
      ownerId: userId
    };

    if (contractGameId) {
      where.contractGameId = contractGameId;
    }

    const units = await database.getClient().unit.findMany({
      where: where,
      include: {
        contractGame: {
          select: {
            id: true,
            name: true,
            downPayment: true
          }
        },
        parentUnit: {
          select: {
            id: true,
            unitName: true,
            unitNumber: true,
            owner: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
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
        host: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        childrenUnits: {
          select: {
            id: true,
            unitName: true,
            unitNumber: true,
            stage: true,
            isActive: true,
            isCompleted: true,
            level: true,
            positionInLevel: true,
            owner: {
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
            host: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        payouts: {
          select: {
            id: true,
            amount: true,
            stage: true,
            status: true,
            createdAt: true
          }
        }
      },
      orderBy: [
        { contractGameId: 'asc' },
        { stage: 'asc' },
        { unitNumber: 'asc' }
      ]
    });

    // Get active units per stage per game
    const activeUnits = {};
    units.forEach(unit => {
      if (unit.isActive) {
        const key = `${unit.contractGameId}_${unit.stage}`;
        if (!activeUnits[key]) {
          activeUnits[key] = unit;
        }
      }
    });

    return successResponse(res, 200, 'Units retrieved successfully', {
      units,
      activeUnits: Object.values(activeUnits)
    });
  } catch (error) {
    logger.error('Error getting user units:', error);
    return errorResponse(res, 500, error.message);
  }
});

/**
 * GET /api/units/my-requests
 * Get user's purchase requests
 */
router.get('/my-requests', async (req, res) => {
  try {
    const userId = req.user.id;
    const contractGameId = req.query.contractGameId || null;

    const where = {
      userId: userId
    };

    if (contractGameId) {
      where.contractGameId = contractGameId;
    }

    const requests = await database.getClient().purchaseRequest.findMany({
      where: where,
      include: {
        contractGame: {
          select: {
            id: true,
            name: true,
            downPayment: true
          }
        },
        mentor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Convert Decimal to Number
    const requestsWithNumbers = requests.map(request => ({
      ...request,
      totalAmount: Number(request.totalAmount) || 0,
      contractGame: {
        ...request.contractGame,
        downPayment: Number(request.contractGame.downPayment) || 0
      }
    }));

    return successResponse(res, 200, 'Purchase requests retrieved successfully', requestsWithNumbers);
  } catch (error) {
    logger.error('Error getting user purchase requests:', error);
    return errorResponse(res, 500, error.message);
  }
});


/**
 * GET /api/units/:id/tree
 * View unit tree structure (starting from this unit)
 */
router.get('/:id/tree', async (req, res) => {
  try {
    const unitId = req.params.id;
    const PlacementService = require('../../services/placementService');

    // Get the unit first to verify it exists and user has access
    const unit = await database.getClient().unit.findUnique({
      where: { id: unitId },
      include: {
        contractGame: {
          select: {
            id: true,
            name: true,
            status: true
          }
        },
        owner: {
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
        host: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!unit) {
      return errorResponse(res, 404, 'Unit not found');
    }

    // Verify user has access to this unit (owner or can view through contract game)
    // For now, allow if user is authenticated (can be made more restrictive later)
    // Users can view their own units or units in games they participate in

    // Build full tree from this unit using the same method as admin/mentor
    const tree = await PlacementService.buildUnitSubtree(unitId);

    return successResponse(res, 200, 'Unit tree retrieved successfully', tree);
  } catch (error) {
    logger.error('Error getting unit tree:', error);
    return errorResponse(res, 500, error.message);
  }
});

module.exports = { router };

