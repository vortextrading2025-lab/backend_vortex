#!/usr/bin/env node

/**
 * Test Case: test1_101 Unit Stage 1 Completion and Payout
 * Tests if test1_101 unit completes Stage 1 and receives payout
 * Also tests if all of test1's units complete Stage 1
 * 
 * Usage: node src/database/test/test1Stage1CompletionTest.js
 */

const database = require('../../config/database');
const logger = require('../../modules/logging/logger');
const bcrypt = require('bcryptjs');
const ContractGameService = require('../../services/contractGameService');
const PurchaseService = require('../../services/purchaseService');
const FulfillmentService = require('../../services/fulfillmentService');
const PlacementService = require('../../services/placementService');
const WalletService = require('../../modules/wallet/walletService');

const test1Stage1CompletionTest = async () => {
  try {
    console.log('🧪 Starting Test: test1_101 Stage 1 Completion and Payout\n');
    console.log('='.repeat(70));
    
    await database.connect();
    const prisma = database.getClient();

    // Step 1: Setup - Get or create admin and mentor
    console.log('\n📋 Step 1: Setting up admin and mentor...');
    
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
    }

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
    }

    // Create wallets
    await prisma.wallet.upsert({
      where: { userId: admin.id },
      update: {},
      create: { userId: admin.id, balance: 0, totalEarned: 0, totalWithdrawn: 0 }
    });

    await prisma.wallet.upsert({
      where: { userId: mentor.id },
      update: {},
      create: { userId: mentor.id, balance: 0, totalEarned: 0, totalWithdrawn: 0 }
    });

    console.log(`   ✅ Admin: ${admin.email}`);
    console.log(`   ✅ Mentor: ${mentor.email}`);

    // Step 2: Create contract game
    console.log('\n📋 Step 2: Creating contract game...');
    const contractGame = await ContractGameService.createContractGame(
      admin.id,
      'Test Game 2024',
      100.00,
      {
        payoutStage1: 1000.00,
        payoutStage2: 2000.00,
        payoutStage3: 3000.00
      }
    );
    console.log(`   ✅ Contract game created: ${contractGame.name}`);
    console.log(`   💰 Stage 1 Payout: $${contractGame.payoutStage1}`);

    // Step 3: Create test1 user and purchase 4 units
    console.log('\n📋 Step 3: Creating test1 user and purchasing 4 units...');
    
    // Delete existing test1 if exists
    await prisma.user.deleteMany({ where: { email: 'test1@gmail.com' } });

    const hashedPassword = await bcrypt.hash('12345678', 12);
    const testUser1 = await prisma.user.create({
      data: {
        email: 'test1@gmail.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'One',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        mentorId: mentor.id
      }
    });

    await prisma.wallet.create({
      data: {
        userId: testUser1.id,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0
      }
    });

    // Create purchase request for test1
    const purchaseRequest1 = await PurchaseService.createPurchaseRequest(
      testUser1.id,
      contractGame.id,
      4 // 4 units
    );

    // Approve and place test1's units
    await PurchaseService.approvePurchase(
      purchaseRequest1.id,
      mentor.id,
      mentor.id // mentor as host
    );

    const placementResult1 = await PurchaseService.processPlacement(purchaseRequest1.id);
    console.log(`   ✅ test1 purchased and placed ${placementResult1.units.length} units`);

    // Get test1's units
    const test1Units = await prisma.unit.findMany({
      where: {
        ownerId: testUser1.id,
        contractGameId: contractGame.id
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`   📦 test1's units:`);
    test1Units.forEach(unit => {
      console.log(`      - ${unit.unitName} (#${unit.unitNumber}) - Stage ${unit.stage}, Level ${unit.level}, Active: ${unit.isActive}`);
    });

    // Find test1_101 (first unit, should be unit number 101)
    const test1_101 = test1Units.find(u => u.unitNumber === 101);
    if (!test1_101) {
      throw new Error('test1_101 unit not found!');
    }
    console.log(`\n   🎯 Target Unit: ${test1_101.unitName} (#${test1_101.unitNumber})`);
    console.log(`      Level: ${test1_101.level}, Stage: ${test1_101.stage}, Active: ${test1_101.isActive}`);

    // Step 4: Create users to fill tree structure for Stage 1 completion
    // Stage 1 requires: Level 1: 2 units, Level 2: 4 units, Level 3: 6 units, Level 4: 2 units (total 14 units)
    console.log('\n📋 Step 4: Creating users to fill tree structure (14+ units needed for Stage 1)...');
    
    const usersToCreate = [];
    // Create more users than needed to ensure we have enough
    for (let i = 2; i <= 20; i++) {
      const email = `test${i}@gmail.com`;
      await prisma.user.deleteMany({ where: { email } });
      
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName: 'Test',
          lastName: `User${i}`,
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: true,
          mentorId: mentor.id
        }
      });

      await prisma.wallet.create({
        data: {
          userId: user.id,
          balance: 0,
          totalEarned: 0,
          totalWithdrawn: 0
        }
      });

      usersToCreate.push(user);
    }
    console.log(`   ✅ Created ${usersToCreate.length} users`);

    // Step 5: Place units to fill the tree structure
    // We need to place units strategically to fill:
    // - Level 1: 2 units under test1_101
    // - Level 2: 4 units (2 under each Level 1 unit)
    // - Level 3: 6 units (under Level 2 units)
    // - Level 4: 2 units (under Level 3 units)
    console.log('\n📋 Step 5: Placing units to fill tree structure...');
    console.log('   Note: Units will be placed according to odd/even rules automatically');
    
    let userIndex = 0;
    let totalPlaced = 0;
    const maxIterations = 50; // Safety limit
    let iterations = 0;

    // Keep placing units until test1_101 is fulfilled
    while (iterations < maxIterations) {
      iterations++;
      
      // Check if test1_101 is already fulfilled
      const currentTest1_101 = await prisma.unit.findUnique({
        where: { id: test1_101.id }
      });
      
      if (currentTest1_101.isCompleted) {
        console.log(`   ✅ test1_101 is already completed!`);
        break;
      }

      // Check fulfillment status
      const shouldFulfill = await FulfillmentService.checkFulfillment(test1_101.id);
      if (shouldFulfill) {
        console.log(`   ✅ test1_101 is ready to be fulfilled!`);
        break;
      }

      // Get current tree structure
      const levelCounts = await FulfillmentService.countUnitsByLevel(test1_101.id);
      console.log(`   📊 Current tree status (iteration ${iterations}):`);
      Object.keys(levelCounts).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
        console.log(`      Level ${level}: ${levelCounts[level]} units`);
      });

      // Place more units
      if (userIndex >= usersToCreate.length) {
        console.log(`   ⚠️  Ran out of users, creating more...`);
        // Create more users if needed
        for (let i = usersToCreate.length + 2; i <= usersToCreate.length + 10; i++) {
          const email = `test${i}@gmail.com`;
          await prisma.user.deleteMany({ where: { email } });
          
          const user = await prisma.user.create({
            data: {
              email,
              password: hashedPassword,
              firstName: 'Test',
              lastName: `User${i}`,
              role: 'USER',
              status: 'ACTIVE',
              emailVerified: true,
              mentorId: mentor.id
            }
          });

          await prisma.wallet.create({
            data: {
              userId: user.id,
              balance: 0,
              totalEarned: 0,
              totalWithdrawn: 0
            }
          });

          usersToCreate.push(user);
        }
      }

      const user = usersToCreate[userIndex++];
      
      try {
        const request = await PurchaseService.createPurchaseRequest(
          user.id,
          contractGame.id,
          4 // 4 units per user
        );
        
        await PurchaseService.approvePurchase(
          request.id,
          mentor.id,
          testUser1.id // test1 as host to place under test1's tree
        );
        
        const result = await PurchaseService.processPlacement(request.id);
        totalPlaced += result.units.length;
        console.log(`   ✅ Placed ${result.units.length} units for ${user.email} (Total: ${totalPlaced} units)`);
        
        // Small delay to allow async operations
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.log(`   ⚠️  Error placing units for ${user.email}: ${error.message}`);
      }
    }

    if (iterations >= maxIterations) {
      console.log(`   ⚠️  Reached max iterations, checking current status...`);
    }

    // Step 6: Check fulfillment status and manually trigger if needed
    console.log('\n📋 Step 6: Checking fulfillment status...');
    
    const finalLevelCounts = await FulfillmentService.countUnitsByLevel(test1_101.id);
    console.log(`   📊 Final tree structure under test1_101:`);
    Object.keys(finalLevelCounts).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
      console.log(`      Level ${level}: ${finalLevelCounts[level]} units`);
    });

    const shouldFulfill = await FulfillmentService.checkFulfillment(test1_101.id);
    console.log(`   ✅ Should fulfill: ${shouldFulfill}`);

    // Manually trigger fulfillment if ready
    if (shouldFulfill) {
      console.log('\n📋 Step 7: Triggering fulfillment for test1_101...');
      try {
        const fulfilledUnit = await FulfillmentService.fulfillUnit(test1_101.id);
        
        if (fulfilledUnit) {
          console.log(`   ✅ test1_101 fulfilled!`);
          console.log(`      Completed: ${fulfilledUnit.isCompleted}`);
          console.log(`      Active: ${fulfilledUnit.isActive}`);
        } else {
          console.log(`   ⚠️  Fulfillment returned null (may have already been fulfilled)`);
        }
      } catch (err) {
        console.log(`   ❌ Fulfillment error: ${err.message}`);
        console.log(err.stack);
      }
    } else {
      console.log('\n   ⚠️  test1_101 is not ready to fulfill yet');
      console.log('   Required: Level 1: 2 units, Level 2: 4 units, Level 3: 6 units, Level 4: 2 units');
    }

    // Step 7: Verify test1_101 completion and payout
    console.log('\n📋 Step 8: Verifying test1_101 completion and payout...');
    
    const finalTest1_101 = await prisma.unit.findUnique({
      where: { id: test1_101.id },
      include: {
        contractGame: true,
        owner: true
      }
    });

    console.log(`   📦 test1_101 Status:`);
    console.log(`      Unit: ${finalTest1_101.unitName} (#${finalTest1_101.unitNumber})`);
    console.log(`      Stage: ${finalTest1_101.stage}`);
    console.log(`      Completed: ${finalTest1_101.isCompleted}`);
    console.log(`      Active: ${finalTest1_101.isActive} ${finalTest1_101.isCompleted && !finalTest1_101.isActive ? '✅ (Correctly inactive after Stage 1 completion)' : finalTest1_101.isCompleted && finalTest1_101.isActive ? '❌ (Should be inactive after completion!)' : ''}`);
    console.log(`      Completed At: ${finalTest1_101.completedAt || 'N/A'}`);

    // Check for payout
    const payouts = await prisma.payout.findMany({
      where: {
        unitId: test1_101.id,
        stage: 1
      }
    });

    console.log(`\n   💰 Payouts for test1_101:`);
    if (payouts.length > 0) {
      payouts.forEach(payout => {
        console.log(`      ✅ Payout ID: ${payout.id}`);
        console.log(`         Amount: $${Number(payout.amount).toFixed(2)}`);
        console.log(`         Stage: ${payout.stage}`);
        console.log(`         Status: ${payout.status}`);
        console.log(`         Created: ${payout.createdAt}`);
      });
    } else {
      console.log(`      ⚠️  No payouts found for test1_101`);
    }

    // Check wallet balance
    const wallet = await WalletService.getWallet(testUser1.id);
    console.log(`\n   💵 test1 Wallet:`);
    console.log(`      Balance: $${Number(wallet.balance).toFixed(2)}`);
    console.log(`      Total Earned: $${Number(wallet.totalEarned).toFixed(2)}`);
    console.log(`      Total Withdrawn: $${Number(wallet.totalWithdrawn).toFixed(2)}`);

    // Step 8: Check all of test1's units
    console.log('\n📋 Step 9: Checking all of test1 units...');
    
    const allTest1Units = await prisma.unit.findMany({
      where: {
        ownerId: testUser1.id,
        contractGameId: contractGame.id
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`   📦 test1 has ${allTest1Units.length} units:`);
    let completedCount = 0;
    for (const unit of allTest1Units) {
      const unitPayouts = await prisma.payout.findMany({
        where: {
          unitId: unit.id,
          stage: 1
        }
      });
      
      const status = unit.isCompleted ? '✅ COMPLETED' : '⏳ PENDING';
      if (unit.isCompleted) completedCount++;
      
      console.log(`      ${status} ${unit.unitName} (#${unit.unitNumber}) - Stage ${unit.stage}, Payouts: ${unitPayouts.length}`);
    }

    // Final Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Contract Game: ${contractGame.name}`);
    console.log(`✅ test1 User: ${testUser1.email}`);
    console.log(`✅ test1_101 Unit: ${finalTest1_101.unitName} (#${finalTest1_101.unitNumber})`);
    console.log(`✅ test1_101 Completed: ${finalTest1_101.isCompleted ? 'YES ✅' : 'NO ❌'}`);
    console.log(`✅ test1_101 Active: ${finalTest1_101.isActive ? 'YES' : 'NO'} ${finalTest1_101.isCompleted && !finalTest1_101.isActive ? '✅ (Correctly inactive)' : finalTest1_101.isCompleted && finalTest1_101.isActive ? '❌ (Should be inactive!)' : ''}`);
    console.log(`✅ test1_101 Payouts: ${payouts.length} payout(s)`);
    console.log(`✅ test1 Wallet Balance: $${Number(wallet.balance).toFixed(2)}`);
    console.log(`✅ test1 Total Earned: $${Number(wallet.totalEarned).toFixed(2)}`);
    console.log(`✅ All test1 Units Completed: ${completedCount}/${allTest1Units.length}`);
    console.log(`✅ Total Units Placed: ${totalPlaced}`);
    console.log('='.repeat(70));

    if (finalTest1_101.isCompleted && payouts.length > 0 && !finalTest1_101.isActive) {
      console.log('\n🎉 SUCCESS: test1_101 completed Stage 1, received payout, and is correctly INACTIVE!');
    } else if (finalTest1_101.isCompleted && payouts.length > 0 && finalTest1_101.isActive) {
      console.log('\n⚠️  WARNING: test1_101 completed Stage 1 and received payout, but is still ACTIVE (should be inactive!)');
    } else {
      console.log('\n⚠️  WARNING: test1_101 may not have completed Stage 1 yet');
    }

    console.log('\n✅ Test completed!\n');

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
  test1Stage1CompletionTest();
}

module.exports = test1Stage1CompletionTest;

