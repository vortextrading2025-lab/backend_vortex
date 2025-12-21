const database = require('../config/database');
const logger = require('../modules/logging/logger');
const redisClient = require('../config/redis');

/**
 * PlacementService
 * Implements the 5-step placement algorithm for units
 */
class PlacementService {
  /**
   * Generate unit name from email and unit number
   * Format: {email_prefix}_{unit_number}
   * Example: john@example.com -> john_101
   */
  static generateUnitName(email, unitNumber) {
    const emailPrefix = email.split('@')[0];
    return `${emailPrefix}_${unitNumber}`;
  }

  /**
   * Get next unit number for a user in a contract game and stage
   * Rules:
   * - NEW user: Stage 1 starts at 101, Stage 2 at 2001, Stage 3 at 3001
   * - SAME user, SAME stage: Continues sequentially (101-104, then 105, 106, 107...)
   * - SAME user, DIFFERENT stage: Uses stage prefix (2001-2004, then 2005, 2006...)
   * 
   * Stage 1: 101-104 for first 4, then 105, 106, 107... (continues sequentially)
   * Stage 2: 2001-2004 for first 4, then 2005, 2006, 2007... (continues sequentially)
   * Stage 3: 3001-3004 for first 4, then 3005, 3006, 3007... (continues sequentially)
   */
  static async getNextUnitNumber(userId, contractGameId, stage, tx = null) {
    const client = tx || database.getClient();
    const lastUnit = await client.unit.findFirst({
      where: {
        ownerId: userId,
        contractGameId: contractGameId,
        stage: stage
      },
      orderBy: { unitNumber: 'desc' }
    });

    if (!lastUnit) {
      // First unit in this stage for this user
      if (stage === 1) return 101;
      if (stage === 2) return 2001;
      if (stage === 3) return 3001;
    }

    const lastNumber = lastUnit.unitNumber;
    
    // Stage 1: First purchase 101-104, then continues 105, 106, 107...
    if (stage === 1) {
      if (lastNumber >= 101 && lastNumber <= 104) {
        // Still in first 4 units, continue sequentially
        return lastNumber + 1 <= 104 ? lastNumber + 1 : 105;
      }
      // After 104, continue sequentially: 105, 106, 107...
      return lastNumber + 1;
    }
    
    // Stage 2: First purchase 2001-2004, then continues 2005, 2006, 2007...
    if (stage === 2) {
      if (lastNumber >= 2001 && lastNumber <= 2004) {
        // Still in first 4 units, continue sequentially
        return lastNumber + 1 <= 2004 ? lastNumber + 1 : 2005;
      }
      // After 2004, continue sequentially: 2005, 2006, 2007...
      return lastNumber + 1;
    }
    
    // Stage 3: First purchase 3001-3004, then continues 3005, 3006, 3007...
    if (stage === 3) {
      if (lastNumber >= 3001 && lastNumber <= 3004) {
        // Still in first 4 units, continue sequentially
        return lastNumber + 1 <= 3004 ? lastNumber + 1 : 3005;
      }
      // After 3004, continue sequentially: 3005, 3006, 3007...
      return lastNumber + 1;
    }

    // Fallback: increment normally
    return lastNumber + 1;
  }

  /**
   * Find user's active unit in a specific contract game and stage
   * Only ONE unit per user per game per stage can be active
   */
  static async findActiveUnit(userId, contractGameId, stage, tx = null) {
    const client = tx || database.getClient();
    return await client.unit.findFirst({
      where: {
        ownerId: userId,
        contractGameId: contractGameId,
        stage: stage,
        isActive: true,
        isCompleted: false,
        isSystemRoot: false // Don't return system roots
      }
    });
  }

  /**
   * Find system root unit for a contract game and stage
   * Each contract game has one root unit per stage (owned by admin/system)
   */
  static async findSystemRoot(contractGameId, stage, tx = null) {
    const client = tx || database.getClient();
    return await client.unit.findFirst({
      where: {
        contractGameId: contractGameId,
        stage: stage,
        isSystemRoot: true,
        level: 0,
        parentUnitId: null
      }
    });
  }

  /**
   * Find vacant level and parent for placement (left-to-right search)
   * Returns an object with { parentUnitId, level } where a new unit should be placed
   * Binary tree rule: Each parent can only have 2 direct children at parent.level + 1
   * If that level is full, recursively find space under one of the children
   */
  static async findVacantLevel(parentUnitId, tx = null) {
    const client = tx || database.getClient();
    
    // Get parent unit to know starting level
    const parentUnit = await client.unit.findUnique({
      where: { id: parentUnitId },
      select: { level: true }
    });

    if (!parentUnit) {
      throw new Error('Parent unit not found');
    }

    // Get DIRECT children only (at parent.level + 1)
    // In a binary tree, a parent can only have direct children at the immediate next level
    const directChildren = await client.unit.findMany({
      where: {
        parentUnitId: parentUnitId,
        level: parentUnit.level + 1  // Only check immediate children
      },
      select: {
        id: true,
        level: true
      },
      orderBy: { positionInLevel: 'asc' } // Left-to-right order
    });

    // If parent has less than 2 direct children, place at immediate next level under this parent
    if (directChildren.length < 2) {
      return {
        parentUnitId: parentUnitId,
        level: parentUnit.level + 1
      };
    }

    // If parent has 2 direct children, find a child with space
    // Use iterative BFS (breadth-first search) to find the first available spot
    // This avoids deep recursion and transaction timeouts
    // Store both ID and level to avoid extra queries
    const queue = directChildren.map(c => ({ id: c.id, level: c.level })); // Start with both children (with level info)
    const visited = new Set();
    const maxIterations = 500; // Reduced limit to prevent timeout
    let iterations = 0;

    while (queue.length > 0 && iterations < maxIterations) {
      iterations++;
      const currentParent = queue.shift();

      if (visited.has(currentParent.id)) {
        continue; // Skip if already visited
      }
      visited.add(currentParent.id);

      // Get direct children of current parent (batch query)
      const currentChildren = await client.unit.findMany({
        where: {
          parentUnitId: currentParent.id,
          level: currentParent.level + 1
        },
        select: {
          id: true,
          level: true
        },
        orderBy: { positionInLevel: 'asc' }
      });

      // If current parent has less than 2 children, place here
      if (currentChildren.length < 2) {
        return {
          parentUnitId: currentParent.id,
          level: currentParent.level + 1
        };
      }

      // If current parent has 2 children, add both to queue for further search
      // This ensures we check both subtrees (left-to-right)
      if (currentChildren.length >= 2) {
        queue.push(...currentChildren); // Already have level info, no need to map
      }
    }

    // If queue is empty or max iterations reached, try to place at deepest level
    // This should rarely happen, but provides a fallback
    if (queue.length > 0) {
      const lastParent = queue[queue.length - 1];
      return {
        parentUnitId: lastParent.id,
        level: lastParent.level + 1
      };
    }

    throw new Error('No vacant level found in subtree - tree may be full or too deep');
  }

  /**
   * Find vacant position within a level (bottom-to-top search)
   * Positions are 1, 2 (binary tree: only 2 children per node)
   * Returns the first available position
   */
  static async findVacantPosition(parentUnitId, level, tx = null) {
    const client = tx || database.getClient();
    // Get all units at this level under this parent
    const unitsAtLevel = await client.unit.findMany({
      where: {
        parentUnitId: parentUnitId,
        level: level
      },
      select: {
        positionInLevel: true
      }
    });

    const occupiedPositions = new Set(unitsAtLevel.map(u => u.positionInLevel));

    // Search bottom-to-top (positions 1, 2) - Binary tree: only 2 positions
    for (let position = 1; position <= 2; position++) {
      if (!occupiedPositions.has(position)) {
        return position;
      }
    }

    throw new Error(`Level ${level} is full (all 2 positions occupied)`);
  }

  /**
   * Main placement function - implements 5-step algorithm
   * Step 1: Identify owner (get user)
   * Step 2: Get unit number
   * Step 3: Find target active unit (odd → mentor's active, even → user's active)
   * Step 4: Find vacant level (left-to-right)
   * Step 5: Find vacant position (bottom-to-top)
   */
  /**
   * Place a unit in the game tree
   * @param {string} ownerId - User ID who owns the unit
   * @param {number} unitNumber - Unit number (101, 102, etc.)
   * @param {string} contractGameId - Contract game ID
   * @param {string} mentorId - Mentor ID
   * @param {string} hostId - Host ID (mentor decides who the host is)
   * @param {object} tx - Optional transaction client (if called from within a transaction)
   */
  static async placeUnit(ownerId, unitNumber, contractGameId, mentorId, hostId = null, tx = null) {
    // If transaction client is provided, use it; otherwise create a new transaction
    const executePlacement = async (client) => {
      // Step 1: Identify owner
      const owner = await client.user.findUnique({
        where: { id: ownerId },
        select: { id: true, email: true, role: true } // Need role to check if mentor
      });

      if (!owner) {
        throw new Error('Owner user not found');
      }

      // Step 2: Get unit number (provided as parameter)
      // Determine stage based on unit number
      let stage = 1;
      if (unitNumber >= 2001) stage = 2;
      if (unitNumber >= 3001) stage = 3;

      // Step 3: Find target active unit based on game placement rules
      // SPECIAL: Mentors always place under system root (admin/system)
      // Regular users follow normal placement rules
      const isMentor = owner.role === 'MENTOR';
      let targetActiveUnit = null;
      const isOddUnit = unitNumber % 2 === 1;

      if (isMentor) {
        // Mentors: ALWAYS place under system root (admin/system)
        targetActiveUnit = await this.findSystemRoot(contractGameId, stage, client);
        if (!targetActiveUnit) {
          throw new Error(`No system root found for contract game ${contractGameId} stage ${stage}. Contract game may not be initialized.`);
        }
      } else {
        // Regular users: Follow normal placement rules
        // Game Placement Rules:
        // - Odd units (101, 103, 105, etc.) → ALWAYS place under HOST's active unit
        // - Even units (102, 104, 106, etc.) → ALWAYS place under OWNER's (user's) active unit
        // 
        // Note: hostId is stored for tracking referral relationships,
        // but placement target is ALWAYS determined by the odd/even rule
        const finalHostId = hostId || mentorId;

        if (!finalHostId) {
          throw new Error('Host ID is required for unit placement');
        }

        if (isOddUnit) {
          // Odd units (101, 103, etc.): ALWAYS place under HOST's active unit
          targetActiveUnit = await this.findActiveUnit(finalHostId, contractGameId, stage, client);
          
          // If host has no active unit, use system root
          if (!targetActiveUnit) {
            targetActiveUnit = await this.findSystemRoot(contractGameId, stage, client);
            if (!targetActiveUnit) {
              throw new Error(`No system root found for contract game ${contractGameId} stage ${stage}. Contract game may not be initialized.`);
            }
          }
        } else {
          // Even units (102, 104, etc.): ALWAYS place under OWNER's FIRST unit (101)
          // IMPORTANT: Even units should go under the FIRST unit (101), not the active unit
          // This ensures 102 and 104 both go under 101, not 102 going under 101 and 104 going under 102
          const ownerFirstUnit = await client.unit.findFirst({
            where: {
              ownerId: ownerId,
              contractGameId: contractGameId,
              stage: stage,
              isSystemRoot: false,
              unitNumber: {
                gte: stage === 1 ? 101 : stage === 2 ? 2001 : 3001,
                lte: stage === 1 ? 104 : stage === 2 ? 2004 : 3004
              }
            },
            orderBy: { unitNumber: 'asc' } // Get first unit (101, 2001, or 3001)
          });
          
          // Use first unit (101) if it exists, otherwise use active unit as fallback
          if (ownerFirstUnit) {
            targetActiveUnit = ownerFirstUnit;
          } else {
            targetActiveUnit = await this.findActiveUnit(ownerId, contractGameId, stage, client);
          }
          
          // If owner has no units at all, use system root as fallback
          if (!targetActiveUnit) {
            targetActiveUnit = await this.findSystemRoot(contractGameId, stage, client);
            if (!targetActiveUnit) {
              throw new Error(`No system root found for contract game ${contractGameId} stage ${stage}. Contract game may not be initialized.`);
            }
          }
        }
      }

      // Step 4: Find vacant level and parent (left-to-right search)
      // This returns { parentUnitId, level } - the actual parent where unit should be placed
      const vacantPlacement = await this.findVacantLevel(targetActiveUnit.id, client);
      const actualParentUnitId = vacantPlacement.parentUnitId;
      const vacantLevel = vacantPlacement.level;

      // Step 5: Find vacant position (bottom-to-top search)
      const vacantPosition = await this.findVacantPosition(actualParentUnitId, vacantLevel, client);

      // Generate unit name
      const unitName = this.generateUnitName(owner.email, unitNumber);

      // Check if unit name already exists (shouldn't happen, but safety check)
      const existingUnit = await client.unit.findUnique({
        where: {
          contractGameId_unitName: {
            contractGameId: contractGameId,
            unitName: unitName
          }
        }
      });

      if (existingUnit) {
        throw new Error(`Unit with name ${unitName} already exists`);
      }

      // Determine hostId for unit creation
      // For mentors: hostId is admin ID (system root)
      // For regular users: hostId is from parameter (mentor's choice)
      let unitHostId = null;
      if (isMentor) {
        // For mentors, hostId should be admin ID (system root)
        unitHostId = hostId || null; // Should be admin ID from processPlacement
      } else {
        // For regular users, use hostId from parameter
        const finalHostId = hostId || mentorId;
        unitHostId = finalHostId || null;
      }

      // Create the unit
      // Use actualParentUnitId (which may be a child of targetActiveUnit if targetActiveUnit is full)
      const unit = await client.unit.create({
        data: {
          contractGameId: contractGameId,
          ownerId: ownerId,
          unitNumber: unitNumber,
          unitName: unitName,
          stage: stage,
          parentUnitId: actualParentUnitId, // Use the actual parent (may be a child if targetActiveUnit is full)
          level: vacantLevel,
          positionInLevel: vacantPosition,
          isActive: false, // New units are not active by default
          isCompleted: false,
          mentorId: mentorId || null, // Track which mentor placed this unit (null for mentors)
          hostId: unitHostId, // Admin ID for mentors (system root), mentor's choice for regular users
          isSystemRoot: false
        }
      });

      logger.info(`Placed unit ${unitName} (${unitNumber}) for user ${ownerId} at level ${vacantLevel}, position ${vacantPosition}${isMentor ? ' (mentor - under system root)' : ''}`);

      return unit;
    };

    // If transaction client provided, use it directly; otherwise create new transaction
    if (tx) {
      return await executePlacement(tx);
    } else {
      return await database.getClient().$transaction(async (tx) => {
        return await executePlacement(tx);
      }, {
        maxWait: 30000,
        timeout: 30000
      });
    }
  }

  /**
   * Activate next inactive unit for a user in a contract game and stage
   * Only ONE unit per user per game per stage can be active
   * Can accept optional transaction client to avoid nested transactions
   */
  static async activateNextUnit(userId, contractGameId, stage, tx = null) {
    const executeActivation = async (client) => {
      // Deactivate current active unit
      await client.unit.updateMany({
        where: {
          ownerId: userId,
          contractGameId: contractGameId,
          stage: stage,
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      // Find next inactive unit
      const nextUnit = await client.unit.findFirst({
        where: {
          ownerId: userId,
          contractGameId: contractGameId,
          stage: stage,
          isActive: false,
          isCompleted: false
        },
        orderBy: { unitNumber: 'asc' }
      });

      if (nextUnit) {
        // Activate it
        await client.unit.update({
          where: { id: nextUnit.id },
          data: { isActive: true }
        });

        logger.info(`Activated unit ${nextUnit.unitName} for user ${userId} in stage ${stage}`);
        return nextUnit;
      }

      return null;
    };

    // If transaction client provided, use it directly; otherwise create new transaction
    if (tx) {
      return await executeActivation(tx);
    } else {
      return await database.getClient().$transaction(async (tx) => {
        return await executeActivation(tx);
      });
    }
  }

  /**
   * Build a recursive subtree starting from a unit
   * Returns the unit with all its descendants
   */
  static async buildUnitSubtree(unitId, tx = null) {
    const client = tx || database.getClient();
    
    // Get root unit
    const rootUnit = await client.unit.findUnique({
      where: { id: unitId },
      include: {
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        mentor: { select: { id: true, email: true, firstName: true, lastName: true } },
        host: { select: { id: true, email: true, firstName: true, lastName: true } },
        parentUnit: { select: { id: true, unitName: true, unitNumber: true } },
        contractGame: { select: { id: true, name: true } },
        payouts: { select: { id: true, amount: true, stage: true, status: true, createdAt: true } }
      }
    });

    if (!rootUnit) return null;

    // Recursively build the subtree starting from root unit
    const MAX_DEPTH = 20; // Maximum depth to prevent infinite loops
    const unitMap = new Map();
    
    // Helper function to recursively fetch children
    const fetchChildren = async (parentId, depth = 0) => {
      if (depth > MAX_DEPTH) return;
      
      const children = await client.unit.findMany({
        where: {
          parentUnitId: parentId,
          contractGameId: rootUnit.contractGameId, // Only get units from same contract game
          stage: rootUnit.stage // Only get units from same stage
        },
        include: {
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
          mentor: { select: { id: true, email: true, firstName: true, lastName: true } },
          host: { select: { id: true, email: true, firstName: true, lastName: true } },
          parentUnit: { select: { id: true, unitName: true, unitNumber: true } },
          contractGame: { select: { id: true, name: true } },
          payouts: { select: { id: true, amount: true, stage: true, status: true, createdAt: true } }
        },
        orderBy: [
          { level: 'asc' },
          { positionInLevel: 'asc' }
        ]
      });

      // Store children in unit map
      children.forEach(child => {
        if (!unitMap.has(child.id)) {
          unitMap.set(child.id, { ...child, childrenUnits: [] });
        }
      });

      // Recursively fetch children of each child
      for (const child of children) {
        await fetchChildren(child.id, depth + 1);
      }
    };

    // Start building from root unit
    unitMap.set(rootUnit.id, { ...rootUnit, childrenUnits: [] });
    await fetchChildren(unitId, 0);

    // Build parent-child relationships
    unitMap.forEach((unit, unitId) => {
      if (unit.parentUnitId && unitMap.has(unit.parentUnitId)) {
        const parent = unitMap.get(unit.parentUnitId);
        if (!parent.childrenUnits) {
          parent.childrenUnits = [];
        }
        parent.childrenUnits.push(unit);
      }
    });

    // Sort children by positionInLevel (descending) and unitNumber
    unitMap.forEach(unit => {
      if (unit.childrenUnits && unit.childrenUnits.length > 0) {
        unit.childrenUnits.sort((a, b) => {
          if (a.positionInLevel !== b.positionInLevel) {
            return b.positionInLevel - a.positionInLevel; // Descending order
          }
          return a.unitNumber - b.unitNumber;
        });
      }
    });

    return unitMap.get(unitId);
  }
}

module.exports = PlacementService;

