const database = require('../../config/database');
const logger = require('../../modules/logging/logger');

/**
 * Seed initial Vortex system contracts with full stage trees
 * Creates 3 system contracts (one for each stage) with complete tree structures
 */
const seedVortexSystem = async () => {
  try {
    console.log('🌱 Starting Vortex system seeding...');

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

    // Create wallet for admin if doesn't exist
    await database.getClient().wallet.upsert({
      where: { userId: adminUser.id },
      update: {},
      create: {
        userId: adminUser.id,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0
      }
    });

    // Create pricing configuration if doesn't exist - $25,000 down payment
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
    console.log('✅ Pricing configuration created');

    // Clear existing system contracts (optional - comment out to keep existing)
    // await database.getClient().contract.deleteMany({
    //   where: {
    //     ownerId: adminUser.id,
    //     contractNumber: 0
    //   }
    // });

    // Create 3 system root contracts (one for each stage)
    const systemRoots = [];

    for (const stage of stages) {
      // Check if system root already exists - use unique constraint (ownerId, contractNumber)
      // We'll use contractNumber 0 for all system roots, but they're different stages
      // Actually, we need different contract numbers per stage to avoid unique constraint
      // Let's use: 0 for STAGE_1, -1 for STAGE_2, -2 for STAGE_3 (or use stage-specific numbers)
      
      // Better approach: Use stage-specific contract numbers for system roots
      const systemContractNumbers = {
        'STAGE_1': 0,
        'STAGE_2': -1,
        'STAGE_3': -2
      };
      
      const systemContractNumber = systemContractNumbers[stage];
      
      let rootContract = await database.getClient().contract.findFirst({
        where: {
          ownerId: adminUser.id,
          contractNumber: systemContractNumber,
          stage: stage
        }
      });

      if (!rootContract) {
        rootContract = await database.getClient().contract.create({
          data: {
            contractNumber: systemContractNumber, // System contract marker (unique per stage)
            ownerId: adminUser.id, // System owned by admin
            hostId: adminUser.id,
            parentId: null,
            stage: stage,
            status: 'ACTIVE',
            level: 0,
            position: 0,
            positionInLevel: 0,
            isActiveUnit: true,
            isActive: true,
            purchasePrice: 0
          }
        });
        console.log(`✅ Created Vortex system root for ${stage} (contract #${systemContractNumber})`);
      } else {
        console.log(`ℹ️  Vortex system root for ${stage} already exists`);
      }

      systemRoots.push(rootContract);
    }

    // Create full tree structure under each system root
    // For demo: Create a complete binary tree structure that can accommodate many users
    for (let rootIndex = 0; rootIndex < systemRoots.length; rootIndex++) {
      const root = systemRoots[rootIndex];
      const stage = stages[rootIndex];

      console.log(`🌳 Building tree structure for ${stage}...`);

      // Create multiple levels of system units to allow many user placements
      // Level 1: 2 units (binary tree)
      const level1Units = [];
      for (let i = 0; i < 2; i++) {
        const unit = await database.getClient().contract.create({
          data: {
            contractNumber: 100 + (rootIndex * 100) + i + 1, // 101, 102 for STAGE_1, 201, 202 for STAGE_2, etc.
            ownerId: adminUser.id,
            hostId: adminUser.id,
            parentId: root.id,
            stage: stage,
            status: 'ACTIVE',
            level: 1,
            position: i, // 0 or 1 (left or right)
            positionInLevel: 0,
            isActiveUnit: true, // System units are always active
            isActive: true,
            purchasePrice: 0
          }
        });
        level1Units.push(unit);
        console.log(`  ✅ Created Level 1 unit ${unit.contractNumber} at position ${i}`);
      }

      // Level 2: 4 units (2 children per level 1 unit)
      const level2Units = [];
      for (let i = 0; i < level1Units.length; i++) {
        const parent = level1Units[i];
        for (let j = 0; j < 2; j++) {
          const unit = await database.getClient().contract.create({
            data: {
              contractNumber: 100 + (rootIndex * 100) + 10 + (i * 2) + j + 1, // 111, 112, 113, 114 for STAGE_1
              ownerId: adminUser.id,
              hostId: adminUser.id,
              parentId: parent.id,
              stage: stage,
              status: 'ACTIVE',
              level: 2,
              position: j, // 0 or 1
              positionInLevel: 0,
              isActiveUnit: true,
              isActive: true,
              purchasePrice: 0
            }
          });
          level2Units.push(unit);
          console.log(`  ✅ Created Level 2 unit ${unit.contractNumber} under parent ${parent.contractNumber}`);
        }
      }

      // Level 3: 8 units (2 children per level 2 unit)
      const level3Units = [];
      for (let i = 0; i < level2Units.length; i++) {
        const parent = level2Units[i];
        for (let j = 0; j < 2; j++) {
          const unit = await database.getClient().contract.create({
            data: {
              contractNumber: 100 + (rootIndex * 100) + 20 + (i * 2) + j + 1, // 121-128 for STAGE_1
              ownerId: adminUser.id,
              hostId: adminUser.id,
              parentId: parent.id,
              stage: stage,
              status: 'ACTIVE',
              level: 3,
              position: j,
              positionInLevel: 0,
              isActiveUnit: true,
              isActive: true,
              purchasePrice: 0
            }
          });
          level3Units.push(unit);
          console.log(`  ✅ Created Level 3 unit ${unit.contractNumber} under parent ${parent.contractNumber}`);
        }
      }

      // Level 4: 16 units (2 children per level 3 unit) - This provides many placement options
      for (let i = 0; i < level3Units.length; i++) {
        const parent = level3Units[i];
        for (let j = 0; j < 2; j++) {
          const unit = await database.getClient().contract.create({
            data: {
              contractNumber: 100 + (rootIndex * 100) + 30 + (i * 2) + j + 1, // 131-146 for STAGE_1
              ownerId: adminUser.id,
              hostId: adminUser.id,
              parentId: parent.id,
              stage: stage,
              status: 'ACTIVE',
              level: 4,
              position: j,
              positionInLevel: 0,
              isActiveUnit: true,
              isActive: true,
              purchasePrice: 0
            }
          });
          console.log(`  ✅ Created Level 4 unit ${unit.contractNumber} under parent ${parent.contractNumber}`);
        }
      }

      console.log(`✅ Completed tree structure for ${stage}`);
    }

    console.log('\n✅ Vortex system seeding completed successfully!');
    console.log('\n📊 System Structure:');
    console.log('   Created 3 Vortex system root contracts (one per stage)');
    console.log('   Each root has a full binary tree structure:');
    console.log('     - Level 1: 2 units');
    console.log('     - Level 2: 4 units');
    console.log('     - Level 3: 8 units');
    console.log('     - Level 4: 16 units');
    console.log('   Total: 30 system units per stage (90 total)');
    console.log('   These units can accommodate many user contract placements');

  } catch (error) {
    console.error('❌ Vortex system seeding failed:', error);
    throw error;
  }
};

module.exports = seedVortexSystem;

