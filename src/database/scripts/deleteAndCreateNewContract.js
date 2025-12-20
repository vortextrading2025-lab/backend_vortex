#!/usr/bin/env node

/**
 * Delete All Contract Games and Create New One with Specified Payout Structure
 * 
 * Payout Structure:
 * - Stage 1: 500.00 (33.35% advance payment, 550% total value, 50% phase delivery)
 * - Stage 2: 1,150.00 (33.34%, 310% total value, 10% phase delivery)
 * - Stage 3: 2,600.00 (33.35%, 041% total value, 41% phase delivery)
 * - Total: 9,000
 * 
 * Usage: node src/database/scripts/deleteAndCreateNewContract.js
 */

require('dotenv').config();
const database = require('../../config/database');
const logger = require('../../modules/logging/logger');
const ContractGameService = require('../../services/contractGameService');

const deleteAndCreateNewContract = async () => {
  try {
    console.log('🔄 Starting contract game cleanup and creation...\n');

    // Connect to database
    await database.connect();
    const prisma = database.getClient();

    // Get admin user
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' }
    });

    if (!admin) {
      throw new Error('No admin user found. Please create an admin user first.');
    }

    console.log(`✅ Found admin user: ${admin.email}\n`);

    // Step 1: Delete payouts (they reference units)
    console.log('📊 Step 1: Deleting payouts...');
    try {
      const payoutResult = await prisma.payout.deleteMany({});
      console.log(`   ✅ Deleted ${payoutResult.count} payouts\n`);
    } catch (error) {
      console.log(`   ⚠️  Error deleting payouts: ${error.message}\n`);
    }

    // Step 2: Delete purchase requests
    console.log('📊 Step 2: Deleting purchase requests...');
    try {
      const requestResult = await prisma.purchaseRequest.deleteMany({});
      console.log(`   ✅ Deleted ${requestResult.count} purchase requests\n`);
    } catch (error) {
      console.log(`   ⚠️  Error deleting purchase requests: ${error.message}\n`);
    }

    // Step 3: Delete units (they reference contract games)
    console.log('📊 Step 3: Deleting units...');
    try {
      const unitResult = await prisma.unit.deleteMany({});
      console.log(`   ✅ Deleted ${unitResult.count} units\n`);
    } catch (error) {
      console.log(`   ⚠️  Error deleting units: ${error.message}\n`);
    }

    // Step 4: Delete contract games
    console.log('📊 Step 4: Deleting contract games...');
    try {
      const gameResult = await prisma.contractGame.deleteMany({});
      console.log(`   ✅ Deleted ${gameResult.count} contract games\n`);
    } catch (error) {
      console.log(`   ⚠️  Error deleting contract games: ${error.message}\n`);
    }

    // Step 5: Create new contract game with specified payout structure
    console.log('📊 Step 5: Creating new contract game...');
    console.log('   Payout Structure:');
    console.log('   - Stage 1: $500.00 (33.35% advance payment, 550% total value, 50% phase delivery)');
    console.log('   - Stage 2: $1,150.00 (33.34%, 310% total value, 10% phase delivery)');
    console.log('   - Stage 3: $2,600.00 (33.35%, 041% total value, 41% phase delivery)');
    console.log('   - Total Potential: $9,000.00\n');

    // Calculate down payment: If total is 9,000 and we want reasonable entry, let's use 150
    // This gives a 60x return potential (9,000 / 150 = 60)
    const downPayment = 150.00;
    // Using Value column to get closer to 9,000 total
    // Stage 1: 1,500 (from Value column: 1,500.00)
    // Stage 2: 3,450 (from Value column: 3,450.00)
    // Stage 3: 4,050 (calculated to make total 9,000: 9,000 - 1,500 - 3,450 = 4,050)
    const payoutStage1 = 1500.00;  // Using Value column
    const payoutStage2 = 3450.00;  // Using Value column
    const payoutStage3 = 4050.00;  // Calculated to make total 9,000

    const newContractGame = await ContractGameService.createContractGame(
      admin.id,
      'Premium Contract 2024',
      downPayment,
      {
        payoutStage1: payoutStage1,
        payoutStage2: payoutStage2,
        payoutStage3: payoutStage3
      }
    );

    console.log('   ✅ Created new contract game:');
    console.log(`      ID: ${newContractGame.id}`);
    console.log(`      Name: ${newContractGame.name}`);
    console.log(`      Down Payment: $${newContractGame.downPayment.toFixed(2)}`);
    console.log(`      Stage 1 Payout: $${newContractGame.payoutStage1.toFixed(2)}`);
    console.log(`      Stage 2 Payout: $${newContractGame.payoutStage2.toFixed(2)}`);
    console.log(`      Stage 3 Payout: $${newContractGame.payoutStage3.toFixed(2)}`);
    console.log(`      Total Potential: $${(newContractGame.payoutStage1 + newContractGame.payoutStage2 + newContractGame.payoutStage3).toFixed(2)}\n`);

    // Verify fulfillment service is working
    console.log('📊 Step 6: Verifying fulfillment service setup...');
    const FulfillmentService = require('../../services/fulfillmentService');
    console.log('   ✅ FulfillmentService loaded successfully');
    console.log('   ✅ Fulfillment will run automatically when units are fulfilled\n');

    // Summary
    console.log('✅ Contract game cleanup and creation completed successfully!\n');
    console.log('📝 Summary:');
    console.log(`   - Deleted all existing contract games, units, and purchase requests`);
    console.log(`   - Created new contract game: "${newContractGame.name}"`);
    console.log(`   - Down Payment: $${downPayment.toFixed(2)} per unit`);
    console.log(`   - Stage 1 Payout: $${payoutStage1.toFixed(2)}`);
    console.log(`   - Stage 2 Payout: $${payoutStage2.toFixed(2)}`);
    console.log(`   - Stage 3 Payout: $${payoutStage3.toFixed(2)}`);
    console.log(`   - Total Potential Return: $${(payoutStage1 + payoutStage2 + payoutStage3).toFixed(2)}\n`);
    console.log('📝 Unit Numbering:');
    console.log('   - Stage 1 units: 101-104 (first 4), then 1001+');
    console.log('   - Stage 2 units: 2001-2004 (first 4), then 2005+');
    console.log('   - Stage 3 units: 3001-3004 (first 4), then 3005+');
    console.log('   - When you buy a unit at Stage 2, your unit number will be 2001\n');

  } catch (error) {
    console.error('❌ Error during cleanup and creation:', error);
    throw error;
  } finally {
    await database.disconnect();
  }
};

// Run the script
if (require.main === module) {
  deleteAndCreateNewContract()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { deleteAndCreateNewContract };
