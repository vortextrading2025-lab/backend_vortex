require('dotenv').config();
const database = require('../../config/database');
const PurchaseService = require('../../services/purchaseService');
const InviteService = require('../../modules/contract/inviteService');
const FulfillmentService = require('../../services/fulfillmentService');
const WalletService = require('../../modules/wallet/walletService');

/**
 * Test: Invite 6 users, make them buy 4 units each, fill tree for fulfillment, and process payouts
 */
async function testInviteAndFulfillment() {
  try {
    console.log('🧪 Test: Invite Users, Purchase Units, and Fulfillment\n');

    // Step 1: Find or create host user (user996)
    let hostUser = await database.getClient().user.findFirst({
      where: { email: 'user996@gmail.com' }
    });

    if (!hostUser) {
      console.log('❌ Host user user996@gmail.com not found');
      return;
    }

    console.log(`✅ Found host user: ${hostUser.email} (${hostUser.id})\n`);

    // Ensure host has units (101-104)
    const hostUnits = await database.getClient().unit.findMany({
      where: {
        ownerId: hostUser.id,
        isSystemRoot: false
      },
      orderBy: { unitNumber: 'asc' }
    });

    if (hostUnits.length < 4) {
      console.log('⚠️  Host user needs at least 4 units. Creating purchase...');
      const contractGame = await database.getClient().contractGame.findFirst({
        where: { status: 'ACTIVE' }
      });

      if (contractGame) {
        // Ensure wallet has balance
        let wallet = await database.getClient().wallet.findUnique({
          where: { userId: hostUser.id }
        });
        if (!wallet) {
          wallet = await database.getClient().wallet.create({
            data: { userId: hostUser.id, balance: 0, totalEarned: 0 }
          });
        }
        await database.getClient().wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: 2000 } }
        });

        const purchaseRequest = await PurchaseService.createPurchaseRequest(
          hostUser.id,
          contractGame.id,
          4,
          null
        );
        await PurchaseService.processPlacement(purchaseRequest.id);
        console.log('✅ Host user units created\n');
      }
    }

    // Step 2: Find active contract game
    const contractGame = await database.getClient().contractGame.findFirst({
      where: { status: 'ACTIVE' }
    });

    if (!contractGame) {
      console.log('❌ No active contract game found');
      return;
    }

    console.log(`✅ Found contract game: ${contractGame.name}\n`);

    // Step 3: Create 6 invited users and invite links
    console.log('👥 Step 1: Creating 6 invited users...\n');

    const invitedUsers = [];
    for (let i = 1; i <= 6; i++) {
      const email = `invited${i}@test.com`;
      const firstName = `Invited${i}`;
      const lastName = 'User';

      // Check if user already exists
      let user = await database.getClient().user.findFirst({
        where: { email }
      });

      if (!user) {
        // Create user
        try {
          user = await database.getClient().user.create({
            data: {
              email,
              username: `invited${i}_${Date.now()}`, // Make username unique
              firstName,
              lastName,
              password: '$2b$10$dummy', // Dummy password
              role: 'USER',
              emailVerified: true
            }
          });
          console.log(`   ✅ Created user: ${email} (${user.id})`);
        } catch (error) {
          // User might have been created between check and create
          user = await database.getClient().user.findFirst({
            where: { email }
          });
          if (user) {
            console.log(`   ℹ️  User already exists: ${email}`);
          } else {
            throw error;
          }
        }
      } else {
        console.log(`   ℹ️  User already exists: ${email}`);
      }

      // Create wallet
      let wallet = await database.getClient().wallet.findUnique({
        where: { userId: user.id }
      });
      if (!wallet) {
        wallet = await database.getClient().wallet.create({
          data: { userId: user.id, balance: 0, totalEarned: 0 }
        });
      }

      // Create invite link directly (linking inviter to invited user)
      const existingLink = await database.getClient().inviteLink.findFirst({
        where: {
          inviterId: hostUser.id,
          invitedUserId: user.id
        }
      });

      if (existingLink) {
        console.log(`   ℹ️  Invite link already exists for ${email}: ${existingLink.inviteCode}`);
      } else {
        try {
          const crypto = require('crypto');
          let inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
          
          // Ensure code is unique
          let codeExists = await database.getClient().inviteLink.findUnique({
            where: { inviteCode }
          });
          let attempts = 0;
          while (codeExists && attempts < 10) {
            inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
            codeExists = await database.getClient().inviteLink.findUnique({
              where: { inviteCode }
            });
            attempts++;
          }

          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
          const inviteUrl = `${frontendUrl}/register?invite=${inviteCode}`;

          const inviteLink = await database.getClient().inviteLink.create({
            data: {
              inviterId: hostUser.id,
              invitedUserId: user.id,
              inviteCode,
              inviteUrl,
              isActive: true,
              currentUses: 0
            }
          });
          console.log(`   ✅ Created invite link for ${email}: ${inviteCode}`);
        } catch (error) {
          console.log(`   ⚠️  Could not create invite link: ${error.message}`);
        }
      }

      invitedUsers.push(user);
    }

    console.log(`\n✅ Created ${invitedUsers.length} invited users\n`);

    // Step 4: Make each invited user buy 4 units
    console.log('🛒 Step 2: Making each user buy 4 units...\n');

    for (let i = 0; i < invitedUsers.length; i++) {
      const user = invitedUsers[i];
      console.log(`📦 User ${i + 1}/${invitedUsers.length}: ${user.email}`);

      // Get invite link to get hostId (try to find any invite link for this user)
      let inviteLink = await database.getClient().inviteLink.findFirst({
        where: {
          inviterId: hostUser.id,
          invitedUserId: user.id
        }
      });

      // If no direct link, try to find any invite link where this user is the invited user
      if (!inviteLink) {
        inviteLink = await database.getClient().inviteLink.findFirst({
          where: {
            invitedUserId: user.id
          }
        });
      }

      if (!inviteLink) {
        console.log(`   ⚠️  No invite link found for ${user.email}, creating one...`);
        // Create invite link on the fly
        const crypto = require('crypto');
        let inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
        let codeExists = await database.getClient().inviteLink.findUnique({
          where: { inviteCode }
        });
        let attempts = 0;
        while (codeExists && attempts < 10) {
          inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
          codeExists = await database.getClient().inviteLink.findUnique({
            where: { inviteCode }
          });
          attempts++;
        }
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        const inviteUrl = `${frontendUrl}/register?invite=${inviteCode}`;
        inviteLink = await database.getClient().inviteLink.create({
          data: {
            inviterId: hostUser.id,
            invitedUserId: user.id,
            inviteCode,
            inviteUrl,
            isActive: true,
            currentUses: 0
          }
        });
        console.log(`   ✅ Created invite link: ${inviteCode}`);
      }

      // Ensure wallet has balance
      const wallet = await database.getClient().wallet.findUnique({
        where: { userId: user.id }
      });
      await database.getClient().wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: 2000 } } // 4 units * 500
      });

      // Create purchase request with invite code
      try {
        const purchaseRequest = await PurchaseService.createPurchaseRequest(
          user.id,
          contractGame.id,
          4, // 4 units
          inviteLink.inviteCode // Use invite code
        );

        console.log(`   ✅ Purchase request created: ${purchaseRequest.id}`);

        // Process placement
        await PurchaseService.processPlacement(purchaseRequest.id);
        console.log(`   ✅ Units placed for ${user.email}\n`);
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
      }

      // Small delay between purchases
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Step 5: Fill tree to trigger fulfillment
    console.log('🌳 Step 3: Filling tree to trigger fulfillment...\n');

    // Get host's first unit (101)
    const hostFirstUnit = await database.getClient().unit.findFirst({
      where: {
        ownerId: hostUser.id,
        unitNumber: 101,
        isSystemRoot: false
      }
    });

    if (!hostFirstUnit) {
      console.log('❌ Host first unit (101) not found');
      return;
    }

    console.log(`✅ Found host first unit: ${hostFirstUnit.unitName} (${hostFirstUnit.id})\n`);

    // Calculate how many units needed to fill to level 4 (for Stage 1 fulfillment)
    // Stage 1 requires: Level 1, 2, 3 complete + 4 units in Level 4
    // That's: 1 + 2 + 4 + 8 = 15 units total in levels 1-4
    // But we need to check current state

    const unitsUnder101 = await database.getClient().unit.findMany({
      where: {
        OR: [
          { parentUnitId: hostFirstUnit.id },
          { parentUnit: { parentUnitId: hostFirstUnit.id } },
          { parentUnit: { parentUnit: { parentUnitId: hostFirstUnit.id } } },
          { parentUnit: { parentUnit: { parentUnit: { parentUnitId: hostFirstUnit.id } } } }
        ]
      },
      include: {
        parentUnit: {
          select: { id: true, unitNumber: true, level: true }
        }
      }
    });

    console.log(`📊 Current units under 101: ${unitsUnder101.length}`);
    
    // Group by level
    const unitsByLevel = {};
    unitsUnder101.forEach(unit => {
      const level = unit.level - hostFirstUnit.level;
      if (!unitsByLevel[level]) unitsByLevel[level] = [];
      unitsByLevel[level].push(unit);
    });

    Object.keys(unitsByLevel).sort((a, b) => a - b).forEach(level => {
      console.log(`   Level ${level}: ${unitsByLevel[level].length} units`);
    });

    // Check which units are ready for fulfillment
    console.log('\n💰 Step 4: Checking units ready for fulfillment...\n');

    const allHostUnits = await database.getClient().unit.findMany({
      where: {
        ownerId: hostUser.id,
        isSystemRoot: false,
        stage: 1
      },
      include: {
        parentUnit: {
          select: { id: true, unitNumber: true }
        }
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`📊 Host has ${allHostUnits.length} units in Stage 1\n`);

    for (const unit of allHostUnits) {
      // Check if unit is in cooldown
      const now = new Date();
      const cooldownEndsAt = unit.cooldownEndsAt ? new Date(unit.cooldownEndsAt) : null;
      const isInCooldown = cooldownEndsAt && cooldownEndsAt > now;

      if (isInCooldown) {
        const daysRemaining = Math.ceil((cooldownEndsAt - now) / (1000 * 60 * 60 * 24));
        console.log(`   Unit ${unit.unitNumber}: ⏱️  In cooldown (${daysRemaining} days remaining)`);
        
        // For testing: Set cooldown to past date to allow fulfillment
        if (daysRemaining > 0) {
          console.log(`      🔧 Setting cooldown to past date for testing...`);
          await database.getClient().unit.update({
            where: { id: unit.id },
            data: {
              cooldownEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
            }
          });
          console.log(`      ✅ Cooldown bypassed for testing`);
        }
      }

      // Check if unit is ready for fulfillment
      try {
        const isReady = await FulfillmentService.checkFulfillment(unit.id);
        
        if (isReady) {
          console.log(`   Unit ${unit.unitNumber}: ✅ Ready for fulfillment`);
          
          // Get wallet before fulfillment
          const walletBefore = await WalletService.getWallet(hostUser.id);
          const balanceBefore = walletBefore.balance;

          // Fulfill the unit
          try {
            const result = await FulfillmentService.fulfillUnit(unit.id);
            console.log(`      💰 Payout: $${result.payoutAmount}`);
            console.log(`      📊 Next stage advance: $${result.nextStageAdvancePayment || 0}`);
            console.log(`      💵 Remaining balance: $${result.remainingBalance || 0}`);

            // Get wallet after fulfillment
            const walletAfter = await WalletService.getWallet(hostUser.id);
            const balanceAfter = walletAfter.balance;
            console.log(`      💼 Wallet: $${balanceBefore} → $${balanceAfter} (+$${balanceAfter - balanceBefore})`);
          } catch (fulfillError) {
            console.log(`      ❌ Fulfillment error: ${fulfillError.message}`);
          }
        } else {
          console.log(`   Unit ${unit.unitNumber}: ⏳ Not ready yet`);
        }
      } catch (error) {
        console.log(`   Unit ${unit.unitNumber}: ❌ Error checking: ${error.message}`);
      }
    }

    // Step 6: Summary
    console.log('\n📊 Final Summary:\n');

    const finalUnits = await database.getClient().unit.findMany({
      where: {
        ownerId: hostUser.id,
        isSystemRoot: false
      },
      include: {
        parentUnit: {
          select: { unitNumber: true }
        }
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`✅ Host units: ${finalUnits.length}`);
    finalUnits.forEach(unit => {
      const parentInfo = unit.parentUnit ? `under ${unit.parentUnit.unitNumber}` : 'root';
      const status = unit.isActive ? 'ACTIVE' : unit.isCompleted ? 'COMPLETED' : 'PENDING';
      console.log(`   Unit ${unit.unitNumber}: ${parentInfo} (${status})`);
    });

    // Count invited users' units
    let totalInvitedUnits = 0;
    for (const user of invitedUsers) {
      const userUnits = await database.getClient().unit.count({
        where: {
          ownerId: user.id,
          isSystemRoot: false
        }
      });
      totalInvitedUnits += userUnits;
      console.log(`   ${user.email}: ${userUnits} units`);
    }

    console.log(`\n✅ Total invited users' units: ${totalInvitedUnits}`);

    // Final wallet balance
    const finalWallet = await WalletService.getWallet(hostUser.id);
    console.log(`\n💰 Host wallet balance: $${finalWallet.balance}`);
    console.log(`💰 Host total earned: $${finalWallet.totalEarned}`);

    console.log('\n✅ Test completed!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await database.disconnect();
  }
}

testInviteAndFulfillment()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

