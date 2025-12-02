const express = require('express');
const { z } = require('zod');
const database = require('../../config/database');
const ContractService = require('./contractService');
const InviteService = require('./inviteService');
const logger = require('../logging/logger');
const { authenticate, authorize } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/rateLimit');
const AuditLogger = require('../logging/auditLogger');
const { 
  successResponse, 
  errorResponse, 
  validationErrorResponse,
  notFoundErrorResponse,
  serverErrorResponse 
} = require('../../utils/response');

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// Public pricing route (no auth required)
/**
 * @swagger
 * /api/contracts/pricing:
 *   get:
 *     summary: Get contract pricing
 *     description: Get current pricing for all contract stages
 *     tags: [Contracts]
 *     security: []
 *     responses:
 *       200:
 *         description: Pricing retrieved successfully
 */
router.get('/pricing', async (req, res) => {
  try {
    const PricingService = require('../admin/pricingService');
    const pricing = await PricingService.getPricing();
    return successResponse(res, 200, 'Pricing retrieved successfully', { pricing });
  } catch (error) {
    return serverErrorResponse(res, 'Failed to retrieve pricing', error);
  }
});

// Public all contracts route (no auth required)
/**
 * @swagger
 * /api/contracts/all:
 *   get:
 *     summary: Get all running contracts (public view)
 *     description: Get all active/running contracts with minimal details (public access)
 *     tags: [Contracts]
 *     security: []
 *     responses:
 *       200:
 *         description: Contracts retrieved successfully
 */
router.get('/all', async (req, res) => {
  try {
    const contracts = await ContractService.getAllRunningContracts();
    return successResponse(res, 200, 'Contracts retrieved successfully', { 
      contracts,
      count: contracts.length 
    });
  } catch (error) {
    return serverErrorResponse(res, 'Failed to retrieve contracts', error);
  }
});

// All other routes require authentication
router.use(authenticate);

// Validation schemas
const createContractSchema = z.object({
  inviteCode: z.string().optional(), // Optional invite code
  stage: z.enum(['STAGE_1', 'STAGE_2', 'STAGE_3']).optional().default('STAGE_1') // Optional, defaults to STAGE_1
});

const createInviteLinkSchema = z.object({
  maxUses: z.number().int().positive().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  customCode: z.string().min(4).max(20).optional().nullable()
});

const inviteCodeSchema = z.object({
  inviteCode: z.string().min(1)
});

/**
 * @swagger
 * /api/contracts/create:
 *   post:
 *     summary: Create a new contract
 *     description: Create and place a new contract in the positioning system
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               hostId:
     *                 type: string
     *                 description: ID of the host user (optional)
     *               stage:
     *                 type: string
     *                 enum: [STAGE_1, STAGE_2, STAGE_3]
     *                 description: Contract stage (optional, defaults to STAGE_1)
 *     responses:
 *       201:
 *         description: Contract created successfully
 *       400:
 *         description: Validation error or placement failed
 */
router.post('/create', async (req, res) => {
  try {
    const validatedData = createContractSchema.parse(req.body || {});
    const userId = req.user.id;
    const stage = validatedData.stage || 'STAGE_1';
    let hostId = null;

    // Check if user joined via invite link
    const user = await database.getClient().user.findUnique({
      where: { id: userId },
      include: {
        inviteLinks: {
          where: {
            invitedUserId: userId
          },
          take: 1
        }
      }
    });

    // If user has an invite link (joined via invite), use inviter as host
    if (user && user.inviteLinks && user.inviteLinks.length > 0) {
      hostId = user.inviteLinks[0].inviterId;
      logger.info(`User ${userId} creating contract with host ${hostId} from invite link`);
    }

    // Create contract purchase (automatically creates 4 units)
    const result = await ContractService.createContractPurchase(userId, hostId, stage);
    
    // Get updated wallet balance
    const WalletService = require('../wallet/walletService');
    const wallet = await WalletService.getWallet(userId);
    
    return successResponse(res, 201, 'Contract purchase successful. 4 units created.', { 
      units: result.units,
      activeUnit: result.activeUnit,
      totalPrice: result.totalPrice,
      hostId: hostId,
      wallet: {
        balance: wallet.balance,
        totalEarned: wallet.totalEarned
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse(res, error.errors);
    }
    return errorResponse(res, 400, error.message);
  }
});

/**
 * @swagger
 * /api/contracts/my-contracts:
 *   get:
 *     summary: Get user's contracts
 *     description: Get all contracts owned by the authenticated user
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contracts retrieved successfully
 */
router.get('/my-contracts', async (req, res) => {
  try {
    const result = await ContractService.getUserContracts(req.user.id);
    return successResponse(res, 200, 'Contracts retrieved successfully', result);
  } catch (error) {
    return serverErrorResponse(res, 'Failed to retrieve contracts', error);
  }
});

/**
 * @swagger
 * /api/contracts/tree:
 *   get:
 *     summary: Get contract tree
 *     description: Get contract tree structure for visualization
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: contractId
 *         schema:
 *           type: string
 *         description: Optional contract ID to get subtree
 *     responses:
 *       200:
 *         description: Contract tree retrieved successfully
 */
router.get('/tree', async (req, res) => {
  try {
    const { contractId } = req.query;
    const tree = await ContractService.getContractTree(req.user.id, contractId || null);
    return successResponse(res, 200, 'Contract tree retrieved successfully', { tree });
  } catch (error) {
    return serverErrorResponse(res, 'Failed to retrieve contract tree', error);
  }
});

/**
 * @swagger
 * /api/contracts/payouts:
 *   get:
 *     summary: Get user's payouts
 *     description: Get all payout records for the authenticated user
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payouts retrieved successfully
 */
router.get('/payouts', async (req, res) => {
  try {
    const payouts = await database.getClient().payout.findMany({
      where: { userId: req.user.id },
      include: { 
        contract: {
          select: {
            id: true,
            contractNumber: true,
            stage: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate totals
    const totals = {
      total: payouts.reduce((sum, p) => sum + p.amount, 0),
      pending: payouts.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0),
      processed: payouts.filter(p => p.status === 'PROCESSED').reduce((sum, p) => sum + p.amount, 0),
      failed: payouts.filter(p => p.status === 'FAILED').reduce((sum, p) => sum + p.amount, 0)
    };

    return successResponse(res, 200, 'Payouts retrieved successfully', { 
      payouts,
      totals 
    });
  } catch (error) {
    return serverErrorResponse(res, 'Failed to retrieve payouts', error);
  }
});

/**
 * @swagger
 * /api/contracts/check-fulfillment/:id:
 *   post:
 *     summary: Manually check contract fulfillment
 *     description: Manually trigger fulfillment check for a contract
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Fulfillment check completed
 */
router.post('/check-fulfillment/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify contract belongs to user or user is admin
    const contract = await ContractService.getContractById(id, req.user.id);
    if (!contract) {
      return notFoundErrorResponse(res, 'Contract not found');
    }

    await ContractService.checkFulfillment(id);
    
    return successResponse(res, 200, 'Fulfillment check completed', {});
  } catch (error) {
    return serverErrorResponse(res, 'Failed to check fulfillment', error);
  }
});

/**
 * @swagger
 * /api/contracts/:id:
 *   get:
 *     summary: Get contract details
 *     description: Get detailed information about a specific contract. If user owns units, returns tree view.
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contract details retrieved successfully
 *       404:
 *         description: Contract not found
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null; // Allow optional auth for public view
    const contract = await ContractService.getContractById(id, userId);
    
    if (!contract) {
      return notFoundErrorResponse(res, 'Contract not found');
    }
    
    // Check if user owns this contract (full details) or public view (limited details)
    const isOwner = userId && contract.ownerId === userId;
    
    // Get tree view if user owns units in this contract
    let treeView = null;
    if (userId) {
      treeView = await ContractService.getContractTreeView(id, userId);
    }
    
    // Get fulfillment progress only if user owns the contract
    let progress = null;
    if (isOwner) {
      progress = await ContractService.getFulfillmentProgress(id);
    }
    
    return successResponse(res, 200, 'Contract details retrieved successfully', { 
      contract,
      progress,
      isOwner,
      treeView
    });
  } catch (error) {
    return serverErrorResponse(res, 'Failed to retrieve contract details', error);
  }
});

/**
 * @swagger
 * /api/contracts/:id/progress:
 *   get:
 *     summary: Get contract fulfillment progress
 *     description: Get detailed fulfillment progress for a contract
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Progress retrieved successfully
 */
router.get('/:id/progress', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;
    
    // Verify user owns the contract before showing progress
    const contract = await ContractService.getContractById(id, userId);
    if (!contract) {
      return notFoundErrorResponse(res, 'Contract not found');
    }
    
    // Only show progress to contract owner
    if (!userId || contract.ownerId !== userId) {
      return errorResponse(res, 403, 'Access denied. Progress is only available to contract owner.');
    }
    
    const progress = await ContractService.getFulfillmentProgress(id);
    
    if (!progress) {
      return notFoundErrorResponse(res, 'Contract not found');
    }
    
    return successResponse(res, 200, 'Progress retrieved successfully', { progress });
  } catch (error) {
    return serverErrorResponse(res, 'Failed to retrieve progress', error);
  }
});

/**
 * @swagger
 * /api/contracts/active-unit:
 *   get:
 *     summary: Get user's active unit
 *     description: Get the currently active unit for the authenticated user
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active unit retrieved successfully
 */
router.get('/active-unit', async (req, res) => {
  try {
    const activeUnit = await ContractService.getUserActiveUnit(req.user.id);
    if (!activeUnit) {
      return successResponse(res, 200, 'No active unit found', { activeUnit: null });
    }
    return successResponse(res, 200, 'Active unit retrieved successfully', { activeUnit });
  } catch (error) {
    return serverErrorResponse(res, 'Failed to retrieve active unit', error);
  }
});

/**
 * @swagger
 * /api/contracts/future-units:
 *   get:
 *     summary: Get user's future units
 *     description: Get all inactive units that will become active in the future
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Future units retrieved successfully
 */
router.get('/future-units', async (req, res) => {
  try {
    const futureUnits = await ContractService.getUserFutureUnits(req.user.id);
    return successResponse(res, 200, 'Future units retrieved successfully', { 
      futureUnits,
      count: futureUnits.length 
    });
  } catch (error) {
    return serverErrorResponse(res, 'Failed to retrieve future units', error);
  }
});

/**
 * @swagger
 * /api/contracts/invite/create:
 *   post:
 *     summary: Create an invite link
 *     description: |
 *       Create a custom invite link to invite other users to join.
 *       Users who join via this link will be placed under your active unit.
 *       You must have an active unit to create invite links.
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxUses:
 *                 type: integer
 *                 description: Maximum number of times this link can be used (null = unlimited)
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: Expiration date (null = never expires)
 *               customCode:
 *                 type: string
 *                 minLength: 4
 *                 maxLength: 20
 *                 description: Custom invite code (optional, auto-generated if not provided)
 *     responses:
 *       201:
 *         description: Invite link created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     inviteLink:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         inviteCode:
 *                           type: string
 *                         inviteUrl:
 *                           type: string
 *                         maxUses:
 *                           type: integer
 *                           nullable: true
 *                         expiresAt:
 *                           type: string
 *                           nullable: true
 *       400:
 *         description: Validation error or user doesn't have active unit
 */
router.post('/invite/create', async (req, res) => {
  try {
    const validatedData = createInviteLinkSchema.parse(req.body || {});
    const userId = req.user.id;

    const inviteLink = await InviteService.createInviteLink(userId, {
      maxUses: validatedData.maxUses,
      expiresAt: validatedData.expiresAt,
      customCode: validatedData.customCode
    });

    return successResponse(res, 201, 'Invite link created successfully', { 
      inviteLink: {
        id: inviteLink.id,
        inviteCode: inviteLink.inviteCode,
        inviteUrl: inviteLink.inviteUrl,
        maxUses: inviteLink.maxUses,
        expiresAt: inviteLink.expiresAt,
        currentUses: inviteLink.currentUses,
        isActive: inviteLink.isActive,
        createdAt: inviteLink.createdAt
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationErrorResponse(res, error.errors);
    }
    return errorResponse(res, 400, error.message);
  }
});

/**
 * @swagger
 * /api/contracts/invite/my-links:
 *   get:
 *     summary: Get all invite links created by user
 *     description: Retrieve all invite links that you have created
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Invite links retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     inviteLinks:
 *                       type: array
 *                       items:
 *                         type: object
 */
router.get('/invite/my-links', async (req, res) => {
  try {
    const inviteLinks = await InviteService.getUserInviteLinks(req.user.id);
    return successResponse(res, 200, 'Invite links retrieved successfully', { 
      inviteLinks 
    });
  } catch (error) {
    return serverErrorResponse(res, 'Failed to retrieve invite links', error);
  }
});

/**
 * @swagger
 * /api/contracts/invite/check:
 *   get:
 *     summary: Check invite link details (public)
 *     description: Check if an invite code is valid and get inviter details (public endpoint)
 *     tags: [Contracts]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: inviteCode
 *         required: true
 *         schema:
 *           type: string
 *         description: The invite code to check
 *     responses:
 *       200:
 *         description: Invite link details retrieved successfully
 *       400:
 *         description: Invalid or expired invite code
 */
router.get('/invite/check', async (req, res) => {
  try {
    const { inviteCode } = req.query;
    
    if (!inviteCode) {
      return errorResponse(res, 400, 'Invite code is required');
    }

    const inviteDetails = await InviteService.getInviteLinkDetails(inviteCode);
    
    if (!inviteDetails) {
      return errorResponse(res, 400, 'Invalid invite code');
    }

    return successResponse(res, 200, 'Invite link details retrieved successfully', { 
      inviteDetails 
    });
  } catch (error) {
    return errorResponse(res, 400, error.message);
  }
});

/**
 * @swagger
 * /api/contracts/invite/deactivate/{id}:
 *   post:
 *     summary: Deactivate an invite link
 *     description: Deactivate one of your invite links
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Invite link ID
 *     responses:
 *       200:
 *         description: Invite link deactivated successfully
 *       400:
 *         description: Invalid invite link or permission denied
 */
router.post('/invite/deactivate/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const inviteLink = await InviteService.deactivateInviteLink(id, userId);
    return successResponse(res, 200, 'Invite link deactivated successfully', { 
      inviteLink 
    });
  } catch (error) {
    return errorResponse(res, 400, error.message);
  }
});

module.exports = { router };

