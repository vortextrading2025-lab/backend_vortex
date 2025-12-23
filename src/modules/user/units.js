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
 * Get user's purchase requests
 */
router.get('/my-requests', authenticate, async (req, res) => {
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
      select: {
        id: true,
        userId: true,
        contractGameId: true,
        unitCount: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        placedAt: true,
        cooldownEndsAt: true,
        refundedAt: true,
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
        createdAt: 'asc' // Order by creation time to get Contract 1, 2, 3...
      }
    });

    // For each purchase request, find its associated units
    // Units are matched by: same owner, same contractGame, created around the same time as placement
    // For APPROVED requests (units not yet placed), return empty units array
    // For PLACED requests, match units by time window
    const requestsWithUnits = await Promise.all(requests.map(async (request) => {
      // If request is APPROVED (not yet placed), return empty units array
      if (request.status === 'APPROVED') {
        return {
          ...request,
          units: []
        };
      }
      
      // If request is PLACED but no placedAt date, return empty units array
      if (request.status !== 'PLACED' || !request.placedAt) {
        return {
          ...request,
          units: []
        };
      }

      // Find units created around the time of placement (within 30 minutes for safety)
      // Also try without time window if no units found (in case of timing issues)
      const placementTime = new Date(request.placedAt);
      const timeWindowStart = new Date(placementTime.getTime() - 30 * 60 * 1000); // 30 minutes before
      const timeWindowEnd = new Date(placementTime.getTime() + 30 * 60 * 1000); // 30 minutes after

      // First try with time window
      let units = await database.getClient().unit.findMany({
        where: {
          ownerId: request.userId,
          contractGameId: request.contractGameId,
          isSystemRoot: false,
          createdAt: {
            gte: timeWindowStart,
            lte: timeWindowEnd
          }
        },
        select: {
          id: true,
          unitName: true,
          unitNumber: true,
          stage: true,
          level: true,
          positionInLevel: true,
          isActive: true,
          isCompleted: true,
          completedAt: true,
          createdAt: true
        },
        orderBy: {
          unitNumber: 'asc'
        }
      });

      // If no units found with time window, try without time constraint (fallback)
      // This handles cases where there might be timing discrepancies
      if (units.length === 0) {
        logger.warn(`No units found for purchase request ${request.id} with time window. Trying without time constraint.`);
        units = await database.getClient().unit.findMany({
          where: {
            ownerId: request.userId,
            contractGameId: request.contractGameId,
            isSystemRoot: false
          },
          select: {
            id: true,
            unitName: true,
            unitNumber: true,
            stage: true,
            level: true,
            positionInLevel: true,
            isActive: true,
            isCompleted: true,
            completedAt: true,
            createdAt: true
          },
          orderBy: {
            unitNumber: 'asc'
          },
          take: request.unitCount // Limit to expected unit count
        });
      }

      logger.info(`Found ${units.length} units for purchase request ${request.id} (expected ${request.unitCount})`);

      return {
        ...request,
        units: units
      };
    }));

    // Convert Decimal to Number and include units
    const requestsWithNumbers = requestsWithUnits.map(request => ({
      ...request,
      totalAmount: Number(request.totalAmount) || 0,
      contractGame: {
        ...request.contractGame,
        downPayment: Number(request.contractGame.downPayment) || 0,
        advancePaymentStage2: Number(request.contractGame.advancePaymentStage2) || 1150.00,
        advancePaymentStage3: Number(request.contractGame.advancePaymentStage3) || 2600.00,
        payoutStage1: Number(request.contractGame.payoutStage1) || 0,
        payoutStage2: Number(request.contractGame.payoutStage2) || 0,
        payoutStage3: Number(request.contractGame.payoutStage3) || 0
      },
      units: request.units || []
    }));

    return successResponse(res, 200, 'Purchase requests retrieved successfully', requestsWithNumbers);
  } catch (error) {
    logger.error('Error getting user purchase requests:', error);
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
 * POST /api/units/purchase-requests/:id/refund
 * Request to refund a purchase request
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

