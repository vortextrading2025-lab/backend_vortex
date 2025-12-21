#!/usr/bin/env node

/**
 * Verify test1@gmail.com unit placement
 * Checks that 102 and 104 are both children of 101
 */

require('dotenv').config();
const database = require('../../config/database');

const verifyTest1Placement = async () => {
  try {
    console.log('🔍 Verifying test1@gmail.com unit placement...\n');
    
    await database.connect();
    const prisma = database.getClient();

    // Get test1 user
    const test1 = await prisma.user.findUnique({
      where: { email: 'test1@gmail.com' }
    });

    if (!test1) {
      throw new Error('test1@gmail.com not found');
    }

    // Get contract game
    const contractGame = await prisma.contractGame.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    if (!contractGame) {
      throw new Error('No active contract game found');
    }

    // Get test1's units
    const test1Units = await prisma.unit.findMany({
      where: {
        ownerId: test1.id,
        contractGameId: contractGame.id,
        stage: 1,
        isSystemRoot: false
      },
      include: {
        parentUnit: {
          select: {
            id: true,
            unitName: true,
            unitNumber: true,
            owner: {
              select: { email: true }
            }
          }
        },
        childrenUnits: {
          select: {
            id: true,
            unitName: true,
            unitNumber: true,
            level: true
          },
          orderBy: { unitNumber: 'asc' }
        }
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`📦 test1@gmail.com has ${test1Units.length} units:\n`);

    for (const unit of test1Units) {
      const parentInfo = unit.parentUnit 
        ? `${unit.parentUnit.unitName} (#${unit.parentUnit.unitNumber}) - ${unit.parentUnit.owner.email}`
        : 'SYSTEM_ROOT';
      
      const childrenInfo = unit.childrenUnits.length > 0
        ? `\n      Children: ${unit.childrenUnits.map(c => `${c.unitName} (#${c.unitNumber}) [L${c.level}]`).join(', ')}`
        : '';

      console.log(`   ${unit.unitName} (#${unit.unitNumber})`);
      console.log(`      Level: ${unit.level}`);
      console.log(`      Active: ${unit.isActive}`);
      console.log(`      Parent: ${parentInfo}`);
      if (childrenInfo) console.log(childrenInfo);
      console.log('');
    }

    // Verify placement rules
    console.log('✅ Verification:\n');
    
    const unit101 = test1Units.find(u => u.unitNumber === 101);
    const unit102 = test1Units.find(u => u.unitNumber === 102);
    const unit103 = test1Units.find(u => u.unitNumber === 103);
    const unit104 = test1Units.find(u => u.unitNumber === 104);

    if (!unit101 || !unit102 || !unit103 || !unit104) {
      throw new Error('Missing units 101, 102, 103, or 104');
    }

    // Check rule 1: Unit 101 should be active
    if (unit101.isActive) {
      console.log('   ✓ Unit 101 is active');
    } else {
      console.log('   ✗ Unit 101 is NOT active (should be active)');
    }

    // Check rule 2: Unit 102 should be under Unit 101
    if (unit102.parentUnitId === unit101.id) {
      console.log('   ✓ Unit 102 is under Unit 101');
    } else {
      console.log(`   ✗ Unit 102 is NOT under Unit 101 (parent: ${unit102.parentUnit?.unitName || 'none'})`);
    }

    // Check rule 3: Unit 103 should NOT be active
    if (!unit103.isActive) {
      console.log('   ✓ Unit 103 is NOT active (correct)');
    } else {
      console.log('   ✗ Unit 103 is active (should NOT be active)');
    }

    // Check rule 4: Unit 104 should be under Unit 101 (not 102)
    if (unit104.parentUnitId === unit101.id) {
      console.log('   ✓ Unit 104 is under Unit 101');
    } else {
      console.log(`   ✗ Unit 104 is NOT under Unit 101 (parent: ${unit104.parentUnit?.unitName || 'none'})`);
    }

    // Check rule 5: Unit 101 should have 2 children (102 and 104)
    const unit101Children = unit101.childrenUnits.filter(c => c.unitNumber === 102 || c.unitNumber === 104);
    if (unit101Children.length === 2) {
      console.log(`   ✓ Unit 101 has 2 children: ${unit101Children.map(c => c.unitName).join(', ')}`);
    } else {
      console.log(`   ✗ Unit 101 has ${unit101Children.length} children (should have 2: 102 and 104)`);
      console.log(`      Current children: ${unit101.childrenUnits.map(c => c.unitName).join(', ')}`);
    }

    console.log('\n📊 Tree structure under test1_101:\n');
    const printTree = (unit, prefix = '', isLast = true, depth = 0, maxDepth = 5) => {
      if (depth > maxDepth) {
        console.log(`${prefix}${isLast ? '└──' : '├──'} ... (tree continues)`);
        return;
      }
      
      const active = unit.isActive ? ' [ACTIVE]' : '';
      console.log(`${prefix}${isLast ? '└──' : '├──'} ${unit.unitName} (#${unit.unitNumber}) [L${unit.level}]${active}`);
      
      const children = unit.childrenUnits || [];
      children.forEach((child, idx) => {
        const isLastChild = idx === children.length - 1;
        printTree(child, prefix + (isLast ? '   ' : '│  '), isLastChild, depth + 1, maxDepth);
      });
    };

    // Get full tree structure
    const unit101Full = await prisma.unit.findUnique({
      where: { id: unit101.id },
      include: {
        childrenUnits: {
          include: {
            childrenUnits: {
              include: {
                childrenUnits: {
                  include: {
                    childrenUnits: {
                      include: {
                        childrenUnits: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    printTree(unit101Full);

    console.log('\n✅ Verification complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
};

if (require.main === module) {
  verifyTest1Placement();
}

module.exports = { verifyTest1Placement };

