const database = require('../config/database');
const logger = require('../modules/logging/logger');
const redisClient = require('../config/redis');

/**
 * PlacementService
 * Implements the 5-step placement algorithm for units
 */
class PlacementService {
  /**
   * Generate unit name from userId and unit number
   * Format: {userId}_{unit_number}
   * Example: userId "abc123" -> abc123_101
   */
  static generateUnitName(userId, unitNumber) {
    return `${userId}_${unitNumber}`;
  }

  /**
   * Get next unit number for a user in a contract game and stage
   * Rules:
   * - NEW user: Stage 1 starts at 101, Stage 2 at 201, Stage 3 at 301
   * - SAME user, SAME stage: Continues sequentially (101-104, then 105, 106, 107...)
   * - SAME user, DIFFERENT stage: Uses stage prefix (201-204, then 205, 206...)
   * 
   * Stage 1: 101-104 for first 4, then 105, 106, 107... (continues sequentially)
   * Stage 2: 201-204 for first 4, then 205, 206, 207... (continues sequentially)
   * Stage 3: 301-304 for first 4, then 305, 306, 307... (continues sequentially)
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
      if (stage === 2) return 201;
      if (stage === 3) return 301;
    }

    const lastNumber = lastUnit.unitNumber;
    
    // Stage 1: First purchase 101-104, then continues 105, 106, 107...
    if (stage === 1) {
      // Continue sequentially from last number
      return lastNumber + 1;
    }
    
    // Stage 2: First purchase 201-204, then continues 205, 206, 207...
    if (stage === 2) {
      // Continue sequentially from last number
      return lastNumber + 1;
    }
    
    // Stage 3: First purchase 301-304, then continues 305, 306, 307...
    if (stage === 3) {
      // Continue sequentially from last number
      return lastNumber + 1;
    }

    // Fallback: increment normally
    return lastNumber + 1;
  }

  /**
   * Get multiple unit numbers at once (optimized batch version)
   * Returns an array of unit numbers for placing multiple units
   * This reduces database queries from N queries to 1 query
   */
  static async getNextUnitNumbers(userId, contractGameId, stage, count, tx = null) {
    const client = tx || database.getClient();
    
    // Get the last unit number for this user in this stage
    const lastUnit = await client.unit.findFirst({
      where: {
        ownerId: userId,
        contractGameId: contractGameId,
        stage: stage
      },
      orderBy: { unitNumber: 'desc' }
    });

    let startNumber;
    if (!lastUnit) {
      // First units in this stage for this user
      if (stage === 1) startNumber = 101;
      else if (stage === 2) startNumber = 201;
      else if (stage === 3) startNumber = 301;
      else startNumber = 101; // Fallback
    } else {
      // Continue sequentially from last number
      startNumber = lastUnit.unitNumber + 1;
    }

    // Generate array of sequential unit numbers
    const unitNumbers = [];
    for (let i = 0; i < count; i++) {
      unitNumbers.push(startNumber + i);
    }

    return unitNumbers;
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
   * Simple strategy: Find the deepest level (level 10) and place there
   * Level 10 has 1024 units, so there's plenty of space
   */
  static async findSystemRoot(contractGameId, stage, tx = null) {
    const client = tx || database.getClient();
    
    // Simple strategy: Find level 10 system root units (deepest level)
    // Level 10 has 1024 units, so there's plenty of space
    const maxLevel = 10;
    
    // Find system root units at the deepest level (level 10)
    const deepestSystemRoots = await client.unit.findMany({
      where: {
        contractGameId: contractGameId,
        isSystemRoot: true,
        level: maxLevel
      },
      orderBy: { positionInLevel: 'asc' }
    });
    
    // Find the first system root unit at level 10 that has less than 2 direct children
    for (const root of deepestSystemRoots) {
      const directChildren = await client.unit.findMany({
        where: {
          parentUnitId: root.id,
          level: root.level + 1 // Direct children would be at level 11
        }
      });
      
      if (directChildren.length < 2) {
        logger.info(`Found available system root at level ${root.level}: ${root.unitName} (${directChildren.length}/2 children)`);
        return root; // Found an available system root unit at deepest level
      }
    }
    
    // If all level 10 roots are full, try level 9, then 8, etc. (go up the tree)
    for (let level = maxLevel - 1; level >= 0; level--) {
      const systemRootsAtLevel = await client.unit.findMany({
        where: {
          contractGameId: contractGameId,
          isSystemRoot: true,
          level: level
        },
        orderBy: { positionInLevel: 'asc' }
      });
      
      for (const root of systemRootsAtLevel) {
        const directChildren = await client.unit.findMany({
          where: {
            parentUnitId: root.id,
            level: root.level + 1
          }
        });
        
        if (directChildren.length < 2) {
          logger.info(`Found available system root at level ${root.level}: ${root.unitName} (${directChildren.length}/2 children)`);
          return root;
        }
      }
    }
    
    // Fallback: Return level 0 root if nothing else found
    const level0Root = await client.unit.findFirst({
      where: {
        contractGameId: contractGameId,
        isSystemRoot: true,
        level: 0,
        parentUnitId: null
      }
    });
    
    if (level0Root) {
      logger.warn(`All system roots are full, using level 0 root as fallback: ${level0Root.unitName}`);
      return level0Root;
    }
    
    return null; // No system root found at all
  }

  /**
   * Find an available unit for placement when system root is full
   * Returns a unit that has space (less than 2 direct children)
   * Priority: Active units first, then any unit with space
   */
  static async findAvailableUnitForPlacement(contractGameId, stage, tx = null) {
    const client = tx || database.getClient();
    
    // First, try to find an active unit with space
    const activeUnits = await client.unit.findMany({
      where: {
        contractGameId: contractGameId,
        stage: stage,
        isActive: true,
        isSystemRoot: false
      },
      include: {
        _count: {
          select: {
            childrenUnits: {
              where: {
                level: { // Only count direct children
                  // We'll check this in a subquery
                }
              }
            }
          }
        }
      },
      orderBy: { level: 'asc' } // Prefer units at lower levels
    });

    // Check each active unit for available space
    for (const unit of activeUnits) {
      const directChildren = await client.unit.findMany({
        where: {
          parentUnitId: unit.id,
          level: unit.level + 1 // Only direct children
        }
      });
      
      if (directChildren.length < 2) {
        return unit; // Found an active unit with space
      }
    }

    // If no active unit has space, find any unit with space
    const allUnits = await client.unit.findMany({
      where: {
        contractGameId: contractGameId,
        stage: stage,
        isSystemRoot: false
      },
      orderBy: { level: 'asc' } // Prefer units at lower levels
    });

    for (const unit of allUnits) {
      const directChildren = await client.unit.findMany({
        where: {
          parentUnitId: unit.id,
          level: unit.level + 1 // Only direct children
        }
      });
      
      if (directChildren.length < 2) {
        return unit; // Found a unit with space
      }
    }

    return null; // No available units found
  }

  /**
   * Find vacant level and parent for placement (left-to-right search)
   * Returns an object with { parentUnitId, level } where a new unit should be placed
   * Binary tree rule: Each parent can only have 2 direct children at parent.level + 1
   * If that level is full, recursively find space under one of the children
   * Only searches in units owned by the same owner as the starting parent unit
   */
  static async findVacantLevel(parentUnitId, tx = null, requiredOwnerId = null, onlyCountEvenUnits = false) {
    const client = tx || database.getClient();
    
    // Get parent unit to know starting level and owner
    const parentUnit = await client.unit.findUnique({
      where: { id: parentUnitId },
      select: { level: true, ownerId: true }
    });

    if (!parentUnit) {
      throw new Error('Parent unit not found');
    }

    // Use the parent unit's ownerId to restrict search to same-owner units
    // IMPORTANT: If requiredOwnerId is explicitly null, search entire subtree regardless of owner
    // If requiredOwnerId is undefined/not provided, use parent unit's ownerId
    const ownerIdToMatch = requiredOwnerId !== null ? (requiredOwnerId || parentUnit.ownerId) : null;

    // Get ALL direct children (at parent.level + 1) - check total count first
    // In a binary tree, a parent can only have direct children at the immediate next level
    const allDirectChildren = await client.unit.findMany({
      where: {
        parentUnitId: parentUnitId,
        level: parentUnit.level + 1  // Only check immediate children
      },
      select: {
        id: true,
        level: true,
        ownerId: true,
        unitNumber: true,
        positionInLevel: true
      },
      orderBy: [
        { positionInLevel: 'asc' }, // Left (position 1) first, then right (position 2)
        { unitNumber: 'asc' } // If same position, sort by unit number
      ]
    });

    // For even unit placement, only count even units when checking if parent has space
    // (odd units under owner's unit 101 are incorrectly placed and shouldn't count)
    const validDirectChildren = onlyCountEvenUnits 
      ? allDirectChildren.filter(c => c.unitNumber % 2 === 0)
      : allDirectChildren;

    // If parent has less than 2 valid direct children, place at immediate next level under this parent
    if (validDirectChildren.length < 2) {
      return {
        parentUnitId: parentUnitId,
        level: parentUnit.level + 1
      };
    }

    // If parent has 2 valid direct children, need to search deeper in subtree
    // IMPORTANT: If ownerIdToMatch is null, search entire subtree regardless of owner
    // If ownerIdToMatch is set, only search in units owned by that owner
    const directChildren = ownerIdToMatch !== null
      ? validDirectChildren.filter(c => c.ownerId === ownerIdToMatch)
      : validDirectChildren; // Search entire subtree if no owner restriction

    // If parent has 2 direct children owned by same owner, find a child with space
    // Use iterative BFS (breadth-first search) to find the first available spot
    // This avoids deep recursion and transaction timeouts
    // IMPORTANT: Sort by positionInLevel to ensure left-to-right order (position 1 = left/bottom, position 2 = right/top)
    const sortedDirectChildren = directChildren.sort((a, b) => {
      const posA = a.positionInLevel || 0;
      const posB = b.positionInLevel || 0;
      if (posA !== posB) return posA - posB; // Position 1 (left) before position 2 (right)
      return (a.unitNumber || 0) - (b.unitNumber || 0); // If same position, sort by unit number
    });
    const queue = sortedDirectChildren.map(c => ({ id: c.id, level: c.level })); // Start with both children (with level info) in left-to-right order
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
      // Order by positionInLevel ASC to ensure left-to-right order (position 1 = left/bottom, position 2 = right/top)
      // IMPORTANT: If ownerIdToMatch is null, search entire subtree regardless of owner
      const whereClause = {
        parentUnitId: currentParent.id,
        level: currentParent.level + 1
      };
      if (ownerIdToMatch !== null) {
        whereClause.ownerId = ownerIdToMatch; // Only consider units owned by the same owner if restriction is set
      }
      const currentChildrenAll = await client.unit.findMany({
        where: whereClause,
        select: {
          id: true,
          level: true,
          unitNumber: true,
          positionInLevel: true
        },
        orderBy: [
          { positionInLevel: 'asc' }, // Left (position 1) first, then right (position 2)
          { unitNumber: 'asc' } // If same position, sort by unit number
        ]
      });

      // For even unit placement, only count even units
      const currentChildren = onlyCountEvenUnits
        ? currentChildrenAll.filter(c => c.unitNumber % 2 === 0)
        : currentChildrenAll;

      // If current parent has less than 2 valid children owned by same owner, place here
      if (currentChildren.length < 2) {
        return {
          parentUnitId: currentParent.id,
          level: currentParent.level + 1
        };
      }

      // If current parent has 2 children owned by same owner, add both to queue for further search
      // This ensures we check both subtrees (left-to-right)
      // IMPORTANT: Add children in left-to-right order (position 1 first, then position 2)
      if (currentChildren.length >= 2) {
        // Sort by positionInLevel to ensure left (position 1) is checked before right (position 2)
        const sortedChildren = currentChildren.sort((a, b) => {
          const posA = a.positionInLevel || 0;
          const posB = b.positionInLevel || 0;
          if (posA !== posB) return posA - posB; // Position 1 (left) before position 2 (right)
          return (a.unitNumber || 0) - (b.unitNumber || 0); // If same position, sort by unit number
        });
        queue.push(...sortedChildren.map(c => ({ id: c.id, level: c.level }))); // Add in left-to-right order with level info
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
   * 
   * IMPORTANT: Placement rules are ALWAYS followed for EACH unit, regardless of:
   * - How many units are purchased in a single transaction
   * - How many units the user already owns
   * - The order of unit placement
   * 
   * Rules are applied per unit based on:
   * 1. Unit number (odd vs even)
   * 2. Whether it's first purchase (101-104) or subsequent (105+)
   * 3. Left-to-right, bottom-to-top search order
   * 
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
      // 
      // CRITICAL: These rules are ALWAYS followed for EVERY unit, regardless of purchase count
      // 
      // Game Placement Rules (per document):
      // - Odd units (101, 103, 105, etc.) → First purchase (101, 103): under HOST's active unit (or system root if no host)
      //                                      After first purchase (105, 107, etc.): under OWNER's existing units' subtrees (102, 104, etc.)
      // - Even units (102, 104, 106, etc.) → ALWAYS place under OWNER's active unit (101 for first purchase, then under owner's existing units)
      // 
      // Search order: ALWAYS left-to-right, bottom-to-top (per document)
      // 
      // IMPORTANT: After the first 4 units (101-104), ALL subsequent units (105+) go under the OWNER's existing units' subtrees
      // 
      // For non-invited users (hostId is null):
      // 1. First try: System root (if exists and has space)
      // 2. If system root is full: Find another available unit
      // 3. Only if no system root exists: Use someone else's unit
      let targetActiveUnit = null;
      const isOddUnit = unitNumber % 2 === 1;
      let isOddUnitInOwnerSubtree = false; // Track if odd unit is being placed in owner's subtree

      if (isOddUnit) {
        // Odd units (101, 103, 105, 107, etc.): 
        // RULE: ALL odd units go under HOST, regardless of purchase number
        // - 101 (first odd): under HOST's active unit (or system root if no host)
        // - 103 (second odd): under SAME parent as 101 (siblings under host/system)
        // - 105, 107, etc. (subsequent odd): under HOST's active unit subtree (NOT owner's units)
        
        // Check if user already has units
        const ownerExistingUnits = await client.unit.findMany({
          where: {
            ownerId: ownerId,
            contractGameId: contractGameId,
            stage: stage,
            isSystemRoot: false
          },
          orderBy: { unitNumber: 'asc' }
        });

        // Get hostId from parameter or existing units
        let actualHostId = hostId;
        if (ownerExistingUnits.length > 0 && ownerExistingUnits[0].hostId) {
          actualHostId = ownerExistingUnits[0].hostId;
        }

        // SPECIAL CASE: For second odd unit (103) of first set, place under HOST's odd unit (same as 101)
        // CRITICAL: 103 MUST be placed under the HOST's odd unit subtree, NOT under 101's parent (which may be an even unit)
        // If host's odd unit is full, find another system root or host odd unit
        const isSecondOddOfFirstSet = unitNumber === (stage === 1 ? 103 : stage === 2 ? 2003 : 3003);
        const firstOddUnitNumber = stage === 1 ? 101 : stage === 2 ? 2001 : 3001;
        const firstOddUnit = ownerExistingUnits.find(u => u.unitNumber === firstOddUnitNumber);
        
        if (isSecondOddOfFirstSet && firstOddUnit && actualHostId) {
          // Find the host's odd unit (101) - this is where 103 should go, same as 101
          const hostFirstOddUnit = await client.unit.findFirst({
            where: {
              ownerId: actualHostId,
              contractGameId: contractGameId,
              stage: stage,
              isSystemRoot: false,
              unitNumber: firstOddUnitNumber
            }
          });
          
          if (hostFirstOddUnit) {
            // Check if host's odd unit has direct space (max 2 children)
            const hostOddChildren = await client.unit.findMany({
              where: {
                parentUnitId: hostFirstOddUnit.id,
                level: hostFirstOddUnit.level + 1
              }
            });
            
            if (hostOddChildren.length < 2) {
              // Host's odd unit has space - place 103 directly under it (as sibling of host's children, not necessarily 101)
              targetActiveUnit = hostFirstOddUnit;
              logger.info(`Placing second odd unit ${unitNumber} under host's odd unit ${hostFirstOddUnit.unitNumber} (${hostFirstOddUnit.unitName}) - same placement rule as first odd unit`);
            } else {
              // Host's odd unit is full - use findVacantLevel to find space in its subtree
              // But we need to ensure 103 is NOT placed under the owner's 101
              try {
                const vacantPlacement = await this.findVacantLevel(hostFirstOddUnit.id, client, null, false);
                if (vacantPlacement) {
                  const parentUnit = await client.unit.findUnique({
                    where: { id: vacantPlacement.parentUnitId },
                    select: {
                      id: true,
                      unitName: true,
                      unitNumber: true,
                      level: true,
                      ownerId: true
                    }
                  });
                  if (parentUnit) {
                    // CRITICAL: Don't place 103 under the owner's 101
                    if (parentUnit.id !== firstOddUnit.id) {
                      targetActiveUnit = parentUnit;
                      logger.info(`Placing second odd unit ${unitNumber} under host's odd unit ${hostFirstOddUnit.unitNumber} subtree at ${parentUnit.unitName} (level ${parentUnit.level})`);
                    } else {
                      logger.debug(`Skipping placement under owner's first odd unit ${firstOddUnit.unitNumber} - 103 should not be under owner's 101`);
                    }
                  }
                }
              } catch (error) {
                logger.debug(`No space in host odd unit ${hostFirstOddUnit.unitNumber} subtree: ${error.message}`);
              }
            }
          }
        }
        
        // CRITICAL: If we're placing 103 and 101 exists, we should NOT place 103 under 101's subtree
        // Set a flag to prevent host search from placing it under 101
        const shouldSkipHostSubtreeSearch = isSecondOddOfFirstSet && firstOddUnit && !targetActiveUnit;

        // PRIORITY: If owner has existing units and this is a subsequent purchase (105+), 
        // place under OWNER's existing units' subtrees FIRST, before checking host
        if (!targetActiveUnit && ownerExistingUnits.length > 0 && unitNumber > (stage === 1 ? 104 : stage === 2 ? 2004 : 3004)) {
          // Owner has existing units and this is a subsequent purchase (105+)
          // Place under owner's existing even units (102, 104, etc.) subtrees
          const ownerEvenUnits = ownerExistingUnits.filter(u => u.unitNumber % 2 === 0);
          
          if (ownerEvenUnits.length > 0) {
            // Try to find space in owner's even units' subtrees
            for (const evenUnit of ownerEvenUnits) {
              try {
                const vacantPlacement = await this.findVacantLevel(evenUnit.id, client, null, false);
                if (vacantPlacement) {
                  const parentUnit = await client.unit.findUnique({
                    where: { id: vacantPlacement.parentUnitId },
                    select: {
                      id: true,
                      unitName: true,
                      unitNumber: true,
                      level: true,
                      ownerId: true
                    }
                  });
                  if (parentUnit) {
                    targetActiveUnit = parentUnit;
                    logger.info(`Placing odd unit ${unitNumber} under owner's existing even unit ${evenUnit.unitNumber} (${evenUnit.unitName}) subtree - found space at ${parentUnit.unitName} (level ${parentUnit.level})`);
                    break;
                  }
                }
              } catch (error) {
                logger.debug(`No space in owner's even unit ${evenUnit.unitNumber} subtree: ${error.message}`);
                continue;
              }
            }
          }
        }

        // For ALL odd units (101, 103, 105, 107, etc.), place under HOST's active unit subtree
        // (Only if not already placed under owner's existing units)
        if (!targetActiveUnit && actualHostId && !shouldSkipHostSubtreeSearch) {
          // Find host's ACTIVE odd units - per document: "under host's active contract"
          const hostActiveOddUnits = await client.unit.findMany({
            where: {
              ownerId: actualHostId,
              contractGameId: contractGameId,
              stage: stage,
              isSystemRoot: false,
              isActive: true,
              unitNumber: {
                gte: stage === 1 ? 101 : stage === 2 ? 2001 : 3001,
              }
            },
            orderBy: { unitNumber: 'asc' }
          });

          // Filter to only odd units
          const hostActiveOddUnitsOnly = hostActiveOddUnits.filter(u => u.unitNumber % 2 === 1);

          // Try host's active odd units first - use findVacantLevel to check entire subtree (children, grandchildren, etc.)
          for (const hostUnit of hostActiveOddUnitsOnly) {
            try {
              // Use findVacantLevel to find space in host's unit ENTIRE subtree (left-to-right BFS search)
              // This will check:
              // 1. Direct children of host unit
              // 2. If full, check children's children (grandchildren)
              // 3. Continue deeper until space is found
              // Pass null for requiredOwnerId to search entire subtree regardless of owner
              const vacantPlacement = await this.findVacantLevel(hostUnit.id, client, null, false);
              if (vacantPlacement) {
                const parentUnit = await client.unit.findUnique({
                  where: { id: vacantPlacement.parentUnitId },
                  select: {
                    id: true,
                    unitName: true,
                    unitNumber: true,
                    level: true,
                    ownerId: true
                  }
                });
                if (parentUnit) {
                  targetActiveUnit = parentUnit;
                  logger.info(`Placing odd unit ${unitNumber} under host's active odd unit ${hostUnit.unitNumber} (${hostUnit.unitName}) subtree - found space at ${parentUnit.unitName} (level ${parentUnit.level}) following left-to-right BFS search`);
                  break;
                }
              }
            } catch (error) {
              logger.debug(`No space in host unit ${hostUnit.unitNumber} entire subtree: ${error.message}`);
              continue;
            }
          }

          // If all host active odd units are full (including their children), try other host odd units
          if (!targetActiveUnit) {
            const firstOddUnitNumber = stage === 1 ? 101 : stage === 2 ? 2001 : 3001;
            const hostFirstOddUnit = await client.unit.findFirst({
              where: {
                ownerId: actualHostId,
                contractGameId: contractGameId,
                stage: stage,
                isSystemRoot: false,
                unitNumber: firstOddUnitNumber
              }
            });

            if (hostFirstOddUnit) {
              try {
                // Use findVacantLevel to find space in host's first odd unit ENTIRE subtree
                // This will check children, grandchildren, etc. until space is found (left-to-right BFS)
                const vacantPlacement = await this.findVacantLevel(hostFirstOddUnit.id, client, null, false);
                if (vacantPlacement) {
                  const parentUnit = await client.unit.findUnique({
                    where: { id: vacantPlacement.parentUnitId },
                    select: {
                      id: true,
                      unitName: true,
                      unitNumber: true,
                      level: true,
                      ownerId: true
                    }
                  });
                  if (parentUnit) {
                    targetActiveUnit = parentUnit;
                    logger.info(`Placing odd unit ${unitNumber} under host's first odd unit ${hostFirstOddUnit.unitNumber} (${hostFirstOddUnit.unitName}) subtree - found space at ${parentUnit.unitName} (level ${parentUnit.level}) following left-to-right BFS search`);
                  }
                }
              } catch (error) {
                logger.debug(`No space in host first odd unit ${hostFirstOddUnit.unitNumber} entire subtree: ${error.message}`);
              }
            }
          }

        } // end: if (!targetActiveUnit && actualHostId)

        // Only use system root if user has NO existing units (no host) OR host's entire subtree is full
        if (!targetActiveUnit) {
          if (actualHostId) {
            // Host exists but all host units are full - fall back to system root
            const systemRoot = await this.findSystemRoot(contractGameId, stage, client);
            if (systemRoot) {
              const directChildren = await client.unit.findMany({
                where: {
                  parentUnitId: systemRoot.id,
                  level: systemRoot.level + 1
                }
              });
              
              if (directChildren.length < 2) {
                targetActiveUnit = systemRoot;
                logger.info(`Placing under system root (host units full, system root has ${directChildren.length}/2 children)`);
              } else {
                const availableUnit = await this.findAvailableUnitForPlacement(contractGameId, stage, client);
                if (availableUnit) {
                  targetActiveUnit = availableUnit;
                  logger.info(`System root is full, placing under available unit ${availableUnit.unitName}`);
                } else {
                  throw new Error(`All host units are full, system root is full, and no other available units found`);
                }
              }
            } else {
              const availableUnit = await this.findAvailableUnitForPlacement(contractGameId, stage, client);
              if (availableUnit) {
                targetActiveUnit = availableUnit;
                logger.info(`No system root, placing under available unit ${availableUnit.unitName}`);
              } else {
                throw new Error(`All host units are full and no system root or available units found`);
              }
            }
          } else {
            // No hostId - but check if owner has existing units
            // If owner has existing units (105+), place under owner's existing units' subtrees
            if (ownerExistingUnits.length > 0 && unitNumber > (stage === 1 ? 104 : stage === 2 ? 2004 : 3004)) {
              // Owner has existing units and this is a subsequent purchase (105+)
              // Place under owner's existing even units (102, 104, etc.) subtrees
              const ownerEvenUnits = ownerExistingUnits.filter(u => u.unitNumber % 2 === 0);
              
              if (ownerEvenUnits.length > 0) {
                // Try to find space in owner's even units' subtrees
                for (const evenUnit of ownerEvenUnits) {
                  try {
                    const vacantPlacement = await this.findVacantLevel(evenUnit.id, client, null, false);
                    if (vacantPlacement) {
                      const parentUnit = await client.unit.findUnique({
                        where: { id: vacantPlacement.parentUnitId },
                        select: {
                          id: true,
                          unitName: true,
                          unitNumber: true,
                          level: true,
                          ownerId: true
                        }
                      });
                      if (parentUnit) {
                        targetActiveUnit = parentUnit;
                        logger.info(`Placing odd unit ${unitNumber} under owner's existing even unit ${evenUnit.unitNumber} (${evenUnit.unitName}) subtree - found space at ${parentUnit.unitName} (level ${parentUnit.level})`);
                        break;
                      }
                    }
                  } catch (error) {
                    logger.debug(`No space in owner's even unit ${evenUnit.unitNumber} subtree: ${error.message}`);
                    continue;
                  }
                }
              }
            }
            
            // If still no target, use system root
            if (!targetActiveUnit) {
              logger.info(`No hostId provided, using system root for placement`);
              const systemRoot = await this.findSystemRoot(contractGameId, stage, client);
              if (systemRoot) {
                const directChildren = await client.unit.findMany({
                  where: {
                    parentUnitId: systemRoot.id,
                    level: systemRoot.level + 1
                  }
                });
                
                if (directChildren.length < 2) {
                  targetActiveUnit = systemRoot;
                  logger.info(`Placing under system root (no hostId, system root has ${directChildren.length}/2 children)`);
                } else {
                  const availableUnit = await this.findAvailableUnitForPlacement(contractGameId, stage, client);
                  if (availableUnit) {
                    targetActiveUnit = availableUnit;
                    logger.info(`System root is full, placing under available unit ${availableUnit.unitName}`);
                  } else {
                    throw new Error(`No hostId, system root is full, and no other available units found`);
                  }
                }
              } else {
                const availableUnit = await this.findAvailableUnitForPlacement(contractGameId, stage, client);
                if (availableUnit) {
                  targetActiveUnit = availableUnit;
                  logger.info(`No system root, placing under available unit ${availableUnit.unitName}`);
                } else {
                  throw new Error(`No hostId and no system root or available units found`);
                }
              }
            }
          }
        }
      } else {
        // Even units (102, 104, 106, etc.): 
        // RULE: ALWAYS place under "owner's active contract" (per document)
        // 
        // What is "owner's active"?
        // - First purchase (102, 104): owner's active = owner's first odd unit (101)
        // - Subsequent purchases (106, 108): owner's active = owner's existing units
        // 
        // The rule NEVER changes: even → owner's active. Only what we consider "owner's active" changes.
        
        // Determine if this is part of first purchase (102, 104) or subsequent purchase (106, 108)
        const firstOddUnitNumber = stage === 1 ? 101 : stage === 2 ? 2001 : 3001;
        const lastFirstPurchaseNumber = stage === 1 ? 104 : stage === 2 ? 2004 : 3004;
        const isFirstPurchase = unitNumber >= firstOddUnitNumber && unitNumber <= lastFirstPurchaseNumber;
        
        // For first purchase: "owner's active" = owner's first odd unit (101)
        // For subsequent purchases: "owner's active" = owner's existing units (any active unit)
        
        if (isFirstPurchase) {
          // First purchase: find owner's first odd unit (101) - this is "owner's active"
          const ownerFirstOddUnit = await client.unit.findFirst({
            where: {
              ownerId: ownerId,
              contractGameId: contractGameId,
              stage: stage,
              isSystemRoot: false,
              unitNumber: {
                gte: firstOddUnitNumber,
                lte: firstOddUnitNumber
              }
            },
            orderBy: { unitNumber: 'asc' }
          });

          if (ownerFirstOddUnit) {
            // Check if unit 101 has space for direct children (even units only)
            const allDirectChildren = await client.unit.findMany({
              where: {
                parentUnitId: ownerFirstOddUnit.id,
                level: ownerFirstOddUnit.level + 1,
                ownerId: ownerId
              },
              select: {
                unitNumber: true
              }
            });

            // Filter to only even units (odd units under 101 are incorrectly placed)
            const evenUnitChildren = allDirectChildren.filter(c => c.unitNumber % 2 === 0);

            if (evenUnitChildren.length < 2) {
              logger.info(`Placing even unit ${unitNumber} directly under owner's first odd unit ${ownerFirstOddUnit.unitNumber} (${ownerFirstOddUnit.unitName}) - has ${evenUnitChildren.length}/2 even-unit children`);
            } else {
              logger.info(`Placing even unit ${unitNumber} in subtree of owner's first odd unit ${ownerFirstOddUnit.unitNumber} (${ownerFirstOddUnit.unitName}) - unit has ${evenUnitChildren.length} even-unit children, searching deeper`);
            }
            
            targetActiveUnit = ownerFirstOddUnit;
          } else {
            // Owner has no first odd unit yet - this shouldn't happen (odd units are placed first)
            logger.warn(`Owner ${ownerId} has no first odd unit for even unit ${unitNumber}, falling back to system root`);
            targetActiveUnit = await this.findSystemRoot(contractGameId, stage, client);
          }
        } else {
          // Subsequent purchases (106, 108, etc.): Follow SAME pattern as 102, 104
          // Even units go under the FIRST odd unit of their CURRENT set
          // For set 105-108: 106, 108 go under 105 (first odd of that set)
          // For set 109-112: 110, 112 go under 109 (first odd of that set)
          
          // Find the first odd unit of the current set
          // Sets are: 101-104, 105-108, 109-112, etc.
          // First odd of each set: 101, 105, 109, etc.
          const setStart = Math.floor((unitNumber - firstOddUnitNumber) / 4) * 4 + firstOddUnitNumber;
          const firstOddOfCurrentSet = setStart; // This is the first odd unit of the current set
          
          logger.info(`Placing even unit ${unitNumber} - looking for first odd unit of current set: ${firstOddOfCurrentSet}`);
          
          // Find the first odd unit of the current set (105, 109, etc.)
          const firstOddUnitOfSet = await client.unit.findFirst({
            where: {
              ownerId: ownerId,
              contractGameId: contractGameId,
              stage: stage,
              isSystemRoot: false,
              unitNumber: firstOddOfCurrentSet
            },
            orderBy: { unitNumber: 'asc' }
          });

          if (firstOddUnitOfSet) {
            // Check if this unit has space for direct children
            const allDirectChildren = await client.unit.findMany({
              where: {
                parentUnitId: firstOddUnitOfSet.id,
                level: firstOddUnitOfSet.level + 1,
                ownerId: ownerId
              },
              select: {
                unitNumber: true
              }
            });

            // Filter to only even units (same logic as 102, 104 under 101)
            const evenUnitChildren = allDirectChildren.filter(c => c.unitNumber % 2 === 0);

            if (evenUnitChildren.length < 2) {
              logger.info(`Placing even unit ${unitNumber} directly under first odd unit of set ${firstOddUnitOfSet.unitNumber} (${firstOddUnitOfSet.unitName}) - has ${evenUnitChildren.length}/2 even-unit children`);
              targetActiveUnit = firstOddUnitOfSet;
            } else {
              // First odd unit is full, search deeper in its subtree
              logger.info(`Placing even unit ${unitNumber} in subtree of first odd unit ${firstOddUnitOfSet.unitNumber} (${firstOddUnitOfSet.unitName}) - unit has ${evenUnitChildren.length} even-unit children, searching deeper`);
              try {
                const vacantPlacement = await this.findVacantLevel(firstOddUnitOfSet.id, client, ownerId, false);
                if (vacantPlacement) {
                  const parentUnit = await client.unit.findUnique({
                    where: { id: vacantPlacement.parentUnitId },
                    select: {
                      id: true,
                      unitName: true,
                      unitNumber: true,
                      level: true,
                      ownerId: true
                    }
                  });
                  if (parentUnit) {
                    targetActiveUnit = parentUnit;
                    logger.info(`Placing even unit ${unitNumber} under first odd unit ${firstOddUnitOfSet.unitNumber} subtree - found space at ${parentUnit.unitName} (level ${parentUnit.level})`);
                  }
                }
              } catch (error) {
                logger.debug(`No space in first odd unit ${firstOddUnitOfSet.unitNumber} subtree: ${error.message}`);
              }
              
              // If still no space found, use the first odd unit itself
              if (!targetActiveUnit) {
                targetActiveUnit = firstOddUnitOfSet;
              }
            }
          } else {
            // First odd unit of set not found yet - this shouldn't happen (odd units are placed first)
            logger.warn(`First odd unit ${firstOddOfCurrentSet} of current set not found for even unit ${unitNumber}, falling back to owner's existing units`);
            
            // Fallback: Find owner's existing units (102, 104) as host
            const ownerExistingUnits = await client.unit.findMany({
              where: {
                ownerId: ownerId,
                contractGameId: contractGameId,
                stage: stage,
                isSystemRoot: false
              },
              orderBy: { unitNumber: 'asc' }
            });
            
            const ownerEvenUnits = ownerExistingUnits.filter(u => u.unitNumber % 2 === 0);
            
            // Try to find space in owner's even units' subtrees
            for (const evenUnit of ownerEvenUnits) {
              try {
                const vacantPlacement = await this.findVacantLevel(evenUnit.id, client, null, false);
                if (vacantPlacement) {
                  const parentUnit = await client.unit.findUnique({
                    where: { id: vacantPlacement.parentUnitId },
                    select: {
                      id: true,
                      unitName: true,
                      unitNumber: true,
                      level: true,
                      ownerId: true
                    }
                  });
                  if (parentUnit) {
                    targetActiveUnit = parentUnit;
                    logger.info(`Placing even unit ${unitNumber} under owner's even unit ${evenUnit.unitNumber} subtree - found space at ${parentUnit.unitName}`);
                    break;
                  }
                }
              } catch (error) {
                logger.debug(`No space in owner's even unit ${evenUnit.unitNumber} subtree: ${error.message}`);
                continue;
              }
            }
            
            // Final fallback to system root
            if (!targetActiveUnit) {
              targetActiveUnit = await this.findSystemRoot(contractGameId, stage, client);
              if (!targetActiveUnit) {
                throw new Error(`No system root found for contract game ${contractGameId} stage ${stage}`);
              }
            }
          }
        }
        
        if (!targetActiveUnit) {
          targetActiveUnit = await this.findSystemRoot(contractGameId, stage, client);
          if (!targetActiveUnit) {
            throw new Error(`No system root found for contract game ${contractGameId} stage ${stage}. Contract game may not be initialized.`);
          }
        }
      }

      // Step 4: Find vacant level and parent (left-to-right search)
      // This returns { parentUnitId, level } - the actual parent where unit should be placed
      // For odd units: Don't restrict by ownerId (can be under host/system root or owner's units)
      // For even units: Always restrict by ownerId (must be in owner's subtree under 101)
      const shouldRestrictByOwner = !isOddUnit; // Only restrict for even units (must be in owner's subtree)
      const vacantPlacement = await this.findVacantLevel(targetActiveUnit.id, client, shouldRestrictByOwner ? ownerId : null);
      const actualParentUnitId = vacantPlacement.parentUnitId;
      const vacantLevel = vacantPlacement.level;

      // Step 5: Find vacant position (bottom-to-top search)
      const vacantPosition = await this.findVacantPosition(actualParentUnitId, vacantLevel, client);

      // Generate unit name using userId instead of email
      const unitName = this.generateUnitName(ownerId, unitNumber);

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
      // hostId is the inviter (if user was invited) or admin/system root (if not invited)
      // If hostId is null, it means system root (admin) - but we'll store it as null for clarity
      const unitHostId = hostId || null;

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
          mentorId: null, // No longer used - mentors don't place units
          hostId: unitHostId, // Inviter ID if invited, admin/system root if not (stored as null)
          isSystemRoot: false
        }
      });

      logger.info(`Placed unit ${unitName} (${unitNumber}) for user ${ownerId} at level ${vacantLevel}, position ${vacantPosition} (hostId: ${unitHostId || 'system root'})`);

      return unit;
    };

    // If transaction client provided, use it directly; otherwise create new transaction
    if (tx) {
      return await executePlacement(tx);
    } else {
      return await database.getClient().$transaction(async (tx) => {
        return await executePlacement(tx);
      }, {
        maxWait: 5000,
        timeout: 120000  // 120 seconds for deep tree searches
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
    
    // Fetch all active purchase requests with cooldown for the owner to avoid N+1 queries
    const activePurchaseRequests = await client.purchaseRequest.findMany({
      where: {
        userId: rootUnit.ownerId,
        contractGameId: rootUnit.contractGameId,
        status: { in: ['APPROVED', 'PLACED'] },
        cooldownEndsAt: { not: null },
        refundedAt: null
      },
      select: {
        id: true,
        cooldownEndsAt: true,
        placedAt: true,
        approvedAt: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Helper function to get cooldown info for a unit
    const getCooldownInfo = (unit) => {
      if (unit.isSystemRoot) return null;
      
      const now = new Date();
      
      // Find purchase request that created this unit by matching creation time
      for (const request of activePurchaseRequests) {
        const timeWindowStart = new Date(unit.createdAt.getTime() - 30 * 60 * 1000); // 30 min before
        const timeWindowEnd = new Date(unit.createdAt.getTime() + 30 * 60 * 1000); // 30 min after
        
        const requestTime = request.placedAt || request.approvedAt || request.createdAt;
        if (requestTime >= timeWindowStart && requestTime <= timeWindowEnd) {
          if (!request.cooldownEndsAt) continue;
          
          const cooldownEndsAt = new Date(request.cooldownEndsAt);
          if (now > cooldownEndsAt) continue; // Cooldown expired
          
          return {
            cooldownEndsAt: cooldownEndsAt.toISOString(),
            isInCooldown: true
          };
        }
      }
      
      return null;
    };
    
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

      // Store children in unit map and add cooldown info
      children.forEach(child => {
        if (!unitMap.has(child.id)) {
          const cooldownInfo = getCooldownInfo(child);
          unitMap.set(child.id, { 
            ...child, 
            childrenUnits: [],
            cooldownInfo: cooldownInfo
          });
        }
      });

      // Recursively fetch children of each child
      for (const child of children) {
        await fetchChildren(child.id, depth + 1);
      }
    };

    // Start building from root unit
    const rootCooldownInfo = getCooldownInfo(rootUnit);
    unitMap.set(rootUnit.id, { 
      ...rootUnit, 
      childrenUnits: [],
      cooldownInfo: rootCooldownInfo
    });
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

    // Sort children by positionInLevel (ascending - left to right) and unitNumber
    unitMap.forEach(unit => {
      if (unit.childrenUnits && unit.childrenUnits.length > 0) {
        unit.childrenUnits.sort((a, b) => {
          if (a.positionInLevel !== b.positionInLevel) {
            return a.positionInLevel - b.positionInLevel; // Ascending order (left to right)
          }
          return a.unitNumber - b.unitNumber;
        });
      }
    });

    return unitMap.get(unitId);
  }
}

module.exports = PlacementService;

