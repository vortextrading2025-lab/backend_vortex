#!/usr/bin/env node

/**
 * Setup Contract Game
 * - Deletes all existing contract games
 * - Creates ONE system contract game with specified percentages and amounts
 * 
 * Based on the payout table:
 * Stage 1: Advance Payment 33.35550% (500.00), Total Value 1,500.00, Phase Delivery 350.00
 * Stage 2: Advance Payment 33.34310% (1,150.00), Total Value 3,450.00, Phase Delivery 850.00
 * Stage 3: Advance Payment 33.35041% (2,600.00), Total Value 7,800.00, Phase Delivery 7,800.00
 * 
 * Usage: node src/database/scripts/setupContractGame.js
 */

require('dotenv').config();
const database = require('../../config/database');

const setupContractGame = async () => {
  try {
    console.log('🔄 Starting: Setup Contract Game\n');
    console.log('='.repeat(70));
    
    await database.connect();
    const prisma = database.getClient();

    // Step 1: Get or create admin user
    console.log('\n👤 Step 1: Getting or creating admin user...');
    let admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' }
    });

    if (!admin) {
      console.log('   ⚠️  No admin user found. Creating admin user...');
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
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
      console.log(`   ✅ Created admin user: ${admin.email}`);
    } else {
      console.log(`   ✅ Found admin user: ${admin.email}`);
    }

    // Step 2: Delete all existing contract games (and related data)
    console.log('\n🗑️  Step 2: Deleting all existing contract games...');
    
    // Delete in order to respect foreign key constraints
    const deletedPurchaseRequests = await prisma.purchaseRequest.deleteMany({});
    console.log(`   ✅ Deleted ${deletedPurchaseRequests.count} purchase requests`);
    
    const deletedUnits = await prisma.unit.deleteMany({});
    console.log(`   ✅ Deleted ${deletedUnits.count} units`);
    
    const deletedGames = await prisma.contractGame.deleteMany({});
    console.log(`   ✅ Deleted ${deletedGames.count} contract games`);

    // Step 3: Create the system contract game with specified values
    console.log('\n🎮 Step 3: Creating system contract game...');
    console.log('   Stage 1: Advance Payment 500.00 CAD, Phase Delivery 350.00 CAD');
    console.log('   Stage 2: Advance Payment 1,150.00 CAD, Phase Delivery 850.00 CAD');
    console.log('   Stage 3: Advance Payment 2,600.00 CAD, Phase Delivery 7,800.00 CAD');
    
    // Create contract game with all stage advance payments and payouts
    const contractGame = await prisma.contractGame.create({
      data: {
        name: 'Vortex Contract Game',
        downPayment: 500.00, // Stage 1 advance payment
        advancePaymentStage2: 1150.00, // Stage 2 advance payment
        advancePaymentStage3: 2600.00, // Stage 3 advance payment
        payoutStage1: 1500.00, // Total Value Stage 1 (includes $500 advance + $1,000 profit)
        payoutStage2: 3450.00, // Total Value Stage 2 (includes $1,150 advance + $2,300 profit)
        payoutStage3: 7800.00, // Total Value Stage 3 (includes $2,600 advance + $5,200 profit)
        status: 'ACTIVE',
        createdById: admin.id
      }
    });

    // Create ONE level 10 binary tree of system root units (shared across all stages)
    // This creates a complete binary tree: level 0 (1 unit), level 1 (2 units), ... level 10 (1024 units)
    // Total: 2^11 - 1 = 2047 system root units
    // Stages are progression levels (Stage 1 → Stage 2 → Stage 3), not separate trees
    // All system root units use stage: 1 as base, but the tree is shared for all stages
    console.log(`\n   Creating system root tree (shared for all stages)...`);
    const systemRootUnits = [];
    
    // Level 0: Root unit (1 unit) - Use stage 1 as base
    const rootUnit = await prisma.unit.create({
      data: {
        contractGameId: contractGame.id,
        ownerId: admin.id,
        unitNumber: -1, // Single root
        unitName: `SYSTEM_ROOT_L0_P0`,
        stage: 1, // Use stage 1 as base, but tree is shared
        level: 0,
        positionInLevel: 0,
        isActive: true,
        isSystemRoot: true,
        parentUnitId: null,
        mentorId: null,
        hostId: null
      }
    });
    systemRootUnits.push({ level: 0, position: 0, unit: rootUnit });
    
    // Create levels 1-10 (binary tree structure)
    // Each level has 2^level units
    for (let level = 1; level <= 10; level++) {
      const unitsInLevel = Math.pow(2, level);
      const parentLevel = level - 1;
      
      for (let position = 0; position < unitsInLevel; position++) {
        // Find parent: parent position = Math.floor(position / 2)
        const parentPosition = Math.floor(position / 2);
        const parentUnit = systemRootUnits.find(
          u => u.level === parentLevel && u.position === parentPosition
        );
        
        if (!parentUnit) {
          throw new Error(`Parent unit not found for level ${level}, position ${position}`);
        }
        
        const systemUnit = await prisma.unit.create({
          data: {
            contractGameId: contractGame.id,
            ownerId: admin.id,
            unitNumber: -(level * 1000 + position + 1), // Unique negative numbers
            unitName: `SYSTEM_ROOT_L${level}_P${position}`,
            stage: 1, // All system roots use stage 1, but tree is shared
            level: level,
            positionInLevel: position,
            isActive: true,
            isSystemRoot: true,
            parentUnitId: parentUnit.unit.id,
            mentorId: null,
            hostId: null
          }
        });
        
        systemRootUnits.push({ level: level, position: position, unit: systemUnit });
      }
    }
    
    console.log(`   ✅ Created ${systemRootUnits.length} system root units (levels 0-10, shared for all stages)`);

    console.log(`\n✅ Successfully created contract game!`);
    console.log(`   ID: ${contractGame.id}`);
    console.log(`   Name: ${contractGame.name}`);
    console.log(`   Stage 1 Advance Payment: ${Number(contractGame.downPayment)} CAD`);
    console.log(`   Stage 2 Advance Payment: ${Number(contractGame.advancePaymentStage2)} CAD`);
    console.log(`   Stage 3 Advance Payment: ${Number(contractGame.advancePaymentStage3)} CAD`);
    console.log(`   Stage 1 Payout: ${Number(contractGame.payoutStage1)} CAD`);
    console.log(`   Stage 2 Payout: ${Number(contractGame.payoutStage2)} CAD`);
    console.log(`   Stage 3 Payout: ${Number(contractGame.payoutStage3)} CAD`);
    console.log(`   Status: ${contractGame.status}`);

    console.log('\n✨ Script completed successfully!\n');
  } catch (error) {
    console.error('❌ Error setting up contract game:', error);
    console.error('\n💥 Script failed:', error.message);
    throw error;
  } finally {
    await database.disconnect();
  }
};

// Run the script
if (require.main === module) {
  setupContractGame()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      process.exit(1);
    });
}

module.exports = { setupContractGame };

