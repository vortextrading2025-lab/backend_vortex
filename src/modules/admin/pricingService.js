const database = require('../../config/database');
const logger = require('../logging/logger');

class PricingService {
  /**
   * Get all pricing configuration
   */
  static async getPricing() {
    const pricing = await database.getClient().contractPricing.findMany({
      orderBy: { stage: 'asc' }
    });

    // Ensure all stages have pricing (create defaults if missing) - $25,000 down payment
    const stages = ['STAGE_1', 'STAGE_2', 'STAGE_3'];
    const defaults = {
      'STAGE_1': 25000.00,
      'STAGE_2': 25000.00,
      'STAGE_3': 25000.00
    };

    const result = {};
    for (const stage of stages) {
      const existing = pricing.find(p => p.stage === stage);
      if (existing) {
        result[stage] = existing;
      } else {
        // Create default pricing
        const newPricing = await database.getClient().contractPricing.create({
          data: {
            stage: stage,
            price: defaults[stage],
            isActive: true
          }
        });
        result[stage] = newPricing;
      }
    }

    return Object.values(result);
  }

  /**
   * Get price for specific stage
   */
  static async getPriceForStage(stage) {
    const pricing = await database.getClient().contractPricing.findUnique({
      where: { stage }
    });

    if (!pricing || !pricing.isActive) {
      // Default pricing - $25,000 down payment
      const defaults = {
        'STAGE_1': 25000.00,
        'STAGE_2': 25000.00,
        'STAGE_3': 25000.00
      };
      return defaults[stage] || 25000.00;
    }

    return pricing.price;
  }

  /**
   * Update pricing for a stage
   */
  static async updatePricing(stage, price, isActive = true) {
    if (price <= 0) {
      throw new Error('Price must be greater than 0');
    }

    const pricing = await database.getClient().contractPricing.upsert({
      where: { stage },
      update: {
        price: price,
        isActive: isActive
      },
      create: {
        stage: stage,
        price: price,
        isActive: isActive
      }
    });

    logger.info(`Pricing updated for ${stage}: $${price}`);
    return pricing;
  }
}

module.exports = PricingService;

