require('dotenv').config();
const database = require('../../config/database');
const InviteService = require('../../modules/contract/inviteService');
const PurchaseService = require('../../services/purchaseService');

/**
 * Add units to level 6 by having invited users purchase units under user996's existing units
 */
async function addLevel6ViaInvites() {
  try {
    console.log('🧪 Adding level 6 units via invites from user996\n');

    // Ensure database is connected
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

    // 3) Find user996's deepest level units (these are at level 12 based on previous output)
    // We want to find units that have space for children
    const hostUnits = await client.unit.findMany({
      where: {
        ownerId: hostUser.id,
        isSystemRoot: false
      },
      include: {
        _count: {
          select: { childrenUnits: true }
        }
      },
      orderBy: [
        { level: 'desc' },
        { unitNumber: 'asc' }
      ]
    });

    // Find units at the deepest level that have space
    if (hostUnits.length === 0) {
      console.log('❌ Host has no units');
      return;
    }

    const maxLevel = Math.max(...hostUnits.map(u => u.level));
    console.log(`📊 Host's deepest level: ${maxLevel}\n`);

    // Get units at the deepest level that have space for children
    const deepestUnitsWithSpace = hostUnits
      .filter(u => u.level === maxLevel && u._count.childrenUnits < 2)
      .slice(0, 10); // Limit to 10 units to avoid too many invites

    console.log(`📊 Found ${deepestUnitsWithSpace.length} units at level ${maxLevel} with space for children:`);
    deepestUnitsWithSpace.forEach(u => {
      console.log(`   ${u.unitName} (${u.unitNumber}): ${u._count.childrenUnits}/2 children`);
    });
    console.log('');

    if (deepestUnitsWithSpace.length === 0) {
      console.log('ℹ️ No units with available space at deepest level');
      return;
    }

    // 4) Create invite links from user996
    console.log('🔗 Creating invite links from user996...\n');
    const inviteLinks = [];
    for (let i = 0; i < deepestUnitsWithSpace.length; i++) {
      try {
        const inviteLink = await InviteService.createInviteLink(hostUser.id, {});
        inviteLinks.push(inviteLink);
        console.log(`✅ Created invite link ${i + 1}: ${inviteLink.inviteCode}`);
      } catch (error) {
        console.log(`❌ Error creating invite link ${i + 1}: ${error.message}`);
      }
    }
    console.log('');

    // 5) Create dummy users, link them to invite links, and have them purchase units
    console.log('👥 Creating dummy users and purchasing units...\n');
    const invitedUsers = [];
    
    for (let i = 0; i < inviteLinks.length; i++) {
      const inviteLink = inviteLinks[i];
      const email = `level6_invited${i + 1}@test.com`;
      const username = `level6_invited${i + 1}_${Date.now()}`;

      try {
        // Check if user already exists
        let user = await client.user.findFirst({ where: { email } });
        if (!user) {
          user = await client.user.create({
            data: {
              email,
              username,
              password: '$2b$10$dummy', // Dummy password
              emailVerified: true,
              role: 'USER'
            }
          });
          console.log(`✅ Created user: ${email}`);
        } else {
          console.log(`ℹ️ User already exists: ${email}`);
        }

        // Link the invite link to this user (set invitedUserId)
        await client.inviteLink.update({
          where: { id: inviteLink.id },
          data: { invitedUserId: user.id }
        });
        console.log(`🔗 Linked invite link ${inviteLink.inviteCode} to user ${email}`);

        // Create wallet if it doesn't exist
        let wallet = await client.wallet.findUnique({ where: { userId: user.id } });
        if (!wallet) {
          wallet = await client.wallet.create({
            data: {
              userId: user.id,
              balance: 0
            }
          });
        }

        // Fund wallet (4 units × $500 = $2000)
        const costPerUnit = contractGame.downPayment || 500;
        const totalCost = 4 * costPerUnit;
        await client.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: totalCost } }
        });
        console.log(`💰 Funded wallet for ${email}: +$${totalCost}`);

        // Purchase 4 units (the invite link is already linked to the user)
        const purchaseRequest = await PurchaseService.createPurchaseRequest(
          user.id,
          contractGame.id,
          4
        );
        console.log(`✅ Purchase request created for ${email}: ${purchaseRequest.id}`);
        
        invitedUsers.push({ user, purchaseRequest });
      } catch (error) {
        console.log(`❌ Error processing user ${i + 1}: ${error.message}`);
      }
    }
    console.log('');

    // 6) Verify placement
    console.log('📊 Verifying placement...\n');
    
    // Check user996's units again
    const updatedHostUnits = await client.unit.findMany({
      where: {
        ownerId: hostUser.id,
        isSystemRoot: false
      },
      include: {
        _count: {
          select: { childrenUnits: true }
        },
        childrenUnits: {
          select: {
            id: true,
            unitName: true,
            unitNumber: true,
            level: true,
            ownerId: true
          },
          orderBy: { unitNumber: 'asc' }
        }
      },
      orderBy: { level: 'desc', unitNumber: 'asc' }
    });

    // Find units that now have children (these should be at level 6 in tree view)
    const unitsWithNewChildren = updatedHostUnits.filter(u => 
      u.childrenUnits.length > 0 && 
      u.childrenUnits.some(c => invitedUsers.some(iu => iu.user.id === c.ownerId))
    );

    console.log(`📊 Units with new children from invited users: ${unitsWithNewChildren.length}`);
    unitsWithNewChildren.forEach(u => {
      console.log(`   ${u.unitName} (level ${u.level}): ${u.childrenUnits.length} children`);
      u.childrenUnits.forEach(c => {
        const childOwner = invitedUsers.find(iu => iu.user.id === c.ownerId)?.user;
        console.log(`      → ${c.unitName} (level ${c.level}) - owner: ${childOwner?.email || 'unknown'}`);
      });
    });
    console.log('');

    // Check level distribution for invited users' units
    const allInvitedUnits = await client.unit.findMany({
      where: {
        ownerId: { in: invitedUsers.map(iu => iu.user.id) },
        isSystemRoot: false
      },
      include: {
        parentUnit: {
          select: {
            id: true,
            unitName: true,
            unitNumber: true,
            level: true
          }
        }
      },
      orderBy: { ownerId: 'asc', unitNumber: 'asc' }
    });

    console.log(`📊 Total units created for invited users: ${allInvitedUnits.length}`);
    const levelDistribution = {};
    allInvitedUnits.forEach(u => {
      levelDistribution[u.level] = (levelDistribution[u.level] || 0) + 1;
    });
    console.log('📊 Level distribution for invited users\' units:');
    Object.keys(levelDistribution).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
      console.log(`   Level ${level}: ${levelDistribution[level]} units`);
    });

    console.log('\n✅ Script completed');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await database.disconnect();
  }
}

addLevel6ViaInvites()
  .then(() => {
    console.log('✅ Script finished');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

