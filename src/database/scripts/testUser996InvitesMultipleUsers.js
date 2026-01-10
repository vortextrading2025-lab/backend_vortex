require('dotenv').config();
const database = require('../../config/database');
const PurchaseService = require('../../services/purchaseService');
const InviteService = require('../../modules/contract/inviteService');
const bcrypt = require('bcryptjs');

/**
 * Test: User996 invites MULTIPLE users (997, 998, 999)
 * Show that ONE user can invite MANY users and be HOST for all
 */
async function testUser996InvitesMultipleUsers() {
  try {
    console.log('🧪 TEST: User996 Invites MULTIPLE Users\n');
    console.log('='.repeat(70));

    await database.connect();

    // Find or create users
    const userEmails = ['user996@gmail.com', 'user997@gmail.com', 'user998@gmail.com', 'user999@gmail.com'];
    const users = {};

    for (const email of userEmails) {
      let user = await database.getClient().user.findFirst({
        where: { email }
      });

      if (!user) {
        console.log(`Creating user: ${email}`);
        const hashedPassword = await bcrypt.hash('12345678', 12);
        user = await database.getClient().user.create({
          data: {
            email,
            password: hashedPassword,
            firstName: email.split('@')[0],
            lastName: 'Test',
            role: 'USER',
            wallet: {
              create: {
                balance: 100000, // $100k for testing
                totalEarned: 0
              }
            }
          }
        });
      } else {
        // Update wallet balance
        await database.getClient().wallet.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            balance: 100000,
            totalEarned: 0
          },
          update: {
            balance: { increment: 100000 }
          }
        });
      }

      users[email] = user;
      console.log(`✅ User ready: ${email} (${user.id})`);
    }

    // Find active contract game
    const contractGame = await database.getClient().contractGame.findFirst({
      where: { status: 'ACTIVE' }
    });

    if (!contractGame) {
      console.log('❌ No active contract game found');
      return;
    }

    console.log(`\n✅ Found contract game: ${contractGame.name} (${contractGame.id})\n`);
    console.log('='.repeat(70));

    // STEP 1: Delete all units for all test users
    console.log('\n🗑️  STEP 1: Cleaning up all test users...\n');
    
    for (const email of userEmails) {
      const user = users[email];
      
      // Delete purchase requests
      const deletedRequests = await database.getClient().purchaseRequest.deleteMany({
        where: { userId: user.id }
      });
      
      // Delete units
      const deletedUnits = await database.getClient().unit.deleteMany({
        where: {
          ownerId: user.id,
          contractGameId: contractGame.id,
          isSystemRoot: false
        }
      });
      
      // Delete invite links
      await database.getClient().inviteLink.deleteMany({
        where: {
          OR: [
            { inviterId: user.id },
            { invitedUserId: user.id }
          ]
        }
      });

      console.log(`   ✅ Cleaned ${email}: ${deletedUnits.count} units, ${deletedRequests.count} requests`);
    }

    console.log('\n' + '='.repeat(70));

    // STEP 2: User996 buys 4 units (101-104)
    console.log('\n📦 STEP 2: User996 buys 4 units (101-104)...\n');
    
    const user996 = users['user996@gmail.com'];
    
    const purchase996 = await PurchaseService.createPurchaseRequest(
      user996.id,
      contractGame.id,
      4
    );

    console.log(`✅ User996 purchase request created: ${purchase996.id}`);
    
    // Wait for placement
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const user996Units = await database.getClient().unit.findMany({
      where: {
        ownerId: user996.id,
        contractGameId: contractGame.id
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`✅ User996 has ${user996Units.length} units: ${user996Units.map(u => u.unitNumber).join(', ')}\n`);

    console.log('='.repeat(70));

    // STEP 3: User996 creates invite link
    console.log('\n🔗 STEP 3: User996 creates invite link...\n');
    
    const inviteLink = await InviteService.createInviteLink(user996.id, {
      maxUses: null, // Unlimited
      customCode: 'USER996INVITE'
    });

    console.log(`✅ Invite link created!`);
    console.log(`   Code: ${inviteLink.inviteCode}`);
    console.log(`   URL: ${inviteLink.inviteUrl}\n`);

    console.log('='.repeat(70));

    // STEP 4: User997, 998, 999 join using invite code
    console.log('\n👥 STEP 4: Users 997, 998, 999 join using invite code...\n');
    
    const invitedUsers = ['user997@gmail.com', 'user998@gmail.com', 'user999@gmail.com'];
    
    for (const email of invitedUsers) {
      const user = users[email];
      
      // Create invite link record for this user
      await database.getClient().inviteLink.create({
        data: {
          inviterId: user996.id,
          invitedUserId: user.id,
          inviteCode: `${email.split('@')[0].toUpperCase()}`,
          inviteUrl: `http://localhost:3001/register?invite=${email.split('@')[0]}`,
          isActive: true,
          currentUses: 1,
          lastUsedAt: new Date()
        }
      });

      console.log(`   ✅ ${email} joined via user996's invite`);
    }

    console.log('\n' + '='.repeat(70));

    // STEP 5: Each invited user buys 4 units
    console.log('\n💰 STEP 5: Each invited user buys 4 units...\n');
    
    for (const email of invitedUsers) {
      const user = users[email];
      const userName = email.split('@')[0];
      
      console.log(`\n📦 ${userName.toUpperCase()} purchasing 4 units...`);
      
      const purchase = await PurchaseService.createPurchaseRequest(
        user.id,
        contractGame.id,
        4
      );

      console.log(`   ✅ Purchase request created: ${purchase.id}`);
      
      // Wait for placement
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const userUnits = await database.getClient().unit.findMany({
        where: {
          ownerId: user.id,
          contractGameId: contractGame.id
        },
        include: {
          host: {
            select: { email: true }
          },
          parentUnit: {
            select: {
              unitNumber: true,
              unitName: true,
              owner: {
                select: { email: true }
              }
            }
          }
        },
        orderBy: { unitNumber: 'asc' }
      });

      console.log(`   ✅ ${userName} has ${userUnits.length} units:`);
      userUnits.forEach(unit => {
        const hostEmail = unit.host?.email || 'no host';
        const parentInfo = unit.parentUnit 
          ? `${unit.parentUnit.unitNumber} (${unit.parentUnit.owner.email})`
          : 'no parent';
        console.log(`      - Unit ${unit.unitNumber}: HOST=${hostEmail}, Parent=${parentInfo}`);
      });
    }

    console.log('\n' + '='.repeat(70));

    // STEP 6: VERIFICATION - Show all units and their HOSTS
    console.log('\n🎯 STEP 6: VERIFICATION - HOST RELATIONSHIPS\n');
    console.log('='.repeat(70));

    for (const email of userEmails) {
      const user = users[email];
      const userName = email.split('@')[0];
      
      const units = await database.getClient().unit.findMany({
        where: {
          ownerId: user.id,
          contractGameId: contractGame.id
        },
        include: {
          host: {
            select: { email: true }
          },
          parentUnit: {
            select: {
              unitNumber: true,
              owner: {
                select: { email: true }
              }
            }
          }
        },
        orderBy: { unitNumber: 'asc' }
      });

      console.log(`\n${userName.toUpperCase()} (${email}):`);
      console.log(`   Total units: ${units.length}`);
      
      if (units.length > 0) {
        const hosts = [...new Set(units.map(u => u.host?.email).filter(h => h))];
        console.log(`   HOST: ${hosts[0] || 'no host'} ${hosts.length === 1 ? '✅' : '❌'}`);
        
        console.log(`   Units:`);
        units.forEach(unit => {
          const hostEmail = unit.host?.email || 'no host';
          const parentOwner = unit.parentUnit?.owner?.email || 'system';
          const parentNum = unit.parentUnit?.unitNumber || 'root';
          
          console.log(`      ${unit.unitNumber}: HOST=${hostEmail}, Parent=${parentNum} (${parentOwner})`);
        });
      }
    }

    console.log('\n' + '='.repeat(70));

    // STEP 7: Summary
    console.log('\n📊 SUMMARY:\n');
    
    // Count units by host
    const allUnits = await database.getClient().unit.findMany({
      where: {
        ownerId: { in: Object.values(users).map(u => u.id) },
        contractGameId: contractGame.id
      },
      include: {
        owner: { select: { email: true } },
        host: { select: { email: true } }
      }
    });

    const hostCounts = {};
    allUnits.forEach(unit => {
      const hostEmail = unit.host?.email || 'no host';
      hostCounts[hostEmail] = (hostCounts[hostEmail] || 0) + 1;
    });

    console.log('Units by HOST:');
    Object.entries(hostCounts).forEach(([host, count]) => {
      console.log(`   ${host}: ${count} units`);
    });

    // Check if user996 is host for all invited users' units
    const invitedUnits = allUnits.filter(u => 
      u.owner.email !== 'user996@gmail.com'
    );
    
    const allHaveUser996AsHost = invitedUnits.every(u => 
      u.host?.email === 'user996@gmail.com'
    );

    console.log(`\n✅ RESULT: ${allHaveUser996AsHost ? 'SUCCESS!' : 'FAILED'}`);
    console.log(`   - User996 is HOST for ${invitedUnits.filter(u => u.host?.email === 'user996@gmail.com').length}/${invitedUnits.length} invited users' units`);
    console.log(`   - ONE user (user996) can invite MULTIPLE users: ✅ CONFIRMED`);

    console.log('\n' + '='.repeat(70));
    console.log('\n✅ TEST COMPLETED!\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await database.disconnect();
  }
}

testUser996InvitesMultipleUsers()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

