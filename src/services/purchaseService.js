const database = require('../config/database');
const logger = require('../modules/logging/logger');
const PlacementService = require('./placementService');
const FulfillmentService = require('./fulfillmentService');

/**
 * PurchaseService
 * Handles purchase requests and automatic unit placement
 * No mentor approval needed - system auto-approves and places units
 */
class PurchaseService {
  /**
   * Create purchase request
   * Auto-approved immediately, units placed automatically
   * If user was invited, inviter becomes the host
   * If not invited, system places under system root
   */
  static async createPurchaseRequest(userId, contractGameId, unitCount = 1) {
    // Validate unit count (minimum 1)
    if (unitCount < 1) {
      throw new Error('At least 1 unit is required');
    }

    // Get contract game - if not found or not active, automatically use the active one
    let contractGame = await database.getClient().contractGame.findUnique({
      where: { id: contractGameId }
    });

    // If contract game not found or not active, automatically find and use the active one
    if (!contractGame || contractGame.status !== 'ACTIVE') {
      logger.warn(`Contract game ${contractGameId} not found or not active. Auto-detecting active contract game...`);
      
      const activeGame = await database.getClient().contractGame.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' } // Get the most recent active game
      });
      
      if (!activeGame) {
        throw new Error('No active contract game found. Please contact an administrator to create a contract game.');
      }
      
      logger.info(`Auto-using active contract game: ${activeGame.id} (${activeGame.name})`);
      contractGame = activeGame;
      contractGameId = activeGame.id; // Update contractGameId to the active one
    }

    // Note: Users can purchase more units even if they're in cooldown
    // Each new purchase will also go into cooldown (14 days from placement)
    // During cooldown: user can play in contract but will NOT receive payouts until cooldown ends
    // User can cancel and get refund during cooldown period
    // Cooldown check removed - users can buy anytime, new units will also enter cooldown

    // Determine which stage the user is purchasing for
    // Check user's existing units to determine stage
    const userUnits = await database.getClient().unit.findMany({
      where: {
        ownerId: userId,
        contractGameId: contractGameId,
        isSystemRoot: false
      },
      select: {
        stage: true
      }
    });

    // Determine stage: If user has Stage 3 units, they can buy Stage 3. If Stage 2, buy Stage 2. Otherwise Stage 1.
    let purchaseStage = 1;
    let advancePayment = Number(contractGame.downPayment); // Stage 1: 500.00
    
    if (userUnits.length > 0) {
      const maxStage = Math.max(...userUnits.map(u => u.stage));
      if (maxStage >= 3) {
        purchaseStage = 3;
        advancePayment = Number(contractGame.advancePaymentStage3) || Number(contractGame.downPayment); // Stage 3: 2,600.00
      } else if (maxStage >= 2) {
        purchaseStage = 2;
        advancePayment = Number(contractGame.advancePaymentStage2) || Number(contractGame.downPayment); // Stage 2: 1,150.00
      }
      // If maxStage is 1, stay at Stage 1 (500.00)
    }

    // Calculate total amount based on stage
    const totalAmount = advancePayment * unitCount;

    // Get admin user ID (required for mentorId field in schema, not used for approval)
    const admin = await database.getClient().user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' },
      select: { id: true }
    });

    if (!admin) {
      throw new Error('Admin user not found. System cannot create purchase requests without an admin user.');
    }

    // mentorId is required by schema but no longer used
    // Use admin ID as default for backward compatibility with schema
    const mentorId = admin.id;
    let requestStatus = 'APPROVED'; // Auto-approve all requests
    let hostId = null;

    // Check if user was invited (has an invite link)
    const inviteLink = await database.getClient().inviteLink.findFirst({
      where: {
        invitedUserId: userId,
        isActive: true
      },
      include: {
        inviter: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { lastUsedAt: 'desc' } // Get most recent invite
    });

    // Determine host:
    // - If user was invited, inviter becomes the host
    // - If not invited, hostId remains null (system will place under system root)
    if (inviteLink && inviteLink.inviter) {
      hostId = inviteLink.inviter.id;
      
      // Validate that inviter has an active unit (required for placement)
      // Determine which stage the user is purchasing for
      const userUnits = await database.getClient().unit.findMany({
        where: {
          ownerId: userId,
          contractGameId: contractGameId,
          isSystemRoot: false
        },
        select: { stage: true }
      });
      
      let purchaseStage = 1;
      if (userUnits.length > 0) {
        const maxStage = Math.max(...userUnits.map(u => u.stage));
        if (maxStage >= 3) {
          purchaseStage = 3;
        } else if (maxStage >= 2) {
          purchaseStage = 2;
        }
      }
      
      // Check if inviter has an active unit in the same stage
      const PlacementService = require('./placementService');
      const inviterActiveUnit = await PlacementService.findActiveUnit(
        hostId,
        contractGameId,
        purchaseStage
      );
      
      if (!inviterActiveUnit) {
        logger.warn(`Inviter ${hostId} (${inviteLink.inviter.email}) has no active unit in stage ${purchaseStage}. Units will be placed under system root or another available unit.`);
        // Don't throw error - allow placement to proceed with fallback logic
        // The placement service will handle fallback to system root
      } else {
        logger.info(`User ${userId} was invited by ${inviteLink.inviter.email} - host set to inviter (has active unit: ${inviterActiveUnit.unitName})`);
      }
    } else {
      // No invite - system will auto-place under system root
      logger.info(`User ${userId} creating purchase request without invite - system will auto-place`);
    }

    // Set cooldown period: 14 days from purchase creation (not placement)
    const cooldownEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days from now

    // Create purchase request (auto-approved, no mentor approval needed)
    const request = await database.getClient().purchaseRequest.create({
        data: {
          userId: userId,
          mentorId: mentorId, // Required by schema, set to admin ID (not used)
          contractGameId: contractGameId,
          unitCount: unitCount,
          totalAmount: totalAmount,
          status: requestStatus, // Always 'APPROVED' (auto-approved)
          approvedAt: new Date(), // Auto-approved immediately
          hostId: hostId, // inviter ID if invited, null for system auto-place
          cooldownEndsAt: cooldownEndsAt // Set cooldown immediately when purchase is created
        },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
          mentor: {
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
            downPayment: true
          }
        }
      }
    });

    logger.info(`Created purchase request ${request.id} for user ${userId}, ${unitCount} units, total: $${totalAmount}, status: ${requestStatus}, hostId: ${hostId || 'system'}`);
    if (hostId) {
      logger.info(`Purchase request ${request.id}: User was invited, units will be placed under host ${hostId}'s active unit`);
    } else {
      logger.info(`Purchase request ${request.id}: User was not invited, units will be placed under system root`);
    }
    
    // Auto-place units immediately after creation (system auto-places)
    // If hostId is set (user was invited), units will be placed under host's active unit
    // If hostId is null (no invite), units will be placed under system root
    if (requestStatus === 'APPROVED') {
      try {
        // Check if system root exists before attempting placement
        const systemRoot = await PlacementService.findSystemRoot(contractGameId, 1);
        if (!systemRoot && !hostId) {
          logger.warn(`No system root found for contract game ${contractGameId}. Placement may fail.`);
        }
        
        await this.processPlacement(request.id);
        logger.info(`Auto-placed units for purchase request ${request.id} (hostId: ${hostId || 'system'})`);
      } catch (error) {
        logger.error(`Error auto-placing units for request ${request.id}:`, error);
        logger.error(`Error details: ${error.message}`);
        logger.error(`Stack: ${error.stack}`);
        // Re-throw the error so the API can return it to the user
        // This way the user knows what went wrong instead of seeing "Placing..." forever
        throw new Error(`Failed to place units: ${error.message}. Please contact support if this persists.`);
      }
    }
    
    return request;
  }

  // NOTE: Mentor approval/rejection functions removed
  // All purchase requests are now auto-approved and auto-placed
  // No mentor intervention needed

  /**
   * Process placement for an approved purchase request
   * Places all units using PlacementService
   */
  static async processPlacement(requestId) {
    // Increase timeout to 60 seconds for placing multiple units (BFS search can be slow)
    return await database.getClient().$transaction(async (tx) => {
      const request = await tx.purchaseRequest.findUnique({
        where: { id: requestId },
        include: {
          contractGame: true,
          user: {
            select: {
              id: true,
              email: true,
              role: true // Need role to check if mentor
            }
          },
          mentor: {
            select: {
              id: true
            }
          }
        }
      });

      if (!request) {
        throw new Error('Purchase request not found');
      }

      if (request.status !== 'APPROVED') {
        throw new Error(`Purchase request must be APPROVED to place units. Current status: ${request.status}`);
      }

      const placedUnits = [];
      // Determine stage based on user's existing units
      const userExistingUnits = await tx.unit.findMany({
        where: {
          ownerId: request.userId,
          contractGameId: request.contractGameId,
          isSystemRoot: false
        },
        select: {
          stage: true
        }
      });
      
      let stage = 1; // Default to Stage 1
      if (userExistingUnits.length > 0) {
        const maxStage = Math.max(...userExistingUnits.map(u => u.stage));
        if (maxStage >= 3) {
          stage = 3; // User has Stage 3 units, so new purchase is Stage 3
        } else if (maxStage >= 2) {
          stage = 2; // User has Stage 2 units, so new purchase is Stage 2
        }
        // If maxStage is 1, stay at Stage 1
      }

      // Determine hostId for placement:
      // - If request.hostId is set (user was invited), use that host
      // - If request.hostId is null (no invite), use admin/system root
      let hostId = request.hostId;
      if (!hostId) {
        // No host specified (no invite) - use system root (admin)
        const admin = await tx.user.findFirst({
          where: { role: 'ADMIN' },
          orderBy: { createdAt: 'asc' },
          select: { id: true }
        });
        hostId = admin ? admin.id : null;
      }

      // OPTIMIZATION: Get all unit numbers at once (reduces database queries from N to 1)
      const unitNumbers = await PlacementService.getNextUnitNumbers(
        request.userId,
        request.contractGameId,
        stage,
        request.unitCount,
        tx // Pass transaction client
      );

      // Place each unit
      for (let i = 0; i < request.unitCount; i++) {
        const unitNumber = unitNumbers[i];

        try {
          // Placement follows game rules:
          // - Odd units (101, 103, etc.) → Placed under HOST's active unit (or system root if no host)
          // - Even units (102, 104, etc.) → Placed under OWNER's active unit
          // hostId is stored for tracking referral relationships (inviter becomes host)
          const unit = await PlacementService.placeUnit(
            request.userId,
            unitNumber,
            request.contractGameId,
            null, // mentorId no longer used for placement
            hostId, // inviter ID if invited, admin/system root if not
            tx // Pass transaction client
          );

          // Ensure hostId is set correctly
          await tx.unit.update({
            where: { id: unit.id },
            data: {
              hostId: hostId // inviter ID if invited, admin/system root if not
            }
          });

          placedUnits.push(unit);

          // IMPORTANT: Only activate the FIRST unit (101) for the user
          // This ensures even units (102, 104) can be placed under 101
          // Unit 103 should NOT be activated
          if (i === 0 && unitNumber % 2 === 1) {
            // First unit is odd (101), activate it so even units can be placed under it
            const hasActiveUnit = await PlacementService.findActiveUnit(
              request.userId,
              request.contractGameId,
              stage,
              tx
            );

            if (!hasActiveUnit) {
              await tx.unit.update({
                where: { id: unit.id },
                data: { isActive: true }
              });
              logger.info(`Activated first unit ${unit.unitName} (${unitNumber}) for user ${request.userId}`);
            }
          }
          // Do NOT activate unit 103 (i === 2) - only 101 should be active

          // Don't check fulfillment inside transaction - do it after to avoid timeout
        } catch (error) {
          logger.error(`Error placing unit ${unitNumber} for request ${requestId}:`, error);
          throw new Error(`Failed to place unit ${unitNumber}: ${error.message}`);
        }
      }

      // Update request status to PLACED
      const updatedRequest = await tx.purchaseRequest.update({
        where: { id: requestId },
        data: {
          status: 'PLACED',
          placedAt: new Date()
        }
      });

      // Create wallet transaction for the purchase (even in demo mode, for event log)
      try {
        // Get or create wallet (within transaction)
        let wallet = await tx.wallet.findUnique({
          where: { userId: request.userId }
        });
        
        if (!wallet) {
          wallet = await tx.wallet.create({
            data: {
              userId: request.userId,
              balance: 0,
              totalEarned: 0,
              totalWithdrawn: 0
            }
          });
        }
        
        // Get first unit name for description
        const firstUnit = placedUnits[0];
        const unitName = firstUnit ? `${firstUnit.unitName}` : 'units';
        
        // Create transaction record for event log (demo mode - no actual deduction)
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            userId: request.userId,
            type: 'CONTRACT_PURCHASE',
            amount: -Number(request.totalAmount), // Negative for payment
            status: 'COMPLETED',
            referenceId: request.contractGameId, // Link to contract game
            referenceType: 'CONTRACT',
            description: `Direct Advance Payment of ${Number(request.totalAmount).toFixed(2)} CAD made on ${new Date().toLocaleString()} against placement of Unit ${unitName} in Stage ${stage}`
          }
        });
        
        logger.info(`Created transaction record for purchase request ${requestId}`);
      } catch (error) {
        // Don't fail placement if transaction creation fails
        logger.error(`Error creating transaction for purchase request ${requestId}:`, error);
      }

      logger.info(`Placed ${placedUnits.length} units for purchase request ${requestId}`);
      return {
        request: updatedRequest,
        units: placedUnits
      };
    }, {
      maxWait: 60000, // 60 seconds max wait for transaction to start
      timeout: 60000  // 60 seconds timeout for transaction to complete (BFS search can be slow)
    }).then(async (result) => {
      // Cooldown was already set when purchase request was created (in createPurchaseRequest)
      // No need to set it again here - it's already set to 14 days from purchase creation

      // Enhanced fulfillment checking: Check ALL affected units in the tree
      // This includes parent units and their ancestors
      const FulfillmentService = require('./fulfillmentService');
      
      const checkAllAffectedUnits = async (unit) => {
        const unitsToCheck = new Set();
        
        // Get parent chain (all ancestors)
        let currentUnit = await database.getClient().unit.findUnique({
          where: { id: unit.id },
          select: { parentUnitId: true }
        });
        
        while (currentUnit && currentUnit.parentUnitId) {
          unitsToCheck.add(currentUnit.parentUnitId);
          currentUnit = await database.getClient().unit.findUnique({
            where: { id: currentUnit.parentUnitId },
            select: { parentUnitId: true }
          });
        }
        
        // Also check siblings at same level (they might affect parent fulfillment)
        const siblings = await database.getClient().unit.findMany({
          where: {
            parentUnitId: unit.parentUnitId,
            level: unit.level,
            id: { not: unit.id }
          },
          select: { id: true, parentUnitId: true }
        });
        
        siblings.forEach(sibling => {
          if (sibling.parentUnitId) {
            unitsToCheck.add(sibling.parentUnitId);
          }
        });
        
        // Check fulfillment for all affected units
        const checkPromises = Array.from(unitsToCheck).map(parentId => 
          FulfillmentService.checkAndFulfillParent(parentId).catch(err => {
            logger.error(`Error checking fulfillment for parent ${parentId}:`, err);
          })
        );
        
        await Promise.all(checkPromises);
      };
      
      // Check fulfillment for each placed unit and all affected units
      await Promise.all(
        result.units.map(unit => 
          checkAllAffectedUnits(unit).catch(err => {
            logger.error(`Error checking fulfillment for unit ${unit.id}:`, err);
          })
        )
      );
      
      return result;
    });
  }
}

module.exports = PurchaseService;

