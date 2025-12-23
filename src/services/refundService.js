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
}

module.exports = RefundService;
