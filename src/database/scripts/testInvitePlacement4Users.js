require('dotenv').config();
const database = require('../../config/database');
const PurchaseService = require('../../services/purchaseService');

/**
 * Test: From user996, invite 4 users, each buys 4 units, and verify placement.
 * Focus: ensure invited users' 101–104 stay in host subtree (no system root for 103).
 */
async function testInvitePlacement4Users() {
  try {
    console.log('🧪 Test: Invite 4 users from user996 and verify placement\\n');

    const client = database.getClient();

    // 1) Host user
    const hostUser = await client.user.findFirst({ where: { email: 'user996@gmail.com' } });
    if (!hostUser) {
      console.log('❌ Host user user996@gmail.com not found');
      return;
    }
    console.log(`✅ Host: ${hostUser.email} (${hostUser.id})`);

    // 2) Active contract game
    const contractGame = await client.contractGame.findFirst({
      where: { status: 'ACTIVE' }
    });
    if (!contractGame) {
      console.log('❌ No active contract game found');
      return;
    }
    console.log(`✅ Contract game: ${contractGame.name} (${contractGame.id})`);

    // 3) Ensure host has at least 8 units (101–108) – deleteAndTestPlacement already did 16
    const hostUnits = await client.unit.findMany({
      where: { ownerId: hostUser.id, isSystemRoot: false },
      orderBy: { unitNumber: 'asc' }
    });
    console.log(`✅ Host currently has ${hostUnits.length} units (expect ≥ 8)`);

    // 4) Create 4 invited users and invite links from host
    const invitedUsers = [];
    for (let i = 1; i <= 4; i++) {
      const email = `placement_invited${i}@test.com`;

      let user = await client.user.findFirst({ where: { email } });
      if (!user) {
        user = await client.user.create({
          data: {
            email,
            username: `placement_invited${i}_${Date.now()}`,
            firstName: `PlacementInvited${i}`,
            lastName: 'User',
            password: '$2b$10$dummy',
            role: 'USER',
            emailVerified: true
          }
        });
        console.log(`   ✅ Created user: ${email}`);
      } else {
        console.log(`   ℹ️ User already exists: ${email}`);
      }

      // Wallet
      let wallet = await client.wallet.findUnique({ where: { userId: user.id } });
      if (!wallet) {
        wallet = await client.wallet.create({
          data: { userId: user.id, balance: 0, totalEarned: 0 }
        });
      }

      // Invite link: ensure exactly one per (host, invitedUser)
      let inviteLink = await client.inviteLink.findFirst({
        where: {
          inviterId: hostUser.id,
          invitedUserId: user.id
        }
      });

      if (!inviteLink) {
        const crypto = require('crypto');
        let inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
        let existing = await client.inviteLink.findUnique({ where: { inviteCode } });
        let attempts = 0;
        while (existing && attempts < 10) {
          inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
          existing = await client.inviteLink.findUnique({ where: { inviteCode } });
          attempts++;
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
        const inviteUrl = `${frontendUrl}/register?invite=${inviteCode}`;

        inviteLink = await client.inviteLink.create({
          data: {
            inviterId: hostUser.id,
            invitedUserId: user.id,
            inviteCode,
            inviteUrl,
            isActive: true,
            currentUses: 0
          }
        });
        console.log(`   ✅ Created invite link for ${email}: ${inviteLink.inviteCode}`);
      } else {
        console.log(`   ℹ️ Existing invite link for ${email}: ${inviteLink.inviteCode}`);
      }

      invitedUsers.push({ user, inviteLink });
    }

    console.log(`\\n✅ Prepared ${invitedUsers.length} invited users\\n`);

    // 5) Each invited user buys 4 units (101–104)
    for (const { user, inviteLink } of invitedUsers) {
      console.log(`🛒 Purchasing 4 units for ${user.email} using invite ${inviteLink.inviteCode}`);

      // Fund wallet
      const wallet = await client.wallet.findUnique({ where: { userId: user.id } });
      await client.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: 2000 } } // 4 * 500
      });

      // Purchase via PurchaseService so placement rules + host assignment apply
      const purchaseRequest = await PurchaseService.createPurchaseRequest(
        user.id,
        contractGame.id,
        4,
        inviteLink.inviteCode
      );
      console.log(`   ✅ Purchase request: ${purchaseRequest.id} (${purchaseRequest.status})`);

      try {
        await PurchaseService.processPlacement(purchaseRequest.id);
        console.log('   ✅ Units placed');
      } catch (err) {
        console.log(`   ❌ Placement error: ${err.message}`);
      }
    }

    // 6) Verify placement for each invited user
    console.log('\\n🔍 Verifying placement for invited users (units 101–104)\\n');
    for (const { user } of invitedUsers) {
      const units = await client.unit.findMany({
        where: {
          ownerId: user.id,
          stage: 1,
          unitNumber: { gte: 101, lte: 104 }
        },
        include: {
          parentUnit: {
            select: {
              id: true,
              unitName: true,
              unitNumber: true,
              isSystemRoot: true
            }
          }
        },
        orderBy: { unitNumber: 'asc' }
      });

      console.log(`User ${user.email}:`);
      if (units.length === 0) {
        console.log('   ❌ No units found');
        continue;
      }

      for (const u of units) {
        const p = u.parentUnit;
        const parentLabel = p
          ? `${p.unitName} (#${p.unitNumber})${p.isSystemRoot ? ' [SYSTEM_ROOT]' : ''}`
          : 'null';
        console.log(`   Unit ${u.unitNumber}: parent = ${parentLabel}`);
      }

      const u101 = units.find(u => u.unitNumber === 101);
      const u102 = units.find(u => u.unitNumber === 102);
      const u103 = units.find(u => u.unitNumber === 103);
      const u104 = units.find(u => u.unitNumber === 104);

      // Simple checks
      if (u101 && u101.parentUnit && !u101.parentUnit.isSystemRoot) {
        console.log('   ✅ 101 is under host subtree (non-system parent)');
      } else if (u101) {
        console.log('   ❌ 101 should be under host subtree, but parent is system root');
      }

      if (u102 && u101 && u102.parentUnitId === u101.id) {
        console.log('   ✅ 102 under 101');
      } else if (u102) {
        console.log(`   ❌ 102 should be under 101 but is under ${u102.parentUnit?.unitNumber}`);
      }

      if (u103 && u103.parentUnit && u103.parentUnit.isSystemRoot) {
        console.log('   ❌ 103 is under SYSTEM ROOT (should stay in host subtree)');
      } else if (u103) {
        console.log('   ✅ 103 is NOT under system root (good)');
      } else {
        console.log('   ⚠️  103 not present');
      }

      if (u104 && u101 && (u104.parentUnitId === u101.id || u104.parentUnitId === u102?.id)) {
        console.log('   ✅ 104 is correctly under first odd unit subtree (101/102 chain)');
      } else if (u104) {
        console.log(`   ⚠️  104 parent = ${u104.parentUnit?.unitNumber}`);
      }

      console.log('');
    }

    console.log('✅ Test completed\\n');
  } catch (err) {
    console.error('❌ Error in testInvitePlacement4Users:', err);
  } finally {
    await database.disconnect();
  }
}

testInvitePlacement4Users()
  .then(() => {
    console.log('✅ Script finished');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });


