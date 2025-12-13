#!/usr/bin/env node

/**
 * Setup Game for mentor1@gmail.com
 * - Deletes all games
 * - Creates new game
 * - Sets up mentor1@gmail.com as mentor (password: 12345678)
 * - Purchases units for mentor1
 * - Adds units below under mentor1
 * - Completes all stages (1, 2, 3) and verifies payouts in wallet
 * 
 * Usage: node src/database/test/setupMentor1Game.js
 */

const database = require('../../config/database');
const logger = require('../../modules/logging/logger');
const bcrypt = require('bcryptjs');
const ContractGameService = require('../../services/contractGameService');
const PurchaseService = require('../../services/purchaseService');
const FulfillmentService = require('../../services/fulfillmentService');
const PlacementService = require('../../services/placementService');

const setupMentor1Game = async () => {
  try {
    console.log('🔄 Starting: Setup Game for mentor1@gmail.com\n');
    console.log('='.repeat(70));
    
    await database.connect();
    const prisma = database.getClient();

    // Step 1: Get or create admin
    console.log('\n👤 Step 1: Getting admin user...');
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
      console.log(`   ✅ Admin created: ${admin.email}`);
    } else {
      console.log(`   ✅ Admin found: ${admin.email}`);
    }

    // Step 2: Delete all contract games and related data
    console.log('\n🗑️  Step 2: Deleting all contract games and related data...');
    
    const payoutResult = await prisma.payout.deleteMany({});
    console.log(`   ✅ Deleted ${payoutResult.count} payouts`);

    const requestResult = await prisma.purchaseRequest.deleteMany({});
    console.log(`   ✅ Deleted ${requestResult.count} purchase requests`);

    const unitResult = await prisma.unit.deleteMany({});
    console.log(`   ✅ Deleted ${unitResult.count} units`);

    const gameResult = await prisma.contractGame.deleteMany({});
    console.log(`   ✅ Deleted ${gameResult.count} contract games`);

    // Step 3: Create/update mentor1@gmail.com as mentor
    console.log('\n👤 Step 3: Creating/updating mentor1@gmail.com as mentor...');
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

    // Create mentor profile if it doesn't exist
    const existingProfile = await prisma.mentorProfile.findUnique({
      where: { userId: mentor1.id }
    });

    if (!existingProfile) {
      await prisma.mentorProfile.create({
        data: {
          userId: mentor1.id,
          expertise: ['Contract Management', 'Business Development'],
          experience: 5,
          bio: 'Experienced mentor in contract management',
          isVerified: true
        }
      });
      console.log(`   ✅ Mentor profile created`);
    }

    // Create wallet for mentor1
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
    console.log(`   ✅ Wallet created/updated for mentor1`);

    // Step 4: Create new contract game
    console.log('\n🎮 Step 4: Creating new contract game...');
    const contractGame = await ContractGameService.createContractGame(
      admin.id,
      'Mentor1 Game 2024',
      100.00, // $100 down payment
      {
        payoutStage1: 1000.00, // $1,000 for Stage 1
        payoutStage2: 2000.00, // $2,000 for Stage 2
        payoutStage3: 3000.00  // $3,000 for Stage 3
      }
    );
    console.log(`   ✅ Contract game created: ${contractGame.name} (ID: ${contractGame.id})`);
    console.log(`   💰 Down Payment: $${contractGame.downPayment}`);
    console.log(`   💵 Payouts: Stage 1: $${contractGame.payoutStage1}, Stage 2: $${contractGame.payoutStage2}, Stage 3: $${contractGame.payoutStage3}`);

    // Step 5: Purchase units for mentor1
    console.log('\n🛒 Step 5: Purchasing units for mentor1...');
    const purchaseRequest = await PurchaseService.createPurchaseRequest(
      mentor1.id,
      contractGame.id,
      4 // Buy 4 units (minimum required)
    );
    console.log(`   ✅ Purchase request created: ${purchaseRequest.id}`);
    console.log(`   📦 Unit count: ${purchaseRequest.unitCount}`);
    console.log(`   💰 Total amount: $${purchaseRequest.totalAmount}`);
    console.log(`   📊 Initial status: ${purchaseRequest.status}`);

    // Mentor requests are auto-approved and auto-placed
    // Wait a moment for auto-placement to complete, then check status
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Refresh the request to get the latest status
    const updatedRequest = await prisma.purchaseRequest.findUnique({
      where: { id: purchaseRequest.id }
    });

    console.log(`   📊 Updated status: ${updatedRequest.status}`);

    if (updatedRequest.status === 'PLACED') {
      console.log(`   ✅ Units already placed automatically for mentor1 (under system root)`);
      
      // Get the placed units
      const mentor1Units = await prisma.unit.findMany({
        where: {
          ownerId: mentor1.id,
          contractGameId: contractGame.id,
          stage: 1
        },
        orderBy: { unitNumber: 'asc' }
      });
      
      mentor1Units.forEach(unit => {
        console.log(`      - ${unit.unitName} (#${unit.unitNumber}) - Stage ${unit.stage}, Level ${unit.level}, Host: ${unit.hostId ? 'System' : 'None'}`);
      });
    } else if (updatedRequest.status === 'APPROVED') {
      // If approved but not placed, process placement
      console.log(`   ⏳ Processing placement for mentor1...`);
      const placementResult = await PurchaseService.processPlacement(updatedRequest.id);
      console.log(`   ✅ Placed ${placementResult.units.length} unit(s) for mentor1`);
      
      placementResult.units.forEach(unit => {
        console.log(`      - ${unit.unitName} (#${unit.unitNumber}) - Stage ${unit.stage}, Level ${unit.level}`);
      });
    } else {
      console.log(`   ⚠️  Purchase request status: ${updatedRequest.status} - may need manual processing`);
    }

    // Get mentor1's units (refresh after placement)
    await new Promise(resolve => setTimeout(resolve, 500));
    const mentor1Units = await prisma.unit.findMany({
      where: {
        ownerId: mentor1.id,
        contractGameId: contractGame.id,
        stage: 1
      },
      orderBy: { unitNumber: 'asc' }
    });

    if (mentor1Units.length === 0) {
      throw new Error('No units found for mentor1!');
    }

    // Get the first active unit for mentor1 (this is the one we'll use for completion)
    const mentor1Unit = mentor1Units.find(u => u.isActive) || mentor1Units[0];
    console.log(`\n   📦 Mentor1's active unit: ${mentor1Unit.unitName} (#${mentor1Unit.unitNumber})`);
    console.log(`   📊 Total mentor1 units: ${mentor1Units.length}`);

    // Step 6: Add units below under mentor1
    console.log('\n📦 Step 6: Adding units below under mentor1...');
    
    // We need to create users and place units under mentor1's unit
    // For Stage 1 completion, we need 14 units in the next 3 levels
    // Let's create enough users to fill the tree
    
    let userIndex = 1;
    const usersToCreate = 20; // Create enough users to fill the tree
    
    for (let i = 0; i < usersToCreate; i++) {
      const userEmail = `user${userIndex}@test.com`;
      userIndex++;
      
      // Check if user exists
      let testUser = await prisma.user.findUnique({
        where: { email: userEmail }
      });

      if (!testUser) {
        const hashedPwd = await bcrypt.hash('12345678', 12);
        testUser = await prisma.user.create({
          data: {
            email: userEmail,
            password: hashedPwd,
            firstName: 'Test',
            lastName: `User${i + 1}`,
            role: 'USER',
            status: 'ACTIVE',
            emailVerified: true,
            mentorId: mentor1.id // Assign to mentor1
          }
        });

        // Create wallet
        await prisma.wallet.upsert({
          where: { userId: testUser.id },
          update: {},
          create: {
            userId: testUser.id,
            balance: 0,
            totalEarned: 0,
            totalWithdrawn: 0
          }
        });
      }

      // Create purchase request for this user
      try {
        // Ensure user has mentor1 assigned (refresh to get latest data)
        const refreshedUser = await prisma.user.findUnique({
          where: { id: testUser.id },
          select: { id: true, mentorId: true }
        });
        
        // If user doesn't have mentor1, update it
        if (!refreshedUser.mentorId || refreshedUser.mentorId !== mentor1.id) {
          await prisma.user.update({
            where: { id: testUser.id },
            data: { mentorId: mentor1.id }
          });
        }
        
        const userPurchaseRequest = await PurchaseService.createPurchaseRequest(
          testUser.id,
          contractGame.id,
          4 // Buy 4 units
        );

        // Verify the request was assigned to mentor1
        const requestMentorId = userPurchaseRequest.mentorId;
        if (requestMentorId !== mentor1.id) {
          console.log(`   ⚠️  Request assigned to different mentor (${requestMentorId}), expected ${mentor1.id}`);
          // Update the request's mentorId to mentor1
          await prisma.purchaseRequest.update({
            where: { id: userPurchaseRequest.id },
            data: { mentorId: mentor1.id }
          });
        }

        // Approve the request (mentor1 approves)
        await PurchaseService.approvePurchase(
          userPurchaseRequest.id,
          mentor1.id,
          mentor1.id // Host is mentor1
        );

        // Process placement
        await PurchaseService.processPlacement(userPurchaseRequest.id);
        console.log(`   ✅ Created and placed units for ${userEmail}`);
      } catch (error) {
        console.log(`   ⚠️  Error creating units for ${userEmail}: ${error.message}`);
      }
    }

    // Step 7: Complete all stages and receive payouts
    console.log('\n🎯 Step 7: Completing all stages and receiving payouts...');
    
    // Get mentor1's unit again to check its status
    const currentMentor1Unit = await prisma.unit.findUnique({
      where: { id: mentor1Unit.id },
      include: {
        payouts: true
      }
    });

    console.log(`   📊 Mentor1 unit status: Stage ${currentMentor1Unit.stage}, Completed: ${currentMentor1Unit.isCompleted}, Active: ${currentMentor1Unit.isActive}`);

    // Helper function to fill tree until unit completes a stage
    const fillTreeUntilUnitCompletes = async (targetUnit, targetStage) => {
      console.log(`\n   🔄 Filling tree until mentor1 unit completes Stage ${targetStage}...`);
      
      let userIndex = 100; // Start from user100 to avoid conflicts
      let iterations = 0;
      const maxIterations = 500;

      while (iterations < maxIterations) {
        iterations++;
        
        // Check if unit has payout for this stage
        const stagePayout = await prisma.payout.findFirst({
          where: {
            unitId: targetUnit.id,
            stage: targetStage
          }
        });

        if (stagePayout && stagePayout.status === 'CREDITED') {
          console.log(`   ✅ Mentor1 unit completed Stage ${targetStage} and received payout of $${stagePayout.amount}!`);
          return true;
        }

        // Check fulfillment status
        const shouldFulfill = await FulfillmentService.checkFulfillment(targetUnit.id);
        if (shouldFulfill) {
          console.log(`   🎯 Unit is ready to fulfill for Stage ${targetStage}...`);
          await FulfillmentService.fulfillUnit(targetUnit.id);
          
          // Wait a bit for async operations
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check if payout was created
          const payout = await prisma.payout.findFirst({
            where: {
              unitId: targetUnit.id,
              stage: targetStage
            }
          });

          if (payout && payout.status === 'CREDITED') {
            console.log(`   ✅ Mentor1 unit completed Stage ${targetStage} and received payout of $${payout.amount}!`);
            return true;
          }
        }

        // Create more users and place units to fill the tree
        const userEmail = `filluser${userIndex}@test.com`;
        userIndex++;

        try {
          let fillUser = await prisma.user.findUnique({
            where: { email: userEmail }
          });

          if (!fillUser) {
            const hashedPwd = await bcrypt.hash('12345678', 12);
            fillUser = await prisma.user.create({
              data: {
                email: userEmail,
                password: hashedPwd,
                firstName: 'Fill',
                lastName: `User${userIndex}`,
                role: 'USER',
                status: 'ACTIVE',
                emailVerified: true,
                mentorId: mentor1.id
              }
            });

            await prisma.wallet.upsert({
              where: { userId: fillUser.id },
              update: {},
              create: {
                userId: fillUser.id,
                balance: 0,
                totalEarned: 0,
                totalWithdrawn: 0
              }
            });
          }

          const fillPurchaseRequest = await PurchaseService.createPurchaseRequest(
            fillUser.id,
            contractGame.id,
            4
          );

          await PurchaseService.approvePurchase(
            fillPurchaseRequest.id,
            mentor1.id,
            mentor1.id
          );

          await PurchaseService.processPlacement(fillPurchaseRequest.id);
          
          // Wait a bit for fulfillment checks
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          // Continue if there's an error
        }

        // Check every 10 iterations
        if (iterations % 10 === 0) {
          const currentUnit = await prisma.unit.findUnique({
            where: { id: targetUnit.id }
          });
          console.log(`   ⏳ Iteration ${iterations}: Unit stage ${currentUnit.stage}, completed: ${currentUnit.isCompleted}`);
        }
      }

      return false;
    };

    // Complete Stage 1
    console.log('\n   🎯 Completing Stage 1...');
    await fillTreeUntilUnitCompletes(mentor1Unit, 1);

    // Get updated unit for Stage 2
    const updatedUnit = await prisma.unit.findUnique({
      where: { id: mentor1Unit.id }
    });

    // For Stage 2, we need to find the Stage 2 unit for mentor1
    // When Stage 1 completes, a new Stage 2 unit should be created
    const mentor1Stage2Unit = await prisma.unit.findFirst({
      where: {
        ownerId: mentor1.id,
        contractGameId: contractGame.id,
        stage: 2,
        isActive: true
      }
    });

    if (mentor1Stage2Unit) {
      console.log('\n   🎯 Completing Stage 2...');
      await fillTreeUntilUnitCompletes(mentor1Stage2Unit, 2);

      // For Stage 3
      const mentor1Stage3Unit = await prisma.unit.findFirst({
        where: {
          ownerId: mentor1.id,
          contractGameId: contractGame.id,
          stage: 3,
          isActive: true
        }
      });

      if (mentor1Stage3Unit) {
        console.log('\n   🎯 Completing Stage 3...');
        await fillTreeUntilUnitCompletes(mentor1Stage3Unit, 3);
      }
    }

    // Step 8: Final Summary and Wallet Verification
    console.log('\n📊 Step 8: Final Summary and Wallet Verification...');
    console.log('='.repeat(70));
    
    // Get wallet information
    const finalWallet = await prisma.wallet.findUnique({
      where: { userId: mentor1.id }
    });

    if (!finalWallet) {
      console.log('   ⚠️  Wallet not found for mentor1!');
    } else {
      console.log(`\n   💰 MENTOR1 WALLET (${mentor1.email}):`);
      console.log(`      Balance: $${Number(finalWallet.balance)}`);
      console.log(`      Total Earned: $${Number(finalWallet.totalEarned)}`);
      console.log(`      Total Withdrawn: $${Number(finalWallet.totalWithdrawn)}`);
    }

    // Get all payouts (filter through unit relation)
    const allPayouts = await prisma.payout.findMany({
      where: {
        userId: mentor1.id,
        unit: {
          contractGameId: contractGame.id
        }
      },
      orderBy: [{ stage: 'asc' }, { createdAt: 'asc' }],
      include: {
        unit: {
          select: {
            unitName: true,
            unitNumber: true,
            contractGameId: true
          }
        }
      }
    });

    console.log(`\n   💵 PAYOUTS RECEIVED: ${allPayouts.length} total`);
    
    if (allPayouts.length === 0) {
      console.log('      ⚠️  NO PAYOUTS FOUND! Units may not have completed stages.');
    } else {
      const stage1Payouts = allPayouts.filter(p => p.stage === 1);
      const stage2Payouts = allPayouts.filter(p => p.stage === 2);
      const stage3Payouts = allPayouts.filter(p => p.stage === 3);
      
      console.log(`\n      Stage 1 Payouts: ${stage1Payouts.length}`);
      stage1Payouts.forEach(payout => {
        console.log(`         ✅ ${payout.unit.unitName} (#${payout.unit.unitNumber}): $${Number(payout.amount)} - Status: ${payout.status}`);
      });
      
      console.log(`\n      Stage 2 Payouts: ${stage2Payouts.length}`);
      stage2Payouts.forEach(payout => {
        console.log(`         ✅ ${payout.unit.unitName} (#${payout.unit.unitNumber}): $${Number(payout.amount)} - Status: ${payout.status}`);
      });
      
      console.log(`\n      Stage 3 Payouts: ${stage3Payouts.length}`);
      stage3Payouts.forEach(payout => {
        console.log(`         ✅ ${payout.unit.unitName} (#${payout.unit.unitNumber}): $${Number(payout.amount)} - Status: ${payout.status}`);
      });
      
      const totalPayoutAmount = allPayouts.reduce((sum, p) => sum + Number(p.amount), 0);
      const creditedPayouts = allPayouts.filter(p => p.status === 'CREDITED');
      const totalCredited = creditedPayouts.reduce((sum, p) => sum + Number(p.amount), 0);
      
      console.log(`\n      📊 Payout Summary:`);
      console.log(`         Total Payout Amount: $${totalPayoutAmount}`);
      console.log(`         Credited to Wallet: $${totalCredited} (${creditedPayouts.length} payouts)`);
      console.log(`         Pending: $${totalPayoutAmount - totalCredited}`);
    }

    // Get all units
    const allMentor1Units = await prisma.unit.findMany({
      where: {
        ownerId: mentor1.id,
        contractGameId: contractGame.id
      },
      orderBy: [{ stage: 'asc' }, { unitNumber: 'asc' }],
      include: {
        payouts: {
          orderBy: { stage: 'asc' }
        }
      }
    });

    console.log(`\n   📦 MENTOR1 UNITS: ${allMentor1Units.length} total`);
    
    const stage1Units = allMentor1Units.filter(u => u.stage === 1);
    const stage2Units = allMentor1Units.filter(u => u.stage === 2);
    const stage3Units = allMentor1Units.filter(u => u.stage === 3);
    
    console.log(`\n      Stage 1 Units: ${stage1Units.length}`);
    stage1Units.forEach(unit => {
      const payouts = unit.payouts.filter(p => p.stage === 1);
      console.log(`         - ${unit.unitName} (#${unit.unitNumber}) - Completed: ${unit.isCompleted}, Active: ${unit.isActive}, Payouts: ${payouts.length}`);
    });
    
    console.log(`\n      Stage 2 Units: ${stage2Units.length}`);
    stage2Units.forEach(unit => {
      const payouts = unit.payouts.filter(p => p.stage === 2);
      console.log(`         - ${unit.unitName} (#${unit.unitNumber}) - Completed: ${unit.isCompleted}, Active: ${unit.isActive}, Payouts: ${payouts.length}`);
    });
    
    console.log(`\n      Stage 3 Units: ${stage3Units.length}`);
    stage3Units.forEach(unit => {
      const payouts = unit.payouts.filter(p => p.stage === 3);
      console.log(`         - ${unit.unitName} (#${unit.unitNumber}) - Completed: ${unit.isCompleted}, Active: ${unit.isActive}, Payouts: ${payouts.length}`);
    });

    // Verification
    console.log('\n   ✅ VERIFICATION:');
    const expectedPayouts = 3; // One for each stage (Stage 1, 2, 3)
    if (allPayouts.length >= expectedPayouts) {
      console.log(`      ✅ SUCCESS: Received ${allPayouts.length} payouts (expected at least ${expectedPayouts})`);
    } else {
      console.log(`      ⚠️  WARNING: Only received ${allPayouts.length} payouts (expected at least ${expectedPayouts})`);
    }
    
    if (finalWallet && Number(finalWallet.balance) > 0) {
      console.log(`      ✅ SUCCESS: Wallet has balance of $${Number(finalWallet.balance)}`);
    } else {
      console.log(`      ⚠️  WARNING: Wallet balance is $${finalWallet ? Number(finalWallet.balance) : 0}`);
    }
    
    console.log('='.repeat(70));

    console.log('\n' + '='.repeat(70));
    console.log('✅ SUCCESS: Game setup completed for mentor1@gmail.com!');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    logger.error('Error in setupMentor1Game:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
};

// Run if called directly
if (require.main === module) {
  setupMentor1Game();
}

module.exports = setupMentor1Game;

