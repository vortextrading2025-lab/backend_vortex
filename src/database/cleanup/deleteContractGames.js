#!/usr/bin/env node

/**
 * Delete All Contract Games and Units Script
 * This script deletes all contract games, units, and purchase requests
 * 
 * WARNING: This will permanently delete all contract game data!
 * 
 * Usage: node src/database/cleanup/deleteContractGames.js
 */

const database = require('../../config/database');
const logger = require('../../modules/logging/logger');

const deleteContractGames = async () => {
  try {
    console.log('🔄 Starting cleanup of contract games data...\n');

    // Connect to database
    await database.connect();
    const prisma = database.getClient();

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

    // Step 5: Summary
    console.log('📊 Step 5: Cleanup summary...');
    const remainingGames = await prisma.contractGame.count().catch(() => 0);
    const remainingUnits = await prisma.unit.count().catch(() => 0);
    const remainingRequests = await prisma.purchaseRequest.count().catch(() => 0);
    const remainingPayouts = await prisma.payout.count().catch(() => 0);
    
    console.log(`   Contract Games: ${remainingGames}`);
    console.log(`   Units: ${remainingUnits}`);
    console.log(`   Purchase Requests: ${remainingRequests}`);
    console.log(`   Payouts: ${remainingPayouts}`);
    console.log('');

    if (remainingGames === 0 && remainingUnits === 0) {
      console.log('✅ Cleanup completed successfully!\n');
      console.log('📝 Next steps:');
      console.log('   1. Create new contract games through admin interface');
      console.log('   2. The system will automatically build tree structure with mentor units\n');
    } else {
      console.log('⚠️  Warning: Some data still remains. Please check manually.\n');
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    logger.error('Error deleting contract games:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
};

// Run the script
if (require.main === module) {
  deleteContractGames();
}

module.exports = { deleteContractGames };

