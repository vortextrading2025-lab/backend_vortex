const database = require('../../config/database');
const logger = require('../logging/logger');
const AuditLogger = require('../logging/auditLogger');
const WalletService = require('../wallet/walletService');

class ContractService {
  /**
   * Find user's active unit (only ONE per user)
   */
  static async findActiveUnit(userId) {
    return await database.getClient().contract.findFirst({
      where: {
        ownerId: userId,
        isActiveUnit: true,
        status: 'ACTIVE'
      }
    });
  }

  /**
   * Get user's unit count
   */
  static async getUserUnitCount(userId) {
    return await database.getClient().contract.count({
      where: { ownerId: userId }
    });
  }

  /**
   * Get next contract number for a user
   * First purchase: 101, 102, 103, 104
   * Second purchase: 105, 106, 107, 108 (or 1001, 1002, 1003, 1004)
   */
  static async getNextContractNumber(userId) {
    const lastContract = await database.getClient().contract.findFirst({
      where: { ownerId: userId },
      orderBy: { contractNumber: 'desc' }
    });
    
    if (!lastContract) {
      return 101; // First contract number for first purchase
    }
    
    // Continue sequential numbering: 101, 102, 103, 104, then 105, 106, 107, 108, etc.
    return lastContract.contractNumber + 1;
  }

  /**
   * Find next available parent for placing units
   */
  static async findNextAvailableParent(currentParent, stage) {
    // Try to find sibling with space
    const siblings = await database.getClient().contract.findMany({
      where: {
        level: currentParent.level,
        stage: stage,
        status: 'ACTIVE',
        id: { not: currentParent.id }
      },
      orderBy: { position: 'asc' }
    });

    for (const sibling of siblings) {
      const childCount = await database.getClient().contract.count({
        where: { parentId: sibling.id }
      });
      if (childCount < 2) {
        return sibling;
      }
    }

    // If no sibling available, use first child of current parent
    const firstChild = await database.getClient().contract.findFirst({
      where: {
        parentId: currentParent.id,
        stage: stage,
        status: 'ACTIVE'
      },
      orderBy: { position: 'asc' }
    });

    if (firstChild) {
      const childCount = await database.getClient().contract.count({
        where: { parentId: firstChild.id }
      });
      if (childCount < 2) {
        return firstChild;
      }
    }

    return null;
  }

  /**
   * Find vacant position in binary tree (max 2 children per parent)
   */
  static async findVacantPosition(parentContract) {
    // Get children of parent (max 2 in binary tree)
    const children = await database.getClient().contract.findMany({
      where: { parentId: parentContract.id },
      orderBy: [
        { level: 'asc' },
        { position: 'asc' }
      ]
    });

    if (children.length === 0) {
      return { level: parentContract.level + 1, position: 0, positionInLevel: 0 };
    }

    // Binary tree: max 2 children (position 0 = left, position 1 = right)
    if (children.length < 2) {
      // Has space for another child
      const existingPositions = children.map(c => c.position);
      const position = existingPositions.includes(0) ? 1 : 0;
      return { 
        level: parentContract.level + 1, 
        position: position, 
        positionInLevel: 0 
      };
    }

    // Parent is full, find next level
    // Group children by level
    const levelGroups = {};
    children.forEach(child => {
      if (!levelGroups[child.level]) {
        levelGroups[child.level] = [];
      }
      levelGroups[child.level].push(child);
    });

    // Find first level with vacancy (binary tree: each node can have 2 children)
    let currentLevel = parentContract.level + 1;
    while (true) {
      const levelContracts = levelGroups[currentLevel] || [];
      
      // In binary tree, each level can have 2^level nodes
      const maxNodesAtLevel = Math.pow(2, currentLevel - parentContract.level - 1);
      
      if (levelContracts.length < maxNodesAtLevel) {
        // Find first available position (left to right: 0, 1, 0, 1, ...)
        const positions = levelContracts.map(c => c.position);
        for (let pos = 0; pos < 2; pos++) {
          if (!positions.includes(pos)) {
            return { 
              level: currentLevel, 
              position: pos, 
              positionInLevel: levelContracts.filter(c => c.position === pos).length 
            };
          }
        }
      }
      currentLevel++;
    }
  }

  /**
   * Activate next available unit for user
   */
  static async activateNextUnit(userId) {
    // Find next inactive unit
    const nextUnit = await database.getClient().contract.findFirst({
      where: {
        ownerId: userId,
        isActiveUnit: false,
        status: 'ACTIVE'
      },
      orderBy: { contractNumber: 'asc' }
    });

    if (nextUnit) {
      // Deactivate current active unit
      await database.getClient().contract.updateMany({
        where: {
          ownerId: userId,
          isActiveUnit: true
        },
        data: {
          isActiveUnit: false
        }
      });

      // Activate next unit
      await database.getClient().contract.update({
        where: { id: nextUnit.id },
        data: { isActiveUnit: true }
      });

      logger.info(`Activated unit ${nextUnit.contractNumber} for user ${userId}`);
      return nextUnit;
    }

    return null;
  }

  /**
   * Get pricing for a stage
   */
  static async getPricingForStage(stage) {
    const pricing = await database.getClient().contractPricing.findUnique({
      where: { stage }
    });

    if (!pricing || !pricing.isActive) {
      // Default pricing if not configured
      const defaults = {
        'STAGE_1': 1000.00,
        'STAGE_2': 2000.00,
        'STAGE_3': 3000.00
      };
      return defaults[stage] || 1000.00;
    }

    return pricing.price;
  }

  /**
   * Create contract purchase (automatically creates 4 units)
   * DEMO MODE: Wallet payment disabled - anyone can buy units
   */
  static async createContractPurchase(userId, hostId = null, stage = 'STAGE_1') {
    // Check if user has minimum 4 units
    const unitCount = await this.getUserUnitCount(userId);
    if (unitCount > 0 && unitCount < 4) {
      throw new Error(`You must own at least 4 units. Currently you have ${unitCount} units.`);
    }

    // DEMO MODE: Skip wallet payment check and deduction
    // Get pricing for stage (price for 4 units) - for display only
    const price = await this.getPricingForStage(stage);
    const totalPrice = price; // Price is for 4 units

    // DEMO MODE: Wallet payment disabled
    // const wallet = await WalletService.getWallet(userId);
    // if (wallet.balance < totalPrice) {
    //   throw new Error(`Insufficient wallet balance. Required: $${totalPrice}, Available: $${wallet.balance}`);
    // }
    // await WalletService.deductFromWallet(userId, totalPrice, null, `Purchase of 4 units in ${stage}`);

    // Get starting contract number (101, 102, 103, 104 for first purchase)
    const startContractNumber = await this.getNextContractNumber(userId);
    
    // Determine placement based on FIRST contract number (odd/even rule)
    // Odd number (101, 103, 105...) → Place under HOST's active unit
    // Even number (102, 104, 106...) → Place under OWN active unit
    const isOdd = startContractNumber % 2 === 1;

    // Helper function to find available Vortex system unit
    const findAvailableSystemUnit = async (stage) => {
      const adminUser = await database.getClient().user.findFirst({
        where: { role: 'ADMIN' },
        orderBy: { createdAt: 'asc' }
      });

      if (!adminUser) {
        throw new Error('Vortex system not initialized. Please run seeder.');
      }

      // Find any system unit (owned by admin) that has space (less than 2 children)
      const systemUnits = await database.getClient().contract.findMany({
        where: {
          ownerId: adminUser.id,
          stage: stage,
          isActive: true,
          status: 'ACTIVE'
        },
        include: {
          _count: {
            select: { children: true }
          }
        },
        orderBy: [
          { level: 'asc' },
          { position: 'asc' }
        ]
      });

      // Find first system unit with space (binary tree: max 2 children)
      for (const unit of systemUnits) {
        if (unit._count.children < 2) {
          return unit;
        }
      }

      // If no system unit with space found, use system root
      const systemContractNumbers = {
        'STAGE_1': 0,
        'STAGE_2': -1,
        'STAGE_3': -2
      };
      const systemContractNumber = systemContractNumbers[stage] || 0;
      
      const systemRoot = await database.getClient().contract.findFirst({
        where: {
          ownerId: adminUser.id,
          parentId: null, // System root has no parent
          stage: stage,
          isActive: true,
          contractNumber: systemContractNumber
        },
        orderBy: { createdAt: 'asc' }
      });

      if (!systemRoot) {
        throw new Error(`Vortex system root for ${stage} not found. Please run seeder.`);
      }

      return systemRoot;
    };

    // Helper function to find a random user with active unit to be host
    const findRandomHost = async (stage, excludeUserId) => {
      // Find all users with active units in the same stage
      const activeUnits = await database.getClient().contract.findMany({
        where: {
          isActiveUnit: true,
          status: 'ACTIVE',
          stage: stage,
          ownerId: { not: excludeUserId }, // Exclude the current user
          owner: {
            role: { not: 'ADMIN' } // Exclude admin
          }
        },
        include: {
          _count: {
            select: { children: true }
          },
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      // Filter to only units with space (less than 2 children)
      const availableHosts = activeUnits.filter(unit => unit._count.children < 2);

      if (availableHosts.length === 0) {
        return null; // No available hosts, will use system unit
      }

      // Return a random host
      const randomIndex = Math.floor(Math.random() * availableHosts.length);
      return availableHosts[randomIndex];
    };

    // Get admin user for system unit checks
    const adminUser = await database.getClient().user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' }
    });

    // Determine parent contract based on odd/even rule
    let parentContract = null;
    let shouldGiveUnitToHost = false;
    let hostForUnitTransfer = null;

    // Determine host: If no hostId provided, randomly assign one
    let assignedHostId = hostId;
    let assignedHostUnit = null;

    if (!hostId || hostId === userId) {
      // No host specified or self: Find a random host with active unit
      const randomHostUnit = await findRandomHost(stage, userId);
      if (randomHostUnit) {
        assignedHostId = randomHostUnit.ownerId;
        assignedHostUnit = randomHostUnit;
        logger.info(`Randomly assigned host ${assignedHostId} for user ${userId}`);
      }
    } else {
      // Host specified (from invite): Use that host's active unit
      assignedHostUnit = await this.findActiveUnit(hostId);
      if (!assignedHostUnit) {
        throw new Error(`Host does not have an active unit`);
      }
    }

    if (isOdd) {
      // Odd contract number (101, 103, 105...): Place under HOST's active unit
      if (assignedHostUnit) {
        parentContract = assignedHostUnit;
        
        // Check if parent is a user's active unit (not system unit)
        // If yes, one unit should go to the parent owner's host
        if (adminUser && assignedHostUnit.ownerId !== adminUser.id) {
          shouldGiveUnitToHost = true;
          // Get the parent owner's host from their active unit
          const parentOwnerActiveUnit = await database.getClient().contract.findFirst({
            where: {
              ownerId: assignedHostUnit.ownerId,
              isActiveUnit: true
            }
          });
          if (parentOwnerActiveUnit && parentOwnerActiveUnit.hostId && parentOwnerActiveUnit.hostId !== assignedHostUnit.ownerId) {
            hostForUnitTransfer = parentOwnerActiveUnit.hostId;
          }
        }
      } else {
        // No host available: place under Vortex system unit
        parentContract = await findAvailableSystemUnit(stage);
        assignedHostId = adminUser.id; // System is the host
      }
    } else {
      // Even contract number (102, 104, 106...): Place under OWN active unit
      const ownActiveUnit = await this.findActiveUnit(userId);
      if (ownActiveUnit) {
        // User has active unit: place under it
        parentContract = ownActiveUnit;
        assignedHostId = userId; // Self is host for even numbers
      } else {
        // User has no active unit (first purchase): 
        // Try to use assigned host's unit, otherwise use system unit
        if (assignedHostUnit) {
          parentContract = assignedHostUnit;
        } else {
          parentContract = await findAvailableSystemUnit(stage);
          assignedHostId = adminUser.id; // System is the host
        }
      }
    }

    // Ensure parentContract is never null (users never own root contracts)
    if (!parentContract) {
      throw new Error('No available parent contract found. Vortex system may not be initialized.');
    }

    // Create 4 units - ALL placed under the determined parent
    const createdUnits = [];
    const hasActiveUnit = !!(await this.findActiveUnit(userId));
    let currentParent = parentContract; // Start with determined parent

    for (let i = 0; i < 4; i++) {
      const contractNumber = startContractNumber + i;
      // Only first unit of first purchase is active
      const isActiveUnit = i === 0 && !hasActiveUnit;

      // Check if current parent has space (binary tree: max 2 children)
      const parentChildrenCount = await database.getClient().contract.count({
        where: { parentId: currentParent.id }
      });
      
      // If parent is full, find next available parent
      if (parentChildrenCount >= 2) {
        const nextParent = await this.findNextAvailableParent(currentParent, stage);
        if (nextParent) {
          currentParent = nextParent;
        } else if (createdUnits.length > 0) {
          // Use first created unit as parent (user's own unit)
          currentParent = createdUnits[0];
        } else {
          // If no next parent and no created units, find another Vortex system unit
          currentParent = await findAvailableSystemUnit(stage);
        }
      }
      
      // Find position for this unit (currentParent is guaranteed to exist)
      const positionData = await this.findVacantPosition(currentParent);

      // Determine owner and host for this unit
      // If this is the 4th unit and we need to give one to host, assign it to the host
      let unitOwnerId = userId;
      let unitHostId = assignedHostId || userId;
      
      if (shouldGiveUnitToHost && i === 3 && hostForUnitTransfer) {
        // Last unit (4th) goes to the host
        unitOwnerId = hostForUnitTransfer;
        unitHostId = hostForUnitTransfer; // Host becomes owner of this unit
        logger.info(`Unit ${contractNumber} assigned to host ${hostForUnitTransfer} as per "give one unit to host" rule`);
      }

      const unit = await database.getClient().contract.create({
        data: {
          contractNumber,
          ownerId: unitOwnerId,
          hostId: unitHostId,
          parentId: currentParent.id, // ALWAYS has a parent (never null for users)
          stage: stage,
          status: 'ACTIVE',
          level: positionData.level,
          position: positionData.position,
          positionInLevel: positionData.positionInLevel,
          isActiveUnit: isActiveUnit && unitOwnerId === userId, // Only user's units can be active
          isActive: true,
          purchasePrice: totalPrice / 4, // Price per unit
          downPayment: totalPrice / 4
        }
      });

      createdUnits.push(unit);

      // For subsequent units, if parent is full, use first created unit as parent
      if (i === 0 && createdUnits.length > 0) {
        // Check if we should use first unit as parent for next units
        const firstUnitChildrenCount = await database.getClient().contract.count({
          where: { parentId: createdUnits[0].id }
        });
        if (firstUnitChildrenCount < 2) {
          currentParent = createdUnits[0];
        }
      }
    }

    // Check fulfillment for parent if exists
    if (parentContract) {
      await this.checkFulfillment(parentContract.id);
    }

    logger.info(`Created 4 units for user ${userId} in ${stage}, total price: $${totalPrice}`);

    // Filter to only return user-owned units (exclude unit given to host)
    const userOwnedUnits = createdUnits.filter(u => u.ownerId === userId);

    return {
      units: userOwnedUnits,
      totalPrice,
      activeUnit: userOwnedUnits.find(u => u.isActiveUnit) || null
    };
  }

  /**
   * Check if a contract is fulfilled and handle stage transition
   */
  static async checkFulfillment(contractId) {
    const contract = await database.getClient().contract.findUnique({
      where: { id: contractId },
      include: {
        children: {
          where: { status: 'ACTIVE' }
        }
      }
    });

    if (!contract || contract.status !== 'ACTIVE') {
      return;
    }

    let requiredLevels = 0;
    let requiredUnits = 0;

    if (contract.stage === 'STAGE_1') {
      requiredLevels = 3;
      requiredUnits = 14; // 3 (level 1) + 4 (level 2) + 4 (level 3) + 3 (partial level 4) = 14
    } else if (contract.stage === 'STAGE_2' || contract.stage === 'STAGE_3') {
      requiredLevels = 2;
      requiredUnits = 6; // 3 (level 1) + 4 (level 2) - 1 = 6
    } else {
      return; // Already completed
    }

    // Count units in each level (binary tree structure)
    const levelCounts = {};
    contract.children.forEach(child => {
      if (child.level <= requiredLevels + 1) {
        levelCounts[child.level] = (levelCounts[child.level] || 0) + 1;
      }
    });

    // Check if all required levels are filled
    let totalUnits = 0;
    let allLevelsFilled = true;

    if (contract.stage === 'STAGE_1') {
      // Stage 1: Need 3 in level 1, 4 in level 2, 4 in level 3
      if ((levelCounts[1] || 0) < 3) {
        allLevelsFilled = false;
      }
      if ((levelCounts[2] || 0) < 4) {
        allLevelsFilled = false;
      }
      if ((levelCounts[3] || 0) < 4) {
        allLevelsFilled = false;
      }
      totalUnits = (levelCounts[1] || 0) + (levelCounts[2] || 0) + (levelCounts[3] || 0);
      
      // Check active status requirement: need 4 units in level 4
      const level4Count = levelCounts[4] || 0;
      if (level4Count < 4 && contract.isActive) {
        return; // Still active, don't fulfill yet
      }
    } else if (contract.stage === 'STAGE_2' || contract.stage === 'STAGE_3') {
      // Stage 2/3: Need 3 in level 1, 4 in level 2
      if ((levelCounts[1] || 0) < 3) {
        allLevelsFilled = false;
      }
      if ((levelCounts[2] || 0) < 4) {
        allLevelsFilled = false;
      }
      totalUnits = (levelCounts[1] || 0) + (levelCounts[2] || 0);
      
      // Check active status requirement: need 4 units in level 3
      const level3Count = levelCounts[3] || 0;
      if (level3Count < 4 && contract.isActive) {
        return; // Still active, don't fulfill yet
      }
    }

    if (!allLevelsFilled) {
      return; // Not fulfilled yet
    }

    // Mark as fulfilled
    const updateData = {
      status: 'FULFILLED',
      fulfilledAt: new Date(),
      isActive: false,
      isActiveUnit: false // Deactivate when fulfilled
    };

    if (contract.stage === 'STAGE_1') {
      updateData.movedToStage2At = new Date();
      updateData.stage = 'STAGE_2';
      // Create new 4 units in Stage 2
      try {
        await this.createContractPurchase(contract.ownerId, contract.hostId, 'STAGE_2');
      } catch (error) {
        logger.error(`Failed to create Stage 2 units for ${contract.ownerId}:`, error);
      }
    } else if (contract.stage === 'STAGE_2') {
      updateData.movedToStage3At = new Date();
      updateData.stage = 'STAGE_3';
      // Create new 4 units in Stage 3
      try {
        await this.createContractPurchase(contract.ownerId, contract.hostId, 'STAGE_3');
      } catch (error) {
        logger.error(`Failed to create Stage 3 units for ${contract.ownerId}:`, error);
      }
    } else if (contract.stage === 'STAGE_3') {
      updateData.stage = 'COMPLETED';
    }

    // Calculate payout
    const payoutAmount = this.calculatePayout(contract.stage);
    updateData.payoutAmount = payoutAmount;

    await database.getClient().contract.update({
      where: { id: contractId },
      data: updateData
    });

    // Create payout record and add to wallet
    await database.getClient().payout.create({
      data: {
        contractId: contract.id,
        userId: contract.ownerId,
        amount: payoutAmount,
        stage: contract.stage,
        status: 'PROCESSED'
      }
    });

    // Add payout to wallet automatically
    await WalletService.addToWallet(
      contract.ownerId, 
      payoutAmount, 
      contract.id, 
      'PAYOUT',
      `Payout for contract ${contract.contractNumber} in ${contract.stage}`
    );

    // Activate next unit for user if available
    await this.activateNextUnit(contract.ownerId);

    logger.info(`Contract ${contract.contractNumber} fulfilled in ${contract.stage}, payout: ${payoutAmount}`);
  }

  /**
   * Calculate payout amount based on stage
   */
  static calculatePayout(stage) {
    const payouts = {
      'STAGE_1': parseFloat(process.env.CONTRACT_PAYOUT_STAGE_1 || '1000'),
      'STAGE_2': parseFloat(process.env.CONTRACT_PAYOUT_STAGE_2 || '2000'),
      'STAGE_3': parseFloat(process.env.CONTRACT_PAYOUT_STAGE_3 || '3000')
    };
    return payouts[stage] || 0;
  }

  /**
   * Get contract tree for visualization
   * Note: Users never own root contracts - all user contracts are under Vortex system units
   */
  static async getContractTree(userId, contractId = null) {
    const where = contractId 
      ? { id: contractId }
      : { 
          ownerId: userId
          // Note: Users never have parentId: null (root contracts) - only Vortex does
        };

    const contracts = await database.getClient().contract.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        host: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        parent: {
          select: {
            id: true,
            contractNumber: true,
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        children: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: [
            { level: 'asc' },
            { position: 'asc' }
          ]
        },
        _count: {
          select: {
            children: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Recursively build tree structure
    const buildTree = (contract) => {
      return {
        ...contract,
        children: contract.children.map(child => buildTree(child))
      };
    };

    return contracts.map(contract => buildTree(contract));
  }

  /**
   * Get contract tree view for a specific contract (for detail page)
   * Returns tree starting from the contract, including parent (host) and all children
   */
  static async getContractTreeView(contractId, userId = null) {
    // Get the contract
    const contract = await database.getClient().contract.findUnique({
      where: { id: contractId },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        host: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        parent: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        children: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            _count: {
              select: {
                children: true
              }
            }
          },
          orderBy: [
            { level: 'asc' },
            { positionInLevel: 'asc' },
            { position: 'asc' }
          ]
        },
        _count: {
          select: {
            children: true
          }
        }
      }
    });

    if (!contract) {
      return null;
    }

    // Check if user owns any units (not necessarily this specific contract)
    let userOwnsUnits = false;
    let userUnits = [];
    let activeUnitId = null;
    
    if (userId) {
      // Check if user owns any contracts
      const userContractCount = await database.getClient().contract.count({
        where: { ownerId: userId }
      });
      userOwnsUnits = userContractCount > 0;
      
      if (userOwnsUnits) {
        // Get user's active unit
        const activeUnit = await this.findActiveUnit(userId);
        activeUnitId = activeUnit?.id || null;
        
        // Get all user's units
        userUnits = await database.getClient().contract.findMany({
          where: {
            ownerId: userId
          },
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            host: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            _count: {
              select: {
                children: true
              }
            }
          },
          orderBy: [
            { contractNumber: 'asc' }
          ]
        });
      }
    }

    // Get all contracts in the tree (contract + all its children recursively)
    const getAllChildren = async (parentId) => {
      const children = await database.getClient().contract.findMany({
        where: { parentId },
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          host: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          _count: {
            select: {
              children: true
            }
          }
        },
        orderBy: [
          { level: 'asc' },
          { positionInLevel: 'asc' },
          { position: 'asc' }
        ]
      });
      
      let allDescendants = [...children];
      for (const child of children) {
        const descendants = await getAllChildren(child.id);
        allDescendants = [...allDescendants, ...descendants];
      }
      return allDescendants;
    };

    // Get children of the current contract
    const allChildren = await getAllChildren(contractId);
    let allContractsInTree = [contract, ...allChildren];
    
    // If user owns units, also get children of ALL user's units (not just the current contract)
    // This ensures we can show the full tree view with all future units
    if (userOwnsUnits && userUnits.length > 0) {
      const userUnitIds = userUnits.map(u => u.id);
      const allUserUnitChildren = [];
      const existingIds = new Set(allContractsInTree.map(c => c.id));
      
      // Also include user's units themselves in the tree (if not already included)
      for (const userUnit of userUnits) {
        if (!existingIds.has(userUnit.id)) {
          allContractsInTree.push(userUnit);
          existingIds.add(userUnit.id);
        }
      }
      
      // IMPORTANT: Also include the HOST contract (parent of user's first unit)
      // The host is at Level 0, and user's units are at Level 1 under the host
      const firstUserUnit = userUnits[0];
      if (firstUserUnit && firstUserUnit.parentId) {
        const hostContract = await database.getClient().contract.findUnique({
          where: { id: firstUserUnit.parentId },
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            _count: {
              select: {
                children: true
              }
            }
          }
        });
        
        if (hostContract && !existingIds.has(hostContract.id)) {
          allContractsInTree.push(hostContract);
          existingIds.add(hostContract.id);
        }
      }
      
      // Get children of ALL user's units (including the current contract if it's a user unit)
      for (const userUnitId of userUnitIds) {
        // Get children of this user unit (even if it's the current contractId)
        const userUnitChildren = await getAllChildren(userUnitId);
        allUserUnitChildren.push(...userUnitChildren);
      }
      
      // Merge and deduplicate (in case there's overlap)
      const uniqueChildren = allUserUnitChildren.filter(c => !existingIds.has(c.id));
      allContractsInTree = [...allContractsInTree, ...uniqueChildren];
      
      logger.info(`Tree view: Found ${allContractsInTree.length} total contracts, including host and ${uniqueChildren.length} children of user's units`);
    }

    return {
      contract,
      userOwnsUnits,
      userUnits,
      activeUnitId,
      treeContracts: allContractsInTree
    };
  }

  /**
   * Get all running contracts (public view with minimal details)
   */
  static async getAllRunningContracts() {
    return await database.getClient().contract.findMany({
      where: {
        status: 'ACTIVE',
        isActive: true
      },
      select: {
        id: true,
        contractNumber: true,
        stage: true,
        status: true,
        level: true,
        position: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: [
        { stage: 'asc' },
        { contractNumber: 'asc' }
      ]
    });
  }

  /**
   * Get user's active unit (only ONE per user)
   */
  static async getUserActiveUnit(userId) {
    const activeUnit = await this.findActiveUnit(userId);
    if (!activeUnit) {
      return null;
    }

    // Get full details with relations
    return await database.getClient().contract.findUnique({
      where: { id: activeUnit.id },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        host: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        parent: {
          select: {
            id: true,
            contractNumber: true,
            owner: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        _count: {
          select: {
            children: true
          }
        }
      }
    });
  }

  /**
   * Get user's future units (inactive units that will become active)
   */
  static async getUserFutureUnits(userId) {
    return await database.getClient().contract.findMany({
      where: {
        ownerId: userId,
        isActiveUnit: false,
        status: 'ACTIVE'
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        host: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        parent: {
          select: {
            id: true,
            contractNumber: true,
            owner: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        _count: {
          select: {
            children: true
          }
        }
      },
      orderBy: [
        { contractNumber: 'asc' }
      ]
    });
  }

  /**
   * Get all contracts for a user
   */
  static async getUserContracts(userId) {
    const contracts = await database.getClient().contract.findMany({
      where: { ownerId: userId },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        host: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        parent: {
          select: {
            id: true,
            contractNumber: true,
            owner: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        _count: {
          select: {
            children: true
          }
        }
      },
      orderBy: [
        { stage: 'asc' },
        { contractNumber: 'asc' }
      ]
    });

    // Get active unit and future units for metadata
    const activeUnit = await this.findActiveUnit(userId);
    const futureUnits = await this.getUserFutureUnits(userId);

    return {
      contracts,
      activeUnit: activeUnit ? activeUnit.id : null,
      futureUnitsCount: futureUnits.length
    };
  }

  /**
   * Get contract details by ID (supports public/private views)
   */
  static async getContractById(contractId, userId = null) {
    const contract = await database.getClient().contract.findUnique({
      where: { id: contractId },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        host: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        parent: {
          select: {
            id: true,
            contractNumber: true,
            owner: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        children: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: [
            { level: 'asc' },
            { position: 'asc' }
          ]
        },
        payouts: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!contract) {
      return null;
    }

    // If user is owner or admin, return full details
    if (userId) {
      const isOwner = contract.ownerId === userId;
      if (isOwner) {
        return contract; // Full details for owner
      }

      // Check if admin
      const user = await database.getClient().user.findUnique({
        where: { id: userId },
        select: { role: true }
      });
      if (user?.role === 'ADMIN') {
        return contract; // Full details for admin
      }
    }

    // Public view: return limited details (no host, no children details, no payouts)
    return {
      id: contract.id,
      contractNumber: contract.contractNumber,
      stage: contract.stage,
      status: contract.status,
      level: contract.level,
      position: contract.position,
      positionInLevel: contract.positionInLevel,
      isActive: contract.isActive,
      isActiveUnit: contract.isActiveUnit,
      owner: contract.owner,
      // No host, children, payouts for public view
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt
    };
  }

  /**
   * Get fulfillment progress for a contract
   */
  static async getFulfillmentProgress(contractId) {
    const contract = await database.getClient().contract.findUnique({
      where: { id: contractId },
      include: {
        children: {
          where: { status: 'ACTIVE' }
        }
      }
    });

    if (!contract) {
      return null;
    }

    let requiredLevels = 0;
    let levelRequirements = {};

    if (contract.stage === 'STAGE_1') {
      requiredLevels = 3;
      levelRequirements = { 1: 3, 2: 4, 3: 4 };
    } else if (contract.stage === 'STAGE_2' || contract.stage === 'STAGE_3') {
      requiredLevels = 2;
      levelRequirements = { 1: 3, 2: 4 };
    }

    const levelCounts = {};
    contract.children.forEach(child => {
      if (child.level <= requiredLevels + 1) {
        levelCounts[child.level] = (levelCounts[child.level] || 0) + 1;
      }
    });

    const progress = {};
    let totalRequired = 0;
    let totalFilled = 0;

    Object.keys(levelRequirements).forEach(level => {
      const levelNum = parseInt(level);
      const required = levelRequirements[levelNum];
      const filled = levelCounts[levelNum] || 0;
      totalRequired += required;
      totalFilled += filled;
      
      progress[levelNum] = {
        required,
        filled,
        percentage: required > 0 ? Math.min(100, (filled / required) * 100) : 0
      };
    });

    return {
      contractId: contract.id,
      stage: contract.stage,
      levelProgress: progress,
      totalRequired,
      totalFilled,
      percentage: totalRequired > 0 ? Math.min(100, (totalFilled / totalRequired) * 100) : 0,
      isFulfilled: contract.status === 'FULFILLED'
    };
  }
}

module.exports = ContractService;

