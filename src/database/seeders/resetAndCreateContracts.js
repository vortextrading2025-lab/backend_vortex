#!/usr/bin/env node

/**
 * Reset and Create Default Contracts Script
 * Deletes all existing contracts and creates 4 default running contracts
 * Usage: node src/database/seeders/resetAndCreateContracts.js
 */

const database = require('../../config/database');
const logger = require('../../modules/logging/logger');

const resetAndCreateContracts = async () => {
  try {
    console.log('🔄 Starting contract reset and creation...');

    // Connect to database
    await database.connect();

    // Get or create admin user for system ownership
    let adminUser = await database.getClient().user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' }
    });

    if (!adminUser) {
      console.log('⚠️  Admin user not found. Creating admin user...');
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('12345678', 12);
      adminUser = await database.getClient().user.create({
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
      console.log('✅ Admin user created');
    }

    // Step 1: Delete ALL contracts (including system contracts and user contracts)
    console.log('\n🗑️  Deleting all existing contracts...');
    const deleteResult = await database.getClient().contract.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.count} contracts`);

    // Step 2: Create pricing configuration - $25,000 down payment
    console.log('\n💰 Setting up pricing configuration...');
    const stages = ['STAGE_1', 'STAGE_2', 'STAGE_3'];
    const defaultPrices = {
      'STAGE_1': 25000.00,
      'STAGE_2': 25000.00,
      'STAGE_3': 25000.00
    };

    for (const stage of stages) {
      await database.getClient().contractPricing.upsert({
        where: { stage },
        update: { price: defaultPrices[stage], isActive: true },
        create: {
          stage: stage,
          price: defaultPrices[stage],
          isActive: true
        }
      });
    }
    console.log('✅ Pricing configuration set ($25,000 per 4 units)');

    // Step 3: Create 4 default running contracts (system contracts)
    // We'll create 4 system root contracts - 1 for STAGE_1, and 3 more for variety
    console.log('\n🌱 Creating 4 default running contracts...');

    const systemContracts = [];
    // Create 4 system root contracts with different contract numbers
    // Using 0, -1, -2, -3 for system roots (all in STAGE_1)
    const systemContractNumbers = [0, -1, -2, -3];

    for (let i = 0; i < 4; i++) {
      const stage = 'STAGE_1'; // All contracts in STAGE_1
      const contractNumber = systemContractNumbers[i];

      // Create root contract
      const rootContract = await database.getClient().contract.create({
        data: {
          contractNumber: contractNumber,
          ownerId: adminUser.id,
          hostId: adminUser.id,
          parentId: null, // Root has no parent
          stage: stage,
          status: 'ACTIVE',
          level: 0,
          position: 0,
          positionInLevel: 0,
          isActiveUnit: true,
          isActive: true,
          purchasePrice: 0,
          downPayment: 0
        }
      });

      systemContracts.push(rootContract);
      console.log(`✅ Created system root contract #${contractNumber} for ${stage}`);

      // Create default tree structure under each root
      // Use base number for this contract to ensure unique numbering
      const baseNumber = Math.abs(contractNumber) * 10000; // 0, 10000, 20000, 30000
      
      // Level 1: 2 units
      const level1Units = [];
      for (let j = 0; j < 2; j++) {
        const unit = await database.getClient().contract.create({
          data: {
            contractNumber: baseNumber + 10 + j, // 10-11, 10010-10011, etc.
            ownerId: adminUser.id,
            hostId: adminUser.id,
            parentId: rootContract.id,
            stage: stage,
            status: 'ACTIVE',
            level: 1,
            position: j,
            positionInLevel: 0,
            isActiveUnit: false,
            isActive: true,
            purchasePrice: 0,
            downPayment: 0
          }
        });
        level1Units.push(unit);
      }
      console.log(`  ✅ Created 2 Level 1 units under contract #${contractNumber}`);

      // Level 2: 4 units (2 children per level 1 unit)
      const level2Units = [];
      for (let j = 0; j < level1Units.length; j++) {
        const parent = level1Units[j];
        for (let k = 0; k < 2; k++) {
          const unit = await database.getClient().contract.create({
            data: {
              contractNumber: baseNumber + 20 + (j * 2) + k, // 20-23, 10020-10023, etc.
              ownerId: adminUser.id,
              hostId: adminUser.id,
              parentId: parent.id,
              stage: stage,
              status: 'ACTIVE',
              level: 2,
              position: k,
              positionInLevel: 0,
              isActiveUnit: false,
              isActive: true,
              purchasePrice: 0,
              downPayment: 0
            }
          });
          level2Units.push(unit);
        }
      }
      console.log(`  ✅ Created 4 Level 2 units under contract #${contractNumber}`);

      // Level 3: 8 units (2 children per level 2 unit)
      const level3Units = [];
      for (let j = 0; j < level2Units.length; j++) {
        const parent = level2Units[j];
        for (let k = 0; k < 2; k++) {
          const unit = await database.getClient().contract.create({
            data: {
              contractNumber: baseNumber + 30 + (j * 2) + k, // 30-37, 10030-10037, etc.
              ownerId: adminUser.id,
              hostId: adminUser.id,
              parentId: parent.id,
              stage: stage,
              status: 'ACTIVE',
              level: 3,
              position: k,
              positionInLevel: 0,
              isActiveUnit: false,
              isActive: true,
              purchasePrice: 0,
              downPayment: 0
            }
          });
          level3Units.push(unit);
        }
      }
      console.log(`  ✅ Created 8 Level 3 units under contract #${contractNumber}`);

      // Level 4: 16 units (2 children per level 3 unit) - These are the placement points
      for (let j = 0; j < level3Units.length; j++) {
        const parent = level3Units[j];
        for (let k = 0; k < 2; k++) {
          const unit = await database.getClient().contract.create({
            data: {
              contractNumber: baseNumber + 40 + (j * 2) + k, // 40-55, 10040-10055, etc.
              ownerId: adminUser.id,
              hostId: adminUser.id,
              parentId: parent.id,
              stage: stage,
              status: 'ACTIVE',
              level: 4,
              position: k,
              positionInLevel: 0,
              isActiveUnit: false,
              isActive: true,
              purchasePrice: 0,
              downPayment: 0
            }
          });
        }
      }
      console.log(`  ✅ Created 16 Level 4 units under contract #${contractNumber}`);
    }

    console.log('\n✅ Successfully created 4 default running contracts!');
    console.log('\n📊 Summary:');
    console.log(`   - Deleted all existing contracts`);
    console.log(`   - Created 4 system root contracts (contract numbers: 0, -1, -2, -3)`);
    console.log(`   - Each root has a full binary tree structure:`);
    console.log(`     * Level 1: 2 units`);
    console.log(`     * Level 2: 4 units`);
    console.log(`     * Level 3: 8 units`);
    console.log(`     * Level 4: 16 units (placement points for user units)`);
    console.log(`   - Total: 4 roots + 120 system units = 124 contracts`);
    console.log(`   - Pricing: $25,000 per 4 units`);
    console.log('\n🎉 You can now buy units and test the system!');

  } catch (error) {
    console.error('❌ Error resetting and creating contracts:', error);
    throw error;
  } finally {
    await database.disconnect();
  }
};

// Run the script
if (require.main === module) {
  resetAndCreateContracts()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = resetAndCreateContracts;

