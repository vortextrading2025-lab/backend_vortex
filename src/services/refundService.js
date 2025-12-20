const database = require('../config/database');
const logger = require('../modules/logging/logger');
const WalletService = require('../modules/wallet/walletService');

class RefundService {
  /**
   * Check if purchase request is eligible for refund (within 14-day cooldown)
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

    if (request.status !== 'PLACED') {
      throw new Error('Only PLACED purchase requests can be refunded');
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
      const units = await tx.unit.findMany({
        where: {
          ownerId: userId,
          contractGameId: request.contractGameId,
          createdAt: {
            gte: request.placedAt,
            lte: new Date(request.placedAt.getTime() + 60000) // Within 1 minute of placement
          }
        }
      });

      const unitIds = units.map(u => u.id);

      // Delete all units
      await tx.unit.deleteMany({
        where: {
          id: { in: unitIds }
        }
      });

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
