const express = require('express');
const { authenticate, optionalAuth } = require('../../middleware/auth');
const { successResponse, errorResponse } = require('../../utils/response');
const database = require('../../config/database');
const logger = require('../logging/logger');

const router = express.Router();

/**
 * GET /api/contract-games
 * List available contract games
 * NOTE: This route must come BEFORE /:id routes to avoid route conflicts
 */
router.get('/contract-games', optionalAuth, async (req, res) => {
  try {
    const ContractGameService = require('../../services/contractGameService');
    const status = req.query.status === 'ACTIVE' ? 'ACTIVE' : null;
    const contractGames = await ContractGameService.listContractGames(status);

    return successResponse(res, 200, 'Contract games retrieved successfully', contractGames);
  } catch (error) {
    logger.error('Error getting contract games:', error);
    return errorResponse(res, 500, error.message);
  }
});

/**
 * GET /api/contract-games/:id
 * Get contract game details (public)
 * NOTE: This route must come BEFORE /:id routes to avoid route conflicts
 */
router.get('/contract-games/:id', optionalAuth, async (req, res) => {
  try {
    const ContractGameService = require('../../services/contractGameService');
    const contractGame = await ContractGameService.getContractGame(req.params.id);

    if (!contractGame) {
      return errorResponse(res, 404, 'Contract game not found');
    }

    // If user is authenticated, add their unit count for this game
    let userUnitCount = 0;
    if (req.user && req.user.id) {
      try {
        userUnitCount = await database.getClient().unit.count({
          where: {
            ownerId: req.user.id,
            contractGameId: req.params.id
          }
        });
      } catch (err) {
        // Ignore errors, just use 0
        logger.warn(`Error getting user unit count: ${err.message}`);
      }
    }

    return successResponse(res, 200, 'Contract game retrieved successfully', {
      ...contractGame,
      userUnitCount: userUnitCount,
      canPurchaseMore: userUnitCount < 4
    });
  } catch (error) {
    logger.error('Error getting contract game:', error);
    return errorResponse(res, 500, error.message);
  }
});

/**
 * GET /api/units/:id/tree
 * View unit tree structure
 */
router.get('/:id/tree', optionalAuth, async (req, res) => {
  try {
    const unitId = req.params.id;
    const PlacementService = require('../../services/placementService');

    // Get the unit first to verify it exists
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

    // Build full tree from this unit using the same method as admin/mentor
    const tree = await PlacementService.buildUnitSubtree(unitId);

    return successResponse(res, 200, 'Unit tree retrieved successfully', tree);
  } catch (error) {
    logger.error('Error getting unit tree:', error);
    return errorResponse(res, 500, error.message);
  }
});

/**
 * GET /api/units/:id
 * Get unit details
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const unitId = req.params.id;
    const userId = req.user?.id || null;

    const unit = await database.getClient().unit.findUnique({
      where: { id: unitId },
      include: {
        contractGame: {
          select: {
            id: true,
            name: true,
            downPayment: true,
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
            }
          },
          orderBy: [
            { level: 'asc' },
            { positionInLevel: 'asc' }
          ]
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
      }
    });

    if (!unit) {
      return errorResponse(res, 404, 'Unit not found');
    }

    // If user is not the owner and not admin, return limited details
    if (userId && unit.ownerId !== userId) {
      const user = await database.getClient().user.findUnique({
        where: { id: userId },
        select: { role: true }
      });

      if (!user || user.role !== 'ADMIN') {
        // Return limited details for non-owners
        return successResponse(res, 200, 'Unit details retrieved successfully', {
          id: unit.id,
          unitName: unit.unitName,
          unitNumber: unit.unitNumber,
          stage: unit.stage,
          isActive: unit.isActive,
          isCompleted: unit.isCompleted,
          level: unit.level,
          positionInLevel: unit.positionInLevel,
          contractGame: unit.contractGame,
          createdAt: unit.createdAt
        });
      }
    }

    return successResponse(res, 200, 'Unit details retrieved successfully', unit);
  } catch (error) {
    logger.error('Error getting unit details:', error);
    return errorResponse(res, 500, error.message);
  }
});

module.exports = { router };

