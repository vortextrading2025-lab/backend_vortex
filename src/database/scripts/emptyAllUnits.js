#!/usr/bin/env node

/**
 * Empty All Units
 * - Deletes all units (including system roots)
 * - Deletes all purchase requests
 * - Deletes all payouts
 * 
 * Usage: node src/database/scripts/emptyAllUnits.js
 */

require('dotenv').config();
const database = require('../../config/database');

const emptyAllUnits = async () => {
  try {
    console.log('🔄 Starting: Empty All Units\n');
    console.log('='.repeat(70));
    
    await database.connect();
    const prisma = database.getClient();

    // Step 1: Delete all payouts (they reference units)
    console.log('\n🗑️  Step 1: Deleting all payouts...');
    const deletedPayouts = await prisma.payout.deleteMany({});
    console.log(`   ✅ Deleted ${deletedPayouts.count} payouts`);

    // Step 2: Delete all purchase requests
    console.log('\n🗑️  Step 2: Deleting all purchase requests...');
    const deletedRequests = await prisma.purchaseRequest.deleteMany({});
    console.log(`   ✅ Deleted ${deletedRequests.count} purchase requests`);

    // Step 3: Delete all units (including system roots)
    // Note: Due to cascade delete, deleting parent units will automatically delete children
    console.log('\n🗑️  Step 3: Deleting all units (including system roots)...');
    const deletedUnits = await prisma.unit.deleteMany({});
    console.log(`   ✅ Deleted ${deletedUnits.count} units`);

    console.log('\n✅ Successfully emptied all units!');
    console.log(`   - Deleted ${deletedPayouts.count} payouts`);
    console.log(`   - Deleted ${deletedRequests.count} purchase requests`);
    console.log(`   - Deleted ${deletedUnits.count} units`);

    console.log('\n✨ Script completed successfully!\n');
  } catch (error) {
    console.error('❌ Error emptying units:', error);
    console.error('\n💥 Script failed:', error.message);
    throw error;
  } finally {
    await database.disconnect();
  }
};

// Run the script
if (require.main === module) {
  emptyAllUnits()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      process.exit(1);
    });
}

module.exports = { emptyAllUnits };

