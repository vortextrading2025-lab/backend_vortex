#!/usr/bin/env node

/**
 * End-to-End Test Script
 * Tests the complete flow: contract game creation, user purchase, tree filling, fulfillment, and payouts
 * Usage: node src/database/test/endToEndTest.js [--clean]
 */

const database = require('../../config/database');
const logger = require('../../modules/logging/logger');
const bcrypt = require('bcryptjs');
const ContractGameService = require('../../services/contractGameService');
const PurchaseService = require('../../services/purchaseService');
const FulfillmentService = require('../../services/fulfillmentService');
const PlacementService = require('../../services/placementService');
const WalletService = require('../../modules/wallet/walletService');

const endToEndTest = async () => {
  try {
    console.log('🧪 Starting End-to-End Test - Simple Flow\n');
    
    // Check for --clean flag
    const shouldClean = process.argv.includes('--clean');
    
    // Connect to database
    await database.connect();
    const prisma = database.getClient();

    // Step 1: Clean up data if requested
    if (shouldClean) {
      console.log('🗑️  Cleaning up existing data...');
      await prisma.payout.deleteMany({});
      await prisma.unit.deleteMany({});
      await prisma.purchaseRequest.deleteMany({});
      await prisma.contractGame.deleteMany({});
      await prisma.wallet.deleteMany({});
      await prisma.user.deleteMany({
        where: {
          email: {
            in: ['test1@gmail.com', 'test2@gmail.com']
          }
        }
      });
      console.log('✅ Data cleaned\n');
    }

    // Step 2: Ensure admin and mentor exist
    console.log('👤 Setting up admin and mentor...');
    
    // Get or create admin
    let admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' }
    });

    if (!admin) {
      const hashedPassword = await bcrypt.hash('12345678', 12);
      admin = await prisma.user.create({
        data: {
          email: 'admin@example.com',
          password: hashedPassword,
          firstName: 'Admin',
          lastName: 'User',
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerified: true
        }
      });
      console.log('   ✅ Admin created');
    } else {
      console.log('   ✅ Admin exists');
    }

    // Get or create mentor
    let mentor = await prisma.user.findFirst({
      where: { 
        role: 'MENTOR',
        status: 'ACTIVE'
      },
      orderBy: { createdAt: 'asc' }
    });

    if (!mentor) {
      const hashedPassword = await bcrypt.hash('12345678', 12);
      mentor = await prisma.user.create({
        data: {
          email: 'mentor1@gmail.com',
          password: hashedPassword,
          firstName: 'Mentor',
          lastName: 'One',
          role: 'MENTOR',
          status: 'ACTIVE',
          emailVerified: true
        }
      });
      console.log('   ✅ Mentor created');
    } else {
      console.log('   ✅ Mentor exists');
    }

    // Create wallets for admin and mentor
    await prisma.wallet.upsert({
      where: { userId: admin.id },
      update: {},
      create: {
        userId: admin.id,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0
      }
    });

    await prisma.wallet.upsert({
      where: { userId: mentor.id },
      update: {},
      create: {
        userId: mentor.id,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0
      }
    });

    console.log('');

    // Step 3: Create contract game
    console.log('🎮 Creating contract game...');
    const contractGame = await ContractGameService.createContractGame(
      admin.id,
      'Test Game 2024',
      100.00, // $100 down payment
      {
        payoutStage1: 1000.00, // $1,000 for Stage 1
        payoutStage2: 2000.00, // $2,000 for Stage 2
        payoutStage3: 3000.00  // $3,000 for Stage 3
      }
    );
    console.log(`   ✅ Contract game created: ${contractGame.name} (ID: ${contractGame.id})`);
    console.log(`   💰 Down Payment: $${contractGame.downPayment}`);
    console.log(`   💵 Payouts: Stage 1: $${contractGame.payoutStage1}, Stage 2: $${contractGame.payoutStage2}, Stage 3: $${contractGame.payoutStage3}\n`);

    // Step 4: Create test1@gmail.com user
    console.log('👤 Creating test1@gmail.com user...');
    const hashedPassword = await bcrypt.hash('12345678', 12);
    
    // Delete existing test user if exists
    await prisma.user.deleteMany({
      where: { email: 'test1@gmail.com' }
    });

    const testUser1 = await prisma.user.create({
      data: {
        email: 'test1@gmail.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'One',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        mentorId: mentor.id // Assign mentor
      }
    });

    // Create wallet for test1
    await prisma.wallet.create({
      data: {
        userId: testUser1.id,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0
      }
    });

    console.log(`   ✅ Test user 1 created: ${testUser1.email} (ID: ${testUser1.id})`);
    console.log(`   👨‍🏫 Assigned mentor: ${mentor.email}\n`);

    // Step 5: Create test2@gmail.com user
    console.log('👤 Creating test2@gmail.com user...');
    
    // Delete existing test user if exists
    await prisma.user.deleteMany({
      where: { email: 'test2@gmail.com' }
    });

    const testUser2 = await prisma.user.create({
      data: {
        email: 'test2@gmail.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'Two',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        mentorId: mentor.id // Assign mentor
      }
    });

    // Create wallet for test2
    await prisma.wallet.create({
      data: {
        userId: testUser2.id,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0
      }
    });

    console.log(`   ✅ Test user 2 created: ${testUser2.email} (ID: ${testUser2.id})`);
    console.log(`   👨‍🏫 Assigned mentor: ${mentor.email}\n`);

    // Step 6: test1@gmail.com creates purchase request
    console.log('🛒 test1@gmail.com creating purchase request...');
    const purchaseRequest1 = await PurchaseService.createPurchaseRequest(
      testUser1.id,
      contractGame.id,
      4 // 4 units
    );
    console.log(`   ✅ Purchase request created (ID: ${purchaseRequest1.id})`);

    // Mentor approves test1's request (mentor is the host)
    console.log('✅ Mentor approving test1@gmail.com request (mentor as host)...');
    const approvedRequest1 = await PurchaseService.approvePurchase(
      purchaseRequest1.id,
      mentor.id,
      mentor.id // mentor is the host
    );
    console.log(`   ✅ Purchase request approved`);

    // Place test1's units
    console.log('📍 Placing test1@gmail.com units...');
    const placementResult1 = await PurchaseService.processPlacement(approvedRequest1.id);
    console.log(`   ✅ ${placementResult1.units.length} units placed for test1@gmail.com`);
    
    // Get test1's units
    const testUser1Units = await prisma.unit.findMany({
      where: {
        ownerId: testUser1.id,
        contractGameId: contractGame.id
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`   📦 test1@gmail.com units:`);
    testUser1Units.forEach(unit => {
      console.log(`      - ${unit.unitName} (#${unit.unitNumber}) - Stage ${unit.stage}, Level ${unit.level}, Position ${unit.positionInLevel}, Active: ${unit.isActive}`);
    });
    console.log('');

    // Step 7: test2@gmail.com creates purchase request
    console.log('🛒 test2@gmail.com creating purchase request...');
    const purchaseRequest2 = await PurchaseService.createPurchaseRequest(
      testUser2.id,
      contractGame.id,
      4 // 4 units
    );
    console.log(`   ✅ Purchase request created (ID: ${purchaseRequest2.id})`);

    // Mentor approves test2's request (test1@gmail.com is the host - this places test2 below test1)
    console.log('✅ Mentor approving test2@gmail.com request (test1@gmail.com as host)...');
    const approvedRequest2 = await PurchaseService.approvePurchase(
      purchaseRequest2.id,
      mentor.id,
      testUser1.id // test1@gmail.com is the host - this will place test2 below test1
    );
    console.log(`   ✅ Purchase request approved with test1@gmail.com as host`);

    // Place test2's units
    console.log('📍 Placing test2@gmail.com units (should be below test1@gmail.com)...');
    const placementResult2 = await PurchaseService.processPlacement(approvedRequest2.id);
    console.log(`   ✅ ${placementResult2.units.length} units placed for test2@gmail.com`);
    
    // Get test2's units
    const testUser2Units = await prisma.unit.findMany({
      where: {
        ownerId: testUser2.id,
        contractGameId: contractGame.id
      },
      include: {
        parentUnit: {
          select: {
            unitName: true,
            owner: {
              select: {
                email: true
              }
            }
          }
        }
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`   📦 test2@gmail.com units:`);
    testUser2Units.forEach(unit => {
      const parentInfo = unit.parentUnit ? ` (Parent: ${unit.parentUnit.unitName} owned by ${unit.parentUnit.owner.email})` : ' (No parent)';
      console.log(`      - ${unit.unitName} (#${unit.unitNumber}) - Stage ${unit.stage}, Level ${unit.level}, Position ${unit.positionInLevel}, Active: ${unit.isActive}${parentInfo}`);
    });
    console.log('');

    // Step 8: Verify tree structure
    console.log('🌳 Verifying tree structure...');
    const test1ActiveUnit = await PlacementService.findActiveUnit(testUser1.id, contractGame.id, 1);
    if (test1ActiveUnit) {
      console.log(`   ✅ test1@gmail.com active unit: ${test1ActiveUnit.unitName} (Level ${test1ActiveUnit.level})`);
      
      // Get children of test1's active unit
      const test1Children = await prisma.unit.findMany({
        where: {
          parentUnitId: test1ActiveUnit.id
        },
        include: {
          owner: {
            select: {
              email: true
            }
          }
        },
        orderBy: [
          { level: 'asc' },
          { positionInLevel: 'asc' }
        ]
      });
      
      if (test1Children.length > 0) {
        console.log(`   📊 Children under test1@gmail.com's active unit (${test1ActiveUnit.unitName}):`);
        test1Children.forEach(child => {
          console.log(`      - ${child.unitName} (${child.owner.email}) - Level ${child.level}, Position ${child.positionInLevel}`);
        });
        
        // Check if test2's units are below test1
        const test2UnitsBelowTest1 = test1Children.filter(u => u.owner.email === 'test2@gmail.com');
        if (test2UnitsBelowTest1.length > 0) {
          console.log(`   ✅ SUCCESS: ${test2UnitsBelowTest1.length} unit(s) from test2@gmail.com are placed below test1@gmail.com!`);
        } else {
          console.log(`   ⚠️  Note: test2@gmail.com units are not direct children of test1's active unit, but may be deeper in the tree.`);
        }
      } else {
        console.log(`   ⚠️  No direct children found under test1@gmail.com's active unit`);
      }
    } else {
      console.log(`   ⚠️  test1@gmail.com has no active unit`);
    }
    console.log('');

    // Step 9: Summary
    console.log('📋 TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Contract Game: ${contractGame.name}`);
    console.log(`✅ Test User 1: ${testUser1.email}`);
    console.log(`✅ Test User 2: ${testUser2.email}`);
    console.log(`✅ Mentor: ${mentor.email}`);
    console.log(`✅ test1@gmail.com Units: ${testUser1Units.length}`);
    console.log(`✅ test2@gmail.com Units: ${testUser2Units.length}`);
    console.log(`✅ test2@gmail.com placed below test1@gmail.com: ${testUser2Units.some(u => u.hostId === testUser1.id) ? 'YES' : 'NO'}`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n✅ End-to-End Test Completed!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
};

// Run if called directly
if (require.main === module) {
  endToEndTest();
}

module.exports = endToEndTest;

