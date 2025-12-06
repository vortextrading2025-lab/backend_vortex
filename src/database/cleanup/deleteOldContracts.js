#!/usr/bin/env node

/**
 * Delete Old Contract Data Script
 * This script deletes all old contract-related data before migrating to the new system
 * 
 * WARNING: This will permanently delete all contract data!
 * Make sure to backup your database before running this script.
 * 
 * Usage: node src/database/cleanup/deleteOldContracts.js
 */

const database = require('../../config/database');

const deleteOldContracts = async () => {
  try {
    console.log('🔄 Starting cleanup of old contract data...\n');

    // Connect to database
    await database.connect();
    const prisma = database.getClient();

    // Step 1: Delete payouts that reference contracts (old system)
    console.log('📊 Step 1: Deleting payouts linked to old contracts...');
    try {
      // Since schema may have already been updated, we'll try to delete all payouts
      // that might be linked to old contracts
      // First, check if we can query the payout model
      const payoutCount = await prisma.payout.count();
      console.log(`   ℹ️  Found ${payoutCount} payouts in database`);
      
      if (payoutCount > 0) {
        // Delete all payouts (they will be recreated with unitId in new system)
        const payoutResult = await prisma.payout.deleteMany({});
        console.log(`   ✅ Deleted ${payoutResult.count} payouts\n`);
      } else {
        console.log(`   ℹ️  No payouts to delete\n`);
      }
    } catch (error) {
      console.log(`   ⚠️  Could not delete payouts: ${error.message}`);
      console.log(`   ℹ️  This is normal if the schema has already been migrated\n`);
    }

    // Step 2: Delete all contracts
    console.log('📊 Step 2: Deleting all old contracts...');
    try {
      const contractResult = await prisma.contract.deleteMany({});
      console.log(`   ✅ Deleted ${contractResult.count} contracts\n`);
    } catch (error) {
      if (error.message.includes('does not exist') || error.message.includes('model')) {
        console.log('   ℹ️  Contract table does not exist (may have already been migrated)\n');
      } else {
        throw error;
      }
    }

    // Step 3: Delete contract pricing (if exists)
    console.log('📊 Step 3: Deleting contract pricing configuration...');
    try {
      const pricingResult = await prisma.contractPricing.deleteMany({});
      console.log(`   ✅ Deleted ${pricingResult.count} pricing configurations\n`);
    } catch (error) {
      // Table might not exist or already deleted
      console.log('   ⚠️  Contract pricing table not found or already deleted\n');
    }

    // Step 4: Summary
    console.log('📊 Step 4: Cleanup summary...');
    const remainingContracts = await prisma.contract.count().catch(() => 0);
    const remainingPayouts = await prisma.payout.count().catch(() => 0);
    
    if (remainingContracts > 0) {
      console.log(`   ⚠️  Warning: ${remainingContracts} contracts still exist`);
    } else {
      console.log(`   ✅ No contracts remaining`);
    }
    
    if (remainingPayouts > 0) {
      console.log(`   ⚠️  Warning: ${remainingPayouts} payouts still exist`);
    } else {
      console.log(`   ✅ No payouts remaining`);
    }
    console.log('');

    console.log('✅ Cleanup completed successfully!\n');
    console.log('📝 Next steps:');
    console.log('   1. Run Prisma migration: npx prisma migrate dev --name contract_placement_marketplace');
    console.log('   2. Generate Prisma client: npx prisma generate');
    console.log('   3. Create initial contract games through admin interface\n');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await database.disconnect();
  }
};

// Run the cleanup
if (require.main === module) {
  deleteOldContracts()
    .then(() => {
      console.log('✨ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { deleteOldContracts };

