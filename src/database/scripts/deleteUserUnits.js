#!/usr/bin/env node

/**
 * Delete User Units Only
 * - Deletes all user units (isSystemRoot = false)
 * - Deletes all purchase requests
 * - Deletes all payouts
 * - Keeps system root units intact
 * 
 * Usage: node src/database/scripts/deleteUserUnits.js
 */

require('dotenv').config();
const database = require('../../config/database');

const deleteUserUnits = async () => {
  try {
    console.log('🔄 Starting: Delete User Units Only\n');
    console.log('='.repeat(70));
    
    await database.connect();
    const prisma = database.getClient();

    // Step 1: Delete all payouts (they reference user units)
    console.log('\n🗑️  Step 1: Deleting all payouts...');
    const deletedPayouts = await prisma.payout.deleteMany({});
    console.log(`   ✅ Deleted ${deletedPayouts.count} payouts`);

    // Step 2: Delete all purchase requests
    console.log('\n🗑️  Step 2: Deleting all purchase requests...');
    const deletedRequests = await prisma.purchaseRequest.deleteMany({});
    console.log(`   ✅ Deleted ${deletedRequests.count} purchase requests`);

    // Step 3: Delete all user units (excluding system roots)
    console.log('\n🗑️  Step 3: Deleting all user units (excluding system roots)...');
    const deletedUnits = await prisma.unit.deleteMany({
      where: {
        isSystemRoot: false
      }
    });
    console.log(`   ✅ Deleted ${deletedUnits.count} user units`);

    // Step 4: Count remaining system root units
    const systemRootCount = await prisma.unit.count({
      where: {
        isSystemRoot: true
      }
    });
    console.log(`   ℹ️  System root units remaining: ${systemRootCount}`);

    console.log('\n✅ Successfully deleted all user units!');
    console.log(`   - Deleted ${deletedPayouts.count} payouts`);
    console.log(`   - Deleted ${deletedRequests.count} purchase requests`);
    console.log(`   - Deleted ${deletedUnits.count} user units`);
    console.log(`   - Kept ${systemRootCount} system root units`);

    console.log('\n✨ Script completed successfully!\n');
  } catch (error) {
    console.error('❌ Error deleting user units:', error);
    console.error('\n💥 Script failed:', error.message);
    throw error;
  } finally {
    await database.disconnect();
  }
};

// Run the script
if (require.main === module) {
  deleteUserUnits()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      process.exit(1);
    });
}

module.exports = { deleteUserUnits };

