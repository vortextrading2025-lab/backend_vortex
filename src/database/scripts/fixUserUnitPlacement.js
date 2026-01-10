/**
 * Fix User Unit Placement
 * Corrects incorrectly placed units for a user
 * 
 * Usage: node src/database/scripts/fixUserUnitPlacement.js [email]
 * Example: node src/database/scripts/fixUserUnitPlacement.js meyer-schulte@t-online.de
 */

require('dotenv').config();
const database = require('../../config/database');
const PlacementService = require('../../services/placementService');

const fixUserUnitPlacement = async () => {
  try {
    const searchEmail = process.argv[2];
    
    if (!searchEmail) {
      console.log('❌ Please provide a user email');
      console.log('Usage: node src/database/scripts/fixUserUnitPlacement.js [email]');
      console.log('Example: node src/database/scripts/fixUserUnitPlacement.js meyer-schulte@t-online.de');
      process.exit(1);
    }

    console.log(`🔧 Fixing unit placement for: "${searchEmail}"\n`);
    console.log('='.repeat(70));
    
    await database.connect();
    const prisma = database.getClient();

    // Find user
    const user = await prisma.user.findUnique({
      where: {
        email: searchEmail
      }
    });

    if (!user) {
      console.log(`❌ User not found: ${searchEmail}`);
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.email})\n`);

    // Check if user was invited
    const inviteLink = await prisma.inviteLink.findFirst({
      where: {
        invitedUserId: user.id
      },
      include: {
        inviter: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    const hostId = inviteLink ? inviteLink.inviterId : null;

    // Get user's units
    const userUnits = await prisma.unit.findMany({
      where: {
        ownerId: user.id,
        isSystemRoot: false
      },
      include: {
        parentUnit: {
          select: {
            id: true,
            unitName: true,
            unitNumber: true,
            owner: {
              select: {
                email: true
              }
            },
            isSystemRoot: true
          }
        },
        contractGame: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { unitNumber: 'asc' }
    });

    if (userUnits.length === 0) {
      console.log('❌ User has no units');
      process.exit(0);
    }

    console.log(`📦 Found ${userUnits.length} units to check:\n`);

    // Find the contract game ID (should be the same for all units)
    const contractGameId = userUnits[0].contractGameId;
    const stage = userUnits[0].stage;

    // Get system root for this stage
    const systemRoot = await prisma.unit.findFirst({
      where: {
        contractGameId: contractGameId,
        stage: stage,
        isSystemRoot: true
      }
    });

    if (!systemRoot) {
      console.log('❌ System root not found for this contract game and stage');
      process.exit(1);
    }

    // Find unit 101 (first odd unit)
    const unit101 = userUnits.find(u => u.unitNumber === 101);
    if (!unit101) {
      console.log('❌ Unit 101 not found');
      process.exit(1);
    }

    console.log(`📋 Unit 101: ${unit101.unitName} (Level ${unit101.level})`);
    console.log(`📋 System Root: ${systemRoot.unitName} (Level ${systemRoot.level})\n`);

    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      let fixedCount = 0;

      for (const unit of userUnits) {
        const isOddUnit = unit.unitNumber % 2 === 1;
        const currentParent = unit.parentUnit;
        let shouldFix = false;
        let newParentId = null;
        let reason = '';

        if (isOddUnit && unit.unitNumber !== 101) {
          // Odd units (103, 105, etc.) should be under system root (if no host) or host's odd unit
          if (!hostId) {
            // No host - should be under system root
            if (!currentParent || !currentParent.isSystemRoot) {
              shouldFix = true;
              newParentId = systemRoot.id;
              reason = `Odd unit should be under system root (no host), currently under ${currentParent ? currentParent.unitName : 'unknown'}`;
            }
          } else {
            // Has host - should be under host's first odd unit
            // For now, we'll place under system root as fallback
            if (!currentParent || currentParent.owner.email !== inviteLink.inviter.email) {
              shouldFix = true;
              newParentId = systemRoot.id;
              reason = `Odd unit should be under host's unit, currently under ${currentParent ? currentParent.unitName : 'unknown'}`;
            }
          }
        } else if (!isOddUnit) {
          // Even units (102, 104, etc.) should be under owner's first odd unit (101)
          // Check if it's directly under 101 or in 101's subtree
          const isUnder101 = await checkIfInSubtree(unit.id, unit101.id, tx);
          
          if (!isUnder101) {
            // Not in 101's subtree - needs to be moved
            shouldFix = true;
            // Check if 101 has space for direct children (only count even units)
            const directChildren = await tx.unit.findMany({
              where: {
                parentUnitId: unit101.id,
                level: unit101.level + 1,
                ownerId: user.id
              },
              select: {
                unitNumber: true
              }
            });
            
            // Filter to only even units
            const evenUnitChildren = directChildren.filter(c => c.unitNumber % 2 === 0);
            
            if (evenUnitChildren.length < 2) {
              // Can place directly under 101
              newParentId = unit101.id;
              reason = `Even unit should be directly under unit 101, currently under ${currentParent ? currentParent.unitName : 'unknown'}`;
            } else {
              // 101 is full, find space in its subtree
              const vacantPlacement = await PlacementService.findVacantLevel(unit101.id, tx, user.id, true);
              newParentId = vacantPlacement.parentUnitId;
              reason = `Even unit should be in unit 101's subtree, currently under ${currentParent ? currentParent.unitName : 'unknown'}`;
            }
          } else {
            // Check if it should be directly under 101 instead of deeper
            if (currentParent && currentParent.id !== unit101.id) {
              // Check if 101 has space for direct children
              const directChildren = await tx.unit.findMany({
                where: {
                  parentUnitId: unit101.id,
                  level: unit101.level + 1,
                  ownerId: user.id
                },
                select: {
                  unitNumber: true
                }
              });
              
              const evenUnitChildren = directChildren.filter(c => c.unitNumber % 2 === 0);
              
              if (evenUnitChildren.length < 2) {
                // Can move to be directly under 101
                shouldFix = true;
                newParentId = unit101.id;
                reason = `Even unit should be directly under unit 101 (sibling of other even units), currently under ${currentParent.unitName}`;
              }
            }
          }
        }

        if (shouldFix) {
          console.log(`\n🔧 Fixing ${unit.unitName} (#${unit.unitNumber}):`);
          console.log(`   Current: Under ${currentParent ? currentParent.unitName : 'unknown'} (Level ${unit.level})`);
          console.log(`   Reason: ${reason}`);
          
          // Calculate new level
          const newParent = await tx.unit.findUnique({
            where: { id: newParentId },
            select: { level: true }
          });
          
          const newLevel = newParent.level + 1;
          
          // Find vacant position in the new level
          const unitsAtNewLevel = await tx.unit.findMany({
            where: {
              parentUnitId: newParentId,
              level: newLevel
            },
            select: {
              positionInLevel: true
            }
          });
          
          const occupiedPositions = new Set(unitsAtNewLevel.map(u => u.positionInLevel));
          let newPosition = 1;
          for (let pos = 1; pos <= 2; pos++) {
            if (!occupiedPositions.has(pos)) {
              newPosition = pos;
              break;
            }
          }
          
          // Update unit
          await tx.unit.update({
            where: { id: unit.id },
            data: {
              parentUnitId: newParentId,
              level: newLevel,
              positionInLevel: newPosition
            }
          });
          
          console.log(`   ✅ Moved to: Level ${newLevel}, Position ${newPosition}`);
          fixedCount++;
        } else {
          console.log(`✅ ${unit.unitName} (#${unit.unitNumber}): Correctly placed`);
        }
      }

      console.log(`\n${'='.repeat(70)}`);
      console.log(`📊 Summary: Fixed ${fixedCount} unit(s)\n`);
    }, {
      maxWait: 10000,
      timeout: 120000
    });

    console.log('✅ Unit placement fixed successfully!\n');

  } catch (error) {
    console.error('❌ Error fixing unit placement:', error.message);
    console.error(error.stack);
  } finally {
    await database.disconnect();
  }
};

// Helper function to check if a unit is in the subtree of another unit
const checkIfInSubtree = async (unitId, rootUnitId, prisma) => {
  let currentUnitId = unitId;
  const maxDepth = 20; // Prevent infinite loops
  let depth = 0;

  while (currentUnitId && depth < maxDepth) {
    const currentUnit = await prisma.unit.findUnique({
      where: { id: currentUnitId },
      select: { parentUnitId: true }
    });

    if (!currentUnit) {
      return false;
    }

    if (currentUnit.parentUnitId === rootUnitId) {
      return true;
    }

    if (!currentUnit.parentUnitId) {
      return false;
    }

    currentUnitId = currentUnit.parentUnitId;
    depth++;
  }

  return false;
};

// Run the script
fixUserUnitPlacement();

