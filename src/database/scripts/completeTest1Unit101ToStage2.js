#!/usr/bin/env node

/**
 * Complete Test1 Unit 101 to Stage 2
 * - Deletes all user units
 * - Adds 4 units for test1@gmail.com
 * - Invites other users under test1
 * - Fills tree until test1_101 completes Stage 1 (reaches Stage 2)
 * 
 * Usage: node src/database/scripts/completeTest1Unit101ToStage2.js
 */

require('dotenv').config();
const database = require('../../config/database');
const bcrypt = require('bcryptjs');
const InviteService = require('../../modules/contract/inviteService');
const PurchaseService = require('../../services/purchaseService');
const FulfillmentService = require('../../services/fulfillmentService');
const WalletService = require('../../modules/wallet/walletService');

const completeTest1Unit101ToStage2 = async () => {
  try {
    console.log('🔄 Starting: Complete Test1 Unit 101 to Stage 2\n');
    console.log('='.repeat(70));
    
    await database.connect();
    const prisma = database.getClient();

    // Step 1: Delete all user units (keep system roots)
    console.log('\n🗑️  Step 1: Deleting all user units...');
    const deletedPayouts = await prisma.payout.deleteMany({
      where: {
        unit: {
          isSystemRoot: false
        }
      }
    });
    console.log(`   ✅ Deleted ${deletedPayouts.count} payouts for user units`);

    const deletedRequests = await prisma.purchaseRequest.deleteMany({});
    console.log(`   ✅ Deleted ${deletedRequests.count} purchase requests`);

    const deletedUnits = await prisma.unit.deleteMany({
      where: {
        isSystemRoot: false
      }
    });
    console.log(`   ✅ Deleted ${deletedUnits.count} user units`);

    // Step 2: Get or create test1@gmail.com
    console.log('\n👤 Step 2: Getting test1@gmail.com...');
    let test1 = await prisma.user.findUnique({
      where: { email: 'test1@gmail.com' }
    });

    if (!test1) {
      const hashedPassword = await bcrypt.hash('12345678', 12);
      test1 = await prisma.user.create({
        data: {
          email: 'test1@gmail.com',
          password: hashedPassword,
          firstName: 'Test',
          lastName: 'One',
          username: 'test1',
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: true
        }
      });
      console.log(`   ✅ Created test1@gmail.com: ${test1.id}`);
    } else {
      console.log(`   ✅ Found test1@gmail.com: ${test1.id}`);
    }

    // Step 3: Ensure test1 has wallet with balance
    console.log('\n💰 Step 3: Ensuring test1 has wallet balance...');
    let wallet = await prisma.wallet.findUnique({
      where: { userId: test1.id }
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: test1.id,
          balance: 10000,
          totalEarned: 0,
          totalWithdrawn: 0
        }
      });
      console.log(`   ✅ Created wallet for test1 with balance: 10000`);
    } else {
      await prisma.wallet.update({
        where: { userId: test1.id },
        data: {
          balance: { increment: 10000 }
        }
      });
      console.log(`   ✅ Updated wallet balance for test1`);
    }

    // Step 4: Get active contract game
    console.log('\n🎮 Step 4: Getting active contract game...');
    const contractGame = await prisma.contractGame.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    if (!contractGame) {
      throw new Error('No active contract game found. Please create one first.');
    }
    console.log(`   ✅ Found active contract game: ${contractGame.name} (${contractGame.id})`);

    // Step 5: Buy 4 units for test1
    console.log('\n🛒 Step 5: Buying 4 units for test1@gmail.com...');
    let purchaseRequest;
    try {
      purchaseRequest = await PurchaseService.createPurchaseRequest(
        test1.id,
        contractGame.id,
        4
      );
      console.log(`   ✅ Purchase request created: ${purchaseRequest.id}`);
      console.log(`   ✅ Status: ${purchaseRequest.status}`);
    } catch (error) {
      console.error(`   ❌ Error buying units: ${error.message}`);
      throw error;
    }

    // Wait for units to be placed
    console.log('\n⏳ Waiting for units to be placed...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 6: Get test1's units and find unit 101
    console.log('\n📦 Step 6: Getting test1\'s units...');
    const test1Units = await prisma.unit.findMany({
      where: {
        ownerId: test1.id,
        isSystemRoot: false
      },
      include: {
        _count: {
          select: {
            childrenUnits: true
          }
        }
      },
      orderBy: { unitNumber: 'asc' }
    });

    if (test1Units.length === 0) {
      throw new Error('test1 has no units. Purchase may have failed.');
    }

    console.log(`   ✅ test1 has ${test1Units.length} units:`);
    test1Units.forEach(unit => {
      console.log(`      - Unit ${unit.unitNumber} (${unit.unitName}): Level ${unit.level}, Active: ${unit.isActive}, Children: ${unit._count?.childrenUnits || 0}`);
    });

    const test1_101 = test1Units.find(u => u.unitNumber === 101);
    if (!test1_101) {
      throw new Error('test1_101 unit not found!');
    }

    console.log(`\n   🎯 Target Unit: ${test1_101.unitName} (#${test1_101.unitNumber})`);
    console.log(`      Stage: ${test1_101.stage}, Level: ${test1_101.level}, Active: ${test1_101.isActive}`);

    // Step 7: We'll create invite links on-demand as we create users
    // (Each invite link can only be used once, so we create them as needed)
    console.log('\n🔗 Step 7: Will create invite links on-demand for each user...');

    // Step 8: Create users and invite them under test1
    console.log('\n👥 Step 8: Creating users and inviting them under test1...');
    const hashedPassword = await bcrypt.hash('12345678', 12);
    const invitedUsers = [];
    const numUsers = 30; // Create enough users to fill the tree

    for (let i = 1; i <= numUsers; i++) {
      const randomNum = Math.floor(Math.random() * 100000);
      const email = `invited${randomNum}@test.com`;
      const username = `invited${randomNum}`;
      
      // Check if user already exists
      let user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        // Check if username exists
        const existingUsername = await prisma.user.findUnique({
          where: { username }
        });
        
        const finalUsername = existingUsername ? `${username}_${Date.now()}` : username;

        user = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            firstName: `Invited${randomNum}`,
            lastName: 'User',
            username: finalUsername,
            role: 'USER',
            status: 'ACTIVE',
            emailVerified: true
          }
        });

        // Create wallet with balance
        await prisma.wallet.create({
          data: {
            userId: user.id,
            balance: 10000,
            totalEarned: 0,
            totalWithdrawn: 0
          }
        });

        // Create and use a new invite link for this user (each can only be used once)
        try {
          const inviteLink = await InviteService.createInviteLink(test1.id);
          await InviteService.useInviteLink(inviteLink.inviteCode, user.id);
          if (i <= 5) {
            console.log(`   ✅ Created and invited: ${email} (invite: ${inviteLink.inviteCode})`);
          }
        } catch (error) {
          if (i <= 5) {
            console.log(`   ⚠️  Created ${email} but invite link error: ${error.message}`);
          }
        }
      } else {
        // Update wallet balance
        await prisma.wallet.upsert({
          where: { userId: user.id },
          update: {
            balance: { increment: 10000 }
          },
          create: {
            userId: user.id,
            balance: 10000,
            totalEarned: 0,
            totalWithdrawn: 0
          }
        });
        if (i <= 5) {
          console.log(`   ✅ Using existing user: ${email}`);
        }
      }

      invitedUsers.push(user);
    }

    console.log(`\n   ✅ Created/updated ${invitedUsers.length} users`);

    // Step 9: Buy units for invited users (they will be placed under test1's tree)
    console.log('\n🛒 Step 9: Buying units for invited users...');
    let purchaseCount = 0;
    for (const user of invitedUsers) {
      try {
        await PurchaseService.createPurchaseRequest(
          user.id,
          contractGame.id,
          4 // Buy 4 units each
        );
        purchaseCount++;
        if (purchaseCount % 10 === 0) {
          console.log(`   ✅ Purchased units for ${purchaseCount} users...`);
        }
      } catch (error) {
        console.error(`   ⚠️  Error buying units for ${user.email}: ${error.message}`);
      }
    }
    console.log(`   ✅ Purchase requests created for ${purchaseCount} users`);

    // Wait for units to be placed
    console.log('\n⏳ Waiting for units to be placed...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 10: Fill tree until test1_101 completes Stage 1
    console.log('\n🎯 Step 10: Filling tree until test1_101 completes Stage 1...');
    console.log('   Stage 1 requires: Level 1: 2 units, Level 2: 4 units, Level 3: 6 units, Level 4: 2 units (total 14 units)');
    
    let iterations = 0;
    const maxIterations = 100;
    let unitCompleted = false;

    while (iterations < maxIterations && !unitCompleted) {
      iterations++;
      
      // Check current unit status
      const currentUnit = await prisma.unit.findUnique({
        where: { id: test1_101.id },
        include: {
          payouts: {
            where: { stage: 1 },
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (currentUnit.isCompleted) {
        const stage1Payout = currentUnit.payouts.find(p => 
          p.stage === 1 && (p.status === 'CREDITED' || p.status === 'COMPLETED')
        );
        
        if (stage1Payout) {
          console.log(`\n   ✅ SUCCESS! Unit ${currentUnit.unitName} completed Stage 1!`);
          console.log(`      Payout: $${stage1Payout.amount} (${stage1Payout.status})`);
          console.log(`      Expected Total Value: $1,500.00`);
          console.log(`      Expected Remaining Balance: $350.00 (after Stage 2 advance payment)`);
          console.log(`      Completed at: ${currentUnit.completedAt}`);
          unitCompleted = true;
          break;
        }
      }

      // Check fulfillment status
      const shouldFulfill = await FulfillmentService.checkFulfillment(test1_101.id);
      
      if (shouldFulfill) {
        console.log(`\n   🎯 Unit is ready to fulfill! Attempting fulfillment...`);
        try {
          await FulfillmentService.fulfillUnit(test1_101.id);
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Check if completed
          const updatedUnit = await prisma.unit.findUnique({
            where: { id: test1_101.id },
            include: {
              payouts: {
                where: { stage: 1 },
                orderBy: { createdAt: 'desc' }
              }
            }
          });

          if (updatedUnit.isCompleted) {
            const stage1Payout = updatedUnit.payouts.find(p => 
              p.stage === 1 && (p.status === 'CREDITED' || p.status === 'COMPLETED')
            );
            
            if (stage1Payout) {
              console.log(`\n   ✅ SUCCESS! Unit ${updatedUnit.unitName} completed Stage 1!`);
              console.log(`      Payout: $${stage1Payout.amount} (${stage1Payout.status})`);
              console.log(`      Expected Total Value: $1,500.00`);
              console.log(`      Expected Remaining Balance: $350.00 (after Stage 2 advance payment)`);
              console.log(`      Completed at: ${updatedUnit.completedAt}`);
              unitCompleted = true;
              break;
            }
          }
        } catch (error) {
          console.log(`   ⚠️  Fulfillment error: ${error.message}`);
        }
      }

      // Get level counts
      const levelCounts = await FulfillmentService.countUnitsByLevel(test1_101.id);
      const level1Count = levelCounts[test1_101.level + 1] || 0;
      const level2Count = levelCounts[test1_101.level + 2] || 0;
      const level3Count = levelCounts[test1_101.level + 3] || 0;
      const level4Count = levelCounts[test1_101.level + 4] || 0;
      
      console.log(`   📊 Iteration ${iterations}: Level 1: ${level1Count}/2, Level 2: ${level2Count}/4, Level 3: ${level3Count}/6, Level 4: ${level4Count}/2`);

      // If not fulfilled, create more users and place units
      if (!unitCompleted && iterations < maxIterations) {
        const additionalUsers = 5;
        console.log(`   👥 Creating ${additionalUsers} more users to fill tree...`);
        
        for (let i = 0; i < additionalUsers; i++) {
          const randomNum = Math.floor(Math.random() * 100000);
          const email = `fill${randomNum}@test.com`;
          
          let user = await prisma.user.findUnique({
            where: { email }
          });

          if (!user) {
            // Check if username exists
            const fillUsername = `fill${randomNum}`;
            const existingUsername = await prisma.user.findUnique({
              where: { username: fillUsername }
            });
            
            const finalUsername = existingUsername ? `${fillUsername}_${Date.now()}` : fillUsername;

            user = await prisma.user.create({
              data: {
                email,
                password: hashedPassword,
                firstName: `Fill${randomNum}`,
                lastName: 'User',
                username: finalUsername,
                role: 'USER',
                status: 'ACTIVE',
                emailVerified: true
              }
            });

            await prisma.wallet.create({
              data: {
                userId: user.id,
                balance: 10000,
                totalEarned: 0,
                totalWithdrawn: 0
              }
            });

            // Create and use a new invite link for this user
            try {
              const inviteLink = await InviteService.createInviteLink(test1.id);
              await InviteService.useInviteLink(inviteLink.inviteCode, user.id);
            } catch (error) {
              // Continue anyway
            }

            try {
              await PurchaseService.createPurchaseRequest(
                user.id,
                contractGame.id,
                4
              );
            } catch (error) {
              // Continue anyway
            }
          }
        }

        // Wait for placement
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Step 11: Final status check
    console.log('\n📊 Step 11: Final status check...');
    const finalUnit = await prisma.unit.findUnique({
      where: { id: test1_101.id },
      include: {
        payouts: {
          select: {
            id: true,
            amount: true,
            stage: true,
            status: true,
            createdAt: true,
            creditedAt: true
          }
        },
        contractGame: {
          select: {
            payoutStage1: true,
            payoutStage2: true,
            advancePaymentStage2: true
          }
        },
        _count: {
          select: {
            childrenUnits: true
          }
        }
      }
    });

    console.log(`\n   📦 Final status of test1_101:\n`);
    console.log(`   - Unit: ${finalUnit.unitName} (#${finalUnit.unitNumber})`);
    console.log(`   - Stage: ${finalUnit.stage}, Active: ${finalUnit.isActive}, Completed: ${finalUnit.isCompleted}`);
    console.log(`   - Children: ${finalUnit._count?.childrenUnits || 0}`);
    
    const stage1Payout = finalUnit.payouts.find(p => p.stage === 1);
    if (stage1Payout) {
      console.log(`   - Stage 1 Payout: $${stage1Payout.amount} (${stage1Payout.status})`);
      console.log(`   - Expected Total Value: $${Number(finalUnit.contractGame.payoutStage1)}`);
      console.log(`   - Expected Stage 2 Advance: $${Number(finalUnit.contractGame.advancePaymentStage2)}`);
      console.log(`   - Expected Remaining Balance: $${Number(finalUnit.contractGame.payoutStage1) - Number(finalUnit.contractGame.advancePaymentStage2)}`);
      if (stage1Payout.creditedAt) {
        console.log(`   - Credited at: ${stage1Payout.creditedAt}`);
      }
    }

    // Check wallet transactions for test1
    console.log(`\n   💰 Wallet transactions for test1:`);
    const test1Wallet = await prisma.wallet.findUnique({
      where: { userId: test1.id }
    });
    
    if (test1Wallet) {
      console.log(`   - Balance: $${test1Wallet.balance}`);
      console.log(`   - Total Earned: $${test1Wallet.totalEarned}`);
      
      const transactions = await prisma.transaction.findMany({
        where: {
          userId: test1.id,
          referenceId: finalUnit.id
        },
        orderBy: { createdAt: 'asc' }
      });
      
      console.log(`   - Transactions related to this unit:`);
      transactions.forEach(tx => {
        console.log(`     ${tx.type}: $${tx.amount} - ${tx.description}`);
      });
    }

    // Check if unit moved to Stage 2
    if (finalUnit.stage === 2) {
      console.log(`\n   ✅ Unit has moved to Stage 2!`);
    } else if (finalUnit.isCompleted && stage1Payout) {
      console.log(`\n   ✅ Unit completed Stage 1 and received payout!`);
      console.log(`   ⚠️  Note: Unit stage is still ${finalUnit.stage}. Check if Stage 2 unit was created.`);
    }

    // Check all test1 units
    const allTest1Units = await prisma.unit.findMany({
      where: {
        ownerId: test1.id,
        isSystemRoot: false
      },
      include: {
        payouts: {
          select: {
            stage: true,
            amount: true,
            status: true
          }
        }
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`\n   📦 All test1 units:`);
    allTest1Units.forEach(unit => {
      const stage1Payout = unit.payouts.find(p => p.stage === 1);
      console.log(`   - Unit ${unit.unitNumber}: Stage ${unit.stage}, Active: ${unit.isActive}, Completed: ${unit.isCompleted}`);
      if (stage1Payout) {
        console.log(`     Stage 1 Payout: $${stage1Payout.amount} (${stage1Payout.status})`);
      }
    });

    if (unitCompleted) {
      console.log('\n✅ SUCCESS! Fulfillment is working correctly!');
      console.log(`   test1_101 completed Stage 1 and received payout.`);
    } else {
      console.log('\n⚠️  Unit did not complete Stage 1 within iterations. Check fulfillment logic.');
    }

    console.log('\n✨ Script completed!\n');
  } catch (error) {
    console.error('❌ Error in script:', error);
    console.error('\n💥 Script failed:', error.message);
    throw error;
  } finally {
    await database.disconnect();
  }
};

// Run the script
if (require.main === module) {
  completeTest1Unit101ToStage2()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { completeTest1Unit101ToStage2 };

