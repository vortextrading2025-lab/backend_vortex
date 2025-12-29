#!/usr/bin/env node

/**
 * Test Test1 Fulfillment
 * - Checks test1@gmail.com's current units
 * - Creates random users and invites them using test1's invite code
 * - Places units for them under test1's tree
 * - Fills tree until one of test1's units completes Stage 1
 * 
 * Usage: node src/database/scripts/testTest1Fulfillment.js
 */

require('dotenv').config();
const database = require('../../config/database');
const bcrypt = require('bcryptjs');
const InviteService = require('../../modules/contract/inviteService');
const PurchaseService = require('../../services/purchaseService');
const FulfillmentService = require('../../services/fulfillmentService');
const WalletService = require('../../modules/wallet/walletService');

const testTest1Fulfillment = async () => {
  try {
    console.log('🧪 Starting: Test Test1 Fulfillment\n');
    console.log('='.repeat(70));
    
    await database.connect();
    const prisma = database.getClient();

    // Step 1: Check test1@gmail.com
    console.log('\n👤 Step 1: Checking test1@gmail.com...');
    const test1 = await prisma.user.findUnique({
      where: { email: 'test1@gmail.com' },
      include: {
        inviteLinks: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!test1) {
      throw new Error('test1@gmail.com not found. Please create this user first.');
    }
    console.log(`   ✅ Found test1@gmail.com: ${test1.id}`);

    // Step 2: Check test1's units
    console.log('\n📦 Step 2: Checking test1\'s units...');
    const test1Units = await prisma.unit.findMany({
      where: {
        ownerId: test1.id,
        isSystemRoot: false
      },
      include: {
        contractGame: {
          select: {
            id: true,
            name: true,
            payoutStage1: true,
            payoutStage2: true,
            payoutStage3: true
          }
        },
        payouts: {
          select: {
            id: true,
            amount: true,
            stage: true,
            status: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            childrenUnits: true
          }
        }
      },
      orderBy: { unitNumber: 'asc' }
    });

    if (test1Units.length === 0) {
      throw new Error('test1@gmail.com has no units. Please purchase units first.');
    }

    console.log(`   ✅ test1 has ${test1Units.length} units:\n`);
    test1Units.forEach(unit => {
      const childrenCount = unit._count?.childrenUnits || 0;
      const payouts = unit.payouts || [];
      const stage1Payout = payouts.find(p => p.stage === 1 && (p.status === 'CREDITED' || p.status === 'COMPLETED'));
      console.log(`   - Unit ${unit.unitNumber} (${unit.unitName}):`);
      console.log(`     Stage: ${unit.stage}, Level: ${unit.level}, Active: ${unit.isActive}, Completed: ${unit.isCompleted}`);
      console.log(`     Children: ${childrenCount}, Stage 1 Payout: ${stage1Payout ? `$${stage1Payout.amount} (${stage1Payout.status})` : 'None'}`);
    });

    // Get active contract game
    const contractGame = await prisma.contractGame.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    if (!contractGame) {
      throw new Error('No active contract game found.');
    }
    console.log(`\n   ✅ Active contract game: ${contractGame.name}`);

    // Step 3: Get or create invite link for test1
    console.log('\n🔗 Step 3: Getting or creating invite link for test1...');
    let inviteLink = test1.inviteLinks && test1.inviteLinks.length > 0 
      ? test1.inviteLinks[0]
      : await InviteService.createInviteLink(test1.id);
    
    console.log(`   ✅ Invite code: ${inviteLink.inviteCode}`);
    console.log(`   ✅ Invite URL: ${inviteLink.inviteUrl}`);

    // Step 4: Create random users and invite them
    console.log('\n👥 Step 4: Creating random users and inviting them...');
    const hashedPassword = await bcrypt.hash('12345678', 12);
    const randomUsers = [];
    const numUsers = 20; // Create 20 random users to fill the tree

    for (let i = 1; i <= numUsers; i++) {
      const randomNum = Math.floor(Math.random() * 10000);
      const email = `random${randomNum}@test.com`;
      
      // Check if user already exists
      let user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            firstName: `Random${randomNum}`,
            lastName: 'User',
            username: `random${randomNum}`,
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

        // Use invite link to link user to test1
        try {
          await InviteService.useInviteLink(inviteLink.inviteCode, user.id);
          console.log(`   ✅ Created and invited: ${email}`);
        } catch (error) {
          console.log(`   ⚠️  Created ${email} but invite link error: ${error.message}`);
        }
      } else {
        // Update wallet balance if needed
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
        console.log(`   ✅ Using existing user: ${email}`);
      }

      randomUsers.push(user);
    }

    console.log(`\n   ✅ Created/updated ${randomUsers.length} random users`);

    // Step 5: Buy units for random users (they will be placed under test1's tree)
    console.log('\n🛒 Step 5: Buying units for random users...');
    let purchaseCount = 0;
    for (const user of randomUsers) {
      try {
        const purchaseRequest = await PurchaseService.createPurchaseRequest(
          user.id,
          contractGame.id,
          4 // Buy 4 units each
        );
        purchaseCount++;
        if (purchaseCount % 5 === 0) {
          console.log(`   ✅ Purchased units for ${purchaseCount} users...`);
        }
      } catch (error) {
        console.error(`   ⚠️  Error buying units for ${user.email}: ${error.message}`);
      }
    }
    console.log(`   ✅ Purchase requests created for ${purchaseCount} users`);

    // Step 6: Wait a bit for units to be placed
    console.log('\n⏳ Step 6: Waiting for units to be placed...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 7: Check fulfillment status and fill tree until one unit completes Stage 1
    console.log('\n🎯 Step 7: Checking fulfillment and filling tree...');
    
    // Find test1's first active unit (or first unit if none active)
    const targetUnit = test1Units.find(u => u.isActive) || test1Units[0];
    if (!targetUnit) {
      throw new Error('No target unit found');
    }

    console.log(`   🎯 Target unit: ${targetUnit.unitName} (#${targetUnit.unitNumber})`);
    console.log(`      Stage: ${targetUnit.stage}, Level: ${targetUnit.level}, Active: ${targetUnit.isActive}`);

    let iterations = 0;
    const maxIterations = 50;
    let unitCompleted = false;

    while (iterations < maxIterations && !unitCompleted) {
      iterations++;
      
      // Check current unit status
      const currentUnit = await prisma.unit.findUnique({
        where: { id: targetUnit.id },
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
          console.log(`      Completed at: ${currentUnit.completedAt}`);
          unitCompleted = true;
          break;
        }
      }

      // Check fulfillment status
      const shouldFulfill = await FulfillmentService.checkFulfillment(targetUnit.id);
      
      if (shouldFulfill) {
        console.log(`\n   🎯 Unit is ready to fulfill! Attempting fulfillment...`);
        try {
          await FulfillmentService.fulfillUnit(targetUnit.id);
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check if completed
          const updatedUnit = await prisma.unit.findUnique({
            where: { id: targetUnit.id },
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
      const levelCounts = await FulfillmentService.countUnitsByLevel(targetUnit.id);
      console.log(`   📊 Iteration ${iterations}: Level counts:`, levelCounts);

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
            user = await prisma.user.create({
              data: {
                email,
                password: hashedPassword,
                firstName: `Fill${randomNum}`,
                lastName: 'User',
                username: `fill${randomNum}`,
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

            try {
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
              console.error(`   ⚠️  Error buying units: ${error.message}`);
            }
          }
        }

        // Wait for placement
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Step 8: Final status check
    console.log('\n📊 Step 8: Final status check...');
    const finalUnits = await prisma.unit.findMany({
      where: {
        ownerId: test1.id,
        isSystemRoot: false
      },
      include: {
        payouts: {
          select: {
            id: true,
            amount: true,
            stage: true,
            status: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            childrenUnits: true
          }
        }
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`\n   📦 Final status of test1's units:\n`);
    finalUnits.forEach(unit => {
      const childrenCount = unit._count?.childrenUnits || 0;
      const payouts = unit.payouts || [];
      const stage1Payout = payouts.find(p => p.stage === 1);
      console.log(`   - Unit ${unit.unitNumber} (${unit.unitName}):`);
      console.log(`     Stage: ${unit.stage}, Active: ${unit.isActive}, Completed: ${unit.isCompleted}`);
      console.log(`     Children: ${childrenCount}`);
      if (stage1Payout) {
        console.log(`     Stage 1 Payout: $${stage1Payout.amount} (${stage1Payout.status})`);
      }
    });

    if (unitCompleted) {
      console.log('\n✅ SUCCESS! Fulfillment is working correctly!');
    } else {
      console.log('\n⚠️  Unit did not complete Stage 1 within iterations. Check fulfillment logic.');
    }

    console.log('\n✨ Script completed!\n');
  } catch (error) {
    console.error('❌ Error in test:', error);
    console.error('\n💥 Script failed:', error.message);
    throw error;
  } finally {
    await database.disconnect();
  }
};

// Run the script
if (require.main === module) {
  testTest1Fulfillment()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { testTest1Fulfillment };

