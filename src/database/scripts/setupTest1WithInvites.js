#!/usr/bin/env node

/**
 * Setup Test1 with Invites
 * - Deletes all user units (keeps system roots)
 * - Buys 4 units for test1@gmail.com
 * - Creates invite links for test1
 * - Registers invited users and buys units for them
 * 
 * Usage: node src/database/scripts/setupTest1WithInvites.js
 */

require('dotenv').config();
const database = require('../../config/database');
const bcrypt = require('bcryptjs');
const InviteService = require('../../modules/contract/inviteService');
const PurchaseService = require('../../services/purchaseService');
const WalletService = require('../../modules/wallet/walletService');

const setupTest1WithInvites = async () => {
  try {
    console.log('🔄 Starting: Setup Test1 with Invites\n');
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
      // Add balance if needed
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
    try {
      const purchaseRequest = await PurchaseService.createPurchaseRequest(
        test1.id,
        contractGame.id,
        4
      );
      console.log(`   ✅ Purchase request created: ${purchaseRequest.id}`);
      console.log(`   ✅ Status: ${purchaseRequest.status}`);
      console.log(`   ✅ Units will be placed automatically`);
    } catch (error) {
      console.error(`   ❌ Error buying units: ${error.message}`);
      throw error;
    }

    // Step 6: Create invite links for test1
    console.log('\n🔗 Step 6: Creating invite links for test1...');
    const inviteLinks = [];
    for (let i = 1; i <= 3; i++) {
      try {
        const inviteLink = await InviteService.createInviteLink(test1.id);
        inviteLinks.push(inviteLink);
        console.log(`   ✅ Invite link ${i} created: ${inviteLink.inviteCode}`);
        console.log(`      URL: ${inviteLink.inviteUrl}`);
      } catch (error) {
        console.error(`   ❌ Error creating invite link ${i}: ${error.message}`);
      }
    }

    // Step 7: Register invited users and buy units for them
    console.log('\n👥 Step 7: Registering invited users and buying units...');
    const invitedUsers = [];
    const hashedPassword = await bcrypt.hash('12345678', 12);

    for (let i = 1; i <= 3; i++) {
      const email = `invited${i}@gmail.com`;
      const firstName = `Invited${i}`;
      const lastName = 'User';
      
      console.log(`\n   📧 Processing ${email}...`);

      // Check if user already exists
      let user = await prisma.user.findUnique({
        where: { email }
      });

      if (user) {
        console.log(`   ⚠️  ${email} already exists, using existing user`);
      } else {
        // Create user
        user = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            username: `invited${i}`,
            role: 'USER',
            status: 'ACTIVE',
            emailVerified: true
          }
        });
        console.log(`   ✅ Created user: ${email} (${user.id})`);
      }

      // Use invite link (link user to inviter)
      if (inviteLinks[i - 1]) {
        try {
          await InviteService.useInviteLink(inviteLinks[i - 1].inviteCode, user.id);
          console.log(`   ✅ User ${email} linked to invite code ${inviteLinks[i - 1].inviteCode}`);
        } catch (error) {
          console.error(`   ⚠️  Error using invite link: ${error.message}`);
          // Continue anyway
        }
      }

      // Ensure user has wallet with balance
      let userWallet = await prisma.wallet.findUnique({
        where: { userId: user.id }
      });

      if (!userWallet) {
        userWallet = await prisma.wallet.create({
          data: {
            userId: user.id,
            balance: 10000,
            totalEarned: 0,
            totalWithdrawn: 0
          }
        });
        console.log(`   ✅ Created wallet for ${email} with balance: 10000`);
      } else {
        await prisma.wallet.update({
          where: { userId: user.id },
          data: {
            balance: { increment: 10000 }
          }
        });
        console.log(`   ✅ Updated wallet balance for ${email}`);
      }

      // Buy 4 units for invited user (will be placed under test1's units)
      try {
        console.log(`   🛒 Buying 4 units for ${email}...`);
        const userPurchaseRequest = await PurchaseService.createPurchaseRequest(
          user.id,
          contractGame.id,
          4
        );
        console.log(`   ✅ Purchase request created for ${email}: ${userPurchaseRequest.id}`);
        console.log(`   ✅ Status: ${userPurchaseRequest.status}`);
        console.log(`   ✅ Units will be placed under test1's units (since test1 invited them)`);
      } catch (error) {
        console.error(`   ❌ Error buying units for ${email}: ${error.message}`);
      }

      invitedUsers.push(user);
    }

    console.log('\n✅ Successfully completed setup!');
    console.log(`   - test1@gmail.com: ${test1.id}`);
    console.log(`   - Purchased 4 units for test1`);
    console.log(`   - Created ${inviteLinks.length} invite links`);
    console.log(`   - Registered ${invitedUsers.length} invited users`);
    console.log(`   - Purchased 4 units for each invited user`);

    console.log('\n✨ Script completed successfully!\n');
  } catch (error) {
    console.error('❌ Error in setup:', error);
    console.error('\n💥 Script failed:', error.message);
    throw error;
  } finally {
    await database.disconnect();
  }
};

// Run the script
if (require.main === module) {
  setupTest1WithInvites()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      process.exit(1);
    });
}

module.exports = { setupTest1WithInvites };

