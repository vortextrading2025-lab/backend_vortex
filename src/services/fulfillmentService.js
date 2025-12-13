const database = require('../config/database');
const logger = require('../modules/logging/logger');
const PlacementService = require('./placementService');

/**
 * FulfillmentService
 * Handles unit completion and fulfillment logic
 */
class FulfillmentService {
  /**
   * Count units in next N levels below a unit
   */
  static async countChildUnits(unitId, levels) {
    const unit = await database.getClient().unit.findUnique({
      where: { id: unitId },
      select: { level: true }
    });

    if (!unit) {
      return 0;
    }

    // Get all children units within the next N levels
    const children = await database.getClient().unit.findMany({
      where: {
        parentUnitId: unitId,
        level: {
          lte: unit.level + levels
        },
        isCompleted: false
      }
    });

    return children.length;
  }

  /**
   * Count units in each level below a unit
   * Returns object with level as key and count as value
   */
  static async countUnitsByLevel(unitId) {
    const client = database.getClient();

    // Get root unit info (we'll need its level for relative checks)
    const root = await client.unit.findUnique({
      where: { id: unitId },
      select: { id: true, level: true, contractGameId: true, stage: true }
    });

    if (!root) {
      return {};
    }

    // BFS over descendants to count units per absolute level
    const levelCounts = {};
    let currentIds = [unitId];

    while (currentIds.length > 0) {
      const children = await client.unit.findMany({
        where: {
          parentUnitId: { in: currentIds },
          contractGameId: root.contractGameId,
          stage: root.stage // only count units in the same stage tree
        },
        select: { id: true, level: true }
      });

      if (children.length === 0) break;

      children.forEach((child) => {
        levelCounts[child.level] = (levelCounts[child.level] || 0) + 1;
      });

      currentIds = children.map((c) => c.id);
    }

    return levelCounts;
  }

  /**
   * Check if active unit should stay active
   * Stage 1: Active unit stays active until 2 units in 4th level (binary tree)
   * Stage 2/3: Active unit stays active until 2 units in 3rd level (binary tree)
   */
  static async shouldStayActive(unitId) {
    const unit = await database.getClient().unit.findUnique({
      where: { id: unitId },
      select: { stage: true, level: true }
    });

    if (!unit || !unit.isActive) {
      return false;
    }

    const levelCounts = await this.countUnitsByLevel(unitId);

    if (unit.stage === 1) {
      // Stage 1: Need 2 units in level 4 (which is level + 4) - binary tree
      const level4 = unit.level + 4;
      const level4Count = levelCounts[level4] || 0;
      return level4Count < 2;
    } else if (unit.stage === 2 || unit.stage === 3) {
      // Stage 2/3: Need 2 units in level 3 (which is level + 3) - binary tree
      const level3 = unit.level + 3;
      const level3Count = levelCounts[level3] || 0;
      return level3Count < 2;
    }

    return false;
  }

  /**
   * Check if a unit should be fulfilled
   * Stage 1: Completes when next 3 levels are filled (14 units: 2+4+6+2) - binary tree
   * Stage 2/3: Completes when next 2 levels are filled (6 units: 2+4) - binary tree
   */
  static async checkFulfillment(unitId) {
    const unit = await database.getClient().unit.findUnique({
      where: { id: unitId },
      include: {
        contractGame: {
          select: {
            id: true,
            payoutStage1: true,
            payoutStage2: true,
            payoutStage3: true
          }
        }
      }
    });

    if (!unit || unit.isCompleted) {
      return false;
    }

    const levelCounts = await this.countUnitsByLevel(unitId);

    let requiredLevels = 0;
    let requiredUnits = 0;
    let levelRequirements = {};

    if (unit.stage === 1) {
      // Stage 1: Need 3 levels filled (binary tree structure)
      // Level 1: 2 units, Level 2: 4 units, Level 3: 6 units, Level 4: 2 units (total 14)
      requiredLevels = 3;
      requiredUnits = 14;
      levelRequirements = {
        [unit.level + 1]: 2, // Level 1: 2 units (binary tree: max 2 children)
        [unit.level + 2]: 4, // Level 2: 4 units (2*2)
        [unit.level + 3]: 6, // Level 3: 6 units (partial, out of max 8)
        [unit.level + 4]: 2  // Level 4: 2 units (partial)
      };
    } else if (unit.stage === 2 || unit.stage === 3) {
      // Stage 2/3: Need 2 levels filled (binary tree structure)
      // Level 1: 2 units, Level 2: 4 units (total 6)
      requiredLevels = 2;
      requiredUnits = 6;
      levelRequirements = {
        [unit.level + 1]: 2, // Level 1: 2 units (binary tree: max 2 children)
        [unit.level + 2]: 4  // Level 2: 4 units (2*2)
      };
    } else {
      return false; // Already completed or invalid stage
    }

    // Check if all required levels are filled
    let allLevelsFilled = true;
    let totalFilled = 0;

    for (const [levelStr, required] of Object.entries(levelRequirements)) {
      const level = parseInt(levelStr);
      const filled = levelCounts[level] || 0;
      totalFilled += filled;

      if (filled < required) {
        allLevelsFilled = false;
      }
    }

    // Special logic: Active unit stays active until 4th/3rd level has 2 units (binary tree)
    if (unit.isActive) {
      const shouldStayActive = await this.shouldStayActive(unitId);
      if (shouldStayActive) {
        return false; // Don't fulfill yet, wait for 4th/3rd level to fill
      }
    }

    // Check if all requirements are met
    if (allLevelsFilled && totalFilled >= requiredUnits) {
      return true;
    }

    return false;
  }

  /**
   * Fulfill a unit: mark as completed, create payout, move to next stage
   */
  static async fulfillUnit(unitId) {
    logger.info(`FULFILL_START unitId=${unitId}`);
    const client = database.getClient();

    // First, perform the core fulfillment in a short transaction:
    // - validate & check fulfillment
    // - mark unit as completed/inactive
    // - create payout (PENDING)
    // Then, outside the transaction, credit the wallet and mark payout CREDITED.
    const { updatedUnit, payoutId, payoutAmount, parentUnitId } = await client.$transaction(async (tx) => {
      const unit = await tx.unit.findUnique({
        where: { id: unitId },
        include: {
          contractGame: {
            select: {
              id: true,
              payoutStage1: true,
              payoutStage2: true,
              payoutStage3: true
            }
          },
          owner: {
            select: {
              id: true,
              email: true
            }
          }
        }
      });

      if (!unit) {
        throw new Error('Unit not found');
      }

      if (unit.isCompleted) {
        logger.warn(`Unit ${unitId} is already completed`);
        return unit;
      }

      // Check if should be fulfilled
      const shouldFulfill = await this.checkFulfillment(unitId);
      if (!shouldFulfill) {
        // Return null structure to indicate not ready (will be handled outside transaction)
        return { updatedUnit: null, payoutId: null, payoutAmount: 0, parentUnitId: null };
      }

      // Get payout amount based on stage
      let payoutAmount = 0;
      if (unit.stage === 1) {
        payoutAmount = parseFloat(unit.contractGame.payoutStage1) || 0;
      } else if (unit.stage === 2) {
        payoutAmount = parseFloat(unit.contractGame.payoutStage2) || 0;
      } else if (unit.stage === 3) {
        payoutAmount = parseFloat(unit.contractGame.payoutStage3) || 0;
      }

      // Mark unit as completed
      // IMPORTANT: Unit becomes inactive after completing each stage
      // After Stage 1 completion, unit becomes inactive (new Stage 2 unit becomes active)
      // After Stage 2 completion, unit becomes inactive (new Stage 3 unit becomes active)
      // After Stage 3 completion, unit becomes inactive (fully completed)
      const updateData = {
        isCompleted: true,
        completedAt: new Date(),
        isActive: false // Deactivate after completing any stage
      };

      // Move to next stage if not in stage 3
      if (unit.stage === 1) {
        // Stage 1 → Stage 2: Unit becomes inactive after completing Stage 1
        // A new Stage 2 unit will become active for the user
      } else if (unit.stage === 2) {
        // Stage 2 → Stage 3: Unit becomes inactive after completing Stage 2
        // A new Stage 3 unit will become active for the user
      } else if (unit.stage === 3) {
        // Stage 3 → COMPLETED (final stage)
        // Unit becomes inactive after completing all 3 stages
        // No further stages
      }

      await tx.unit.update({
        where: { id: unitId },
        data: updateData
      });

      // Create payout record
      const payout = await tx.payout.create({
        data: {
          unitId: unitId,
          userId: unit.ownerId,
          walletId: null, // set after wallet upsert (outside transaction)
          amount: payoutAmount,
          stage: unit.stage,
          status: 'PENDING'
        }
      });

      // Check fulfillment for parent unit (cascade check) - do this outside transaction
      const parentUnitId = unit.parentUnitId;

      const updatedUnit = await tx.unit.findUnique({
        where: { id: unitId },
        include: {
          contractGame: true,
          owner: true
        }
      });

      return { updatedUnit, payoutId: payout.id, payoutAmount, parentUnitId };
    }, {
      timeout: 20000 // increase timeout to allow core fulfillment
    });

    // Outside transaction: credit wallet and mark payout CREDITED
    // This avoids long-running work inside the fulfillment transaction.
    // Check if fulfillment actually happened (payoutId will be null if not ready)
    if (!updatedUnit || !payoutId || payoutAmount <= 0) {
      logger.info(`Unit ${unitId} is not ready to fulfill yet`);
      return null;
    }
    
    if (payoutId && payoutAmount > 0) {
      const wallet = await client.wallet.upsert({
        where: { userId: updatedUnit.ownerId },
        update: {},
        create: {
          userId: updatedUnit.ownerId,
          balance: 0,
          totalEarned: 0,
          totalWithdrawn: 0
        }
      });

      await client.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: payoutAmount },
          totalEarned: { increment: payoutAmount }
        }
      });

      await client.transaction.create({
        data: {
          walletId: wallet.id,
          userId: updatedUnit.ownerId,
          type: 'DEPOSIT',
          amount: payoutAmount,
          status: 'COMPLETED',
          referenceId: updatedUnit.id,
          referenceType: 'PAYOUT',
          description: `Payout for unit completion - Stage ${updatedUnit.stage}`
        }
      });

      // Attach walletId to payout now that wallet exists
      await client.payout.update({
        where: { id: payoutId },
        data: {
          walletId: wallet.id
        }
      });

      await client.payout.update({
        where: { id: payoutId },
        data: {
          status: 'CREDITED',
          creditedAt: new Date()
        }
      });
    }

    // Enhanced logging with owner information
    const ownerEmail = updatedUnit.owner?.email || updatedUnit.ownerId;
    logger.info(`Unit ${updatedUnit.unitName} (${updatedUnit.unitNumber}) fulfilled in stage ${updatedUnit.stage}, payout: $${payoutAmount} to owner ${ownerEmail}`);
    logger.info(`Earnings added to wallet for ${ownerEmail}: $${payoutAmount} (Total payout for Stage ${updatedUnit.stage})`);

    // Activate next unit for user if available (outside transaction to avoid timeout)
    setImmediate(async () => {
      try {
        await PlacementService.activateNextUnit(
          updatedUnit.ownerId,
          updatedUnit.contractGameId,
          updatedUnit.stage
        );
      } catch (err) {
        logger.error(`Error activating next unit for user ${updatedUnit.ownerId}:`, err);
      }
    });

    // Check fulfillment for parent unit (cascade check) - outside transaction
    if (parentUnitId) {
      setImmediate(() => {
        this.checkAndFulfillParent(parentUnitId).catch(err => {
          logger.error(`Error checking parent fulfillment for unit ${parentUnitId}:`, err);
        });
      });
    }

    logger.info(`FULFILL_DONE unitId=${unitId}`);
    return updatedUnit;
  }

  /**
   * Check and fulfill parent unit if conditions are met
   */
  static async checkAndFulfillParent(parentUnitId) {
    try {
      const unit = await database.getClient().unit.findUnique({
        where: { id: parentUnitId },
        select: { id: true, isCompleted: true }
      });

      if (!unit || unit.isCompleted) {
        return;
      }

      const shouldFulfill = await this.checkFulfillment(parentUnitId);
      if (shouldFulfill) {
        await this.fulfillUnit(parentUnitId);
      }
    } catch (error) {
      logger.error(`Error in checkAndFulfillParent for ${parentUnitId}:`, error);
    }
  }

  /**
   * Check fulfillment for all units after a placement
   * This should be called after placing units
   */
  static async checkFulfillmentAfterPlacement(placedUnitId) {
    // Get the placed unit
    const placedUnit = await database.getClient().unit.findUnique({
      where: { id: placedUnitId },
      select: { parentUnitId: true }
    });

    if (!placedUnit || !placedUnit.parentUnitId) {
      return;
    }

    // Check fulfillment for parent unit
    await this.checkAndFulfillParent(placedUnit.parentUnitId);
  }
}

module.exports = FulfillmentService;

