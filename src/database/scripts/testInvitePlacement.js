const database = require('../../config/database');
const PurchaseService = require('../../services/purchaseService');
const InviteService = require('../../modules/contract/inviteService');
const AuthService = require('../../modules/auth/authService');

async function testInvitePlacement() {
  try {
    console.log('🔄 Starting: Test Invite Placement System\n');
    console.log('=====================================================================\n');

    // Step 1: Connect to database
    await database.connect();
    console.log('✅ Database connected successfully\n');

    // Step 2: Get or create test1@gmail.com user
    let test1 = await database.getClient().user.findUnique({
      where: { email: 'test1@gmail.com' }
    });

    if (!test1) {
      console.log('❌ test1@gmail.com not found. Please create this user first.');
      return;
    }

    console.log(`👤 Found test1@gmail.com: ${test1.id}\n`);

    // Step 3: Check if test1 has units
    const test1Units = await database.getClient().unit.findMany({
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
      console.log('❌ test1@gmail.com has no units. Please purchase units first.');
      return;
    }

    console.log(`📦 test1 has ${test1Units.length} units:\n`);
    test1Units.forEach(unit => {
      const childrenCount = unit._count?.childrenUnits || 0;
      console.log(`  - Unit ${unit.unitNumber} (${unit.unitName}): ${childrenCount}/2 children`);
    });
    console.log('');

    // Step 4: Create invite link for test1
    console.log('🔗 Creating invite link for test1...');
    const inviteLink = await InviteService.createInviteLink(test1.id);
    console.log(`✅ Invite link created: ${inviteLink.inviteCode}`);
    console.log(`   URL: ${inviteLink.inviteUrl}\n`);

    // Step 5: Register a new user with the invite code
    console.log('👤 Registering new user with invite code...');
    const newUserEmail = `invited_user_${Date.now()}@test.com`;
    const newUserData = {
      email: newUserEmail,
      password: 'Test123!@#',
      firstName: 'Invited',
      lastName: 'User',
      phone: '+1234567890',
      role: 'USER',
      inviteCode: inviteLink.inviteCode
    };

    // Register user (this will link the invite)
    const registrationResult = await AuthService.register(
      newUserData,
      null, // no files
      '127.0.0.1',
      'Test Agent'
    );

    // AuthService.register returns { user, tokens, sessionId }
    const newUser = registrationResult?.user || await database.getClient().user.findUnique({
      where: { email: newUserEmail }
    });
    
    if (!newUser) {
      console.log('❌ Failed to register or find new user');
      return;
    }
    
    console.log(`✅ New user registered: ${newUser.email} (${newUser.id})\n`);

    // Step 6: Verify invite link was used
    const usedInviteLink = await database.getClient().inviteLink.findUnique({
      where: { id: inviteLink.id },
      include: {
        inviter: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    if (usedInviteLink.invitedUserId === newUser.id) {
      console.log(`✅ Invite link linked to new user`);
      console.log(`   Inviter: ${usedInviteLink.inviter.email} (${usedInviteLink.inviter.id})\n`);
    } else {
      console.log(`❌ Invite link not properly linked`);
      return;
    }

    // Step 7: Get active contract game
    const contractGame = await database.getClient().contractGame.findFirst({
      where: { status: 'ACTIVE' }
    });

    if (!contractGame) {
      console.log('❌ No active contract game found');
      return;
    }

    console.log(`🎮 Active contract game: ${contractGame.name} (${contractGame.id})\n`);

    // Step 8: Purchase units for the new user (this should place units under test1's units)
    console.log('💰 Purchasing 4 units for invited user...');
    const purchaseRequest = await PurchaseService.createPurchaseRequest(
      newUser.id,
      contractGame.id,
      4
    );

    console.log(`✅ Purchase request created: ${purchaseRequest.id}`);
    console.log(`   Status: ${purchaseRequest.status}`);
    console.log(`   Host ID: ${purchaseRequest.hostId || 'null (system)'}\n`);

    // Step 9: Wait a moment for placement to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 10: Check where the new user's units were placed
    const newUserUnits = await database.getClient().unit.findMany({
      where: {
        ownerId: newUser.id,
        isSystemRoot: false
      },
      orderBy: { unitNumber: 'asc' },
      include: {
        parentUnit: {
          select: {
            id: true,
            unitName: true,
            unitNumber: true,
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

    console.log(`📦 New user has ${newUserUnits.length} units:\n`);
    newUserUnits.forEach(unit => {
      const parentInfo = unit.parentUnit
        ? `Unit ${unit.parentUnit.unitNumber} (${unit.parentUnit.owner.email})`
        : 'System Root';
      console.log(`  - Unit ${unit.unitNumber} (${unit.unitName})`);
      console.log(`    Parent: ${parentInfo}`);
      console.log(`    Level: ${unit.level}`);
      console.log('');
    });

    // Step 11: Verify placement order
    console.log('🔍 Verifying placement order...\n');
    
    // Get test1's units with children count
    const test1UnitsWithChildren = await Promise.all(
      test1Units.map(async (unit) => {
        const children = await database.getClient().unit.findMany({
          where: {
            parentUnitId: unit.id
          }
        });
        return {
          ...unit,
          children: children,
          childrenCount: children.length
        };
      })
    );

    // Check which test1 units have the new user's units as children
    const placementOrder = [];
    for (const test1Unit of test1UnitsWithChildren) {
      const placedUnderThis = newUserUnits.filter(u => u.parentUnitId === test1Unit.id);
      if (placedUnderThis.length > 0) {
        placementOrder.push({
          test1Unit: test1Unit.unitNumber,
          placedUnits: placedUnderThis.map(u => u.unitNumber)
        });
      }
    }

    if (placementOrder.length > 0) {
      console.log('✅ Placement order:\n');
      placementOrder.forEach(({ test1Unit, placedUnits }) => {
        console.log(`  - test1's Unit ${test1Unit} has: ${placedUnits.join(', ')}`);
      });
      console.log('');
    } else {
      console.log('⚠️  No units were placed under test1\'s units');
      console.log('   Units may have been placed under system root or another unit\n');
    }

    // Step 12: Check if all units are under test1's units
    const allUnderTest1 = newUserUnits.every(unit => {
      return unit.parentUnit && unit.parentUnit.ownerId === test1.id;
    });

    if (allUnderTest1) {
      console.log('✅ SUCCESS: All new user units are placed under test1\'s units!\n');
    } else {
      console.log('⚠️  WARNING: Some units are not under test1\'s units\n');
    }

    console.log('=====================================================================');
    console.log('✅ Test completed successfully\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  } finally {
    await database.disconnect();
  }
}

// Run the test
testInvitePlacement();

