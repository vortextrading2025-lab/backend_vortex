#!/usr/bin/env node

/**
 * Setup Test1 Game Script
 * Deletes all contract games and units, creates "Test1" game,
 * and sets up metro1@gmail.com and other users to purchase units
 * Usage: node src/database/test/setupTest1Game.js
 */

const database = require('../../config/database');
const logger = require('../../modules/logging/logger');
const bcrypt = require('bcryptjs');
const ContractGameService = require('../../services/contractGameService');
const PurchaseService = require('../../services/purchaseService');

const setupTest1Game = async () => {
  try {
    console.log('🔄 Starting Test1 game setup...\n');
    
    // Connect to database
    await database.connect();
    const prisma = database.getClient();

    // Step 1: Delete all contract games and related data
    console.log('🗑️  Step 1: Deleting all contract games and units...');
    await prisma.payout.deleteMany({});
    await prisma.unit.deleteMany({});
    await prisma.purchaseRequest.deleteMany({});
    await prisma.contractGame.deleteMany({});
    console.log('   ✅ All contract games and units deleted\n');

    // Step 2: Ensure admin exists
    console.log('👤 Step 2: Setting up admin...');
    let admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' }
    });

    if (!admin) {
      const hashedPassword = await bcrypt.hash('12345678', 12);
      admin = await prisma.user.create({
        data: {
          email: 'admin@example.com',
          password: hashedPassword,
          firstName: 'Admin',
          lastName: 'User',
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerified: true
        }
      });
      console.log('   ✅ Admin created');
    } else {
      console.log('   ✅ Admin exists');
    }

    // Step 3: Ensure mentor exists
    console.log('\n👤 Step 3: Setting up mentor...');
    let mentor = await prisma.user.findFirst({
      where: { 
        role: 'MENTOR',
        status: 'ACTIVE'
      },
      orderBy: { createdAt: 'asc' }
    });

    if (!mentor) {
      const hashedPassword = await bcrypt.hash('12345678', 12);
      mentor = await prisma.user.create({
        data: {
          email: 'mentor1@gmail.com',
          password: hashedPassword,
          firstName: 'Mentor',
          lastName: 'One',
          role: 'MENTOR',
          status: 'ACTIVE',
          emailVerified: true
        }
      });
      console.log('   ✅ Mentor created');
    } else {
      console.log('   ✅ Mentor exists');
    }

    // Step 4: Create/find metro1@gmail.com
    console.log('\n👤 Step 4: Setting up metro1@gmail.com...');
    let metro1 = await prisma.user.upsert({
      where: { email: 'metro1@gmail.com' },
      update: {},
      create: {
        email: 'metro1@gmail.com',
        password: await bcrypt.hash('12345678', 12),
        firstName: 'Metro',
        lastName: 'One',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        mentorId: mentor.id
      }
    });
    console.log('   ✅ metro1@gmail.com exists/created');

    // Step 5: Create additional test users
    console.log('\n👤 Step 5: Creating additional test users...');
    const testUsers = [
      { email: 'user1@gmail.com', firstName: 'User', lastName: 'One' },
      { email: 'user2@gmail.com', firstName: 'User', lastName: 'Two' },
      { email: 'user3@gmail.com', firstName: 'User', lastName: 'Three' },
      { email: 'user4@gmail.com', firstName: 'User', lastName: 'Four' }
    ];

    const createdUsers = [];
    for (const userData of testUsers) {
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {},
        create: {
          email: userData.email,
          password: await bcrypt.hash('12345678', 12),
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: true,
          mentorId: mentor.id
        }
      });
      createdUsers.push(user);
      console.log(`   ✅ ${userData.email} exists/created`);
    }

    // Step 6: Create "Test1" contract game
    console.log('\n🎮 Step 6: Creating "Test1" contract game...');
    const contractGame = await ContractGameService.createContractGame(
      admin.id,
      'Test1',
      100, // $100 down payment
      {
        payoutStage1: 1000, // $1000 payout for stage 1
        payoutStage2: 2000, // $2000 payout for stage 2
        payoutStage3: 3000  // $3000 payout for stage 3
      }
    );
    console.log(`   ✅ Contract game created: ${contractGame.name} (ID: ${contractGame.id})`);

    // Step 7: Create purchase request for metro1@gmail.com
    console.log('\n🛒 Step 7: Creating purchase request for metro1@gmail.com...');
    const metro1PurchaseRequest = await PurchaseService.createPurchaseRequest(
      metro1.id,
      contractGame.id,
      4 // 4 units
    );
    console.log(`   ✅ Purchase request created (ID: ${metro1PurchaseRequest.id})`);

    // Step 8: Approve metro1's purchase request
    console.log('\n✅ Step 8: Approving metro1 purchase request...');
    const approvedMetro1Request = await PurchaseService.approvePurchase(
      metro1PurchaseRequest.id,
      mentor.id,
      mentor.id // Mentor is the host
    );
    console.log('   ✅ Purchase request approved');

    // Step 9: Place metro1's units
    console.log('\n📍 Step 9: Placing metro1 units...');
    const metro1PlacementResult = await PurchaseService.processPlacement(metro1PurchaseRequest.id);
    console.log(`   ✅ ${metro1PlacementResult.unitsPlaced} units placed for metro1@gmail.com`);

    // Step 10: Create purchase requests for other users
    console.log('\n🛒 Step 10: Creating purchase requests for other users...');
    const purchaseRequests = [];
    for (const user of createdUsers) {
      try {
        const purchaseRequest = await PurchaseService.createPurchaseRequest(
          user.id,
          contractGame.id,
          4 // 4 units
        );
        purchaseRequests.push({ user, purchaseRequest });
        console.log(`   ✅ Purchase request created for ${user.email}`);
      } catch (error) {
        console.log(`   ⚠️  Error creating purchase request for ${user.email}: ${error.message}`);
      }
    }

    // Step 11: Approve and place units for other users
    console.log('\n✅ Step 11: Approving and placing units for other users...');
    for (const { user, purchaseRequest } of purchaseRequests) {
      try {
        // Approve purchase request
        await PurchaseService.approvePurchase(
          purchaseRequest.id,
          mentor.id,
          mentor.id
        );
        
        // Place units
        const placementResult = await PurchaseService.processPlacement(purchaseRequest.id);
        console.log(`   ✅ ${placementResult.unitsPlaced} units placed for ${user.email}`);
      } catch (error) {
        console.log(`   ⚠️  Error processing ${user.email}: ${error.message}`);
      }
    }

    // Step 12: Verify all units
    console.log('\n📊 Step 12: Verifying all units...');
    const allUnits = await prisma.unit.findMany({
      where: {
        contractGameId: contractGame.id,
        isSystemRoot: false // Exclude system root units
      },
      include: {
        owner: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: [
        { ownerId: 'asc' },
        { unitNumber: 'asc' }
      ]
    });

    console.log(`   ✅ Found ${allUnits.length} total units in Test1 game:`);
    
    // Group by owner
    const unitsByOwner = {};
    allUnits.forEach(unit => {
      const email = unit.owner.email;
      if (!unitsByOwner[email]) {
        unitsByOwner[email] = [];
      }
      unitsByOwner[email].push(unit);
    });

    Object.entries(unitsByOwner).forEach(([email, units]) => {
      console.log(`\n   ${email}:`);
      units.forEach(unit => {
        console.log(`      - ${unit.unitName} (#${unit.unitNumber}) - Stage ${unit.stage}, Level ${unit.level}, Pos ${unit.positionInLevel}, Active: ${unit.isActive}`);
      });
    });

    // Step 13: Summary
    console.log('\n📋 Summary:');
    console.log(`   Contract Game: ${contractGame.name} (ID: ${contractGame.id})`);
    console.log(`   Down Payment: $${contractGame.downPayment} per unit`);
    console.log(`   Total Units Created: ${allUnits.length}`);
    console.log(`   Users with Units: ${Object.keys(unitsByOwner).length}`);
    console.log(`   Active Units: ${allUnits.filter(u => u.isActive).length}`);
    console.log(`   Mentor: ${mentor.email}`);
    console.log('\n✅ All done!');
    console.log('\n📝 Login Credentials:');
    console.log('   metro1@gmail.com / 12345678');
    console.log('   user1@gmail.com / 12345678');
    console.log('   user2@gmail.com / 12345678');
    console.log('   user3@gmail.com / 12345678');
    console.log('   user4@gmail.com / 12345678');
    console.log('   mentor1@gmail.com / 12345678');
    console.log('   admin@example.com / 12345678');

  } catch (error) {
    console.error('❌ Error:', error);
    logger.error('Error in setupTest1Game:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
};

// Run the script
if (require.main === module) {
  setupTest1Game();
}

module.exports = { setupTest1Game };
