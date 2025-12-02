const database = require('../../config/database');
const logger = require('../logging/logger');

class WalletService {
  /**
   * Get or create wallet for user
   */
  static async getWallet(userId) {
    let wallet = await database.getClient().wallet.findUnique({
      where: { userId }
    });

    if (!wallet) {
      wallet = await database.getClient().wallet.create({
        data: {
          userId,
          balance: 0,
          totalEarned: 0,
          totalWithdrawn: 0
        }
      });
      logger.info(`Wallet created for user ${userId}`);
    }

    return wallet;
  }

  /**
   * Add amount to wallet (for payouts)
   */
  static async addToWallet(userId, amount, referenceId = null, referenceType = null, description = null) {
    const wallet = await this.getWallet(userId);

    const updatedWallet = await database.getClient().wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: amount },
        totalEarned: { increment: amount }
      }
    });

    // Create transaction record
    await database.getClient().transaction.create({
      data: {
        walletId: wallet.id,
        userId: userId,
        type: 'DEPOSIT',
        amount: amount,
        status: 'COMPLETED',
        referenceId: referenceId,
        referenceType: referenceType,
        description: description || `Deposit: ${referenceType || 'Payout'}`
      }
    });

    logger.info(`Added ${amount} to wallet for user ${userId}`);
    return updatedWallet;
  }

  /**
   * Deduct amount from wallet (for contract purchases)
   */
  static async deductFromWallet(userId, amount, referenceId = null, description = null) {
    const wallet = await this.getWallet(userId);

    if (wallet.balance < amount) {
      throw new Error('Insufficient wallet balance');
    }

    const updatedWallet = await database.getClient().wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { decrement: amount }
      }
    });

    // Create transaction record
    await database.getClient().transaction.create({
      data: {
        walletId: wallet.id,
        userId: userId,
        type: 'CONTRACT_PURCHASE',
        amount: -amount, // Negative for deduction
        status: 'COMPLETED',
        referenceId: referenceId,
        referenceType: 'CONTRACT',
        description: description || `Contract purchase`
      }
    });

    logger.info(`Deducted ${amount} from wallet for user ${userId}`);
    return updatedWallet;
  }

  /**
   * Get wallet transactions
   */
  static async getTransactions(userId, limit = 50, offset = 0) {
    const wallet = await this.getWallet(userId);

    const transactions = await database.getClient().transaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    const total = await database.getClient().transaction.count({
      where: { walletId: wallet.id }
    });

    return {
      transactions,
      total,
      limit,
      offset
    };
  }

  /**
   * Withdraw from wallet (manual withdrawal)
   */
  static async withdraw(userId, amount) {
    const wallet = await this.getWallet(userId);

    if (wallet.balance < amount) {
      throw new Error('Insufficient wallet balance');
    }

    const updatedWallet = await database.getClient().wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { decrement: amount },
        totalWithdrawn: { increment: amount }
      }
    });

    // Create transaction record
    await database.getClient().transaction.create({
      data: {
        walletId: wallet.id,
        userId: userId,
        type: 'WITHDRAWAL',
        amount: -amount,
        status: 'COMPLETED',
        description: 'Withdrawal'
      }
    });

    logger.info(`Withdrew ${amount} from wallet for user ${userId}`);
    return updatedWallet;
  }
}

module.exports = WalletService;

