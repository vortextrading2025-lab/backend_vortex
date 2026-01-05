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
  static async findVacantLevel(parentUnitId, tx = null, requiredOwnerId = null) {
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
    const ownerIdToMatch = requiredOwnerId || parentUnit.ownerId;

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
        ownerId: true
      },
      orderBy: { positionInLevel: 'asc' } // Left-to-right order
    });

    // If parent has less than 2 direct children total, place at immediate next level under this parent
    if (allDirectChildren.length < 2) {
      return {
        parentUnitId: parentUnitId,
        level: parentUnit.level + 1
      };
    }

    // If parent has 2 direct children, filter to only same-owner children for deeper search
    const directChildren = allDirectChildren.filter(c => c.ownerId === ownerIdToMatch);

    // If parent has 2 direct children owned by same owner, find a child with space
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

      // Get direct children of current parent (batch query) that are owned by the same owner
      const currentChildren = await client.unit.findMany({
        where: {
          parentUnitId: currentParent.id,
          level: currentParent.level + 1,
          ownerId: ownerIdToMatch  // Only consider units owned by the same owner
        },
        select: {
          id: true,
          level: true
        },
        orderBy: { positionInLevel: 'asc' }
      });

      // If current parent has less than 2 children owned by same owner, place here
      if (currentChildren.length < 2) {
        return {
          parentUnitId: currentParent.id,
          level: currentParent.level + 1
        };
      }

      // If current parent has 2 children owned by same owner, add both to queue for further search
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
      // Game Placement Rules:
      // - Odd units (101, 103, 105, etc.) → ALWAYS place under HOST's active unit (or system root if no host)
      // - Even units (102, 104, 106, etc.) → ALWAYS place under OWNER's (user's) first unit (101)
      // 
      // For non-invited users (hostId is null):
      // 1. First try: System root (if exists and has space)
      // 2. If system root is full: Find another available unit
      // 3. Only if no system root exists: Use someone else's unit
      let targetActiveUnit = null;
      const isOddUnit = unitNumber % 2 === 1;

      if (isOddUnit) {
        // Odd units (101, 103, etc.): 
        // ALWAYS place under HOST (or system root if no host)
        // - Unit 101 → Under host (active)
        // - Unit 103 → Under host (sibling of 101)
        // - Unit 105 → Under host (sibling of 101, 103), etc.
        // All odd units are siblings under the host
          if (hostId) {
            // Find host's ODD units only (101, 103, 105, etc.) - odd units go under host's odd units
            // Prioritize the host's first odd unit (101) first
            const firstOddUnitNumber = stage === 1 ? 101 : stage === 2 ? 2001 : 3001;
            
            // First, try the host's first odd unit (101, 2001, or 3001)
            const hostFirstOddUnit = await client.unit.findFirst({
              where: {
                ownerId: hostId,
                contractGameId: contractGameId,
                stage: stage,
                isSystemRoot: false,
                unitNumber: firstOddUnitNumber
              }
            });

            if (hostFirstOddUnit) {
              const directChildren = await client.unit.findMany({
                where: {
                  parentUnitId: hostFirstOddUnit.id,
                  level: hostFirstOddUnit.level + 1 // Only direct children
                }
              });

              if (directChildren.length < 2) {
                // Host's first odd unit has space - use it
                targetActiveUnit = hostFirstOddUnit;
                logger.info(`Placing odd unit ${unitNumber} under host's first odd unit ${hostFirstOddUnit.unitNumber} (${hostFirstOddUnit.unitName}) - has ${directChildren.length}/2 children`);
              }
            }

            // If host's first odd unit is full, find other odd units with space
            if (!targetActiveUnit) {
              const hostOddUnits = await client.unit.findMany({
                where: {
                  ownerId: hostId,
                  contractGameId: contractGameId,
                  stage: stage,
                  isSystemRoot: false,
                  unitNumber: {
                    gte: firstOddUnitNumber,
                    // Only odd units: unitNumber % 2 === 1
                  }
                },
                orderBy: { unitNumber: 'asc' }
              });

              // Filter to only odd units
              const oddUnitsOnly = hostOddUnits.filter(u => u.unitNumber % 2 === 1);

              // Check each odd unit to find the first one with available space
              for (const hostUnit of oddUnitsOnly) {
                const directChildren = await client.unit.findMany({
                  where: {
                    parentUnitId: hostUnit.id,
                    level: hostUnit.level + 1 // Only direct children
                  }
                });

                if (directChildren.length < 2) {
                  // Found a host odd unit with available space
                  targetActiveUnit = hostUnit;
                  logger.info(`Placing odd unit ${unitNumber} under host's odd Unit ${hostUnit.unitNumber} (${hostUnit.unitName}) - has ${directChildren.length}/2 children`);
                  break;
                }
              }
            }

            // If all host odd units are full, fall back to system root
            if (!targetActiveUnit) {
              logger.warn(`All host ${hostId} odd units are full in stage ${stage}, falling back to system root`);
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
                  logger.info(`Placing under system root (all host odd units full, system root has ${directChildren.length}/2 children)`);
                } else {
                  // System root is full - find another available unit
                  const availableUnit = await this.findAvailableUnitForPlacement(contractGameId, stage, client);
                  if (availableUnit) {
                    targetActiveUnit = availableUnit;
                    logger.info(`System root is full, placing under available unit ${availableUnit.unitName}`);
                  } else {
                    throw new Error(`All host odd units are full, system root is full, and no other available units found`);
                  }
                }
              } else {
                // No system root - find any available unit
                const availableUnit = await this.findAvailableUnitForPlacement(contractGameId, stage, client);
                if (availableUnit) {
                  targetActiveUnit = availableUnit;
                  logger.info(`No system root, placing under available unit ${availableUnit.unitName}`);
                } else {
                  throw new Error(`All host odd units are full and no system root or available units found`);
                }
              }
            }
          } else {
            // No hostId - use system root
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
                // System root is full - find another available unit
                const availableUnit = await this.findAvailableUnitForPlacement(contractGameId, stage, client);
                if (availableUnit) {
                  targetActiveUnit = availableUnit;
                  logger.info(`System root is full, placing under available unit ${availableUnit.unitName}`);
                } else {
                  throw new Error(`No hostId, system root is full, and no other available units found`);
                }
              }
            } else {
              // No system root - find any available unit
              const availableUnit = await this.findAvailableUnitForPlacement(contractGameId, stage, client);
              if (availableUnit) {
                targetActiveUnit = availableUnit;
                logger.info(`No system root, placing under available unit ${availableUnit.unitName}`);
              } else {
                throw new Error(`No hostId and no system root or available units found`);
              }
            }
          }
      } else {
        // Even units (102, 104, etc.): 
        // - First try: Place under OWNER's FIRST ODD UNIT (101) if it has space
        // - If 101 is full: Find any owner unit with available space
        // - Unit 102 → Under Unit 101 (child of 101)
        // - Unit 104 → Under Unit 101 (child of 101, sibling of 102)
        // - Unit 106 → Under Unit 101 or another owner unit if 101 is full
        // All even units should be children of owner's units
        
        // Find owner's first odd unit (101, 2001, or 3001)
        const ownerFirstOddUnit = await client.unit.findFirst({
          where: {
            ownerId: ownerId,
            contractGameId: contractGameId,
            stage: stage,
            isSystemRoot: false,
            unitNumber: {
              // First odd unit: 101, 2001, or 3001
              gte: stage === 1 ? 101 : stage === 2 ? 2001 : 3001,
              lte: stage === 1 ? 101 : stage === 2 ? 2001 : 3001
            }
          },
          orderBy: { unitNumber: 'asc' }
        });

        if (ownerFirstOddUnit) {
          // Use owner's first odd unit (101) - findVacantLevel will find space in its subtree
          // even if it has 2 direct children (it will search deeper levels)
          targetActiveUnit = ownerFirstOddUnit;
          logger.info(`Placing even unit ${unitNumber} under owner's first odd unit ${ownerFirstOddUnit.unitNumber} (${ownerFirstOddUnit.unitName}) - will find space in subtree`);
        } else {
          // Owner has no odd unit yet - this shouldn't happen (odd units are placed first)
          // Fall back to system root
          logger.warn(`Owner ${ownerId} has no first odd unit for even unit ${unitNumber}, falling back to system root`);
          targetActiveUnit = await this.findSystemRoot(contractGameId, stage, client);
        }
        
        // If owner has no units at all, use system root as fallback
        if (!targetActiveUnit) {
          targetActiveUnit = await this.findSystemRoot(contractGameId, stage, client);
          if (!targetActiveUnit) {
            throw new Error(`No system root found for contract game ${contractGameId} stage ${stage}. Contract game may not be initialized.`);
          }
        }
      }

      // Step 4: Find vacant level and parent (left-to-right search)
      // This returns { parentUnitId, level } - the actual parent where unit should be placed
      // Pass ownerId to ensure we only search in units owned by the same owner
      const vacantPlacement = await this.findVacantLevel(targetActiveUnit.id, client, ownerId);
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

