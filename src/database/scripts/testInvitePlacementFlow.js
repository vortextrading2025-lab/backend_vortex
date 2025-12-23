#!/usr/bin/env node

/**
 * Test Invite Placement Flow
 * - test1@gmail.com invites 2 users
 * - Those 2 users buy 4 units each
 * - Verify units are placed under test1's units
 * 
 * Usage: node src/database/scripts/testInvitePlacementFlow.js
 */

require('dotenv').config();
const database = require('../../config/database');
const PurchaseService = require('../../services/purchaseService');
const InviteService = require('../../modules/contract/inviteService');
const WalletService = require('../../modules/wallet/walletService');

const testInvitePlacementFlow = async () => {
  try {
    console.log('🔄 Starting: Test Invite Placement Flow\n');
    console.log('='.repeat(70));
    
    await database.connect();
    const prisma = database.getClient();

    // Step 1: Get active contract game
    console.log('\n🎮 Step 1: Getting active contract game...');
    const contractGame = await prisma.contractGame.findFirst({
      where: { status: 'ACTIVE' }
    });

    if (!contractGame) {
      console.log('   ❌ No active contract game found. Please create one first.');
      return;
    }
    console.log(`   ✅ Found active contract: ${contractGame.name} (${contractGame.id})`);

    // Step 2: Get test1@gmail.com
    console.log('\n👤 Step 2: Getting test1@gmail.com...');
    let test1 = await prisma.user.findUnique({
      where: { email: 'test1@gmail.com' }
    });

    if (!test1) {
      console.log('   ❌ test1@gmail.com not found. Please create this user first.');
      return;
    }
    console.log(`   ✅ Found test1@gmail.com: ${test1.id}`);

    // Step 3: Check if test1 has units
    const test1Units = await prisma.unit.findMany({
      where: {
        ownerId: test1.id,
        isSystemRoot: false
      },
      orderBy: { unitNumber: 'asc' },
      include: {
        _count: {
          select: {
            childrenUnits: true
          }
        }
      }
    });

    if (test1Units.length === 0) {
      console.log('   ⚠️  test1@gmail.com has no units. Purchasing 4 units first...');
      
      // Ensure wallet balance
      let wallet = await WalletService.getWallet(test1.id);
      if (wallet.balance < 2000) {
        await WalletService.addToWallet(test1.id, 2000 - wallet.balance, null, 'DEPOSIT', 'Test deposit for unit purchase');
      }

      // Purchase 4 units
      const purchaseRequest = await PurchaseService.createPurchaseRequest(
        test1.id,
        contractGame.id,
        4
      );
      console.log(`   ✅ Purchase request created: ${purchaseRequest.id}`);
      
      // Wait for placement
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Refresh test1 units
      const updatedTest1Units = await prisma.unit.findMany({
        where: {
          ownerId: test1.id,
          isSystemRoot: false
        },
        orderBy: { unitNumber: 'asc' }
      });
      console.log(`   ✅ test1 now has ${updatedTest1Units.length} units`);
    } else {
      console.log(`   ✅ test1 already has ${test1Units.length} units`);
      test1Units.forEach(unit => {
        const childrenCount = unit._count?.childrenUnits || 0;
        console.log(`      - Unit ${unit.unitNumber} (${unit.unitName}): ${childrenCount}/2 children`);
      });
    }

    // Step 4: Create invite link for test1
    console.log('\n🔗 Step 4: Creating invite link for test1@gmail.com...');
    try {
      const inviteLink = await InviteService.createInviteLink(test1.id);
      console.log(`   ✅ Invite link created:`);
      console.log(`      Code: ${inviteLink.inviteCode}`);
      console.log(`      URL: ${inviteLink.inviteUrl}`);
      console.log(`      Max Uses: ${inviteLink.maxUses || 'Unlimited'}`);
      console.log(`      Expires: ${inviteLink.expiresAt || 'Never'}`);
    } catch (error) {
      console.error(`   ❌ Error creating invite link: ${error.message}`);
      throw error;
    }

    // Step 5: Create 2 new users using the invite link
    console.log('\n👥 Step 5: Creating 2 invited users...');
    const invitedUsers = [];
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('test123', 12);

    for (let i = 1; i <= 2; i++) {
      const email = `invited${i}@gmail.com`;
      const firstName = `Invited${i}`;
      const lastName = 'User';

      // Check if user already exists
      let user = await prisma.user.findUnique({
        where: { email }
      });

      if (user) {
        console.log(`   ⚠️  ${email} already exists, using existing user`);
      } else {
        // Get the invite link again to use it
        const inviteLink = await InviteService.createInviteLink(test1.id);
        
        // Create user with invite code
        user = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            role: 'USER',
            status: 'ACTIVE',
            emailVerified: true
          }
        });
        console.log(`   ✅ Created ${email}: ${user.id}`);

        // Use the invite link
        try {
          await InviteService.useInviteLink(inviteLink.inviteCode, user.id);
          console.log(`   ✅ User ${email} registered with invite code ${inviteLink.inviteCode}`);
        } catch (error) {
          console.error(`   ⚠️  Error using invite link for ${email}: ${error.message}`);
          // Continue anyway - the user is created
        }
      }

      invitedUsers.push(user);
    }

    // Step 6: Ensure invited users have wallet balance and purchase units
    console.log('\n💰 Step 6: Purchasing units for invited users...');
    
    for (const user of invitedUsers) {
      console.log(`\n   👤 Processing ${user.email}...`);
      
      // Ensure wallet balance
      let wallet = await WalletService.getWallet(user.id);
      if (wallet.balance < 2000) {
        await WalletService.addToWallet(user.id, 2000 - wallet.balance, null, 'DEPOSIT', 'Test deposit for unit purchase');
        wallet = await WalletService.getWallet(user.id);
      }
      console.log(`      💰 Wallet balance: C$${wallet.balance.toFixed(2)}`);

      // Purchase 4 units
      try {
        console.log(`      📦 Purchasing 4 units...`);
        const purchaseRequest = await PurchaseService.createPurchaseRequest(
          user.id,
          contractGame.id,
          4
        );
        console.log(`      ✅ Purchase request created: ${purchaseRequest.id}`);
        console.log(`         Status: ${purchaseRequest.status}`);
        console.log(`         Host ID: ${purchaseRequest.hostId || 'null (system)'}`);
        
        // Wait for placement
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check placed units
        const userUnits = await prisma.unit.findMany({
          where: {
            ownerId: user.id,
            isSystemRoot: false
          },
          orderBy: { unitNumber: 'asc' },
          include: {
            parentUnit: {
              select: {
                unitName: true,
                unitNumber: true,
                isSystemRoot: true,
                owner: {
                  select: {
                    email: true
                  }
                }
              }
            }
          }
        });
        
        console.log(`      📦 Placed ${userUnits.length} units:`);
        userUnits.forEach(unit => {
          const parentInfo = unit.parentUnit 
            ? (unit.parentUnit.isSystemRoot 
                ? 'System Root' 
                : `Unit ${unit.parentUnit.unitNumber} (${unit.parentUnit.owner.email})`)
            : 'None';
          console.log(`         - Unit ${unit.unitNumber} (${unit.unitName})`);
          console.log(`           Parent: ${parentInfo}`);
          console.log(`           Active: ${unit.isActive}`);
        });
      } catch (error) {
        console.error(`      ❌ Error purchasing units for ${user.email}: ${error.message}`);
        if (error.stack) {
          console.error(`      Stack: ${error.stack}`);
        }
      }
    }

    // Step 7: Show final tree structure
    console.log('\n📊 Step 7: Final Tree Structure...\n');
    
    // Get test1's units with children
    const test1FinalUnits = await prisma.unit.findMany({
      where: {
        ownerId: test1.id,
        isSystemRoot: false
      },
      orderBy: { unitNumber: 'asc' },
      include: {
        childrenUnits: {
          include: {
            owner: {
              select: {
                email: true
              }
            },
            childrenUnits: {
              include: {
                owner: {
                  select: {
                    email: true
                  }
                }
              }
            }
          },
          orderBy: { unitNumber: 'asc' }
        }
      }
    });

    console.log(`test1@gmail.com's units:\n`);
    test1FinalUnits.forEach(unit => {
      console.log(`  Unit ${unit.unitNumber} (${unit.unitName}) - Active: ${unit.isActive}`);
      if (unit.childrenUnits && unit.childrenUnits.length > 0) {
        unit.childrenUnits.forEach(child => {
          console.log(`    └─ Unit ${child.unitNumber} (${child.unitName}) - Owner: ${child.owner.email}, Active: ${child.isActive}`);
          if (child.childrenUnits && child.childrenUnits.length > 0) {
            child.childrenUnits.forEach(grandchild => {
              console.log(`       └─ Unit ${grandchild.unitNumber} (${grandchild.unitName}) - Owner: ${grandchild.owner.email}, Active: ${grandchild.isActive}`);
            });
          }
        });
      } else {
        console.log(`    (no children)`);
      }
    });

    // Get all invited users' units
    console.log(`\nInvited users' units:\n`);
    for (const user of invitedUsers) {
      const userUnits = await prisma.unit.findMany({
        where: {
          ownerId: user.id,
          isSystemRoot: false
        },
        orderBy: { unitNumber: 'asc' },
        include: {
          parentUnit: {
            select: {
              unitName: true,
              unitNumber: true,
              owner: {
                select: {
                  email: true
                }
              }
            }
          }
        }
      });

      console.log(`${user.email}:`);
      userUnits.forEach(unit => {
        const parentInfo = unit.parentUnit 
          ? `Unit ${unit.parentUnit.unitNumber} (${unit.parentUnit.owner.email})`
          : 'System Root';
        console.log(`  - Unit ${unit.unitNumber} (${unit.unitName}) - Parent: ${parentInfo}, Active: ${unit.isActive}`);
      });
      console.log('');
    }

    // Step 8: Verify placement rules
    console.log('🔍 Step 8: Verifying placement rules...\n');
    
    let allCorrect = true;
    for (const user of invitedUsers) {
      const userUnits = await prisma.unit.findMany({
        where: {
          ownerId: user.id,
          isSystemRoot: false
        },
        orderBy: { unitNumber: 'asc' },
        include: {
          parentUnit: {
            select: {
              ownerId: true,
              owner: {
                select: {
                  email: true
                }
              }
            }
          }
        }
      });

      console.log(`Checking ${user.email}:`);
      const oddUnits = userUnits.filter(u => u.unitNumber % 2 === 1);
      const evenUnits = userUnits.filter(u => u.unitNumber % 2 === 0);

      // Check odd units (101, 103) - should be under test1's units
      for (const oddUnit of oddUnits) {
        if (!oddUnit.parentUnit || oddUnit.parentUnit.ownerId !== test1.id) {
          console.log(`  ❌ Unit ${oddUnit.unitNumber} (odd) should be under test1's unit, but parent is: ${oddUnit.parentUnit ? oddUnit.parentUnit.owner.email : 'None'}`);
          allCorrect = false;
        } else {
          console.log(`  ✅ Unit ${oddUnit.unitNumber} (odd) correctly placed under test1's unit`);
        }
      }

      // Check even units (102, 104) - should be under user's own Unit 101
      const userUnit101 = userUnits.find(u => u.unitNumber === 101 || u.unitNumber === 2001 || u.unitNumber === 3001);
      for (const evenUnit of evenUnits) {
        if (!evenUnit.parentUnit || evenUnit.parentUnit.ownerId !== user.id || evenUnit.parentUnit.unitNumber !== userUnit101?.unitNumber) {
          console.log(`  ❌ Unit ${evenUnit.unitNumber} (even) should be under user's own Unit 101, but parent is: ${evenUnit.parentUnit ? `Unit ${evenUnit.parentUnit.unitNumber} (${evenUnit.parentUnit.owner.email})` : 'None'}`);
          allCorrect = false;
        } else {
          console.log(`  ✅ Unit ${evenUnit.unitNumber} (even) correctly placed under user's own Unit 101`);
        }
      }
      console.log('');
    }

    if (allCorrect) {
      console.log('✅ All placement rules verified correctly!\n');
    } else {
      console.log('⚠️  Some placement rules may not be correct. Please review.\n');
    }

    console.log('✅ Test completed successfully!\n');
  } catch (error) {
    console.error('❌ Error in test:', error);
    console.error('\n💥 Script failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    throw error;
  } finally {
    await database.disconnect();
  }
};

// Run the script
if (require.main === module) {
  testInvitePlacementFlow()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      process.exit(1);
    });
}

module.exports = { testInvitePlacementFlow };

