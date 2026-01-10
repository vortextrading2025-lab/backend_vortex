const database = require('../config/database');
const logger = require('../modules/logging/logger');
const WalletService = require('../modules/wallet/walletService');

class RefundService {
  /**
   * Check if purchase request is eligible for refund (within 14-day cooldown)
   * Allows cancellation of both APPROVED (units being placed) and PLACED (units placed) requests
   */
  static async isEligibleForRefund(requestId) {
    const request = await database.getClient().purchaseRequest.findUnique({
      where: { id: requestId },
      include: {
        contractGame: true
      }
    });

    if (!request) {
      throw new Error('Purchase request not found');
    }

    // Allow cancellation of APPROVED (units being placed) and PLACED (units placed) requests
    if (request.status !== 'APPROVED' && request.status !== 'PLACED') {
      throw new Error(`Only APPROVED or PLACED purchase requests can be cancelled. Current status: ${request.status}`);
    }

    if (request.refundedAt) {
      throw new Error('Purchase request has already been refunded');
    }

    if (!request.cooldownEndsAt) {
      throw new Error('Cooldown period not set for this purchase');
    }

    const now = new Date();
    if (now > request.cooldownEndsAt) {
      throw new Error('Cooldown period has expired. Refund is no longer available.');
    }

    return true;
  }

  /**
   * Process refund for a purchase request
   * - Deletes all units associated with the request
   * - Refunds money to user's wallet
   * - Marks request as refunded
   */
  static async processRefund(requestId, userId) {
    return await database.getClient().$transaction(async (tx) => {
      const request = await tx.purchaseRequest.findUnique({
        where: { id: requestId },
        include: {
          user: true,
          contractGame: true
        }
      });

      if (!request) {
        throw new Error('Purchase request not found');
      }

      if (request.userId !== userId) {
        throw new Error('You can only refund your own purchase requests');
      }

      // Check eligibility
      await this.isEligibleForRefund(requestId);

      // Get all units for this request
      // For APPROVED requests: find units created around the request creation time
      // For PLACED requests: find units created around the placement time
      const timeReference = request.placedAt || request.createdAt;
      const timeWindowStart = new Date(timeReference.getTime() - 5 * 60 * 1000); // 5 minutes before
      const timeWindowEnd = new Date(timeReference.getTime() + 60 * 60 * 1000); // 1 hour after (to catch all units)

      let units = await tx.unit.findMany({
        where: {
          ownerId: userId,
          contractGameId: request.contractGameId,
          isSystemRoot: false,
          createdAt: {
            gte: timeWindowStart,
            lte: timeWindowEnd
          }
        },
        orderBy: { createdAt: 'desc' },
        take: request.unitCount // Limit to expected unit count
      });

      // If no units found with time window, try to find by matching unit count and recent creation
      if (units.length === 0) {
        // Find the most recent units for this user in this game
        units = await tx.unit.findMany({
          where: {
            ownerId: userId,
            contractGameId: request.contractGameId,
            isSystemRoot: false
          },
          orderBy: { createdAt: 'desc' },
          take: request.unitCount // Limit to expected unit count
        });
        
        // Only take units that were created after the request was created
        units = units.filter(unit => new Date(unit.createdAt) >= new Date(request.createdAt));
      }

      const unitIds = units.map(u => u.id);

      // Delete all units associated with this request
      if (unitIds.length > 0) {
        await tx.unit.deleteMany({
          where: {
            id: { in: unitIds }
          }
        });
        logger.info(`Deleted ${unitIds.length} units for refund of request ${requestId}`);
      } else {
        logger.warn(`No units found to delete for refund of request ${requestId} (status: ${request.status})`);
      }

      // Refund to wallet
      await WalletService.addToWallet(
        userId,
        Number(request.totalAmount),
        null,
        `Refund for purchase request ${requestId}`
      );

      // Mark request as refunded
      await tx.purchaseRequest.update({
        where: { id: requestId },
        data: {
          refundedAt: new Date(),
          status: 'REFUNDED'
        }
      });

      logger.info(`Refunded purchase request ${requestId}: ${request.totalAmount} to user ${userId}`);

      return {
        requestId,
        refundAmount: Number(request.totalAmount),
        unitsDeleted: units.length,
        unitIds: unitIds
      };
    }).then(async (result) => {
      // Cancel any held payouts for these units (outside transaction)
      const PayoutReleaseService = require('./payoutReleaseService');
      await PayoutReleaseService.cancelHeldPayoutsForUnits(result.unitIds);
      return result;
    });
  }

  /**
   * Get remaining cooldown time for a purchase request
   */
  static async getCooldownRemaining(requestId) {
    const request = await database.getClient().purchaseRequest.findUnique({
      where: { id: requestId },
      select: {
        cooldownEndsAt: true,
        refundedAt: true
      }
    });

    if (!request || !request.cooldownEndsAt || request.refundedAt) {
      return null;
    }

    const now = new Date();
    const remaining = request.cooldownEndsAt.getTime() - now.getTime();

    if (remaining <= 0) {
      return null; // Cooldown expired
    }

    return {
      days: Math.floor(remaining / (1000 * 60 * 60 * 24)),
      hours: Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60)),
      totalMs: remaining
    };
  }

  /**
   * Check if a unit is eligible for refund (within 14-day cooldown)
   * Each unit has its own cooldown period
   */
  static async isUnitEligibleForRefund(unitId) {
    const unit = await database.getClient().unit.findUnique({
      where: { id: unitId },
      include: {
        contractGame: true,
        owner: true
      }
    });

    if (!unit) {
      throw new Error('Unit not found');
    }

    if (unit.refundedAt) {
      throw new Error('Unit has already been refunded');
    }

    if (!unit.cooldownEndsAt) {
      throw new Error('Cooldown period not set for this unit');
    }

    const now = new Date();
    if (now > unit.cooldownEndsAt) {
      throw new Error('Cooldown period has expired. Refund is no longer available.');
    }

    return true;
  }

  /**
   * Process refund for a single unit
   * - Deletes the unit
   * - Refunds the unit's advance payment to user's wallet
   * - Re-places all children (subtree) following placement rules
   * - Marks unit as refunded
   */
  static async processUnitRefund(unitId, userId) {
    const SubtreeReplacementService = require('./subtreeReplacementService');
    
    // Increase transaction timeout for subtree operations (default is 5s, we need more for large subtrees)
    return await database.getClient().$transaction(async (tx) => {
      const unit = await tx.unit.findUnique({
        where: { id: unitId },
        include: {
          contractGame: true,
          owner: true,
          purchaseRequest: true
        }
      });

      if (!unit) {
        throw new Error('Unit not found');
      }

      if (unit.ownerId !== userId) {
        throw new Error('You can only refund your own units');
      }

      // Check if unit is system root (cannot be cancelled)
      if (unit.isSystemRoot) {
        throw new Error('System root units cannot be cancelled');
      }

      // Check eligibility
      await this.isUnitEligibleForRefund(unitId);

      // Check if this is the first unit of a set (101, 105, 109, 113, 117...)
      // First units: (unitNumber - 101) % 4 === 0
      const isFirstUnitOfSet = unit.unitNumber >= 101 && (unit.unitNumber - 101) % 4 === 0;
      
      logger.info(`Unit ${unit.unitName} (${unit.unitNumber}): First unit of set = ${isFirstUnitOfSet}`);

      // Get all direct children before deletion
      const children = await tx.unit.findMany({
        where: { parentUnitId: unitId },
        include: {
          owner: {
            select: {
              id: true,
              email: true
            }
          }
        }
      });

      logger.info(`Unit ${unit.unitName} has ${children.length} direct children`);

      if (isFirstUnitOfSet) {
        // First unit of set (101, 105, 109...): DELETE entire subtree
        logger.info(`Deleting entire subtree for first unit ${unit.unitNumber}`);
        
        if (children.length > 0) {
          // Collect all descendant IDs using breadth-first search
          const allDescendantIds = [];
          const queue = [...children.map(c => c.id)];
          
          while (queue.length > 0) {
            const currentId = queue.shift();
            allDescendantIds.push(currentId);
            
            // Get children of current unit
            const grandchildren = await tx.unit.findMany({
              where: { parentUnitId: currentId },
              select: { id: true }
            });
            
            queue.push(...grandchildren.map(gc => gc.id));
          }
          
          logger.info(`Found ${allDescendantIds.length} total descendants to delete`);
          
          // Delete all descendants in reverse order (deepest first to avoid foreign key issues)
          for (const descendantId of allDescendantIds.reverse()) {
            await tx.unit.delete({ where: { id: descendantId } });
          }
          
          logger.info(`Deleted entire subtree (${allDescendantIds.length} units)`);
        }
      } else {
        // Other units (102, 103, 104, 106...): DETACH children for re-placement
        logger.info(`Detaching children for re-placement (not first unit)`);
        
        if (children.length > 0) {
          await tx.unit.updateMany({
            where: { parentUnitId: unitId },
            data: { parentUnitId: null }
          });
          logger.info(`Detached ${children.length} children from unit ${unit.unitName}`);
        }
      }

      // Calculate refund amount based on stage
      let refundAmount = 0;
      if (unit.stage === 1) {
        refundAmount = Number(unit.contractGame.downPayment);
      } else if (unit.stage === 2) {
        refundAmount = Number(unit.contractGame.advancePaymentStage2);
      } else if (unit.stage === 3) {
        refundAmount = Number(unit.contractGame.advancePaymentStage3);
      }

      // Store parent unit ID before deletion (for re-placement)
      const parentUnitId = unit.parentUnitId;

      // Delete the unit
      await tx.unit.delete({
        where: { id: unitId }
      });
      logger.info(`Deleted unit ${unit.unitName} (${unitId}) for refund`);

      // Re-place subtree ONLY if NOT first unit of set
      if (!isFirstUnitOfSet && children.length > 0 && parentUnitId) {
        try {
          const replacementResult = await SubtreeReplacementService.replaceSubtree(
            children,
            parentUnitId,
            tx
          );
          logger.info(`Subtree re-placement completed: ${replacementResult.replaced} units re-placed`);
        } catch (error) {
          logger.error(`Error during subtree re-placement:`, error);
          // Don't fail the entire refund if re-placement has issues
          // The units are already detached and can be manually fixed
        }
      } else if (!isFirstUnitOfSet && children.length > 0 && !parentUnitId) {
        logger.warn(`Unit ${unit.unitName} had children but no parent - children will remain detached`);
      } else if (isFirstUnitOfSet && children.length > 0) {
        logger.info(`First unit of set: Entire subtree deleted (no re-placement)`);
      }

      // Refund to wallet
      await WalletService.addToWallet(
        userId,
        refundAmount,
        null,
        `Refund for unit ${unit.unitName} (${unit.unitNumber}) in Stage ${unit.stage}`
      );

      logger.info(`Refunded unit ${unitId}: ${refundAmount} to user ${userId}`);

      // Calculate how many units were affected
      let affectedUnitsCount = children.length;
      if (isFirstUnitOfSet && children.length > 0) {
        // For first unit, count all descendants that were deleted
        affectedUnitsCount = children.length; // This was already counted in getAllDescendants
      }

      return {
        unitId,
        unitName: unit.unitName,
        unitNumber: unit.unitNumber,
        stage: unit.stage,
        refundAmount,
        isFirstUnitOfSet,
        childrenAffected: children.length,
        subtreeDeleted: isFirstUnitOfSet,
        childrenReplaced: !isFirstUnitOfSet ? children.length : 0
      };
    }, {
      timeout: 15000 // 15 seconds timeout for subtree operations
    }).then(async (result) => {
      // Cancel any held payouts for this unit (outside transaction)
      const PayoutReleaseService = require('./payoutReleaseService');
      await PayoutReleaseService.cancelHeldPayoutsForUnits([result.unitId]);
      return result;
    });
  }

  /**
   * Get remaining cooldown time for a unit
   */
  static async getUnitCooldownRemaining(unitId) {
    const unit = await database.getClient().unit.findUnique({
      where: { id: unitId },
      select: {
        cooldownEndsAt: true,
        refundedAt: true
      }
    });

    if (!unit || !unit.cooldownEndsAt || unit.refundedAt) {
      return null;
    }

    const now = new Date();
    const remaining = unit.cooldownEndsAt.getTime() - now.getTime();

    if (remaining <= 0) {
      return null; // Cooldown expired
    }

    return {
      days: Math.floor(remaining / (1000 * 60 * 60 * 24)),
      hours: Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60)),
      totalMs: remaining
    };
  }
}

module.exports = RefundService;
