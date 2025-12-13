const database = require('../config/database');
const logger = require('../modules/logging/logger');

/**
 * ContractGameService
 * Handles contract game management
 */
class ContractGameService {
  /**
   * Create a new contract game
   */
  static async createContractGame(adminId, name, downPayment, payoutAmounts) {
    // Validate payout amounts
    if (!payoutAmounts.payoutStage1 || !payoutAmounts.payoutStage2 || !payoutAmounts.payoutStage3) {
      throw new Error('Payout amounts for all stages are required');
    }

    if (downPayment <= 0) {
      throw new Error('Down payment must be greater than 0');
    }

    // Verify user is admin
    const admin = await database.getClient().user.findUnique({
      where: { id: adminId },
      select: { role: true }
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new Error('Only admins can create contract games');
    }

    // Create contract game with system root units only
    const contractGame = await database.getClient().$transaction(async (tx) => {
      // Create contract game
      const game = await tx.contractGame.create({
        data: {
          name: name,
          downPayment: downPayment,
          payoutStage1: payoutAmounts.payoutStage1,
          payoutStage2: payoutAmounts.payoutStage2,
          payoutStage3: payoutAmounts.payoutStage3,
          status: 'ACTIVE',
          createdById: adminId
        }
      });

      // Create system root unit for each stage (Stage 1, 2, 3)
      // Only create root units - no mentor tree structure
      const systemRoots = [];
      for (let stage = 1; stage <= 3; stage++) {
        const root = await tx.unit.create({
          data: {
            contractGameId: game.id,
            ownerId: adminId, // System/admin owns the root
            unitNumber: -stage, // Root units: -1, -2, -3 (unique per stage)
            unitName: `SYSTEM_ROOT_S${stage}`, // System root identifier
            stage: stage,
            level: 0, // Root is at level 0
            positionInLevel: 0,
            isActive: true, // Root units are always active
            isSystemRoot: true, // Mark as system root
            parentUnitId: null, // Root has no parent
            mentorId: null,
            hostId: null
          }
        });
        systemRoots.push({ stage, root });
      }

      logger.info(`Created contract game ${game.id}: ${name} with system root units only (3 root units for stages 1, 2, 3)`);

      // Return game with createdBy relation
      const result = await tx.contractGame.findUnique({
        where: { id: game.id },
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });
      
      // Convert Decimal to numbers for JSON serialization
      return {
        ...result,
        downPayment: Number(result.downPayment),
        payoutStage1: Number(result.payoutStage1),
        payoutStage2: Number(result.payoutStage2),
        payoutStage3: Number(result.payoutStage3)
      };
    }, {
      maxWait: 10000, // 10 seconds max wait for transaction to start
      timeout: 10000  // 10 seconds timeout for transaction to complete
    });

    return contractGame;
  }

  /**
   * Update contract game
   */
  static async updateContractGame(gameId, updates) {
    const allowedUpdates = ['name', 'downPayment', 'payoutStage1', 'payoutStage2', 'payoutStage3', 'status'];
    const updateData = {};

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        updateData[key] = updates[key];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('No valid fields to update');
    }

    const contractGame = await database.getClient().contractGame.update({
      where: { id: gameId },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: {
            units: true,
            purchaseRequests: true
          }
        }
      }
    });

    logger.info(`Updated contract game ${gameId}`);
    
    // Convert Decimal to numbers for JSON serialization
    return {
      ...contractGame,
      downPayment: Number(contractGame.downPayment),
      payoutStage1: Number(contractGame.payoutStage1),
      payoutStage2: Number(contractGame.payoutStage2),
      payoutStage3: Number(contractGame.payoutStage3)
    };
  }

  /**
   * Get contract game with statistics
   */
  static async getContractGame(gameId) {
    const contractGame = await database.getClient().contractGame.findUnique({
      where: { id: gameId },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: {
            units: true,
            purchaseRequests: true
          }
        }
      }
    });

    if (!contractGame) {
      return null;
    }

    // Get additional statistics
    const stats = await this.getContractGameStats(gameId);

    // Convert Decimal to numbers for JSON serialization
    return {
      ...contractGame,
      downPayment: Number(contractGame.downPayment),
      payoutStage1: Number(contractGame.payoutStage1),
      payoutStage2: Number(contractGame.payoutStage2),
      payoutStage3: Number(contractGame.payoutStage3),
      stats: stats
    };
  }

  /**
   * Get contract game statistics
   */
  static async getContractGameStats(gameId) {
    try {
      const [
        totalUnits,
        activeUnits,
        completedUnits,
        totalPayouts,
        pendingRequests,
        approvedRequests,
        placedRequests
      ] = await Promise.all([
        // Total units
        database.getClient().unit.count({
          where: { contractGameId: gameId }
        }).catch(() => 0),
        // Active units
        database.getClient().unit.count({
          where: {
            contractGameId: gameId,
            isActive: true,
            isCompleted: false
          }
        }).catch(() => 0),
        // Completed units
        database.getClient().unit.count({
          where: {
            contractGameId: gameId,
            isCompleted: true
          }
        }).catch(() => 0),
        // Total payouts amount
        database.getClient().payout.aggregate({
          where: {
            unit: {
              contractGameId: gameId
            },
            status: 'CREDITED'
          },
          _sum: {
            amount: true
          }
        }).catch((err) => {
          // Silently handle database connection errors
          if (err.message && err.message.includes('Can\'t reach database server')) {
            logger.warn(`Database connection issue when getting payouts for game ${gameId}`);
          }
          return { _sum: { amount: 0 } };
        }),
        // Pending requests
        database.getClient().purchaseRequest.count({
          where: {
            contractGameId: gameId,
            status: 'PENDING'
          }
        }).catch(() => 0),
        // Approved requests
        database.getClient().purchaseRequest.count({
          where: {
            contractGameId: gameId,
            status: 'APPROVED'
          }
        }).catch(() => 0),
        // Placed requests
        database.getClient().purchaseRequest.count({
          where: {
            contractGameId: gameId,
            status: 'PLACED'
          }
        }).catch(() => 0)
      ]);

      return {
        totalUnits,
        activeUnits,
        completedUnits,
        totalPayouts: Number(totalPayouts._sum.amount || 0),
        pendingRequests,
        approvedRequests,
        placedRequests
      };
    } catch (error) {
      logger.error(`Error getting contract game stats for ${gameId}:`, error);
      // Return default stats if database query fails
      return {
        totalUnits: 0,
        activeUnits: 0,
        completedUnits: 0,
        totalPayouts: 0,
        pendingRequests: 0,
        approvedRequests: 0,
        placedRequests: 0
      };
    }
  }

  /**
   * List contract games with optional status filter
   */
  static async listContractGames(status = null) {
    try {
      const where = status ? { status: status } : {};

      const contractGames = await database.getClient().contractGame.findMany({
        where: where,
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          },
          _count: {
            select: {
              units: true,
              purchaseRequests: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Get stats for each game and convert Decimal to numbers
      const gamesWithStats = await Promise.all(
        contractGames.map(async (game) => {
          const stats = await this.getContractGameStats(game.id);
          return {
            ...game,
            downPayment: Number(game.downPayment),
            payoutStage1: Number(game.payoutStage1),
            payoutStage2: Number(game.payoutStage2),
            payoutStage3: Number(game.payoutStage3),
            stats: stats
          };
        })
      );

      return gamesWithStats;
    } catch (error) {
      logger.error('Error listing contract games:', error);
      // If database connection fails, return empty array instead of crashing
      if (error.message && error.message.includes("Can't reach database server")) {
        logger.warn('Database connection failed, returning empty array');
        return [];
      }
      throw error;
    }
  }

  /**
   * Pause contract game (no new purchases)
   */
  static async pauseContractGame(gameId) {
    const contractGame = await database.getClient().contractGame.update({
      where: { id: gameId },
      data: {
        status: 'PAUSED'
      }
    });

    logger.info(`Paused contract game ${gameId}`);
    return contractGame;
  }

  /**
   * Complete contract game
   */
  static async completeContractGame(gameId) {
    const contractGame = await database.getClient().contractGame.update({
      where: { id: gameId },
      data: {
        status: 'COMPLETED'
      }
    });

    logger.info(`Completed contract game ${gameId}`);
    return contractGame;
  }

  /**
   * Build binary tree structure and assign units to mentors
   * Creates a 4-level binary tree: 2 → 4 → 8 → 16 = 30 mentor units total
   */
  static async buildMentorTreeStructure(tx, contractGameId, rootId, mentors) {
    if (mentors.length === 0) {
      logger.warn('No mentors found, skipping tree structure creation');
      return [];
    }

    const mentorUnits = [];
    let mentorIndex = 0;
    let unitCounter = 1; // Start from 1 for mentor units
    
    // Track which mentors have an active unit (only ONE active unit per mentor per game per stage)
    const mentorActiveUnits = new Set();

    // Helper function to check if a mentor already has an active unit
    const hasActiveUnit = (mentorId) => mentorActiveUnits.has(mentorId);
    
    // Helper function to create a unit with proper active status
    // IMPORTANT: Only the FIRST unit created for each mentor (by order) will be active
    // This ensures only ONE active unit per mentor per game per stage
    const createUnit = async (mentor, parentId, level, positionInLevel) => {
      // Check if this mentor already has an active unit in this game and stage
      const alreadyHasActive = mentorActiveUnits.has(mentor.id);
      const isActive = !alreadyHasActive; // Only first unit for this mentor is active
      
      if (isActive) {
        mentorActiveUnits.add(mentor.id);
        logger.info(`Marking first unit as active for mentor ${mentor.email} in game ${contractGameId} at level ${level}`);
      }
      
      const unit = await tx.unit.create({
        data: {
          contractGameId: contractGameId,
          ownerId: mentor.id,
          unitNumber: unitCounter++,
          unitName: `${mentor.email.split('@')[0]}_MENTOR_${unitCounter - 1}`,
          stage: 1,
          level: level,
          positionInLevel: positionInLevel,
          isActive: isActive, // Only first unit per mentor is active
          isSystemRoot: false,
          parentUnitId: parentId,
          mentorId: mentor.id,
          hostId: mentor.id
        }
      });
      
      return unit;
    };

    // Level 1: 2 units (binary tree)
    // These are the first units created, so they will be active for their respective mentors
    const level1Units = [];
    for (let i = 0; i < 2; i++) {
      const mentor = mentors[mentorIndex % mentors.length];
      const unit = await createUnit(mentor, rootId, 1, i + 1);
      level1Units.push(unit);
      mentorUnits.push(unit);
      mentorIndex++;
    }

    // Level 2: 4 units (2 children per level 1 unit)
    // These will be inactive (mentors already have active units from level 1)
    const level2Units = [];
    for (let i = 0; i < level1Units.length; i++) {
      const parent = level1Units[i];
      for (let j = 0; j < 2; j++) {
        const mentor = mentors[mentorIndex % mentors.length];
        const unit = await createUnit(mentor, parent.id, 2, (i * 2) + j + 1);
        level2Units.push(unit);
        mentorUnits.push(unit);
        mentorIndex++;
      }
    }

    // Level 3: 8 units (2 children per level 2 unit)
    // These will be inactive (mentors already have active units)
    const level3Units = [];
    for (let i = 0; i < level2Units.length; i++) {
      const parent = level2Units[i];
      for (let j = 0; j < 2; j++) {
        const mentor = mentors[mentorIndex % mentors.length];
        const unit = await createUnit(mentor, parent.id, 3, (i * 2) + j + 1);
        level3Units.push(unit);
        mentorUnits.push(unit);
        mentorIndex++;
      }
    }

    // Level 4: 16 units (2 children per level 3 unit) - These are placement points
    // These will be inactive (mentors already have active units)
    // User units will be placed under the mentor's ACTIVE unit (from level 1)
    for (let i = 0; i < level3Units.length; i++) {
      const parent = level3Units[i];
      for (let j = 0; j < 2; j++) {
        const mentor = mentors[mentorIndex % mentors.length];
        const unit = await createUnit(mentor, parent.id, 4, (i * 2) + j + 1);
        mentorUnits.push(unit);
        mentorIndex++;
      }
    }

    const activeCount = mentorActiveUnits.size;
    logger.info(`Built tree structure: ${mentorUnits.length} mentor units across 4 levels. ${activeCount} mentors have active units.`);
    return mentorUnits;
  }
}

module.exports = ContractGameService;

