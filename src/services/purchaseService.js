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
  static async createPurchaseRequest(userId, contractGameId, unitCount = 4) {
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

    // IMPORTANT: Check if user already has 4 units in this contract game
    // Each user can only own 4 units per contract game
    const existingUnitsCount = await database.getClient().unit.count({
      where: {
        ownerId: userId,
        contractGameId: contractGameId
      }
    });

    if (existingUnitsCount >= 4) {
      throw new Error(`You already own 4 units in this contract game. Each user can only own 4 units per contract game.`);
    }

    // For first purchase, minimum is 4 units
    // For subsequent purchases, can buy remaining units (even if less than 4)
    if (existingUnitsCount === 0 && unitCount < 4) {
      throw new Error('Minimum 4 units required for first purchase in a contract game.');
    }

    // Check if adding new units would exceed the limit
    if (existingUnitsCount + unitCount > 4) {
      const remaining = 4 - existingUnitsCount;
      throw new Error(`You can only purchase ${remaining} more unit(s) in this contract game. You already own ${existingUnitsCount} units. Maximum is 4 units per user per contract game.`);
    }

    // Calculate total amount
    const totalAmount = contractGame.downPayment * unitCount;

    // Check if user already has a mentor assigned
    const user = await database.getClient().user.findUnique({
      where: { id: userId },
      select: { mentorId: true }
    });

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

    // Create purchase request
    const request = await database.getClient().purchaseRequest.create({
      data: {
        userId: userId,
        mentorId: mentor.id,
        contractGameId: contractGameId,
        unitCount: unitCount,
        totalAmount: totalAmount,
        status: 'PENDING'
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

    logger.info(`Created purchase request ${request.id} for user ${userId}, ${unitCount} units, total: $${totalAmount}`);
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

      // If hostId is provided, validate it exists and is a valid user
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
              email: true
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

      // Get user's mentor (host) - the mentor who approved this request
      // This mentor becomes the host for the user's units
      const mentor = await tx.user.findUnique({
        where: { id: request.mentorId },
        select: { id: true }
      });

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
          // Place the unit
          // Use the hostId that mentor selected when approving (stored in request.hostId)
          // If hostId is not set, default to mentorId
          const hostId = request.hostId || request.mentorId;
          
          // Placement follows game rules:
          // - Odd units (101, 103, etc.) → Placed under HOST's active unit
          // - Even units (102, 104, etc.) → Placed under OWNER's active unit
          // hostId is stored for tracking referral relationships
          const unit = await PlacementService.placeUnit(
            request.userId,
            unitNumber,
            request.contractGameId,
            request.mentorId,
            hostId, // Pass the hostId that mentor selected (for tracking)
            tx // Pass transaction client
          );

          // Ensure hostId is set correctly (mentor's choice)
          await tx.unit.update({
            where: { id: unit.id },
            data: {
              hostId: hostId // Use the hostId that mentor selected
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
      // Check fulfillment after transaction completes (async, non-blocking)
      // This prevents transaction timeout issues
      Promise.all(
        result.units.map(unit => 
          FulfillmentService.checkFulfillmentAfterPlacement(unit.id).catch(err => {
            logger.error(`Error checking fulfillment for unit ${unit.id}:`, err);
            // Don't fail the whole operation if fulfillment check fails
          })
        )
      ).catch(err => {
        logger.error('Error in fulfillment checks:', err);
      });
      
      return result;
    });
  }
}

module.exports = PurchaseService;

