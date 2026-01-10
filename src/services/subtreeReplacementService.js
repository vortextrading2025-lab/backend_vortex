const database = require('../config/database');
const logger = require('../modules/logging/logger');
const PlacementService = require('./placementService');

/**
 * SubtreeReplacementService
 * Handles re-placement of subtree when a unit is cancelled
 */
class SubtreeReplacementService {
  /**
   * Get all descendants of a unit (entire subtree)
   * Returns flat array of all units in subtree, ordered by level (shallowest first)
   */
  static async getAllDescendants(unitId, tx = null) {
    const client = tx || database.getClient();
    const descendants = [];
    const queue = [unitId];
    
    while (queue.length > 0) {
      const currentId = queue.shift();
      
      // Get direct children of current unit
      const children = await client.unit.findMany({
        where: { parentUnitId: currentId },
        include: {
          owner: {
            select: {
              id: true,
              email: true
            }
          }
        }
      });
      
      // Add children to descendants and queue
      for (const child of children) {
        descendants.push(child);
        queue.push(child.id);
      }
    }
    
    // Sort by level (shallowest first) to maintain tree structure during re-placement
    descendants.sort((a, b) => a.level - b.level);
    
    return descendants;
  }

  /**
   * Re-place a single unit following placement rules
   * Returns updated unit with new parent, level, and position
   */
  static async replaceUnit(unit, newParentId, tx = null) {
    const client = tx || database.getClient();
    
    // Get new parent unit to determine placement
    const newParent = await client.unit.findUnique({
      where: { id: newParentId },
      select: {
        id: true,
        level: true,
        ownerId: true,
        contractGameId: true,
        stage: true
      }
    });
    
    if (!newParent) {
      throw new Error(`New parent unit ${newParentId} not found`);
    }
    
    // Determine placement based on unit number (odd/even rules)
    const isOddUnit = unit.unitNumber % 2 === 1;
    
    // Find vacant spot in the tree
    // For odd units: Place under host's active unit or system root
    // For even units: Place under owner's active unit
    let placementParentId = newParentId;
    
    if (isOddUnit) {
      // Odd unit: Place under owner's active odd unit or system root
      const activeOddUnit = await client.unit.findFirst({
        where: {
          ownerId: unit.ownerId,
          contractGameId: unit.contractGameId,
          stage: unit.stage,
          isActive: true,
          unitNumber: { in: [101, 103, 105, 107, 109, 111, 113, 115, 117, 119] }
        }
      });
      
      if (activeOddUnit) {
        placementParentId = activeOddUnit.id;
      } else {
        // Use system root
        const systemRoot = await PlacementService.findSystemRoot(unit.contractGameId, unit.stage, client);
        if (systemRoot) {
          placementParentId = systemRoot.id;
        }
      }
    } else {
      // Even unit: Place under owner's active unit
      const activeUnit = await client.unit.findFirst({
        where: {
          ownerId: unit.ownerId,
          contractGameId: unit.contractGameId,
          stage: unit.stage,
          isActive: true
        }
      });
      
      if (activeUnit) {
        placementParentId = activeUnit.id;
      }
    }
    
    // Find vacant level and position under placement parent
    const vacantSpot = await PlacementService.findVacantLevel(placementParentId, client, null, false);
    
    if (!vacantSpot || !vacantSpot.parentUnitId) {
      throw new Error(`No vacant spot found for unit ${unit.unitName}`);
    }
    
    // Calculate position in level
    const siblingsCount = await client.unit.count({
      where: {
        parentUnitId: vacantSpot.parentUnitId,
        level: vacantSpot.level
      }
    });
    
    const positionInLevel = siblingsCount + 1;
    
    // Get new parent's owner for host update
    const finalParent = await client.unit.findUnique({
      where: { id: vacantSpot.parentUnitId },
      select: { ownerId: true }
    });
    
    // Update unit with new placement
    const updatedUnit = await client.unit.update({
      where: { id: unit.id },
      data: {
        parentUnitId: vacantSpot.parentUnitId,
        level: vacantSpot.level,
        positionInLevel: positionInLevel,
        hostId: finalParent ? finalParent.ownerId : null // Update host to new parent's owner
      }
    });
    
    logger.info(`Re-placed unit ${unit.unitName}: new parent=${vacantSpot.parentUnitId}, level=${vacantSpot.level}, position=${positionInLevel}`);
    
    return updatedUnit;
  }

  /**
   * Re-place entire subtree after a unit is cancelled
   * @param {Array} children - Direct children of the cancelled unit
   * @param {String} newParentId - ID of the cancelled unit's parent (where children will be re-placed)
   * @param {Object} tx - Prisma transaction client
   */
  static async replaceSubtree(children, newParentId, tx = null) {
    const client = tx || database.getClient();
    
    if (!children || children.length === 0) {
      logger.info('No children to re-place');
      return;
    }
    
    if (!newParentId) {
      throw new Error('Cannot re-place subtree: no parent unit ID provided');
    }
    
    logger.info(`Starting subtree re-placement: ${children.length} direct children, new parent=${newParentId}`);
    
    // Get all descendants (entire subtree) for each direct child
    const allDescendants = [];
    for (const child of children) {
      const descendants = await this.getAllDescendants(child.id, client);
      allDescendants.push(child, ...descendants);
    }
    
    // Remove duplicates (in case of overlapping subtrees)
    const uniqueUnits = Array.from(new Map(allDescendants.map(u => [u.id, u])).values());
    
    // Sort by level (shallowest first) to maintain tree structure
    uniqueUnits.sort((a, b) => a.level - b.level);
    
    logger.info(`Total units to re-place: ${uniqueUnits.length} (including all descendants)`);
    
    // Re-place each unit one by one
    let replacedCount = 0;
    let errorCount = 0;
    
    for (const unit of uniqueUnits) {
      try {
        await this.replaceUnit(unit, newParentId, client);
        replacedCount++;
      } catch (error) {
        errorCount++;
        logger.error(`Error re-placing unit ${unit.id} (${unit.unitName}):`, error);
        // Continue with other units even if one fails
      }
    }
    
    logger.info(`Subtree re-placement complete: ${replacedCount} units re-placed, ${errorCount} errors`);
    
    if (errorCount > 0) {
      throw new Error(`Subtree re-placement completed with ${errorCount} errors. Check logs for details.`);
    }
    
    return {
      totalUnits: uniqueUnits.length,
      replaced: replacedCount,
      errors: errorCount
    };
  }

  /**
   * Check if a unit can be cancelled (not a system root)
   */
  static async canCancelUnit(unitId, tx = null) {
    const client = tx || database.getClient();
    
    const unit = await client.unit.findUnique({
      where: { id: unitId },
      select: { isSystemRoot: true }
    });
    
    if (!unit) {
      throw new Error('Unit not found');
    }
    
    if (unit.isSystemRoot) {
      throw new Error('System root units cannot be cancelled');
    }
    
    return true;
  }
}

module.exports = SubtreeReplacementService;

