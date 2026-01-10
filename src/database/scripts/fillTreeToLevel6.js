require('dotenv').config();
const database = require('../../config/database');
const InviteService = require('../../modules/contract/inviteService');
const PurchaseService = require('../../services/purchaseService');

/**
 * Fill tree to level 6:
 * 1. Delete existing level6_invited user units
 * 2. Ensure user996 has 4 units
 * 3. user996 invites dummy users (tier 1)
 * 4. Tier 1 users invite tier 2 users
 * 5. Tier 2 users invite tier 3 users
 * 6. Fill tree to level 6
 */
async function fillTreeToLevel6() {
  try {
    console.log('🧪 Filling tree to level 6\n');

    await database.connect();
    const client = database.getClient();

    // 1) Find user996
    const hostUser = await client.user.findFirst({ 
      where: { email: 'user996@gmail.com' } 
    });
    if (!hostUser) {
      console.log('❌ User user996@gmail.com not found');
      return;
    }
    console.log(`✅ Host: ${hostUser.email} (${hostUser.id})\n`);

    // 2) Find active contract game
    const contractGame = await client.contractGame.findFirst({
      where: { status: 'ACTIVE' }
    });
    if (!contractGame) {
      console.log('❌ No active contract game found');
      return;
    }
    console.log(`✅ Contract game: ${contractGame.name} (${contractGame.id})\n`);

    // 3) Delete existing level6_invited user units
    console.log('🗑️ Deleting existing level6_invited user units...\n');
    const level6Users = await client.user.findMany({
      where: {
        email: { startsWith: 'level6_invited' }
      }
    });

    for (const user of level6Users) {
      // Delete units
      const units = await client.unit.findMany({
        where: { ownerId: user.id }
      });
      if (units.length > 0) {
        await client.unit.deleteMany({
          where: { ownerId: user.id }
        });
        console.log(`   Deleted ${units.length} units for ${user.email}`);
      }
      
      // Delete invite links
      await client.inviteLink.deleteMany({
        where: {
          OR: [
            { inviterId: user.id },
            { invitedUserId: user.id }
          ]
        }
      });
      
      // Delete purchase requests
      await client.purchaseRequest.deleteMany({
        where: { userId: user.id }
      });
      
      // Delete user
      await client.user.delete({
        where: { id: user.id }
      });
      console.log(`   Deleted user: ${user.email}`);
    }
    console.log('');

    // 4) Ensure user996 has 4 units (101-104)
    console.log('📊 Checking user996 units...\n');
    const hostUnits = await client.unit.findMany({
      where: {
        ownerId: hostUser.id,
        isSystemRoot: false
      },
      orderBy: { unitNumber: 'asc' }
    });

    if (hostUnits.length < 4) {
      console.log(`   user996 has ${hostUnits.length} units, need 4. Purchasing...\n`);
      
      // Fund wallet
      let wallet = await client.wallet.findUnique({ where: { userId: hostUser.id } });
      if (!wallet) {
        wallet = await client.wallet.create({
          data: { userId: hostUser.id, balance: 0 }
        });
      }
      
      const costPerUnit = contractGame.downPayment || 500;
      const totalCost = 4 * costPerUnit;
      await client.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: totalCost } }
      });
      console.log(`💰 Funded wallet: +$${totalCost}\n`);

      // Purchase 4 units
      const purchaseRequest = await PurchaseService.createPurchaseRequest(
        hostUser.id,
        contractGame.id,
        4
      );
      console.log(`✅ Purchase request created: ${purchaseRequest.id}\n`);
    } else {
      console.log(`✅ user996 already has ${hostUnits.length} units\n`);
    }

    // 5) Create tier 1 users (invited by user996)
    console.log('👥 Creating tier 1 users (invited by user996)...\n');
    const tier1Users = [];
    
    for (let i = 1; i <= 2; i++) {
      const email = `tier1_user${i}@test.com`;
      const username = `tier1_user${i}_${Date.now()}`;

      // Create user
      let user = await client.user.findFirst({ where: { email } });
      if (!user) {
        user = await client.user.create({
          data: {
            email,
            username,
            password: '$2b$10$dummy',
            emailVerified: true,
            role: 'USER'
          }
        });
        console.log(`✅ Created tier 1 user: ${email}`);
      } else {
        console.log(`ℹ️ Tier 1 user already exists: ${email}`);
      }

      // Create invite link from user996 to this user
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
        console.log(`   🔗 Created invite link: ${inviteCode}`);
      }

      // Fund wallet
      let wallet = await client.wallet.findUnique({ where: { userId: user.id } });
      if (!wallet) {
        wallet = await client.wallet.create({
          data: { userId: user.id, balance: 0 }
        });
      }

      const costPerUnit = contractGame.downPayment || 500;
      const totalCost = 4 * costPerUnit;
      await client.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: totalCost } }
      });
      console.log(`   💰 Funded wallet: +$${totalCost}`);

      // Purchase 4 units
      const purchaseRequest = await PurchaseService.createPurchaseRequest(
        user.id,
        contractGame.id,
        4
      );
      console.log(`   ✅ Purchase request created: ${purchaseRequest.id}\n`);

      tier1Users.push({ user, inviteLink });
    }

    // Wait a bit for placement to complete
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 6) Create tier 2 users (invited by tier 1 users)
    console.log('👥 Creating tier 2 users (invited by tier 1 users)...\n');
    const tier2Users = [];
    
    for (const tier1 of tier1Users) {
      for (let i = 1; i <= 2; i++) {
        const email = `tier2_user${tier1.user.id}_${i}@test.com`;
        const username = `tier2_user${tier1.user.id}_${i}_${Date.now()}`;

        // Create user
        let user = await client.user.findFirst({ where: { email } });
        if (!user) {
          user = await client.user.create({
            data: {
              email,
              username,
              password: '$2b$10$dummy',
              emailVerified: true,
              role: 'USER'
            }
          });
          console.log(`✅ Created tier 2 user: ${email}`);
        }

        // Create invite link from tier1 to this user
        let inviteLink = await client.inviteLink.findFirst({
          where: {
            inviterId: tier1.user.id,
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
              inviterId: tier1.user.id,
              invitedUserId: user.id,
              inviteCode,
              inviteUrl,
              isActive: true,
              currentUses: 0
            }
          });
          console.log(`   🔗 Created invite link: ${inviteCode}`);
        }

        // Fund wallet
        let wallet = await client.wallet.findUnique({ where: { userId: user.id } });
        if (!wallet) {
          wallet = await client.wallet.create({
            data: { userId: user.id, balance: 0 }
          });
        }

        const costPerUnit = contractGame.downPayment || 500;
        const totalCost = 4 * costPerUnit;
        await client.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: totalCost } }
        });
        console.log(`   💰 Funded wallet: +$${totalCost}`);

        // Purchase 4 units
        const purchaseRequest = await PurchaseService.createPurchaseRequest(
          user.id,
          contractGame.id,
          4
        );
        console.log(`   ✅ Purchase request created: ${purchaseRequest.id}\n`);

        tier2Users.push({ user, inviteLink, tier1Parent: tier1 });
      }
    }

    // Wait a bit for placement to complete
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 7) Create tier 3 users (invited by tier 2 users) to fill to level 6
    console.log('👥 Creating tier 3 users (invited by tier 2 users) to fill to level 6...\n');
    const tier3Users = [];
    
    for (const tier2 of tier2Users) {
      for (let i = 1; i <= 2; i++) {
        const email = `tier3_user${tier2.user.id}_${i}@test.com`;
        const username = `tier3_user${tier2.user.id}_${i}_${Date.now()}`;

        // Create user
        let user = await client.user.findFirst({ where: { email } });
        if (!user) {
          user = await client.user.create({
            data: {
              email,
              username,
              password: '$2b$10$dummy',
              emailVerified: true,
              role: 'USER'
            }
          });
          console.log(`✅ Created tier 3 user: ${email}`);
        }

        // Create invite link from tier2 to this user
        let inviteLink = await client.inviteLink.findFirst({
          where: {
            inviterId: tier2.user.id,
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
              inviterId: tier2.user.id,
              invitedUserId: user.id,
              inviteCode,
              inviteUrl,
              isActive: true,
              currentUses: 0
            }
          });
          console.log(`   🔗 Created invite link: ${inviteCode}`);
        }

        // Fund wallet
        let wallet = await client.wallet.findUnique({ where: { userId: user.id } });
        if (!wallet) {
          wallet = await client.wallet.create({
            data: { userId: user.id, balance: 0 }
          });
        }

        const costPerUnit = contractGame.downPayment || 500;
        const totalCost = 4 * costPerUnit;
        await client.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: totalCost } }
        });
        console.log(`   💰 Funded wallet: +$${totalCost}`);

        // Purchase 4 units
        const purchaseRequest = await PurchaseService.createPurchaseRequest(
          user.id,
          contractGame.id,
          4
        );
        console.log(`   ✅ Purchase request created: ${purchaseRequest.id}\n`);

        tier3Users.push({ user, inviteLink, tier2Parent: tier2 });
      }
    }

    // Wait for all placements to complete
    console.log('⏳ Waiting for all placements to complete...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 8) Verify tree structure
    console.log('📊 Verifying tree structure...\n');
    
    const allUnits = await client.unit.findMany({
      where: {
        ownerId: hostUser.id,
        isSystemRoot: false
      },
      include: {
        _count: {
          select: { childrenUnits: true }
        }
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`📊 user996 has ${allUnits.length} units\n`);

    // Check level distribution
    const levelDistribution = {};
    const allUserUnits = await client.unit.findMany({
      where: {
        OR: [
          { ownerId: hostUser.id },
          { ownerId: { in: [...tier1Users, ...tier2Users, ...tier3Users].map(u => u.user.id) } }
        ],
        isSystemRoot: false
      }
    });

    allUserUnits.forEach(u => {
      levelDistribution[u.level] = (levelDistribution[u.level] || 0) + 1;
    });

    console.log('📊 Level distribution:');
    Object.keys(levelDistribution).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
      console.log(`   Level ${level}: ${levelDistribution[level]} units`);
    });

    // Check if we have units at level 6 (relative to user996_101)
    // Level 6 would be: user996_101 (level 0) -> level 1 -> level 2 -> level 3 -> level 4 -> level 5 -> level 6
    // We need to find the deepest level in the subtree of user996_101
    const user996_101 = await client.unit.findFirst({
      where: {
        ownerId: hostUser.id,
        unitNumber: 101,
        isSystemRoot: false
      }
    });

    if (user996_101) {
      // Find max depth in subtree
      const findMaxDepth = async (unitId, currentDepth = 0) => {
        const children = await client.unit.findMany({
          where: { parentUnitId: unitId }
        });
        
        if (children.length === 0) {
          return currentDepth;
        }
        
        const depths = await Promise.all(
          children.map(child => findMaxDepth(child.id, currentDepth + 1))
        );
        
        return Math.max(...depths);
      };

      const maxDepth = await findMaxDepth(user996_101.id);
      console.log(`\n📊 Maximum depth in user996_101 subtree: ${maxDepth} levels`);
      
      if (maxDepth >= 6) {
        console.log('✅ Tree filled to level 6!');
      } else {
        console.log(`⚠️ Tree only reaches level ${maxDepth}, need level 6`);
      }
    }

    console.log('\n✅ Script completed');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await database.disconnect();
  }
}

fillTreeToLevel6()
  .then(() => {
    console.log('✅ Script finished');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });



