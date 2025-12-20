const express = require('express');
const { z } = require('zod');
const { authenticate, authorize } = require('../../middleware/auth');
const { successResponse, errorResponse, validationErrorResponse } = require('../../utils/response');
const PurchaseService = require('../../services/purchaseService');
const PlacementService = require('../../services/placementService');
const database = require('../../config/database');
const logger = require('../logging/logger');

const router = express.Router();

// All routes require authentication and mentor role
router.use(authenticate);
router.use(authorize('MENTOR'));

// Validation schemas
const rejectRequestSchema = z.object({
  reason: z.string().optional()
});

/**
 * GET /api/mentor/requests
 * View assigned purchase requests
 */
router.get('/requests', async (req, res) => {
  try {
    const mentorId = req.user.id;
    const status = req.query.status || null;

    const where = {
      mentorId: mentorId
    };

    if (status) {
      where.status = status;
    }

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

    // Convert Decimal to Number for JSON serialization
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
    logger.error('Error getting mentor requests:', error);
    return errorResponse(res, 500, error.message);
  }
});

/**
 * POST /api/mentor/requests/:id/approve
 * Approve purchase request
 */
router.post('/requests/:id/approve', async (req, res) => {
  try {
    const mentorId = req.user.id;
    const requestId = req.params.id;
    const { hostId } = req.body; // Mentor can specify who the host is (optional, defaults to mentor)

    const request = await PurchaseService.approvePurchase(requestId, mentorId, hostId);

    // Convert Decimal to Number for JSON serialization
    const requestWithNumbers = {
      ...request,
      totalAmount: Number(request.totalAmount) || 0,
      contractGame: request.contractGame ? {
        ...request.contractGame,
        downPayment: Number(request.contractGame.downPayment) || 0
      } : request.contractGame
    };

    return successResponse(res, 200, 'Purchase request approved successfully', requestWithNumbers);
  } catch (error) {
    logger.error('Error approving purchase request:', error);
    return errorResponse(res, 400, error.message);
  }
});

/**
 * POST /api/mentor/requests/:id/reject
 * Reject purchase request
 */
router.post('/requests/:id/reject', async (req, res) => {
  try {
    const mentorId = req.user.id;
    const requestId = req.params.id;
    const validatedData = rejectRequestSchema.parse(req.body || {});

    const request = await PurchaseService.rejectPurchase(
      requestId,
      mentorId,
      validatedData.reason
    );

    // Convert Decimal to Number for JSON serialization
    const requestWithNumbers = {
      ...request,
      totalAmount: Number(request.totalAmount) || 0,
      contractGame: request.contractGame ? {
        ...request.contractGame,
        downPayment: Number(request.contractGame.downPayment) || 0
      } : request.contractGame
    };

    return successResponse(res, 200, 'Purchase request rejected successfully', requestWithNumbers);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse(res, error.errors);
    }
    logger.error('Error rejecting purchase request:', error);
    return errorResponse(res, 400, error.message);
  }
});

/**
 * POST /api/mentor/place-units
 * Place units for approved request
 */
router.post('/place-units', async (req, res) => {
  try {
    const requestId = req.body.requestId;

    if (!requestId) {
      return errorResponse(res, 400, 'Request ID is required');
    }

    // Verify the request is assigned to this mentor
    const request = await database.getClient().purchaseRequest.findUnique({
      where: { id: requestId },
      select: { mentorId: true, status: true }
    });

    if (!request) {
      return errorResponse(res, 404, 'Purchase request not found');
    }

    if (request.mentorId !== req.user.id) {
      return errorResponse(res, 403, 'You are not assigned to this purchase request');
    }

    const result = await PurchaseService.processPlacement(requestId);

    return successResponse(res, 200, 'Units placed successfully', result);
  } catch (error) {
    logger.error('Error placing units:', error);
    return errorResponse(res, 400, error.message);
  }
});

/**
 * GET /api/mentor/mentees
 * View users assigned to mentor (via mentorId relationship)
 */
router.get('/mentees', async (req, res) => {
  try {
    const mentorId = req.user.id;

    // Get all users assigned to this mentor via mentorId field
    const mentees = await database.getClient().user.findMany({
      where: {
        mentorId: mentorId,
        role: 'USER' // Only regular users, not other mentors
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (mentees.length === 0) {
      return successResponse(res, 200, 'Mentees retrieved successfully', []);
    }

    // Get mentee IDs for batch queries
    const menteeIds = mentees.map(m => m.id);

    // If no mentees, return empty array with empty stats
    if (menteeIds.length === 0) {
      return successResponse(res, 200, 'Mentees retrieved successfully', []);
    }

    // Batch query: Get all stats in 3 queries instead of 3*N queries
    // Only run if we have mentees to avoid empty array issues
    let purchaseRequestCounts = [];
    let unitCounts = [];
    let activeUnitCounts = [];

    try {
      [purchaseRequestCounts, unitCounts, activeUnitCounts] = await Promise.all([
        // Get purchase request counts for all mentees
        database.getClient().purchaseRequest.groupBy({
          by: ['userId'],
          where: {
            userId: { in: menteeIds },
            mentorId: mentorId
          },
          _count: {
            id: true
          }
        }),
        // Get total unit counts for all mentees
        database.getClient().unit.groupBy({
          by: ['ownerId'],
          where: {
            ownerId: { in: menteeIds }
          },
          _count: {
            id: true
          }
        }),
        // Get active unit counts for all mentees
        database.getClient().unit.groupBy({
          by: ['ownerId'],
          where: {
            ownerId: { in: menteeIds },
            isActive: true
          },
          _count: {
            id: true
          }
        })
      ]);
    } catch (dbError) {
      // If database connection fails, log error and return mentees with zero stats
      logger.error('Database error fetching mentee stats:', dbError);
      // Continue with empty stats arrays - mentees will have 0 for all stats
      purchaseRequestCounts = [];
      unitCounts = [];
      activeUnitCounts = [];
    }

    // Create lookup maps for O(1) access
    const requestCountMap = new Map(
      purchaseRequestCounts.map(item => [item.userId, item._count.id])
    );
    const unitCountMap = new Map(
      unitCounts.map(item => [item.ownerId, item._count.id])
    );
    const activeUnitCountMap = new Map(
      activeUnitCounts.map(item => [item.ownerId, item._count.id])
    );

    // Combine mentees with their stats
    const menteesWithStats = mentees.map((mentee) => ({
      id: mentee.id,
      email: mentee.email,
      firstName: mentee.firstName,
      lastName: mentee.lastName,
      status: mentee.status,
      createdAt: mentee.createdAt,
      stats: {
        totalRequests: requestCountMap.get(mentee.id) || 0,
        totalUnits: unitCountMap.get(mentee.id) || 0,
        activeUnits: activeUnitCountMap.get(mentee.id) || 0
      }
    }));

    return successResponse(res, 200, 'Mentees retrieved successfully', menteesWithStats);
  } catch (error) {
    logger.error('Error getting mentees:', error);
    return errorResponse(res, 500, error.message);
  }
});

/**
 * GET /api/mentor/mentees-in-game/:contractGameId
 * Get mentees who have units in a specific contract game (for host selection)
 * Only returns mentees who are already playing in that game
 */
router.get('/mentees-in-game/:contractGameId', async (req, res) => {
  try {
    const mentorId = req.user.id;
    const { contractGameId } = req.params;

    // Get all mentees who have units in this specific contract game
    const menteesWithUnits = await database.getClient().user.findMany({
      where: {
        mentorId: mentorId,
        role: 'USER', // Only regular users, not other mentors
        ownedUnits: {
          some: {
            contractGameId: contractGameId
          }
        }
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        _count: {
          select: {
            ownedUnits: {
              where: {
                contractGameId: contractGameId
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Format response
    const mentees = menteesWithUnits.map(mentee => ({
      id: mentee.id,
      email: mentee.email,
      firstName: mentee.firstName,
      lastName: mentee.lastName,
      status: mentee.status,
      unitCount: mentee._count.ownedUnits
    }));

    return successResponse(res, 200, 'Mentees in game retrieved successfully', mentees);
  } catch (error) {
    logger.error('Error getting mentees in game:', error);
    return errorResponse(res, 500, error.message);
  }
});

/**
 * GET /api/mentor/my-tree
 * View mentor's tree from their active unit (root of their tree)
 */
router.get('/my-tree', async (req, res) => {
  try {
    const mentorId = req.user.id;
    const contractGameId = req.query.contractGameId || null;

    // Find mentor's active unit(s) - they can have multiple active units in different games
    const where = {
      ownerId: mentorId,
      isActive: true,
      isCompleted: false,
      isSystemRoot: false
    };

    if (contractGameId) {
      where.contractGameId = contractGameId;
    }

    // Get all active units for this mentor
    const activeUnits = await database.getClient().unit.findMany({
      where: where,
      include: {
        contractGame: {
          select: {
            id: true,
            name: true,
            downPayment: true
          }
        },
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (activeUnits.length === 0) {
      return successResponse(res, 200, 'No active units found for mentor', {
        trees: [],
        message: 'You do not have any active units yet. Active units will appear here once contract games are created.'
      });
    }

    // For each active unit, build the tree structure using PlacementService
    const PlacementService = require('../../services/placementService');
    const trees = await Promise.all(
      activeUnits.map(async (rootUnit) => {
        // Use the same buildUnitSubtree method as admin endpoint for consistency
        const tree = await PlacementService.buildUnitSubtree(rootUnit.id);
        
        return {
          rootUnit: {
            id: rootUnit.id,
            unitName: rootUnit.unitName,
            unitNumber: rootUnit.unitNumber,
            stage: rootUnit.stage,
            level: rootUnit.level,
            contractGame: rootUnit.contractGame
          },
          tree: tree
        };
      })
    );

    return successResponse(res, 200, 'Mentor tree retrieved successfully', {
      trees: trees,
      totalActiveUnits: activeUnits.length
    });
  } catch (error) {
    logger.error('Error getting mentor tree:', error);
    return errorResponse(res, 500, error.message);
  }
});

/**
 * GET /api/mentor/trees/:userId
 * View mentee's unit tree
 */
router.get('/trees/:userId', async (req, res) => {
  try {
    const mentorId = req.user.id;
    const userId = req.params.userId;

    // Verify this user is assigned to this mentor
    const hasRequest = await database.getClient().purchaseRequest.findFirst({
      where: {
        userId: userId,
        mentorId: mentorId
      }
    });

    if (!hasRequest) {
      return errorResponse(res, 403, 'This user is not assigned to you');
    }

    // Get all units for this user
    const units = await database.getClient().unit.findMany({
      where: {
        ownerId: userId
      },
      include: {
        contractGame: {
          select: {
            id: true,
            name: true
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
        childrenUnits: {
          include: {
            owner: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: [
            { level: 'asc' },
            { positionInLevel: 'asc' }
          ]
        }
      },
      orderBy: [
        { contractGameId: 'asc' },
        { stage: 'asc' },
        { unitNumber: 'asc' }
      ]
    });

    return successResponse(res, 200, 'Unit tree retrieved successfully', units);
  } catch (error) {
    logger.error('Error getting mentee tree:', error);
    return errorResponse(res, 500, error.message);
  }
});

module.exports = { router };

