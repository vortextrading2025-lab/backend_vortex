#!/usr/bin/env node

/**
 * Create Contract Game and Purchase Units Script
 * Deletes all contract games and units, creates a new one, and has test1@gmail.com purchase units
 * Usage: node src/database/test/createContractAndPurchase.js
 */

const database = require('../../config/database');
const logger = require('../../modules/logging/logger');
const bcrypt = require('bcryptjs');
const ContractGameService = require('../../services/contractGameService');
const PurchaseService = require('../../services/purchaseService');

const createContractAndPurchase = async () => {
  try {
    console.log('🔄 Starting contract game creation and purchase...\n');
    
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

    // Step 4: Ensure test1@gmail.com exists
    console.log('\n👤 Step 4: Setting up test user...');
    let testUser = await prisma.user.upsert({
      where: { email: 'test1@gmail.com' },
      update: {},
      create: {
        email: 'test1@gmail.com',
        password: await bcrypt.hash('12345678', 12),
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        mentorId: mentor.id // Assign mentor
      }
    });
    console.log('   ✅ Test user exists/created');

    // Step 5: Create contract game
    console.log('\n🎮 Step 5: Creating contract game...');
    const contractGame = await ContractGameService.createContractGame(
      admin.id,
      'Test Contract Game 2024',
      100, // $100 down payment
      {
        payoutStage1: 1000, // $1000 payout for stage 1
        payoutStage2: 2000, // $2000 payout for stage 2
        payoutStage3: 3000  // $3000 payout for stage 3
      }
    );
    console.log(`   ✅ Contract game created: ${contractGame.name} (ID: ${contractGame.id})`);

    // Step 6: Create purchase request for test1@gmail.com
    console.log('\n🛒 Step 6: Creating purchase request for test1@gmail.com...');
    const purchaseRequest = await PurchaseService.createPurchaseRequest(
      testUser.id,
      contractGame.id,
      4 // 4 units
    );
    console.log(`   ✅ Purchase request created (ID: ${purchaseRequest.id})`);

    // Step 7: Approve purchase request (mentor approves)
    console.log('\n✅ Step 7: Approving purchase request...');
    const approvedRequest = await PurchaseService.approvePurchase(
      purchaseRequest.id,
      mentor.id,
      mentor.id // Mentor is the host
    );
    console.log('   ✅ Purchase request approved');

    // Step 8: Place units
    console.log('\n📍 Step 8: Placing units...');
    const placementResult = await PurchaseService.processPlacement(purchaseRequest.id);
    console.log(`   ✅ ${placementResult.unitsPlaced} units placed`);

    // Step 9: Verify units
    console.log('\n📊 Step 9: Verifying units...');
    const units = await prisma.unit.findMany({
      where: {
        ownerId: testUser.id,
        contractGameId: contractGame.id
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`   ✅ Found ${units.length} units for test1@gmail.com:`);
    units.forEach(unit => {
      console.log(`      - ${unit.unitName} (#${unit.unitNumber}) - Stage ${unit.stage}, Level ${unit.level}, Active: ${unit.isActive}`);
    });

    // Step 10: Summary
    console.log('\n📋 Summary:');
    console.log(`   Contract Game: ${contractGame.name}`);
    console.log(`   User: test1@gmail.com`);
    console.log(`   Units Purchased: ${units.length}`);
    console.log(`   Active Units: ${units.filter(u => u.isActive).length}`);
    console.log(`   Mentor: ${mentor.email}`);
    console.log('\n✅ All done!');

  } catch (error) {
    console.error('❌ Error:', error);
    logger.error('Error in createContractAndPurchase:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
};

// Run the script
if (require.main === module) {
  createContractAndPurchase();
}

module.exports = { createContractAndPurchase };

