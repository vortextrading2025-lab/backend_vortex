const database = require('../config/database');
const logger = require('../modules/logging/logger');

/**
 * PayoutReleaseService
 * Handles releasing held payouts after cooldown period ends
 */
class PayoutReleaseService {
  /**
   * Release all payouts that are held and cooldown has ended
   * This should be called periodically (e.g., via cron job)
   */
  static async releaseHeldPayouts() {
    const client = database.getClient();
    const now = new Date();

    // Find all held payouts where cooldown has ended
    const heldPayouts = await client.payout.findMany({
      where: {
        status: 'HELD',
        heldUntil: {
          lte: now // Cooldown has ended
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        },
        unit: {
          select: {
            id: true,
            unitName: true,
            unitNumber: true
          }
        }
      }
    });

    if (heldPayouts.length === 0) {
      logger.info('No held payouts to release');
      return { released: 0, payouts: [] };
    }

    logger.info(`Found ${heldPayouts.length} held payouts to release`);

    const releasedPayouts = [];

    for (const payout of heldPayouts) {
      try {
        await this.releasePayout(payout.id);
        releasedPayouts.push(payout);
      } catch (error) {
        logger.error(`Error releasing payout ${payout.id}:`, error);
      }
    }

    logger.info(`Released ${releasedPayouts.length} payouts`);
    return {
      released: releasedPayouts.length,
      payouts: releasedPayouts.map(p => ({
        id: p.id,
        userId: p.userId,
        amount: Number(p.amount),
        stage: p.stage
      }))
    };
  }

  /**
   * Release a single held payout
   * Credits the wallet and marks payout as CREDITED
   */
  static async releasePayout(payoutId) {
    const client = database.getClient();

    return await client.$transaction(async (tx) => {
      // Get payout with user info
      const payout = await tx.payout.findUnique({
        where: { id: payoutId },
        include: {
          user: {
            select: {
              id: true,
              email: true
            }
          }
        }
      });

      if (!payout) {
        throw new Error('Payout not found');
      }

      if (payout.status !== 'HELD') {
        throw new Error(`Payout ${payoutId} is not in HELD status (current: ${payout.status})`);
      }

      // Check if cooldown has actually ended
      if (payout.heldUntil && new Date() < payout.heldUntil) {
        throw new Error(`Payout ${payoutId} is still in cooldown period`);
      }

      const payoutAmount = Number(payout.amount);

      // Get or create wallet
      const wallet = await tx.wallet.upsert({
        where: { userId: payout.userId },
        update: {},
        create: {
          userId: payout.userId,
          balance: 0,
          totalEarned: 0,
          totalWithdrawn: 0
        }
      });

      // Credit wallet
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: payoutAmount },
          totalEarned: { increment: payoutAmount }
        }
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          userId: payout.userId,
          type: 'DEPOSIT',
          amount: payoutAmount,
          status: 'COMPLETED',
          referenceId: payout.unitId,
          referenceType: 'PAYOUT',
          description: `Payout for unit completion - Stage ${payout.stage} (released after cooldown)`
        }
      });

      // Update payout status
      await tx.payout.update({
        where: { id: payoutId },
        data: {
          status: 'CREDITED',
          creditedAt: new Date(),
          walletId: wallet.id
        }
      });

      logger.info(`Released payout ${payoutId}: $${payoutAmount} credited to user ${payout.user.email}`);
      return payout;
    });
  }

  /**
   * Cancel held payouts for a refunded purchase request
   * When user refunds, we need to cancel any held payouts from those units
   */
  static async cancelHeldPayoutsForUnits(unitIds) {
    const client = database.getClient();

    const heldPayouts = await client.payout.findMany({
      where: {
        unitId: { in: unitIds },
        status: 'HELD'
      }
    });

    if (heldPayouts.length === 0) {
      return { cancelled: 0 };
    }

    // Cancel the payouts (mark as CANCELLED)
    await client.payout.updateMany({
      where: {
        id: { in: heldPayouts.map(p => p.id) }
      },
      data: {
        status: 'CANCELLED'
      }
    });

    logger.info(`Cancelled ${heldPayouts.length} held payouts for refunded units`);
    return { cancelled: heldPayouts.length };
  }
}

module.exports = PayoutReleaseService;





