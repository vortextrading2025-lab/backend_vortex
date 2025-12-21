#!/usr/bin/env node

/**
 * Test test1@gmail.com Unit Placement
 * - Deletes all units (except system roots)
 * - Adds units for test1@gmail.com
 * - Verifies placement rules are followed correctly
 */

require('dotenv').config();
const database = require('../../config/database');
const logger = require('../../modules/logging/logger');
const bcrypt = require('bcryptjs');
const PurchaseService = require('../../services/purchaseService');
const PlacementService = require('../../services/placementService');

const testTest1Placement = async () => {
  try {
    console.log('🧪 Testing test1@gmail.com Unit Placement\n');
    console.log('='.repeat(70));
    
    await database.connect();
    const prisma = database.getClient();

    // Step 1: Get or create admin
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' }
    });

    if (!admin) {
      throw new Error('Admin user not found');
    }

    // Step 2: Get active contract game
    const contractGame = await prisma.contractGame.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    if (!contractGame) {
      throw new Error('No active contract game found');
    }

    // Step 3: Delete all units (except system roots), purchase requests, and payouts
    console.log('\n🗑️  Step 1: Deleting all units (except system roots), purchase requests, and payouts...');
    await prisma.payout.deleteMany({});
    await prisma.purchaseRequest.deleteMany({});
    const deletedUnits = await prisma.unit.deleteMany({
      where: {
        isSystemRoot: false
      }
    });
    console.log(`   ✅ Deleted ${deletedUnits.count} user units, all purchase requests, and payouts`);

    // Step 4: Get or create mentor1
    console.log('\n👤 Step 2: Setting up mentor1@gmail.com...');
    const mentorEmail = 'mentor1@gmail.com';
    const hashedPassword = await bcrypt.hash('12345678', 12);
    
    let mentor1 = await prisma.user.findUnique({
      where: { email: mentorEmail }
    });

    if (mentor1) {
      mentor1 = await prisma.user.update({
        where: { email: mentorEmail },
        data: {
          password: hashedPassword,
          role: 'MENTOR',
          status: 'ACTIVE',
          emailVerified: true
        }
      });
      console.log(`   ✅ Updated user to mentor: ${mentor1.email}`);
    } else {
      mentor1 = await prisma.user.create({
        data: {
          email: mentorEmail,
          password: hashedPassword,
          firstName: 'Mentor',
          lastName: 'One',
          role: 'MENTOR',
          status: 'ACTIVE',
          emailVerified: true
        }
      });
      console.log(`   ✅ Created mentor: ${mentor1.email}`);
    }

    await prisma.wallet.upsert({
      where: { userId: mentor1.id },
      update: {},
      create: {
        userId: mentor1.id,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0
      }
    });

    // Step 4.5: Add units for mentor1 first (so test1 can be placed under mentor1's active unit)
    console.log('\n📦 Step 2.5: Adding units for mentor1@gmail.com (so test1 can be placed under mentor1)...');
    const mentor1Request = await PurchaseService.createPurchaseRequest(
      mentor1.id,
      contractGame.id,
      4
    );
    // Mentor requests are auto-approved, so just wait a moment for auto-placement
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(`   ✅ Added 4 units for mentor1 (auto-approved and auto-placed)`);

    // Step 5: Get or create test1@gmail.com
    console.log('\n👤 Step 3: Setting up test1@gmail.com...');
    const testEmail = 'test1@gmail.com';
    
    let test1 = await prisma.user.findUnique({
      where: { email: testEmail }
    });

    if (test1) {
      test1 = await prisma.user.update({
        where: { email: testEmail },
        data: {
          password: hashedPassword,
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: true,
          mentorId: mentor1.id
        }
      });
      console.log(`   ✅ Updated user: ${test1.email}`);
    } else {
      test1 = await prisma.user.create({
        data: {
          email: testEmail,
          password: hashedPassword,
          firstName: 'Test',
          lastName: 'One',
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: true,
          mentorId: mentor1.id
        }
      });
      console.log(`   ✅ Created user: ${test1.email}`);
    }

    await prisma.wallet.upsert({
      where: { userId: test1.id },
      update: {},
      create: {
        userId: test1.id,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0
      }
    });

    // Step 6: Add units for test1@gmail.com using PurchaseService
    console.log('\n📦 Step 4: Adding 4 units for test1@gmail.com...');
    console.log('   Expected: 101, 102, 103, 104');
    console.log('   Rules:');
    console.log('     - 101 (odd) → under host\'s active unit (mentor1)');
    console.log('     - 102 (even) → under 101 (owner\'s first unit)');
    console.log('     - 103 (odd) → under host\'s active unit (mentor1)');
    console.log('     - 104 (even) → under 101 (owner\'s first unit, NOT 102)');
    
    const request = await PurchaseService.createPurchaseRequest(
      test1.id,
      contractGame.id,
      4
    );
    console.log(`   ✅ Purchase request created: ${request.id}`);
    
    await PurchaseService.approvePurchase(request.id, mentor1.id, mentor1.id);
    console.log(`   ✅ Purchase request approved`);
    
    const result = await PurchaseService.processPlacement(request.id);
    console.log(`   ✅ Units placed: ${result.units.length}`);

    // Step 7: Verify placement rules
    console.log('\n✅ Step 5: Verifying placement rules...\n');
    
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
    console.log('🔍 Verification:\n');
    
    const unit101 = test1Units.find(u => u.unitNumber === 101);
    const unit102 = test1Units.find(u => u.unitNumber === 102);
    const unit103 = test1Units.find(u => u.unitNumber === 103);
    const unit104 = test1Units.find(u => u.unitNumber === 104);

    if (!unit101 || !unit102 || !unit103 || !unit104) {
      throw new Error('Missing units 101, 102, 103, or 104');
    }

    let allPassed = true;

    // Rule 1: Unit 101 should be active
    if (unit101.isActive) {
      console.log('   ✅ Unit 101 is active');
    } else {
      console.log('   ❌ Unit 101 is NOT active (should be active)');
      allPassed = false;
    }

    // Rule 2: Unit 101 should be under host's active unit (mentor1) or system root if mentor1 has no active unit
    if (unit101.parentUnit && (unit101.parentUnit.owner.email === 'mentor1@gmail.com' || unit101.parentUnit.unitName === 'SYSTEM_ROOT_S1')) {
      const parentType = unit101.parentUnit.owner.email === 'mentor1@gmail.com' ? 'host\'s active unit' : 'system root (mentor1 has no active unit)';
      console.log(`   ✅ Unit 101 is under ${parentType} (${unit101.parentUnit.unitName})`);
    } else {
      console.log(`   ❌ Unit 101 is NOT under host's active unit or system root (parent: ${unit101.parentUnit?.unitName || 'none'})`);
      allPassed = false;
    }

    // Rule 3: Unit 102 should be under Unit 101
    if (unit102.parentUnitId === unit101.id) {
      console.log('   ✅ Unit 102 is under Unit 101');
    } else {
      console.log(`   ❌ Unit 102 is NOT under Unit 101 (parent: ${unit102.parentUnit?.unitName || 'none'})`);
      allPassed = false;
    }

    // Rule 4: Unit 103 should NOT be active
    if (!unit103.isActive) {
      console.log('   ✅ Unit 103 is NOT active (correct)');
    } else {
      console.log('   ❌ Unit 103 is active (should NOT be active)');
      allPassed = false;
    }

    // Rule 5: Unit 103 should be under host's active unit (mentor1) or system root if mentor1 has no active unit
    if (unit103.parentUnit && (unit103.parentUnit.owner.email === 'mentor1@gmail.com' || unit103.parentUnit.unitName === 'SYSTEM_ROOT_S1')) {
      const parentType = unit103.parentUnit.owner.email === 'mentor1@gmail.com' ? 'host\'s active unit' : 'system root (mentor1 has no active unit)';
      console.log(`   ✅ Unit 103 is under ${parentType} (${unit103.parentUnit.unitName})`);
    } else {
      console.log(`   ❌ Unit 103 is NOT under host's active unit or system root (parent: ${unit103.parentUnit?.unitName || 'none'})`);
      allPassed = false;
    }

    // Rule 6: Unit 104 should be under Unit 101 (NOT 102)
    if (unit104.parentUnitId === unit101.id) {
      console.log('   ✅ Unit 104 is under Unit 101 (correct, NOT under 102)');
    } else {
      console.log(`   ❌ Unit 104 is NOT under Unit 101 (parent: ${unit104.parentUnit?.unitName || 'none'})`);
      allPassed = false;
    }

    // Rule 7: Unit 101 should have 2 children (102 and 104)
    const unit101Children = unit101.childrenUnits.filter(c => c.unitNumber === 102 || c.unitNumber === 104);
    if (unit101Children.length === 2) {
      console.log(`   ✅ Unit 101 has 2 children: ${unit101Children.map(c => c.unitName).join(', ')}`);
    } else {
      console.log(`   ❌ Unit 101 has ${unit101Children.length} children (should have 2: 102 and 104)`);
      console.log(`      Current children: ${unit101.childrenUnits.map(c => c.unitName).join(', ')}`);
      allPassed = false;
    }

    // Rule 8: Unit numbers should be 101, 102, 103, 104
    const unitNumbers = test1Units.map(u => u.unitNumber).sort((a, b) => a - b);
    if (JSON.stringify(unitNumbers) === JSON.stringify([101, 102, 103, 104])) {
      console.log('   ✅ Unit numbers are correct: 101, 102, 103, 104');
    } else {
      console.log(`   ❌ Unit numbers are incorrect: ${unitNumbers.join(', ')} (expected: 101, 102, 103, 104)`);
      allPassed = false;
    }

    // Rule 9: Unit names should have email prefix
    const unitNames = test1Units.map(u => u.unitName);
    const expectedPrefix = 'test1';
    const allHavePrefix = unitNames.every(name => name.startsWith(expectedPrefix));
    if (allHavePrefix) {
      console.log(`   ✅ All unit names have prefix "${expectedPrefix}"`);
    } else {
      console.log(`   ❌ Some unit names don't have prefix "${expectedPrefix}"`);
      console.log(`      Unit names: ${unitNames.join(', ')}`);
      allPassed = false;
    }

    // Step 8: Show tree structure
    console.log('\n🌳 Tree Structure:\n');
    const printTree = (unit, prefix = '', isLast = true, depth = 0, maxDepth = 5) => {
      if (depth > maxDepth) {
        console.log(`${prefix}${isLast ? '└──' : '├──'} ... (tree continues)`);
        return;
      }
      
      const active = unit.isActive ? ' [ACTIVE]' : '';
      const ownerEmail = unit.owner?.email || 'SYSTEM';
      console.log(`${prefix}${isLast ? '└──' : '├──'} ${unit.unitName} (#${unit.unitNumber}) - ${ownerEmail}${active} [L${unit.level}]`);
      
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
        owner: {
          select: { email: true }
        },
        childrenUnits: {
          include: {
            owner: {
              select: { email: true }
            },
            childrenUnits: {
              include: {
                owner: {
                  select: { email: true }
                },
                childrenUnits: {
                  include: {
                    owner: {
                      select: { email: true }
                    },
                    childrenUnits: {
                      include: {
                        owner: {
                          select: { email: true }
                        }
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

    // Final summary
    console.log('\n' + '='.repeat(70));
    if (allPassed) {
      console.log('✅ ALL PLACEMENT RULES VERIFIED CORRECTLY!');
    } else {
      console.log('❌ SOME PLACEMENT RULES FAILED!');
    }
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Error:', error);
    logger.error('Error in testTest1Placement:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
};

if (require.main === module) {
  testTest1Placement();
}

module.exports = { testTest1Placement };

