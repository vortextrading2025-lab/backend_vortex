#!/usr/bin/env node

/**
 * Fill test1_101 subtree to Level 8
 * - Invite 3 users under test1
 * - Each user buys 4 units
 * - Repeat until test1_101's subtree reaches level 8
 * 
 * Usage: node src/database/scripts/fillTest1SubtreeToLevel8.js
 */

require('dotenv').config();
const database = require('../../config/database');
const PurchaseService = require('../../services/purchaseService');
const WalletService = require('../../modules/wallet/walletService');

const fillTest1SubtreeToLevel8 = async () => {
  try {
    console.log('🔄 Starting: Fill test1_101 subtree to Level 8\n');
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

    // Get test1's units separately
    const test1Units = await prisma.unit.findMany({
      where: {
        ownerId: test1.id,
        contractGameId: contractGame.id,
        stage: 1,
        isSystemRoot: false
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`   📦 test1 has ${test1Units.length} units`);

    // Find test1_101
    const test1_101 = test1Units.find(u => u.unitNumber === 101);
    if (!test1_101) {
      console.log('   ❌ test1_101 not found. test1 needs to have unit 101 first.');
      return;
    }
    console.log(`   ✅ Found test1_101: ${test1_101.id} at level ${test1_101.level}`);

    // Helper function to get max depth of a unit's subtree (absolute level)
    const getMaxDepth = async (unitId) => {
      const unit = await prisma.unit.findUnique({
        where: { id: unitId },
        include: {
          childrenUnits: true
        }
      });

      if (!unit || unit.childrenUnits.length === 0) {
        return unit ? unit.level : 0;
      }

      const childDepths = await Promise.all(
        unit.childrenUnits.map(child => getMaxDepth(child.id))
      );

      return Math.max(...childDepths);
    };

    // Helper function to get depth relative to a root unit
    const getRelativeDepth = async (rootUnitId, rootLevel) => {
      const maxDepth = await getMaxDepth(rootUnitId);
      return maxDepth - rootLevel; // Depth relative to root
    };

    // Helper function to create a test user
    const createTestUser = async (email, index) => {
      // Check if user already exists
      let user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            username: `invited${index}`,
            password: '$2a$10$dummy.hash.for.test.users', // Dummy hash
            firstName: 'Invited',
            lastName: `User${index}`,
            role: 'USER',
            status: 'ACTIVE',
            emailVerified: true
          }
        });
        console.log(`   ✅ Created user: ${email}`);
      } else {
        console.log(`   ℹ️  User already exists: ${email}`);
      }

      // Ensure user has a wallet
      try {
        await WalletService.getWallet(user.id);
      } catch (error) {
        console.log(`   ⚠️  Wallet creation issue (may already exist): ${error.message}`);
      }

      return user;
    };

    // Helper function to add funds to wallet
    const addFundsToWallet = async (userId, amount) => {
      const wallet = await WalletService.getWallet(userId);
      await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          userId: userId,
          type: 'DEPOSIT',
          amount: amount,
          status: 'COMPLETED',
          description: 'Test funds for unit purchase'
        }
      });
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: {
            increment: amount
          }
        }
      });
    };

    // Helper function to create invite link and link it to a user
    const createInviteLinkForUser = async (inviterId, invitedUserId) => {
      // Check if invite link already exists for this user
      const existingLink = await prisma.inviteLink.findFirst({
        where: {
          invitedUserId: invitedUserId,
          inviterId: inviterId
        }
      });

      if (existingLink) {
        console.log(`   ℹ️  Invite link already exists for user ${invitedUserId}`);
        return existingLink;
      }

      const crypto = require('crypto');
      
      // Generate unique invite code
      let inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      let existingCodeLink = await prisma.inviteLink.findUnique({
        where: { inviteCode }
      });
      
      let attempts = 0;
      while (existingCodeLink && attempts < 10) {
        inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
        existingCodeLink = await prisma.inviteLink.findUnique({
          where: { inviteCode }
        });
        attempts++;
      }

      if (existingCodeLink) {
        throw new Error('Failed to generate unique invite code');
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const inviteUrl = `${frontendUrl}/register?invite=${inviteCode}`;

      // Create invite link directly with invitedUserId set
      const inviteLink = await prisma.inviteLink.create({
        data: {
          inviterId,
          invitedUserId,
          inviteCode,
          inviteUrl,
          maxUses: null,
          expiresAt: null,
          isActive: true,
          currentUses: 1,
          lastUsedAt: new Date()
        }
      });

      return inviteLink;
    };

    // Helper function to purchase 4 units for a user
    const purchaseUnitsForUser = async (userId, hostId) => {
      // Create invite link and link it to the user (so hostId is set correctly)
      await createInviteLinkForUser(hostId, userId);

      // Add funds (4 units * $500 = $2000, plus extra for fees)
      await addFundsToWallet(userId, 2500);

      // Create purchase request (hostId will be determined from invite link)
      const request = await PurchaseService.createPurchaseRequest(
        userId,
        contractGame.id,
        4 // 4 units
      );

      console.log(`   📝 Created purchase request: ${request.id}`);

      // Approve the request
      await PurchaseService.approvePurchaseRequest(request.id);

      console.log(`   ✅ Purchase request approved`);

      // Process placement
      const result = await PurchaseService.processPlacement(request.id);
      console.log(`   ✅ Units placed: ${result.units.length}`);

      return result.units;
    };

    let round = 1;
    let userIndex = 1;
    const targetRelativeDepth = 8; // 8 levels deep relative to test1_101

    console.log(`\n🎯 Target: Fill test1_101 subtree to ${targetRelativeDepth} levels deep (relative to test1_101)\n`);
    console.log(`   test1_101 is at absolute level ${test1_101.level}`);
    console.log(`   Target absolute level: ${test1_101.level + targetRelativeDepth}\n`);

    while (true) {
      const currentMaxDepth = await getMaxDepth(test1_101.id);
      const currentRelativeDepth = currentMaxDepth - test1_101.level;
      console.log(`\n📊 Round ${round}:`);
      console.log(`   Current max absolute level: ${currentMaxDepth}`);
      console.log(`   Current relative depth: ${currentRelativeDepth} levels`);
      console.log(`   Target relative depth: ${targetRelativeDepth} levels`);

      if (currentRelativeDepth >= targetRelativeDepth) {
        console.log(`\n✅ Target reached! test1_101 subtree is ${currentRelativeDepth} levels deep (absolute level ${currentMaxDepth})`);
        break;
      }

      console.log(`\n👥 Round ${round}: Inviting 3 users and having them buy 4 units each...`);

      // Create 3 users and have them purchase units
      for (let i = 0; i < 3; i++) {
        const email = `invited${userIndex}@test.com`;
        console.log(`\n   👤 User ${i + 1}/3: ${email}`);

        try {
          const user = await createTestUser(email, userIndex);
          const units = await purchaseUnitsForUser(user.id, test1.id);
          console.log(`   ✅ User ${email} purchased ${units.length} units`);
          userIndex++; // Increment for next user
        } catch (error) {
          console.error(`   ❌ Error for user ${email}:`, error.message);
          // Increment index even on error to avoid reusing same email
          userIndex++;
          // Continue with next user
        }
      }

      // Check depth again
      const newMaxDepth = await getMaxDepth(test1_101.id);
      const newRelativeDepth = newMaxDepth - test1_101.level;
      console.log(`\n   📈 New max absolute level: ${newMaxDepth}`);
      console.log(`   📈 New relative depth: ${newRelativeDepth} levels`);

      if (newMaxDepth === currentMaxDepth) {
        console.log(`   ⚠️  Depth didn't increase. May need more users or check placement logic.`);
      }

      round++;

      // Safety limit to prevent infinite loops
      if (round > 50) {
        console.log(`\n⚠️  Reached safety limit of 50 rounds. Stopping.`);
        break;
      }
    }

    // Final summary
    console.log(`\n${'='.repeat(70)}`);
    console.log('📊 Final Summary:');
    const finalMaxDepth = await getMaxDepth(test1_101.id);
    const finalRelativeDepth = finalMaxDepth - test1_101.level;
    console.log(`   test1_101 absolute level: ${test1_101.level}`);
    console.log(`   Max absolute level in subtree: ${finalMaxDepth}`);
    console.log(`   Relative depth: ${finalRelativeDepth} levels`);
    
    // Count total units in subtree
    const countUnitsInSubtree = async (unitId) => {
      const unit = await prisma.unit.findUnique({
        where: { id: unitId },
        include: {
          childrenUnits: true
        }
      });

      if (!unit) return 0;

      let count = 1; // Count self
      for (const child of unit.childrenUnits) {
        count += await countUnitsInSubtree(child.id);
      }

      return count;
    };

    const totalUnits = await countUnitsInSubtree(test1_101.id);
    console.log(`   Total units in test1_101 subtree: ${totalUnits}`);
    console.log(`   Total rounds completed: ${round - 1}`);
    console.log(`   Total users created: ${userIndex - 1}`);

    console.log('\n✅ Test complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
};

if (require.main === module) {
  fillTest1SubtreeToLevel8();
}

module.exports = fillTest1SubtreeToLevel8;

