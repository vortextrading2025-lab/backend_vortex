const express = require('express');
const { z } = require('zod');
const database = require('../../config/database');
const PricingService = require('./pricingService');
const { authenticate, authorize } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/rateLimit');
const { 
  successResponse, 
  errorResponse, 
  validationErrorResponse,
  serverErrorResponse 
} = require('../../utils/response');

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// All routes require admin authentication
router.use(authenticate);
router.use(authorize(['ADMIN']));

// Validation schemas
const updatePricingSchema = z.object({
  stage: z.enum(['STAGE_1', 'STAGE_2', 'STAGE_3']),
  price: z.number().positive(),
  isActive: z.boolean().optional().default(true)
});

/**
 * @swagger
 * /api/admin/pricing:
 *   get:
 *     summary: Get pricing configuration
 *     description: Get all contract pricing configuration (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pricing retrieved successfully
 */
router.get('/', async (req, res) => {
  try {
    const pricing = await PricingService.getPricing();
    return successResponse(res, 200, 'Pricing retrieved successfully', { pricing });
  } catch (error) {
    return serverErrorResponse(res, 'Failed to retrieve pricing', error);
  }
});

/**
 * @swagger
 * /api/admin/pricing:
 *   post:
 *     summary: Update pricing
 *     description: Update pricing for a contract stage (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - stage
 *               - price
 *             properties:
 *               stage:
 *                 type: string
 *                 enum: [STAGE_1, STAGE_2, STAGE_3]
 *               price:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Pricing updated successfully
 */
router.post('/', async (req, res) => {
  try {
    const validatedData = updatePricingSchema.parse(req.body);
    const pricing = await PricingService.updatePricing(
      validatedData.stage,
      validatedData.price,
      validatedData.isActive
    );
    return successResponse(res, 200, 'Pricing updated successfully', { pricing });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse(res, error.errors);
    }
    return errorResponse(res, 400, error.message);
  }
});

/**
 * @swagger
 * /api/admin/pricing/:stage/toggle:
 *   post:
 *     summary: Toggle pricing active status
 *     description: Enable or disable pricing for a contract stage (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: stage
 *         required: true
 *         schema:
 *           type: string
 *           enum: [STAGE_1, STAGE_2, STAGE_3]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Pricing status updated successfully
 */
router.post('/:stage/toggle', async (req, res) => {
  try {
    const { stage } = req.params;
    const { isActive } = req.body;

    if (!['STAGE_1', 'STAGE_2', 'STAGE_3'].includes(stage)) {
      return errorResponse(res, 400, 'Invalid stage');
    }

    // Get current pricing
    const currentPricing = await database.getClient().contractPricing.findUnique({
      where: { stage }
    });

    if (!currentPricing) {
      return errorResponse(res, 404, 'Pricing not found for this stage');
    }

    // Toggle or set isActive
    const newStatus = isActive !== undefined ? isActive : !currentPricing.isActive;

    const updatedPricing = await database.getClient().contractPricing.update({
      where: { stage },
      data: { isActive: newStatus }
    });

    return successResponse(res, 200, `Pricing ${newStatus ? 'enabled' : 'disabled'} successfully`, { pricing: updatedPricing });
  } catch (error) {
    return serverErrorResponse(res, 'Failed to toggle pricing status', error);
  }
});

/**
 * @swagger
 * /api/admin/pricing/:stage:
 *   get:
 *     summary: Get price for specific stage
 *     description: Get pricing for a specific contract stage (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: stage
 *         required: true
 *         schema:
 *           type: string
 *           enum: [STAGE_1, STAGE_2, STAGE_3]
 *     responses:
 *       200:
 *         description: Price retrieved successfully
 */
router.get('/:stage', async (req, res) => {
  try {
    const { stage } = req.params;
    if (!['STAGE_1', 'STAGE_2', 'STAGE_3'].includes(stage)) {
      return errorResponse(res, 400, 'Invalid stage');
    }
    const price = await PricingService.getPriceForStage(stage);
    return successResponse(res, 200, 'Price retrieved successfully', { stage, price });
  } catch (error) {
    return serverErrorResponse(res, 'Failed to retrieve price', error);
  }
});

module.exports = { router };

