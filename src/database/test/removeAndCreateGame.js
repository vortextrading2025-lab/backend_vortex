#!/usr/bin/env node

/**
 * Remove a Contract Game and Create a New One
 * Usage: node src/database/test/removeAndCreateGame.js
 */

const database = require('../../config/database');
const logger = require('../../modules/logging/logger');
const ContractGameService = require('../../services/contractGameService');

const removeAndCreateGame = async () => {
  try {
    console.log('🔄 Starting: Remove contract game and create new one...\n');

    // Connect to database
    await database.connect();
    const prisma = database.getClient();

    // Step 1: Get admin user
    console.log('👤 Step 1: Getting admin user...');
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' }
    });

    if (!admin) {
      throw new Error('No admin user found. Please create an admin user first.');
    }
    console.log(`   ✅ Admin found: ${admin.email} (ID: ${admin.id})\n`);

    // Step 2: List all contract games
    console.log('📋 Step 2: Listing all contract games...');
    const existingGames = await prisma.contractGame.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            units: true,
            purchaseRequests: true
          }
        }
      }
    });

    if (existingGames.length === 0) {
      console.log('   ℹ️  No contract games found. Will create a new one.\n');
    } else {
      console.log(`   Found ${existingGames.length} contract game(s):`);
      existingGames.forEach((game, index) => {
        console.log(`   ${index + 1}. ${game.name} (ID: ${game.id})`);
        console.log(`      - Status: ${game.status}`);
        console.log(`      - Units: ${game._count.units}`);
        console.log(`      - Purchase Requests: ${game._count.purchaseRequests}`);
        console.log(`      - Created: ${game.createdAt.toISOString()}`);
      });
      console.log('');
    }

    // Step 3: Delete all contract games (and related data)
    if (existingGames.length > 0) {
      console.log('🗑️  Step 3: Deleting all contract games and related data...');
      
      // Delete payouts first (they reference units)
      const payoutResult = await prisma.payout.deleteMany({});
      console.log(`   ✅ Deleted ${payoutResult.count} payouts`);

      // Delete purchase requests
      const requestResult = await prisma.purchaseRequest.deleteMany({});
      console.log(`   ✅ Deleted ${requestResult.count} purchase requests`);

      // Delete units
      const unitResult = await prisma.unit.deleteMany({});
      console.log(`   ✅ Deleted ${unitResult.count} units`);

      // Delete contract games
      const gameResult = await prisma.contractGame.deleteMany({});
      console.log(`   ✅ Deleted ${gameResult.count} contract games\n`);
    } else {
      console.log('   ℹ️  Skipping deletion - no games to delete\n');
    }

    // Step 4: Create new contract game
    console.log('🎮 Step 4: Creating new contract game...');
    const newGame = await ContractGameService.createContractGame(
      admin.id,
      'Test Game 2024',
      100.00, // $100 down payment
      {
        payoutStage1: 1000.00, // $1,000 for Stage 1
        payoutStage2: 2000.00, // $2,000 for Stage 2
        payoutStage3: 3000.00  // $3,000 for Stage 3
      }
    );

    console.log(`   ✅ Contract game created: ${newGame.name} (ID: ${newGame.id})`);
    console.log(`   💰 Down Payment: $${newGame.downPayment}`);
    console.log(`   💵 Payouts: Stage 1: $${newGame.payoutStage1}, Stage 2: $${newGame.payoutStage2}, Stage 3: $${newGame.payoutStage3}\n`);

    // Step 5: Verify the game was created
    console.log('✅ Step 5: Verifying game creation...');
    const verifyGame = await prisma.contractGame.findUnique({
      where: { id: newGame.id },
      include: {
        _count: {
          select: {
            units: true
          }
        }
      }
    });

    if (verifyGame) {
      console.log(`   ✅ Game verified: ${verifyGame.name}`);
      console.log(`   📊 System units created: ${verifyGame._count.units}`);
      console.log(`   📅 Created at: ${verifyGame.createdAt.toISOString()}\n`);
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ SUCCESS: Contract game removed and new one created!');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
};

// Run if called directly
if (require.main === module) {
  removeAndCreateGame();
}

module.exports = removeAndCreateGame;

