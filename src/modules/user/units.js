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
  contractGameId: z.string().optional(), // Optional - will auto-detect active game if not provided
  unitCount: z.number().int().min(1, 'At least 1 unit is required')
});

/**
 * POST /api/units/purchase
 * Request to purchase units - auto-approved and units placed automatically
 * If user was invited, units placed under inviter's active unit
 * If not invited, units placed under system root
 */
router.post('/purchase', async (req, res) => {
  try {
    const validatedData = purchaseRequestSchema.parse(req.body);
    const userId = req.user.id;

    // Auto-detect active contract game if not provided
    let contractGameId = validatedData.contractGameId;
    if (!contractGameId) {
      const activeGame = await database.getClient().contractGame.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' }
      });
      
      if (!activeGame) {
        return errorResponse(res, 400, 'No active contract game found. Please contact an administrator to create a contract game.');
      }
      
      contractGameId = activeGame.id;
      logger.info(`Auto-detected active contract game: ${activeGame.id} (${activeGame.name})`);
    }

    // Create purchase request - auto-approved and units placed automatically
    const request = await PurchaseService.createPurchaseRequest(
      userId,
      contractGameId,
      validatedData.unitCount
    );

    // Get the full request with related data
    const fullRequest = await database.getClient().purchaseRequest.findUnique({
      where: { id: request.id },
      include: {
        user: {
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
        },
        mentor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    logger.info(`Purchase request created and auto-placed: ${request.id} for user ${userId}. Status: ${request.status}`);

    return successResponse(res, 201, 'Purchase request approved! Your units have been placed automatically.', {
      request: fullRequest
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse(res, error.errors);
    }
    logger.error('Error creating purchase request:', error);
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
      ownerId: userId,
      isSystemRoot: false // Exclude system root units
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
 * Get user's contracts (each unit is a separate contract)
 * Returns each unit as a separate contract with its own cooldown and cancellation status
 */
router.get('/my-requests', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const contractGameId = req.query.contractGameId || null;

    const where = {
      ownerId: userId,
      isSystemRoot: false,
      refundedAt: null // Only show non-refunded units
    };

    if (contractGameId) {
      where.contractGameId = contractGameId;
    }

    // Get all units for this user (each unit is a separate contract)
    const units = await database.getClient().unit.findMany({
      where: where,
      include: {
        contractGame: {
          select: {
            id: true,
            name: true,
            downPayment: true,
            advancePaymentStage2: true,
            advancePaymentStage3: true,
            payoutStage1: true,
            payoutStage2: true,
            payoutStage3: true,
            status: true
          }
        },
        purchaseRequest: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            placedAt: true
          }
        },
        payouts: {
          select: {
            id: true,
            amount: true,
            stage: true,
            status: true,
            createdAt: true,
            creditedAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: {
        createdAt: 'asc' // Order by creation to get Contract 1, 2, 3...
      }
    });

    // Map each unit to a contract
    const contracts = await Promise.all(units.map(async (unit, index) => {
      // Calculate advance payment amount based on stage
      let advancePayment = 0;
      if (unit.stage === 1) {
        advancePayment = Number(unit.contractGame.downPayment);
      } else if (unit.stage === 2) {
        advancePayment = Number(unit.contractGame.advancePaymentStage2);
      } else if (unit.stage === 3) {
        advancePayment = Number(unit.contractGame.advancePaymentStage3);
      }

      // Count children units in the required level
      // Stage 1: need 4 units in level 4 (unit.level + 3)
      // Stage 2/3: need 4 units in level 3 (unit.level + 2)
      const requiredLevel = unit.stage === 1 ? unit.level + 3 : unit.level + 2;
      const childrenInRequiredLevel = await database.getClient().unit.count({
        where: {
          parentUnitId: unit.id,
          level: requiredLevel,
          contractGameId: unit.contractGameId,
          stage: unit.stage
        }
      });

      // Check if unit has received commission payment for current stage
      const hasReceivedCommission = (unit.payouts || []).some(p => 
        p.stage === unit.stage && (p.status === 'CREDITED' || p.status === 'COMPLETED')
      );

      // Check if unit has ever been active (has payouts or was active)
      const hasEverBeenActive = unit.isActive || (unit.payouts && unit.payouts.length > 0) || unit.completedAt;

      return {
        id: unit.id, // Use unit ID as contract ID
        contractNumber: index + 1, // Contract 1, 2, 3...
        unit: {
          id: unit.id,
          unitName: unit.unitName,
          unitNumber: unit.unitNumber,
          stage: unit.stage,
          level: unit.level,
          positionInLevel: unit.positionInLevel,
          isActive: unit.isActive,
          isCompleted: unit.isCompleted,
          completedAt: unit.completedAt,
          createdAt: unit.createdAt,
          purchaseRequestId: unit.purchaseRequestId || unit.purchaseRequest?.id || null
        },
        contractGame: {
          id: unit.contractGame.id,
          name: unit.contractGame.name || 'Vortex Contract',
          status: unit.contractGame.status || 'ACTIVE',
          downPayment: Number(unit.contractGame.downPayment) || 0,
          advancePaymentStage2: Number(unit.contractGame.advancePaymentStage2) || 1150.00,
          advancePaymentStage3: Number(unit.contractGame.advancePaymentStage3) || 2600.00,
          payoutStage1: Number(unit.contractGame.payoutStage1) || 0,
          payoutStage2: Number(unit.contractGame.payoutStage2) || 0,
          payoutStage3: Number(unit.contractGame.payoutStage3) || 0
        },
        advancePayment: advancePayment,
        totalAmount: advancePayment, // For single unit, total = advance payment
        cooldownEndsAt: unit.cooldownEndsAt,
        refundedAt: unit.refundedAt,
        createdAt: unit.createdAt,
        placedAt: unit.purchaseRequest?.placedAt || unit.createdAt,
        requestStatus: unit.purchaseRequest?.status || 'PLACED', // Status of the purchase request
        payouts: (unit.payouts || []).map(p => ({
          id: p.id,
          amount: Number(p.amount),
          stage: p.stage,
          status: p.status,
          createdAt: p.createdAt,
          creditedAt: p.creditedAt
        })),
        // Status calculation data
        hasEverBeenActive: hasEverBeenActive,
        hasReceivedCommission: hasReceivedCommission,
        childrenInRequiredLevel: childrenInRequiredLevel,
        requiredLevel: requiredLevel
      };
    }));

    return successResponse(res, 200, 'Contracts retrieved successfully', contracts);
  } catch (error) {
    logger.error('Error getting user contracts:', error);
    return errorResponse(res, 500, error.message);
  }
});

/**
 * POST /api/units/purchase-requests/:id/retry-placement
 * Retry placement for a stuck APPROVED purchase request
 */
router.post('/purchase-requests/:id/retry-placement', authenticate, async (req, res) => {
  try {
    const requestId = req.params.id;
    const userId = req.user.id;
    
    // Verify the request belongs to the user
    const request = await database.getClient().purchaseRequest.findUnique({
      where: { id: requestId },
      select: { userId: true, status: true }
    });
    
    if (!request) {
      return errorResponse(res, 404, 'Purchase request not found');
    }
    
    if (request.userId !== userId) {
      return errorResponse(res, 403, 'You can only retry placement for your own purchase requests');
    }
    
    if (request.status !== 'APPROVED') {
      return errorResponse(res, 400, `Cannot retry placement. Request status is ${request.status}. Only APPROVED requests can be retried.`);
    }
    
    // Retry placement
    const PurchaseService = require('../../services/purchaseService');
    const result = await PurchaseService.processPlacement(requestId);
    
    return successResponse(res, 200, 'Units placed successfully', result);
  } catch (error) {
    logger.error('Error retrying placement:', error);
    return errorResponse(res, 400, error.message);
  }
});

/**
 * POST /api/units/:id/refund
 * Refund a single unit (cancels the unit and refunds money)
 * Each unit is a separate contract with its own cooldown period
 */
router.post('/:id/refund', authenticate, async (req, res) => {
  try {
    const unitId = req.params.id;
    const userId = req.user.id;

    const RefundService = require('../../services/refundService');
    const result = await RefundService.processUnitRefund(unitId, userId);

    return successResponse(res, 200, 'Unit refunded successfully', result);
  } catch (error) {
    logger.error('Error refunding unit:', error);
    return errorResponse(res, 400, error.message);
  }
});

/**
 * POST /api/units/purchase-requests/:id/refund
 * Request to refund a purchase request (kept for backward compatibility)
 * Note: Now each unit should be refunded individually using /api/units/:id/refund
 */
router.post('/purchase-requests/:id/refund', authenticate, async (req, res) => {
  try {
    const requestId = req.params.id;
    const userId = req.user.id;
    
    const RefundService = require('../../services/refundService');
    const result = await RefundService.processRefund(requestId, userId);
    
    return successResponse(res, 200, 'Refund processed successfully', result);
  } catch (error) {
    logger.error('Error processing refund:', error);
    return errorResponse(res, 400, error.message);
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

