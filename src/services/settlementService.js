const database = require('../config/database');
const WalletService = require('../modules/wallet/walletService');

const prisma = database.getClient();

class SettlementService {
  /**
   * Process automatic settlement when order is delivered
   * @param {String} orderId - Order ID
   * @returns {Promise<Object>} Settlement record
   */
  async processSettlement(orderId) {
    try {
      // Get order with items
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          vendor: {
            include: {
              wallet: true,
            },
          },
        },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status !== 'DELIVERED') {
        throw new Error('Order must be delivered before settlement');
      }

      // Check if settlement already exists (optimize: only check status)
      const existingSettlement = await prisma.settlement.findUnique({
        where: { orderId },
        select: {
          id: true,
          status: true,
        },
      });

      if (existingSettlement) {
        if (existingSettlement.status === 'COMPLETED') {
          return existingSettlement; // Already settled
        }
        // If pending, update it
        return await this.completeSettlement(existingSettlement.id);
      }

      // Create settlement record
      const settlement = await prisma.settlement.create({
        data: {
          vendorId: order.vendorId,
          orderId: order.id,
          amount: order.totalAmount,
          currency: order.currency || 'CAD',
          status: 'PENDING',
        },
      });

      // Process settlement (credit vendor wallet)
      return await this.completeSettlement(settlement.id);
    } catch (error) {
      console.error('Error processing settlement:', error);
      throw error;
    }
  }

  /**
   * Complete a settlement by crediting vendor wallet
   * @param {String} settlementId - Settlement ID
   * @returns {Promise<Object>} Completed settlement
   */
  async completeSettlement(settlementId) {
    try {
      // Optimize: Use select for better performance
      const settlement = await prisma.settlement.findUnique({
        where: { id: settlementId },
        select: {
          id: true,
          vendorId: true,
          orderId: true,
          amount: true,
          currency: true,
          status: true,
          settledAt: true,
          createdAt: true,
          updatedAt: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              status: true,
            },
          },
          vendor: {
            select: {
              id: true,
              wallet: {
                select: {
                  id: true,
                  balance: true,
                },
              },
            },
          },
        },
      });

      if (!settlement) {
        throw new Error('Settlement not found');
      }

      if (settlement.status === 'COMPLETED') {
        return settlement; // Already completed
      }

      // Ensure vendor has a wallet and credit it
      const amount = Number(settlement.amount);
      await WalletService.addToWallet(
        settlement.vendorId,
        amount,
        settlement.id,
        'SETTLEMENT',
        `Settlement for order ${settlement.order.orderNumber}`
      );

      // Update settlement status (optimize: use select)
      const updatedSettlement = await prisma.settlement.update({
        where: { id: settlementId },
        data: {
          status: 'COMPLETED',
          settledAt: new Date(),
        },
        select: {
          id: true,
          vendorId: true,
          orderId: true,
          amount: true,
          currency: true,
          status: true,
          settledAt: true,
          createdAt: true,
          updatedAt: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
            },
          },
          vendor: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return updatedSettlement;
    } catch (error) {
      // Mark settlement as failed
      try {
        await prisma.settlement.update({
          where: { id: settlementId },
          data: {
            status: 'FAILED',
          },
        });
      } catch (updateError) {
        console.error('Error updating settlement status to FAILED:', updateError);
      }

      console.error('Error completing settlement:', error);
      throw error;
    }
  }

  /**
   * Get settlement by ID
   * @param {String} settlementId - Settlement ID
   * @param {String} vendorId - Optional vendor ID for ownership check
   * @returns {Promise<Object>} Settlement
   */
  async getSettlementById(settlementId, vendorId = null) {
    // Optimize: Use select for better performance
    const settlement = await prisma.settlement.findUnique({
      where: { id: settlementId },
      select: {
        id: true,
        vendorId: true,
        orderId: true,
        amount: true,
        currency: true,
        status: true,
        settledAt: true,
        createdAt: true,
        updatedAt: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
            items: {
              select: {
                id: true,
                productId: true,
                quantity: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        vendor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!settlement) {
      throw new Error('Settlement not found');
    }

    if (vendorId && settlement.vendorId !== vendorId) {
      throw new Error('Unauthorized: Settlement does not belong to this vendor');
    }

    return settlement;
  }

  /**
   * List settlements for a vendor
   * @param {String} vendorId - Vendor ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Settlements with pagination
   */
  async listVendorSettlements(vendorId, filters = {}) {
    const {
      page = 1,
      limit = 20,
      status = null,
      startDate = null,
      endDate = null,
    } = filters;

    const skip = (page - 1) * limit;

    const where = {
      vendorId,
      ...(status && { status }),
      ...(startDate || endDate ? {
        createdAt: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      } : {}),
    };

    // Optimize: Use select for better performance
    const [settlements, total] = await Promise.all([
      prisma.settlement.findMany({
        where,
        select: {
          id: true,
          vendorId: true,
          orderId: true,
          amount: true,
          currency: true,
          status: true,
          settledAt: true,
          createdAt: true,
          updatedAt: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.settlement.count({ where }),
    ]);

    // Calculate totals
    const totalAmount = settlements.reduce((sum, s) => sum + Number(s.amount), 0);
    const totalCompleted = await prisma.settlement.aggregate({
      where: {
        ...where,
        status: 'COMPLETED',
      },
      _sum: {
        amount: true,
      },
    });

    return {
      settlements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalAmount: Number(totalAmount),
        totalCompleted: Number(totalCompleted._sum.amount || 0),
        totalPending: total - settlements.filter((s) => s.status === 'COMPLETED').length,
      },
    };
  }

  /**
   * Process pending settlements (for batch processing)
   * @returns {Promise<Object>} Processing results
   */
  async processPendingSettlements() {
    // Optimize: Only fetch needed fields
    const pendingSettlements = await prisma.settlement.findMany({
      where: {
        status: 'PENDING',
      },
      select: {
        id: true,
        orderId: true,
        order: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    const results = {
      processed: 0,
      failed: 0,
      errors: [],
    };

    for (const settlement of pendingSettlements) {
      try {
        // Only process if order is delivered
          if (settlement.order.status === 'DELIVERED') {
            await this.completeSettlement(settlement.id);
            results.processed++;
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            settlementId: settlement.id,
            error: error.message,
          });
        }
      }

    return results;
  }
}

module.exports = new SettlementService();
