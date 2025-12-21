#!/usr/bin/env node

/**
 * Test 5 Users Under test1@gmail.com
 * - Deletes all units (except system roots)
 * - Adds units for test1@gmail.com
 * - Creates 5 users, each buying 4 units
 * - Places them under test1's units (test1 is the host)
 */

require('dotenv').config();
const database = require('../../config/database');
const logger = require('../../modules/logging/logger');
const bcrypt = require('bcryptjs');
const PurchaseService = require('../../services/purchaseService');
const PlacementService = require('../../services/placementService');

const test5UsersUnderTest1 = async () => {
  try {
    console.log('🧪 Testing 5 Users Under test1@gmail.com\n');
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

    // Step 5: Add units for mentor1 first (so test1 can be placed under mentor1's active unit)
    console.log('\n📦 Step 2.5: Adding units for mentor1@gmail.com...');
    const mentor1Request = await PurchaseService.createPurchaseRequest(
      mentor1.id,
      contractGame.id,
      4
    );
    // Mentor requests are auto-approved, so just wait a moment for auto-placement
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log(`   ✅ Added 4 units for mentor1 (auto-approved and auto-placed)`);

    // Step 6: Get or create test1@gmail.com
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

    // Step 7: Add units for test1@gmail.com
    console.log('\n📦 Step 4: Adding 4 units for test1@gmail.com...');
    const test1Request = await PurchaseService.createPurchaseRequest(
      test1.id,
      contractGame.id,
      4
    );
    await PurchaseService.approvePurchase(test1Request.id, mentor1.id, mentor1.id);
    const test1Result = await PurchaseService.processPlacement(test1Request.id);
    console.log(`   ✅ Added 4 units for test1: ${test1Result.units.map(u => u.unitNumber).join(', ')}`);

    // Get test1's active unit
    const test1ActiveUnit = await PlacementService.findActiveUnit(
      test1.id,
      contractGame.id,
      1
    );
    if (!test1ActiveUnit) {
      throw new Error('test1 has no active unit');
    }
    console.log(`   📍 test1's active unit: ${test1ActiveUnit.unitName} (#${test1ActiveUnit.unitNumber}) at level ${test1ActiveUnit.level}`);

    // Step 8: Create 5 users and add 4 units each under test1
    console.log('\n👥 Step 5: Creating 5 users and adding 4 units each under test1...');
    
    const users = [];
    for (let i = 1; i <= 5; i++) {
      const userEmail = `user${i}@test.com`;
      
      // Delete existing user if exists
      await prisma.unit.deleteMany({
        where: {
          owner: { email: userEmail }
        }
      });
      await prisma.purchaseRequest.deleteMany({
        where: {
          user: { email: userEmail }
        }
      });
      await prisma.user.deleteMany({
        where: { email: userEmail }
      });

      const newUser = await prisma.user.create({
        data: {
          email: userEmail,
          password: hashedPassword,
          firstName: 'User',
          lastName: `${i}`,
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: true,
          mentorId: mentor1.id
        }
      });

      await prisma.wallet.create({
        data: {
          userId: newUser.id,
          balance: 0,
          totalEarned: 0,
          totalWithdrawn: 0
        }
      });

      users.push(newUser);
      console.log(`   ✅ Created user: ${newUser.email}`);

      // Create purchase request with test1 as host
      const userRequest = await prisma.purchaseRequest.create({
        data: {
          userId: newUser.id,
          mentorId: mentor1.id,
          hostId: test1.id, // test1 is the host
          contractGameId: contractGame.id,
          unitCount: 4,
          totalAmount: contractGame.downPayment * 4,
          status: 'APPROVED',
          approvedAt: new Date()
        }
      });

      // Place units
      const userResult = await PurchaseService.processPlacement(userRequest.id);
      console.log(`   ✅ Added 4 units for ${newUser.email}: ${userResult.units.map(u => u.unitNumber).join(', ')}`);
      
      // Show where units were placed
      for (const unit of userResult.units) {
        const unitWithParent = await prisma.unit.findUnique({
          where: { id: unit.id },
          include: {
            parentUnit: {
              select: {
                unitName: true,
                unitNumber: true,
                owner: {
                  select: { email: true }
                }
              }
            }
          }
        });
        const parentInfo = unitWithParent.parentUnit 
          ? `${unitWithParent.parentUnit.unitName} (#${unitWithParent.parentUnit.unitNumber}) - ${unitWithParent.parentUnit.owner.email}`
          : 'SYSTEM_ROOT';
        console.log(`      ${unit.unitName} (#${unit.unitNumber}) [L${unit.level}] → under ${parentInfo}`);
      }
    }

    // Step 9: Verify all placements
    console.log('\n✅ Step 6: Verifying placements...\n');
    
    // Get test1's units
    const test1Units = await prisma.unit.findMany({
      where: {
        ownerId: test1.id,
        contractGameId: contractGame.id,
        stage: 1,
        isSystemRoot: false
      },
      include: {
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
          },
          orderBy: { unitNumber: 'asc' }
        }
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`📦 test1@gmail.com has ${test1Units.length} units:\n`);
    for (const unit of test1Units) {
      const childrenCount = unit.childrenUnits.length;
      console.log(`   ${unit.unitName} (#${unit.unitNumber}) [L${unit.level}] - ${childrenCount} children`);
      if (childrenCount > 0) {
        unit.childrenUnits.forEach(child => {
          console.log(`      └── ${child.unitName} (#${child.unitNumber}) [L${child.level}] - ${child.owner.email}`);
        });
      }
    }

    // Get all units for the 5 users
    console.log('\n📊 Summary of 5 users:\n');
    for (const user of users) {
      const userUnits = await prisma.unit.findMany({
        where: {
          ownerId: user.id,
          contractGameId: contractGame.id,
          stage: 1,
          isSystemRoot: false
        },
        include: {
          parentUnit: {
            select: {
              unitName: true,
              unitNumber: true,
              owner: {
                select: { email: true }
              }
            }
          }
        },
        orderBy: { unitNumber: 'asc' }
      });

      console.log(`   ${user.email}: ${userUnits.length} units`);
      console.log(`      Unit numbers: ${userUnits.map(u => u.unitNumber).join(', ')}`);
      console.log(`      Unit names: ${userUnits.map(u => u.unitName).join(', ')}`);
      
      // Verify placement rules for each user
      const userUnit101 = userUnits.find(u => u.unitNumber === 101);
      const userUnit102 = userUnits.find(u => u.unitNumber === 102);
      const userUnit103 = userUnits.find(u => u.unitNumber === 103);
      const userUnit104 = userUnits.find(u => u.unitNumber === 104);

      if (userUnit101 && userUnit102 && userUnit103 && userUnit104) {
        // Check if 101 is active
        const is101Active = userUnit101.isActive ? '✓' : '✗';
        // Check if 102 is under 101
        const is102Under101 = userUnit102.parentUnitId === userUnit101.id ? '✓' : '✗';
        // Check if 103 is NOT active
        const is103NotActive = !userUnit103.isActive ? '✓' : '✗';
        // Check if 104 is under 101
        const is104Under101 = userUnit104.parentUnitId === userUnit101.id ? '✓' : '✗';
        // Check if 101 has 2 children
        const unit101Children = await prisma.unit.findMany({
          where: {
            parentUnitId: userUnit101.id
          }
        });
        const has2Children = unit101Children.length === 2 ? '✓' : '✗';
        
        console.log(`      Rules: 101 active: ${is101Active}, 102 under 101: ${is102Under101}, 103 not active: ${is103NotActive}, 104 under 101: ${is104Under101}, 101 has 2 children: ${has2Children}`);
      }
      console.log('');
    }

    // Step 10: Show tree structure
    console.log('\n🌳 Tree Structure (showing test1 and children):\n');
    const printTree = (unit, prefix = '', isLast = true, depth = 0, maxDepth = 6) => {
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

    // Get test1's unit 101 with full tree
    const test1Unit101 = test1Units.find(u => u.unitNumber === 101);
    if (test1Unit101) {
      const test1Unit101Full = await prisma.unit.findUnique({
        where: { id: test1Unit101.id },
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
      printTree(test1Unit101Full);
    }

    // Final summary
    const totalUnits = await prisma.unit.count({
      where: {
        contractGameId: contractGame.id,
        stage: 1,
        isSystemRoot: false
      }
    });

    console.log('\n' + '='.repeat(70));
    console.log('📋 Final Summary:');
    console.log(`   test1@gmail.com: 4 units`);
    console.log(`   5 users: 4 units each = 20 units`);
    console.log(`   Total units (excluding system roots): ${totalUnits}`);
    console.log('='.repeat(70));

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
    logger.error('Error in test5UsersUnderTest1:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
};

if (require.main === module) {
  test5UsersUnderTest1();
}

module.exports = { test5UsersUnderTest1 };

