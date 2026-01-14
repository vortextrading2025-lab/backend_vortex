const cron = require('node-cron');
const database = require('../config/database');
const logger = require('../modules/logging/logger');
const FulfillmentService = require('../services/fulfillmentService');

/**
 * Fulfillment Job
 * Runs every hour to check for units that:
 * 1. Have passed cooldown period (cooldownEndsAt < now)
 * 2. Are ready to be fulfilled (both children filled)
 * 3. Process payouts for eligible units
 */
class FulfillmentJob {
  /**
   * Start the fulfillment job (runs every hour)
   */
  static start() {
    // Run every hour at minute 0
    cron.schedule('0 * * * *', async () => {
      try {
        logger.info('🕐 Fulfillment job started...');
        await this.processPendingFulfillments();
        logger.info('✅ Fulfillment job completed');
      } catch (error) {
        logger.error('❌ Fulfillment job error:', error);
      }
    });

    // Also run immediately on startup
    setTimeout(async () => {
      try {
        logger.info('🚀 Running fulfillment job on startup...');
        await this.processPendingFulfillments();
        logger.info('✅ Startup fulfillment job completed');
      } catch (error) {
        logger.error('❌ Startup fulfillment job error:', error);
      }
    }, 5000); // Wait 5 seconds after startup

    logger.info('📅 Fulfillment job scheduled (runs every hour)');
  }

  /**
   * Process all pending fulfillments
   * 1. Find all units that have passed cooldown
   * 2. Check if they meet fulfillment criteria
   * 3. Process payouts for eligible units
   */
  static async processPendingFulfillments() {
    const prisma = database.getClient();
    const now = new Date();

    // Find all units that:
    // 1. Have passed cooldown period
    // 2. Are not completed
    // 3. Are not system root
    const unitsPassedCooldown = await prisma.unit.findMany({
      where: {
        cooldownEndsAt: {
          lte: now // Cooldown has ended
        },
        isCompleted: false,
        isSystemRoot: false
      },
      include: {
        owner: {
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
            payoutStage1: true,
            payoutStage2: true,
            payoutStage3: true
          }
        },
        payouts: {
          select: {
            id: true,
            stage: true,
            amount: true,
            status: true
          }
        }
      }
    });

    if (unitsPassedCooldown.length === 0) {
      logger.info('No units found past cooldown period');
      return;
    }

    logger.info(`Found ${unitsPassedCooldown.length} units past cooldown period`);

    // Check each unit for fulfillment eligibility
    let fulfilledCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const unit of unitsPassedCooldown) {
      try {
        // Check if unit meets fulfillment criteria
        const shouldFulfill = await FulfillmentService.checkFulfillment(unit.id);

        if (shouldFulfill) {
          logger.info(`✅ Unit ${unit.unitName} (${unit.owner.email}) is eligible for fulfillment`);
          
          // Fulfill the unit (creates payout, marks as completed, advances to next stage)
          await FulfillmentService.fulfillUnit(unit.id);
          
          fulfilledCount++;
          logger.info(`💰 Fulfilled unit ${unit.unitName} - Stage ${unit.stage} completed`);
        } else {
          skippedCount++;
          logger.debug(`⏭️  Unit ${unit.unitName} skipped - not ready for fulfillment`);
        }
      } catch (error) {
        errorCount++;
        logger.error(`❌ Error processing unit ${unit.id} (${unit.unitName}):`, error);
      }
    }

    // Process any pending payouts (status: HELD or PENDING)
    await this.processPendingPayouts();

    logger.info(`
📊 Fulfillment Job Summary:
   - Total units checked: ${unitsPassedCooldown.length}
   - Fulfilled: ${fulfilledCount}
   - Skipped: ${skippedCount}
   - Errors: ${errorCount}
    `);
  }

  /**
   * Process pending payouts (payouts that were held during cooldown)
   * Release them to user's wallet once cooldown ends
   */
  static async processPendingPayouts() {
    const prisma = database.getClient();
    const now = new Date();

    // Find all payouts that:
    // 1. Are HELD (held during cooldown)
    // 2. Cooldown has ended (heldUntil <= now)
    const pendingPayouts = await prisma.payout.findMany({
      where: {
        status: 'HELD',
        heldUntil: {
          lte: now
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
            unitName: true,
            stage: true
          }
        }
      }
    });

    if (pendingPayouts.length === 0) {
      logger.info('No pending payouts to process');
      return;
    }

    logger.info(`Found ${pendingPayouts.length} pending payouts to release`);

    for (const payout of pendingPayouts) {
      try {
        // Get or create wallet
        let wallet = await prisma.wallet.findUnique({
          where: { userId: payout.userId }
        });

        if (!wallet) {
          wallet = await prisma.wallet.create({
            data: {
              userId: payout.userId,
              balance: 0,
              totalEarned: 0,
              totalWithdrawn: 0
            }
          });
        }

        // Credit payout to wallet
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: parseFloat(payout.amount) },
            totalEarned: { increment: parseFloat(payout.amount) }
          }
        });

        // Update payout status
        await prisma.payout.update({
          where: { id: payout.id },
          data: {
            status: 'CREDITED',
            creditedAt: new Date(),
            walletId: wallet.id
          }
        });

        // Create transaction record
        await prisma.transaction.create({
          data: {
            walletId: wallet.id,
            userId: payout.userId,
            type: 'DEPOSIT',
            amount: parseFloat(payout.amount),
            status: 'COMPLETED',
            referenceId: payout.unitId,
            referenceType: 'PAYOUT',
            description: `Total Value of $${parseFloat(payout.amount).toFixed(2)} CAD Earned on ${new Date().toLocaleString()} for completion of Unit ${payout.unit.unitName} in Stage ${payout.stage}. Remaining Balance: $${parseFloat(payout.amount).toFixed(2)} CAD from Total Value, Advance Payment: $0.00 CAD (already deducted from earnings before this payout)`
          }
        });

        logger.info(`💰 Released payout $${parseFloat(payout.amount).toFixed(2)} to ${payout.user.email} (Unit: ${payout.unit.unitName}, Stage: ${payout.stage})`);
      } catch (error) {
        logger.error(`❌ Error processing payout ${payout.id}:`, error);
      }
    }
  }
}

module.exports = FulfillmentJob;

