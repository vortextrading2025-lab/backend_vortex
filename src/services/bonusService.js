const database = require('../config/database');
const { z } = require('zod');

const prisma = database.getClient();

// Validation schemas
const createBonusSchema = z.object({
  userId: z.string(),
  orderId: z.string(),
  orderNumber: z.string().optional(), // Order number for display
  orderItemId: z.string(),
  productId: z.string(),
  productName: z.string(),
  quantity: z.number().int().positive(),
  sellingPrice: z.number().positive(),
  costPrice: z.number().positive(),
  bonusAmount: z.number().positive(),
});

class BonusService {
  /**
   * Get or create bonus wallet for user
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Bonus wallet
   */
  static async getBonusWallet(userId) {
    let bonusWallet = await prisma.bonusWallet.findUnique({
      where: { userId }
    });

    if (!bonusWallet) {
      bonusWallet = await prisma.bonusWallet.create({
        data: {
          userId,
          balance: 0,
          totalBonus: 0,
          totalRedeemed: 0
        }
      });
    }

    return bonusWallet;
  }

  /**
   * Create bonus from order item
   * @param {Object} data - Bonus data
   * @returns {Promise<Object>} Created bonus
   */
  static async createBonus(data) {
    const validatedData = createBonusSchema.parse(data);

    // Get or create bonus wallet
    const bonusWallet = await this.getBonusWallet(validatedData.userId);

    // Create bonus record
    const bonus = await prisma.bonus.create({
      data: {
        userId: validatedData.userId,
        bonusWalletId: bonusWallet.id,
        orderId: validatedData.orderId,
        orderNumber: validatedData.orderNumber || null,
        orderItemId: validatedData.orderItemId,
        productId: validatedData.productId,
        productName: validatedData.productName,
        quantity: validatedData.quantity,
        sellingPrice: validatedData.sellingPrice,
        costPrice: validatedData.costPrice,
        bonusAmount: validatedData.bonusAmount,
        status: 'ACTIVE'
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Update bonus wallet
    await prisma.bonusWallet.update({
      where: { id: bonusWallet.id },
      data: {
        balance: { increment: validatedData.bonusAmount },
        totalBonus: { increment: validatedData.bonusAmount }
      }
    });

    return bonus;
  }

  /**
   * Get user's bonus wallet
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Bonus wallet with stats
   */
  static async getUserBonusWallet(userId) {
    const bonusWallet = await this.getBonusWallet(userId);

    const stats = await prisma.bonus.aggregate({
      where: {
        userId,
        status: 'ACTIVE'
      },
      _sum: {
        bonusAmount: true
      },
      _count: {
        id: true
      }
    });

    return {
      ...bonusWallet,
      activeBonuses: stats._count.id || 0,
      activeBonusAmount: Number(stats._sum.bonusAmount) || 0
    };
  }

  /**
   * List user's bonuses
   * @param {String} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Bonuses with pagination
   */
  static async listUserBonuses(userId, filters = {}) {
    const {
      page = 1,
      limit = 20,
      status = null,
      orderId = null,
    } = filters;

    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(status && { status }),
      ...(orderId && { orderId }),
    };

    const [bonuses, total] = await Promise.all([
      prisma.bonus.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }),
      prisma.bonus.count({ where })
    ]);

    return {
      bonuses,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get bonus by ID
   * @param {String} bonusId - Bonus ID
   * @param {String} userId - User ID (for authorization)
   * @returns {Promise<Object>} Bonus
   */
  static async getBonusById(bonusId, userId = null) {
    const bonus = await prisma.bonus.findUnique({
      where: { id: bonusId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!bonus) {
      throw new Error('Bonus not found');
    }

    if (userId && bonus.userId !== userId) {
      throw new Error('Unauthorized: Bonus does not belong to this user');
    }

    return bonus;
  }

  /**
   * Redeem bonus (transfer to main wallet)
   * @param {String} bonusId - Bonus ID
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Updated bonus
   */
  static async redeemBonus(bonusId, userId) {
    const bonus = await this.getBonusById(bonusId, userId);

    if (bonus.status !== 'ACTIVE') {
      throw new Error(`Bonus cannot be redeemed. Current status: ${bonus.status}`);
    }

    // Update bonus status
    const updatedBonus = await prisma.bonus.update({
      where: { id: bonusId },
      data: {
        status: 'REDEEMED',
        redeemedAt: new Date()
      }
    });

    // Update bonus wallet
    await prisma.bonusWallet.update({
      where: { id: bonus.bonusWalletId },
      data: {
        balance: { decrement: bonus.bonusAmount },
        totalRedeemed: { increment: bonus.bonusAmount }
      }
    });

    // Add to main wallet (using WalletService)
    const WalletService = require('../modules/wallet/walletService');
    await WalletService.addToWallet(
      userId,
      Number(bonus.bonusAmount),
      bonus.orderId,
      'BONUS_REDEMPTION',
      `Redeemed bonus from order ${bonus.orderId} - Product: ${bonus.productName}`
    );

    return updatedBonus;
  }

  /**
   * Get bonus statistics for user
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Bonus statistics
   */
  static async getBonusStats(userId) {
    const bonusWallet = await this.getBonusWallet(userId);

    const [activeBonuses, redeemedBonuses, totalBonuses] = await Promise.all([
      prisma.bonus.aggregate({
        where: {
          userId,
          status: 'ACTIVE'
        },
        _sum: {
          bonusAmount: true
        },
        _count: {
          id: true
        }
      }),
      prisma.bonus.aggregate({
        where: {
          userId,
          status: 'REDEEMED'
        },
        _sum: {
          bonusAmount: true
        },
        _count: {
          id: true
        }
      }),
      prisma.bonus.count({
        where: { userId }
      })
    ]);

    return {
      wallet: bonusWallet,
      active: {
        count: activeBonuses._count.id || 0,
        amount: Number(activeBonuses._sum.bonusAmount) || 0
      },
      redeemed: {
        count: redeemedBonuses._count.id || 0,
        amount: Number(redeemedBonuses._sum.bonusAmount) || 0
      },
      total: {
        count: totalBonuses,
        amount: Number(bonusWallet.totalBonus) || 0
      }
    };
  }
}

module.exports = BonusService;

