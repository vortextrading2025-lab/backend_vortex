const database = require('../config/database');
const logger = require('../modules/logging/logger');
const PlacementService = require('./placementService');
const FulfillmentService = require('./fulfillmentService');

/**
 * PurchaseService
 * Handles purchase requests and mentor assignment
 */
class PurchaseService {
  /**
   * Auto-assign mentor to a user for a contract game
   * Assigns based on least number of pending requests
   */
  static async assignMentor(userId, contractGameId) {
    // Find all active mentors
    const mentors = await database.getClient().user.findMany({
      where: {
        role: 'MENTOR',
        status: 'ACTIVE'
      },
      include: {
        _count: {
          select: {
            mentorRequests: {
              where: {
                status: 'PENDING',
                contractGameId: contractGameId
              }
            }
          }
        }
      }
    });

    if (mentors.length === 0) {
      throw new Error('No active mentors available');
    }

    // Sort by number of pending requests (ascending)
    mentors.sort((a, b) => {
      return a._count.mentorRequests - b._count.mentorRequests;
    });

    // Return mentor with least pending requests
    // If tie, return first one (could be randomized in future)
    const assignedMentor = mentors[0];

    logger.info(`Assigned mentor ${assignedMentor.id} to user ${userId} for contract game ${contractGameId}`);
    return assignedMentor;
  }

  /**
   * Assign default mentor to a user (for signup)
   * Round-robin assignment: assigns to mentor with least mentees
   * If only 1 mentor exists, ALL users go to that mentor
   */
  static async assignDefaultMentor(userId) {
    // Find all active mentors with their mentee count
    const mentors = await database.getClient().user.findMany({
      where: {
        role: 'MENTOR',
        status: 'ACTIVE'
      },
      include: {
        _count: {
          select: {
            mentees: true // Count users assigned to this mentor
          }
        }
      }
    });

    if (mentors.length === 0) {
      throw new Error('No active mentors available');
    }

    // If only 1 mentor, ALL users go to that mentor
    if (mentors.length === 1) {
      const mentor = mentors[0];
      await database.getClient().user.update({
        where: { id: userId },
        data: { mentorId: mentor.id }
      });
      logger.info(`Assigned default mentor ${mentor.id} (${mentor.email}) to user ${userId} - Only 1 mentor available, all users assigned to this mentor`);
      return mentor;
    }

    // Multiple mentors: Round-robin - assign to mentor with least mentees
    mentors.sort((a, b) => {
      return a._count.mentees - b._count.mentees;
    });

    // Assign to mentor with least mentees
    const assignedMentor = mentors[0];

    await database.getClient().user.update({
      where: { id: userId },
      data: { mentorId: assignedMentor.id }
    });

    logger.info(`Assigned default mentor ${assignedMentor.id} (${assignedMentor.email}) to user ${userId} - Round-robin (${assignedMentor._count.mentees} mentees)`);
    return assignedMentor;
  }

  /**
   * Create purchase request
   * Uses user's assigned mentor if available, otherwise auto-assigns one
   */
  static async createPurchaseRequest(userId, contractGameId, unitCount = 1) {
    // Validate unit count (minimum 1)
    if (unitCount < 1) {
      throw new Error('At least 1 unit is required');
    }

    // Get contract game
    const contractGame = await database.getClient().contractGame.findUnique({
      where: { id: contractGameId }
    });

    if (!contractGame) {
      throw new Error('Contract game not found');
    }

    if (contractGame.status !== 'ACTIVE') {
      throw new Error('Contract game is not active');
    }

    // Check for active cooldown period
    // Users cannot purchase more units if they have units in cooldown period (14 days from placement)
    // During cooldown: user can play in contract but will NOT receive payouts until cooldown ends
    // User can cancel and get refund during cooldown period
    const activeCooldown = await database.getClient().purchaseRequest.findFirst({
      where: {
        userId: userId,
        contractGameId: contractGameId,
        status: 'PLACED',
        cooldownEndsAt: {
          gt: new Date() // Cooldown hasn't ended yet
        },
        refundedAt: null // Not refunded
      },
      orderBy: {
        cooldownEndsAt: 'desc' // Get the most recent cooldown
      },
      select: {
        cooldownEndsAt: true,
        placedAt: true
      }
    });

    if (activeCooldown) {
      const cooldownEndsAt = new Date(activeCooldown.cooldownEndsAt);
      const now = new Date();
      const timeRemaining = cooldownEndsAt.getTime() - now.getTime();
      const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));
      const hoursRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60));
      
      let timeMessage = '';
      if (daysRemaining > 1) {
        timeMessage = `${daysRemaining} days`;
      } else if (hoursRemaining > 1) {
        timeMessage = `${hoursRemaining} hours`;
      } else {
        timeMessage = 'less than an hour';
      }
      
      throw new Error(`You are in a cooldown period. You cannot purchase more units until ${cooldownEndsAt.toLocaleString()}. Time remaining: ${timeMessage}. During cooldown, you can play in the contract but will not receive payouts. You can cancel and get a refund during this period.`);
    }

    // Calculate total amount
    const totalAmount = contractGame.downPayment * unitCount;

    // Check if user is a mentor
    const user = await database.getClient().user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, mentorId: true }
    });

    let mentorId = null;
    let requestStatus = 'PENDING';
    let hostId = null;

    // SPECIAL HANDLING FOR MENTORS:
    // Mentors are NEVER assigned to other mentors
    // Their purchase requests are auto-approved and placed under admin/system root
    if (user && user.role === 'MENTOR') {
      // Get admin user ID for mentorId (for tracking purposes)
      const admin = await database.getClient().user.findFirst({
        where: { role: 'ADMIN' },
        orderBy: { createdAt: 'asc' },
        select: { id: true }
      });
      
      mentorId = admin ? admin.id : null; // Use admin as "mentor" for tracking, or null
      hostId = admin ? admin.id : null; // Host is admin/system root
      requestStatus = 'APPROVED'; // Auto-approve mentor requests
      
      logger.info(`Mentor ${userId} creating purchase request - auto-approved, will be placed under admin/system root`);
    } else {
      // Regular user - assign mentor as usual
      let mentor;
      if (user && user.mentorId) {
        // Use user's assigned mentor
        mentor = await database.getClient().user.findUnique({
          where: { id: user.mentorId },
          select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true }
        });

        // Verify mentor is still active
        if (!mentor || mentor.role !== 'MENTOR' || mentor.status !== 'ACTIVE') {
          // Mentor is no longer valid, assign a new one
          mentor = await this.assignMentor(userId, contractGameId);
          // Update user's mentor
          await database.getClient().user.update({
            where: { id: userId },
            data: { mentorId: mentor.id }
          });
        }
      } else {
        // No mentor assigned, auto-assign one
        mentor = await this.assignMentor(userId, contractGameId);
        // Update user's mentor for future purchases
        await database.getClient().user.update({
          where: { id: userId },
          data: { mentorId: mentor.id }
        });
      }
      mentorId = mentor.id;
    }

    // Create purchase request
    const request = await database.getClient().purchaseRequest.create({
      data: {
        userId: userId,
        mentorId: mentorId, // admin ID for mentors, actual mentor ID for regular users
        contractGameId: contractGameId,
        unitCount: unitCount,
        totalAmount: totalAmount,
        status: requestStatus, // 'APPROVED' for mentors, 'PENDING' for regular users
        approvedAt: requestStatus === 'APPROVED' ? new Date() : null,
        hostId: hostId // admin ID for mentors (system root), null for regular users (set during approval)
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
        mentor: mentorId ? {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        } : undefined,
        contractGame: {
          select: {
            id: true,
            name: true,
            downPayment: true
          }
        }
      }
    });

    logger.info(`Created purchase request ${request.id} for user ${userId}, ${unitCount} units, total: $${totalAmount}, status: ${requestStatus}`);
    
    // If mentor request is auto-approved, auto-place units
    if (requestStatus === 'APPROVED' && user && user.role === 'MENTOR') {
      // Auto-place mentor units under admin/system root
      try {
        await this.processPlacement(request.id);
        logger.info(`Auto-placed units for mentor ${userId} purchase request ${request.id}`);
      } catch (error) {
        logger.error(`Error auto-placing mentor units:`, error);
        // Don't fail the request creation, just log the error
      }
    }
    
    return request;
  }

  /**
   * Approve purchase request
   * @param {string} requestId - Purchase request ID
   * @param {string} mentorId - Mentor ID approving the request
   * @param {string} hostId - Optional host ID (if mentor wants to specify who the host is)
   */
  static async approvePurchase(requestId, mentorId, hostId = null) {
    return await database.getClient().$transaction(async (tx) => {
      const request = await tx.purchaseRequest.findUnique({
        where: { id: requestId },
        include: {
          contractGame: true,
          user: true
        }
      });

      if (!request) {
        throw new Error('Purchase request not found');
      }

      if (request.mentorId !== mentorId) {
        throw new Error('Only the assigned mentor can approve this request');
      }

      if (request.status !== 'PENDING') {
        throw new Error(`Purchase request is already ${request.status}`);
      }

      // If hostId is provided, validate it exists and has units in this contract game
      // If not provided, default to mentor (mentor is the host by default)
      let finalHostId = hostId || mentorId;
      if (hostId) {
        const hostUser = await tx.user.findUnique({
          where: { id: hostId },
          select: { id: true, role: true }
        });
        if (!hostUser) {
          throw new Error('Host user not found');
        }

        // VALIDATION: If host is not the mentor, they must have units in this contract game
        // Mentor can always be host (will use system root if no units)
        // But mentees must have units in the game to be selected as hosts
        if (hostId !== mentorId) {
          const hostUnitsCount = await tx.unit.count({
            where: {
              ownerId: hostId,
              contractGameId: request.contractGameId
            }
          });

          if (hostUnitsCount === 0) {
            throw new Error('The selected host must have units in this contract game. Only mentees who are already playing can be selected as hosts.');
          }
        }

        finalHostId = hostId;
      }

      // Update request status and store hostId (mentor decides who the host is)
      const updatedRequest = await tx.purchaseRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          hostId: finalHostId // Store the host ID that mentor selected
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

      logger.info(`Purchase request ${requestId} approved by mentor ${mentorId}`);
      return updatedRequest;
    }, {
      timeout: 20000 // allow more time for approval flow
    });
  }

  /**
   * Reject purchase request
   */
  static async rejectPurchase(requestId, mentorId, reason = null) {
    return await database.getClient().$transaction(async (tx) => {
      const request = await tx.purchaseRequest.findUnique({
        where: { id: requestId }
      });

      if (!request) {
        throw new Error('Purchase request not found');
      }

      if (request.mentorId !== mentorId) {
        throw new Error('Only the assigned mentor can reject this request');
      }

      if (request.status !== 'PENDING') {
        throw new Error(`Purchase request is already ${request.status}`);
      }

      // Update request status
      const updatedRequest = await tx.purchaseRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED'
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
              name: true
            }
          }
        }
      });

      logger.info(`Purchase request ${requestId} rejected by mentor ${mentorId}${reason ? `: ${reason}` : ''}`);
      return updatedRequest;
    });
  }

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
      const stage = 1; // Always start with stage 1

      // Check if user is a mentor
      const isMentor = request.user.role === 'MENTOR';

      // Place each unit
      for (let i = 0; i < request.unitCount; i++) {
        // Get next unit number for this user
        const unitNumber = await PlacementService.getNextUnitNumber(
          request.userId,
          request.contractGameId,
          stage,
          tx // Pass transaction client
        );

        try {
          // SPECIAL HANDLING FOR MENTORS:
          // Mentor units are placed under admin/system root (hostId = admin/system)
          // Regular users: use hostId from request or default to mentorId
          let hostId = null;
          let mentorIdForPlacement = null;
          
          if (isMentor) {
            // Mentors: place under system root, host is admin/system
            // Use the hostId from request (which should be admin ID) or get admin
            if (request.hostId) {
              hostId = request.hostId; // Should be admin ID
            } else {
              // Fallback: get admin ID
              const admin = await tx.user.findFirst({
                where: { role: 'ADMIN' },
                orderBy: { createdAt: 'asc' },
                select: { id: true }
              });
              hostId = admin ? admin.id : null;
            }
            mentorIdForPlacement = null; // No mentor for mentors
          } else {
            // Regular users: use normal placement logic
            hostId = request.hostId || request.mentorId;
            mentorIdForPlacement = request.mentorId;
          }
          
          // Placement follows game rules:
          // - Odd units (101, 103, etc.) → Placed under HOST's active unit (or system root for mentors)
          // - Even units (102, 104, etc.) → Placed under OWNER's active unit (or system root for mentors)
          // hostId is stored for tracking referral relationships
          const unit = await PlacementService.placeUnit(
            request.userId,
            unitNumber,
            request.contractGameId,
            mentorIdForPlacement, // null for mentors
            hostId, // admin ID for mentors (system root), mentor's choice for regular users
            tx // Pass transaction client
          );

          // Ensure hostId is set correctly
          await tx.unit.update({
            where: { id: unit.id },
            data: {
              hostId: hostId // admin ID for mentors, mentor's choice for regular users
            }
          });

          placedUnits.push(unit);

          // If this is the first unit (should be odd, e.g., 101), activate it
          // This makes it the user's active unit for subsequent even-numbered units
          if (i === 0) {
            const hasActiveUnit = await PlacementService.findActiveUnit(
              request.userId,
              request.contractGameId,
              stage,
              tx // Pass transaction client
            );

            if (!hasActiveUnit && unitNumber % 2 === 1) {
              // First unit is odd, activate it so even units can be placed under it
              await tx.unit.update({
                where: { id: unit.id },
                data: { isActive: true }
              });
              logger.info(`Activated first unit ${unit.unitName} for user ${request.userId}`);
            }
          }

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

      logger.info(`Placed ${placedUnits.length} units for purchase request ${requestId}`);
      return {
        request: updatedRequest,
        units: placedUnits
      };
    }, {
      maxWait: 60000, // 60 seconds max wait for transaction to start
      timeout: 60000  // 60 seconds timeout for transaction to complete (BFS search can be slow)
    }).then(async (result) => {
      // Set cooldown period: 14 days from placement
      await database.getClient().purchaseRequest.update({
        where: { id: requestId },
        data: {
          cooldownEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
        }
      });

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

