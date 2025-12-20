#!/usr/bin/env node

/**
 * Comprehensive Test: test1 All Units Complete All Stages
 * Tests if test1's 4 units (101, 102, 103, 104) complete all 3 stages and receive payouts
 * 
 * Usage: node src/database/test/test1AllUnitsAllStagesTest.js
 */

const database = require('../../config/database');
const logger = require('../../modules/logging/logger');
const bcrypt = require('bcryptjs');
const ContractGameService = require('../../services/contractGameService');
const PurchaseService = require('../../services/purchaseService');
const FulfillmentService = require('../../services/fulfillmentService');
const PlacementService = require('../../services/placementService');
const WalletService = require('../../modules/wallet/walletService');

const test1AllUnitsAllStagesTest = async () => {
  try {
    console.log('🧪 Starting Comprehensive Test: test1 All Units Complete All Stages\n');
    console.log('='.repeat(70));
    
    await database.connect();
    const prisma = database.getClient();

    // Step 1: Setup
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
    console.log(`   💰 Payouts: Stage 1: $${contractGame.payoutStage1}, Stage 2: $${contractGame.payoutStage2}, Stage 3: $${contractGame.payoutStage3}`);

    // Step 3: Create test1 user and purchase 4 units
    console.log('\n📋 Step 3: Creating test1 user and purchasing 4 units...');
    
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

    const purchaseRequest1 = await PurchaseService.createPurchaseRequest(
      testUser1.id,
      contractGame.id,
      4
    );

    await PurchaseService.approvePurchase(
      purchaseRequest1.id,
      mentor.id,
      mentor.id
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

    console.log(`   📦 test1 units:`);
    test1Units.forEach(unit => {
      console.log(`      - ${unit.unitName} (#${unit.unitNumber}) - Stage ${unit.stage}, Level ${unit.level}, Active: ${unit.isActive}`);
    });

    const test1_101 = test1Units.find(u => u.unitNumber === 101);
    const test1_102 = test1Units.find(u => u.unitNumber === 102);
    const test1_103 = test1Units.find(u => u.unitNumber === 103);
    const test1_104 = test1Units.find(u => u.unitNumber === 104);

    if (!test1_101 || !test1_102 || !test1_103 || !test1_104) {
      throw new Error('Not all test1 units found!');
    }

    // Step 4: Helper function to fill tree until unit completes a stage
    const fillTreeUntilUnitCompletes = async (targetUnit, targetStage, unitName) => {
      console.log(`\n📋 Filling tree until ${unitName} completes Stage ${targetStage}...`);
      
      let userIndex = 2; // Start from test2
      let iterations = 0;
      const maxIterations = 200;

      while (iterations < maxIterations) {
        iterations++;
        
        // Check if unit is completed for this stage
        const currentUnit = await prisma.unit.findUnique({
          where: { id: targetUnit.id }
        });

        // Check if unit has payout for this stage
        const stagePayout = await prisma.payout.findFirst({
          where: {
            unitId: targetUnit.id,
            stage: targetStage
          }
        });

        if (stagePayout && stagePayout.status === 'CREDITED') {
          console.log(`   ✅ ${unitName} completed Stage ${targetStage} and received payout!`);
          return true;
        }

        // Check fulfillment status
        const shouldFulfill = await FulfillmentService.checkFulfillment(targetUnit.id);
        if (shouldFulfill) {
          console.log(`   ✅ ${unitName} is ready to fulfill Stage ${targetStage}...`);
          try {
            await FulfillmentService.fulfillUnit(targetUnit.id);
            // Wait a bit for async operations
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify payout was created
            const payout = await prisma.payout.findFirst({
              where: {
                unitId: targetUnit.id,
                stage: targetStage
              }
            });
            
            if (payout && payout.status === 'CREDITED') {
              console.log(`   ✅ ${unitName} fulfilled Stage ${targetStage}, payout: $${Number(payout.amount).toFixed(2)}`);
              return true;
            }
          } catch (error) {
            console.log(`   ⚠️  Error fulfilling ${unitName}: ${error.message}`);
          }
        }

        // Get level counts
        const levelCounts = await FulfillmentService.countUnitsByLevel(targetUnit.id);
        const levelSummary = Object.keys(levelCounts).sort((a, b) => parseInt(a) - parseInt(b))
          .map(level => `L${level}:${levelCounts[level]}`).join(', ');
        
        if (iterations % 10 === 0) {
          console.log(`   📊 Iteration ${iterations}: ${unitName} tree - ${levelSummary}`);
        }

        // Create and place more units
        const email = `test${userIndex}@gmail.com`;
        await prisma.user.deleteMany({ where: { email } });
        
        const user = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            firstName: 'Test',
            lastName: `User${userIndex}`,
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

        try {
          const request = await PurchaseService.createPurchaseRequest(
            user.id,
            contractGame.id,
            4
          );
          
          await PurchaseService.approvePurchase(
            request.id,
            mentor.id,
            testUser1.id // Place under test1's tree
          );
          
          const result = await PurchaseService.processPlacement(request.id);
          userIndex++;
          
          // Small delay
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.log(`   ⚠️  Error placing units for ${email}: ${error.message}`);
          userIndex++;
        }
      }

      return false;
    };

    // Step 5: Fill tree until test1_101 completes Stage 1
    console.log('\n' + '='.repeat(70));
    console.log('🎯 PHASE 1: Completing Stage 1 for all test1 units');
    console.log('='.repeat(70));

    await fillTreeUntilUnitCompletes(test1_101, 1, 'test1_101');
    await fillTreeUntilUnitCompletes(test1_102, 1, 'test1_102');
    await fillTreeUntilUnitCompletes(test1_103, 1, 'test1_103');
    await fillTreeUntilUnitCompletes(test1_104, 1, 'test1_104');

    // Step 6: Verify Stage 1 completion
    console.log('\n' + '='.repeat(70));
    console.log('📊 STAGE 1 VERIFICATION');
    console.log('='.repeat(70));

    const stage1Payouts = await prisma.payout.findMany({
      where: {
        unitId: { in: [test1_101.id, test1_102.id, test1_103.id, test1_104.id] },
        stage: 1
      }
    });

    console.log(`\n   💰 Stage 1 Payouts: ${stage1Payouts.length}/4`);
    stage1Payouts.forEach(payout => {
      const unit = test1Units.find(u => u.id === payout.unitId);
      console.log(`      ✅ ${unit?.unitName || payout.unitId}: $${Number(payout.amount).toFixed(2)} (${payout.status})`);
    });

    // Step 7: Fill tree until all units complete Stage 2
    console.log('\n' + '='.repeat(70));
    console.log('🎯 PHASE 2: Completing Stage 2 for all test1 units');
    console.log('='.repeat(70));

    // Note: After Stage 1 completion, units should move to Stage 2
    // We need to check if units are in Stage 2 and fill tree accordingly
    await fillTreeUntilUnitCompletes(test1_101, 2, 'test1_101');
    await fillTreeUntilUnitCompletes(test1_102, 2, 'test1_102');
    await fillTreeUntilUnitCompletes(test1_103, 2, 'test1_103');
    await fillTreeUntilUnitCompletes(test1_104, 2, 'test1_104');

    // Step 8: Verify Stage 2 completion
    console.log('\n' + '='.repeat(70));
    console.log('📊 STAGE 2 VERIFICATION');
    console.log('='.repeat(70));

    const stage2Payouts = await prisma.payout.findMany({
      where: {
        unitId: { in: [test1_101.id, test1_102.id, test1_103.id, test1_104.id] },
        stage: 2
      }
    });

    console.log(`\n   💰 Stage 2 Payouts: ${stage2Payouts.length}/4`);
    stage2Payouts.forEach(payout => {
      const unit = test1Units.find(u => u.id === payout.unitId);
      console.log(`      ✅ ${unit?.unitName || payout.unitId}: $${Number(payout.amount).toFixed(2)} (${payout.status})`);
    });

    // Step 9: Fill tree until all units complete Stage 3
    console.log('\n' + '='.repeat(70));
    console.log('🎯 PHASE 3: Completing Stage 3 for all test1 units');
    console.log('='.repeat(70));

    await fillTreeUntilUnitCompletes(test1_101, 3, 'test1_101');
    await fillTreeUntilUnitCompletes(test1_102, 3, 'test1_102');
    await fillTreeUntilUnitCompletes(test1_103, 3, 'test1_103');
    await fillTreeUntilUnitCompletes(test1_104, 3, 'test1_104');

    // Step 10: Final Verification
    console.log('\n' + '='.repeat(70));
    console.log('📊 FINAL VERIFICATION');
    console.log('='.repeat(70));

    const allPayouts = await prisma.payout.findMany({
      where: {
        unitId: { in: [test1_101.id, test1_102.id, test1_103.id, test1_104.id] }
      },
      orderBy: [{ unitId: 'asc' }, { stage: 'asc' }]
    });

    const wallet = await WalletService.getWallet(testUser1.id);

    console.log(`\n   💵 test1 Wallet:`);
    console.log(`      Balance: $${Number(wallet.balance).toFixed(2)}`);
    console.log(`      Total Earned: $${Number(wallet.totalEarned).toFixed(2)}`);

    console.log(`\n   📦 All Payouts Summary:`);
    const payoutByUnit = {};
    allPayouts.forEach(payout => {
      if (!payoutByUnit[payout.unitId]) {
        payoutByUnit[payout.unitId] = [];
      }
      payoutByUnit[payout.unitId].push(payout);
    });

    test1Units.forEach(unit => {
      const payouts = payoutByUnit[unit.id] || [];
      const total = payouts.reduce((sum, p) => sum + Number(p.amount), 0);
      console.log(`      ${unit.unitName}: ${payouts.length} payout(s) = $${total.toFixed(2)}`);
      payouts.forEach(p => {
        console.log(`         Stage ${p.stage}: $${Number(p.amount).toFixed(2)} (${p.status})`);
      });
    });

    // Final Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Total Payouts: ${allPayouts.length}/12 (4 units × 3 stages)`);
    console.log(`✅ Total Earned: $${Number(wallet.totalEarned).toFixed(2)}`);
    console.log(`✅ Expected Total: $24,000.00 (4 units × $6,000 each)`);
    console.log('='.repeat(70));

    if (allPayouts.length === 12 && Number(wallet.totalEarned) >= 24000) {
      console.log('\n🎉 SUCCESS: All test1 units completed all 3 stages and received payouts!');
    } else {
      console.log('\n⚠️  WARNING: Not all units completed all stages yet');
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
  test1AllUnitsAllStagesTest();
}

module.exports = test1AllUnitsAllStagesTest;








