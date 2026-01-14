/**
 * Check User Unit Placement
 * Verifies if a user's units are placed according to placement rules
 * 
 * Usage: node src/database/scripts/checkUserUnitPlacement.js [email]
 * Example: node src/database/scripts/checkUserUnitPlacement.js meyer-schulte@t-online.de
 */

require('dotenv').config();
const database = require('../../config/database');

const checkUserUnitPlacement = async () => {
  try {
    const searchEmail = process.argv[2];
    
    if (!searchEmail) {
      console.log('❌ Please provide a user email');
      console.log('Usage: node src/database/scripts/checkUserUnitPlacement.js [email]');
      console.log('Example: node src/database/scripts/checkUserUnitPlacement.js meyer-schulte@t-online.de');
      process.exit(1);
    }

    console.log(`🔍 Checking unit placement for: "${searchEmail}"\n`);
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
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    const hostId = inviteLink ? inviteLink.inviterId : null;
    const hostName = inviteLink ? `${inviteLink.inviter.firstName} ${inviteLink.inviter.lastName}` : 'System Root';

    console.log(`👤 Host: ${hostName} (${inviteLink ? inviteLink.inviter.email : 'N/A'})`);
    console.log(`   Invite Code: ${inviteLink ? inviteLink.inviteCode : 'N/A (not invited)'}\n`);

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
                email: true,
                firstName: true,
                lastName: true
              }
            }
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

    console.log(`📦 User has ${userUnits.length} units:\n`);

    // Check placement rules
    const placementIssues = [];
    const placementCorrect = [];

    for (const unit of userUnits) {
      const isOddUnit = unit.unitNumber % 2 === 1;
      const parentInfo = unit.parentUnit 
        ? `${unit.parentUnit.unitName} (${unit.parentUnit.owner.email})`
        : 'System Root';
      
      console.log(`${'='.repeat(70)}`);
      console.log(`Unit: ${unit.unitName} (#${unit.unitNumber})`);
      console.log(`  Stage: ${unit.stage}`);
      console.log(`  Level: ${unit.level}`);
      console.log(`  Status: ${unit.isActive ? 'ACTIVE' : unit.isCompleted ? 'COMPLETED' : 'INACTIVE'}`);
      console.log(`  Parent: ${parentInfo}`);

      if (isOddUnit) {
        // Odd units (101, 103, etc.) should be under HOST's first odd unit
        console.log(`  Rule: Odd unit → Should be under HOST's first odd unit`);
        
        if (hostId) {
          // Check if parent is owned by host
          if (unit.parentUnit && unit.parentUnit.owner.email === inviteLink.inviter.email) {
            // Check if parent is an odd unit
            if (unit.parentUnit.unitNumber % 2 === 1) {
              placementCorrect.push({
                unit: unit.unitName,
                rule: 'Odd unit under host\'s odd unit',
                status: '✅ CORRECT'
              });
              console.log(`  ✅ CORRECT: Placed under host's odd unit`);
            } else {
              placementIssues.push({
                unit: unit.unitName,
                rule: 'Odd unit should be under host\'s odd unit',
                issue: `Parent is even unit (${unit.parentUnit.unitNumber})`,
                status: '❌ INCORRECT'
              });
              console.log(`  ❌ INCORRECT: Parent is even unit, should be odd unit`);
            }
          } else if (unit.parentUnit && unit.parentUnit.owner.email === user.email) {
            placementIssues.push({
              unit: unit.unitName,
              rule: 'Odd unit should be under host\'s odd unit',
              issue: `Placed under own unit instead of host's unit`,
              status: '❌ INCORRECT'
            });
            console.log(`  ❌ INCORRECT: Placed under own unit, should be under host's unit`);
          } else {
            placementIssues.push({
              unit: unit.unitName,
              rule: 'Odd unit should be under host\'s odd unit',
              issue: `Placed under ${unit.parentUnit ? unit.parentUnit.owner.email : 'system root'}`,
              status: '❌ INCORRECT'
            });
            console.log(`  ❌ INCORRECT: Not placed under host's unit`);
          }
        } else {
          // No host - should be under system root
          if (!unit.parentUnit || unit.parentUnit.unitName.includes('SYSTEM_ROOT')) {
            placementCorrect.push({
              unit: unit.unitName,
              rule: 'Odd unit under system root (no host)',
              status: '✅ CORRECT'
            });
            console.log(`  ✅ CORRECT: Placed under system root (no host)`);
          } else {
            placementIssues.push({
              unit: unit.unitName,
              rule: 'Odd unit should be under system root (no host)',
              issue: `Placed under ${parentInfo}`,
              status: '❌ INCORRECT'
            });
            console.log(`  ❌ INCORRECT: Should be under system root`);
          }
        }
      } else {
        // Even units (102, 104, etc.) should be under OWNER's first odd unit (101)
        console.log(`  Rule: Even unit → Should be under OWNER's first odd unit (101)`);
        
        const ownerFirstOddUnit = userUnits.find(u => u.unitNumber === 101);
        
        if (ownerFirstOddUnit) {
          // Check if this unit is in the subtree of unit 101
          const isUnder101 = await checkIfInSubtree(unit.id, ownerFirstOddUnit.id, prisma);
          
          if (isUnder101) {
            placementCorrect.push({
              unit: unit.unitName,
              rule: 'Even unit under owner\'s first odd unit (101)',
              status: '✅ CORRECT'
            });
            console.log(`  ✅ CORRECT: Placed in subtree of unit 101`);
          } else {
            placementIssues.push({
              unit: unit.unitName,
              rule: 'Even unit should be under owner\'s first odd unit (101)',
              issue: `Not in subtree of unit 101`,
              status: '❌ INCORRECT'
            });
            console.log(`  ❌ INCORRECT: Not in subtree of unit 101`);
          }
        } else {
          placementIssues.push({
            unit: unit.unitName,
            rule: 'Even unit should be under owner\'s first odd unit (101)',
            issue: `Owner's unit 101 not found`,
            status: '❌ INCORRECT'
          });
          console.log(`  ❌ INCORRECT: Owner's unit 101 not found`);
        }
      }
      console.log('');
    }

    // Summary
    console.log('='.repeat(70));
    console.log('📊 PLACEMENT SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Correctly Placed: ${placementCorrect.length}`);
    console.log(`❌ Placement Issues: ${placementIssues.length}\n`);

    if (placementCorrect.length > 0) {
      console.log('✅ Correctly Placed Units:');
      placementCorrect.forEach(item => {
        console.log(`   - ${item.unit}: ${item.rule}`);
      });
      console.log('');
    }

    if (placementIssues.length > 0) {
      console.log('❌ Placement Issues:');
      placementIssues.forEach(item => {
        console.log(`   - ${item.unit}: ${item.issue}`);
      });
      console.log('');
    }

    if (placementIssues.length === 0) {
      console.log('✅ All units are placed correctly according to placement rules!\n');
    } else {
      console.log('⚠️  Some units have placement issues. See details above.\n');
    }

  } catch (error) {
    console.error('❌ Error checking unit placement:', error.message);
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
checkUserUnitPlacement();

