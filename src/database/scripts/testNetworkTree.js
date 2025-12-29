#!/usr/bin/env node

/**
 * Test Network Tree Structure
 * - Creates test users and builds a network tree
 * - Root user invites users, and each of those invites more users
 * - Tests the complete downstream network structure
 * 
 * Usage: node src/database/scripts/testNetworkTree.js
 */

require('dotenv').config();
const database = require('../../config/database');
const bcrypt = require('bcryptjs');
const InviteService = require('../../modules/contract/inviteService');
const PurchaseService = require('../../services/purchaseService');
const WalletService = require('../../modules/wallet/walletService');

const testNetworkTree = async () => {
  try {
    console.log('🔄 Starting: Test Network Tree Structure\n');
    console.log('='.repeat(70));
    
    await database.connect();
    const prisma = database.getClient();

    // Step 1: Get or create root test user
    console.log('\n👤 Step 1: Getting root test user (test1@gmail.com)...');
    let rootUser = await prisma.user.findUnique({
      where: { email: 'test1@gmail.com' }
    });

    if (!rootUser) {
      const hashedPassword = await bcrypt.hash('12345678', 12);
      rootUser = await prisma.user.create({
        data: {
          email: 'test1@gmail.com',
          password: hashedPassword,
          firstName: 'Test',
          lastName: 'Root',
          username: 'test1',
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: true
        }
      });
      console.log(`   ✅ Created root user: ${rootUser.id}`);
    } else {
      console.log(`   ✅ Found root user: ${rootUser.id}`);
    }

    // Ensure root user has wallet and units
    let rootWallet = await prisma.wallet.findUnique({
      where: { userId: rootUser.id }
    });
    if (!rootWallet) {
      await prisma.wallet.create({
        data: {
          userId: rootUser.id,
          balance: 100000,
          totalEarned: 0,
          totalWithdrawn: 0
        }
      });
    } else {
      // Ensure sufficient balance
      await prisma.wallet.update({
        where: { userId: rootUser.id },
        data: { balance: { increment: 100000 } }
      });
    }

    // Check if root user has units with available space, if not buy more
    const rootUnits = await prisma.unit.findMany({
      where: {
        ownerId: rootUser.id,
        isSystemRoot: false
      }
    });

    // Check if we have odd units with available space
    const oddUnitsWithSpace = [];
    for (const unit of rootUnits) {
      const unitNum = unit.unitNumber || 0;
      if (unitNum % 2 === 1) {
        const childrenCount = await prisma.unit.count({
          where: {
            parentUnitId: unit.id
          }
        });
        if (childrenCount < 2) {
          oddUnitsWithSpace.push(unit);
        }
      }
    }

    if (oddUnitsWithSpace.length === 0) {
      console.log('   📦 Root user needs more units with space, buying 4 more units...');
      const contractGame = await prisma.contractGame.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' }
      });
      if (contractGame) {
        try {
          await PurchaseService.createPurchaseRequest(rootUser.id, contractGame.id, 4);
          console.log('   ✅ Bought 4 more units for root user');
          // Wait for units to be placed
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
          console.log(`   ⚠️  Error buying units: ${error.message}`);
        }
      }
    } else {
      console.log(`   ✅ Root user has ${oddUnitsWithSpace.length} odd units with available space`);
    }

    // Step 2: Create Level 1 users (invited by root)
    console.log('\n👥 Step 2: Creating Level 1 users (invited by root)...');
    const level1Users = [];
    const level1Count = 3; // Create 3 users at level 1

    for (let i = 1; i <= level1Count; i++) {
      const email = `level1_user${i}@test.com`;
      const username = `level1_user${i}`;
      
      // Delete if exists
      await prisma.user.deleteMany({ where: { email } });
      
      const hashedPassword = await bcrypt.hash('12345678', 12);
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName: `Level1`,
          lastName: `User${i}`,
          username,
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: true
        }
      });

      // Create wallet
      await prisma.wallet.create({
        data: {
          userId: user.id,
          balance: 100000,
          totalEarned: 0,
          totalWithdrawn: 0
        }
      });

      // Create invite link for root and use it
      try {
        const inviteLink = await InviteService.createInviteLink(rootUser.id);
        await InviteService.useInviteLink(inviteLink.inviteCode, user.id);
        console.log(`   ✅ Created Level 1 user ${i}: ${email} (invited by root)`);
        
        // Buy units for Level 1 user so they can invite others
        const contractGame = await prisma.contractGame.findFirst({
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' }
        });
        if (contractGame) {
          try {
            await PurchaseService.createPurchaseRequest(user.id, contractGame.id, 4);
            console.log(`   ✅ Bought 4 units for Level 1 user ${i}`);
            // Wait for units to be placed
            await new Promise(resolve => setTimeout(resolve, 5000));
          } catch (error) {
            console.log(`   ⚠️  Error buying units for Level 1 user ${i}: ${error.message}`);
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Created Level 1 user ${i} but invite error: ${error.message}`);
      }

      level1Users.push(user);
    }

    // Step 3: Create Level 2 users (invited by Level 1 users)
    console.log('\n👥 Step 3: Creating Level 2 users (invited by Level 1 users)...');
    const level2Users = [];
    const level2CountPerUser = 2; // Each Level 1 user invites 2 users

    for (let i = 0; i < level1Users.length; i++) {
      const level1User = level1Users[i];
      
      for (let j = 1; j <= level2CountPerUser; j++) {
        const email = `level2_user${i + 1}_${j}@test.com`;
        const username = `level2_user${i + 1}_${j}`;
        
        // Delete if exists
        await prisma.user.deleteMany({ where: { email } });
        
        const hashedPassword = await bcrypt.hash('12345678', 12);
        const user = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            firstName: `Level2`,
            lastName: `User${i + 1}_${j}`,
            username,
            role: 'USER',
            status: 'ACTIVE',
            emailVerified: true
          }
        });

        // Create wallet
        await prisma.wallet.create({
          data: {
            userId: user.id,
            balance: 100000,
            totalEarned: 0,
            totalWithdrawn: 0
          }
        });

        // Create invite link for Level 1 user and use it
        try {
          const inviteLink = await InviteService.createInviteLink(level1User.id);
          await InviteService.useInviteLink(inviteLink.inviteCode, user.id);
          console.log(`   ✅ Created Level 2 user: ${email} (invited by Level 1 user ${i + 1})`);
          
          // Buy units for Level 2 user so they can invite others
          const contractGame = await prisma.contractGame.findFirst({
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' }
          });
          if (contractGame) {
            try {
              await PurchaseService.createPurchaseRequest(user.id, contractGame.id, 4);
              console.log(`   ✅ Bought 4 units for Level 2 user`);
              // Wait for units to be placed
              await new Promise(resolve => setTimeout(resolve, 5000));
            } catch (error) {
              console.log(`   ⚠️  Error buying units for Level 2 user: ${error.message}`);
            }
          }
        } catch (error) {
          console.log(`   ⚠️  Created Level 2 user but invite error: ${error.message}`);
        }

        level2Users.push({ user, level1Index: i });
      }
    }

    // Step 4: Create Level 3 users (invited by Level 2 users)
    console.log('\n👥 Step 4: Creating Level 3 users (invited by Level 2 users)...');
    const level3Users = [];
    const level3CountPerUser = 1; // Each Level 2 user invites 1 user

    for (let i = 0; i < level2Users.length; i++) {
      const level2User = level2Users[i].user;
      
      for (let j = 1; j <= level3CountPerUser; j++) {
        const email = `level3_user${i + 1}_${j}@test.com`;
        const username = `level3_user${i + 1}_${j}`;
        
        // Delete if exists
        await prisma.user.deleteMany({ where: { email } });
        
        const hashedPassword = await bcrypt.hash('12345678', 12);
        const user = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            firstName: `Level3`,
            lastName: `User${i + 1}_${j}`,
            username,
            role: 'USER',
            status: 'ACTIVE',
            emailVerified: true
          }
        });

        // Create wallet
        await prisma.wallet.create({
          data: {
            userId: user.id,
            balance: 100000,
            totalEarned: 0,
            totalWithdrawn: 0
          }
        });

        // Create invite link for Level 2 user and use it
        try {
          const inviteLink = await InviteService.createInviteLink(level2User.id);
          await InviteService.useInviteLink(inviteLink.inviteCode, user.id);
          console.log(`   ✅ Created Level 3 user: ${email} (invited by Level 2 user ${i + 1})`);
          
          // Buy units for Level 3 user (optional, for further expansion)
          const contractGame = await prisma.contractGame.findFirst({
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' }
          });
          if (contractGame) {
            try {
              await PurchaseService.createPurchaseRequest(user.id, contractGame.id, 4);
              console.log(`   ✅ Bought 4 units for Level 3 user`);
              // Wait for units to be placed
              await new Promise(resolve => setTimeout(resolve, 5000));
            } catch (error) {
              console.log(`   ⚠️  Error buying units for Level 3 user: ${error.message}`);
            }
          }
        } catch (error) {
          console.log(`   ⚠️  Created Level 3 user but invite error: ${error.message}`);
        }

        level3Users.push({ user, level2Index: i });
      }
    }

    // Step 5: Summary
    console.log('\n📊 Step 5: Network Tree Summary...');
    console.log(`\n   Network Structure:`);
    console.log(`   └─ Root: test1@gmail.com`);
    console.log(`      ├─ Level 1: ${level1Users.length} users`);
    console.log(`      │  ├─ Each Level 1 user invited: ${level2CountPerUser} users`);
    console.log(`      │  └─ Level 2: ${level2Users.length} total users`);
    console.log(`      │     ├─ Each Level 2 user invited: ${level3CountPerUser} users`);
    console.log(`      │     └─ Level 3: ${level3Users.length} total users`);
    console.log(`\n   Total Network Users: ${level1Users.length + level2Users.length + level3Users.length}`);

    // Verify the network structure
    console.log('\n🔍 Step 6: Verifying network structure...');
    
    // Get root's direct invites
    const rootInvites = await prisma.inviteLink.findMany({
      where: {
        inviterId: rootUser.id,
        invitedUserId: { not: null }
      },
      include: {
        invitedUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    console.log(`\n   Root user (test1@gmail.com) invited ${rootInvites.length} users:`);
    for (const invite of rootInvites) {
      const invitedUser = invite.invitedUser;
      
      // Get users invited by this Level 1 user
      const level1Invites = await prisma.inviteLink.findMany({
        where: {
          inviterId: invitedUser.id,
          invitedUserId: { not: null }
        },
        include: {
          invitedUser: {
            select: {
              email: true
            }
          }
        }
      });

      console.log(`   - ${invitedUser.email} (invited ${level1Invites.length} users)`);
      
      for (const level1Invite of level1Invites) {
        // Get users invited by this Level 2 user
        const level2Invites = await prisma.inviteLink.findMany({
          where: {
            inviterId: level1Invite.invitedUser.id,
            invitedUserId: { not: null }
          }
        });
        
        console.log(`     └─ ${level1Invite.invitedUser.email} (invited ${level2Invites.length} users)`);
        
        for (const level2Invite of level2Invites) {
          const level2User = await prisma.user.findUnique({
            where: { id: level2Invite.invitedUserId },
            select: { email: true }
          });
          console.log(`        └─ ${level2User?.email || 'Unknown'}`);
        }
      }
    }

    console.log('\n✅ Network tree test completed successfully!');
    console.log(`\n   You can now check the network in the profile page:`);
    console.log(`   - Root: test1@gmail.com`);
    console.log(`   - Should see ${level1Users.length} Level 1 users`);
    console.log(`   - Each Level 1 user should show ${level2CountPerUser} Level 2 users`);
    console.log(`   - Each Level 2 user should show ${level3CountPerUser} Level 3 users`);
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
  testNetworkTree()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { testNetworkTree };

