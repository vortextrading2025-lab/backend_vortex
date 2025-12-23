#!/usr/bin/env node

/**
 * Ensure Contract Game Exists
 * - Checks if an active contract game exists
 * - If not, creates one with system root tree
 * 
 * Usage: node src/database/scripts/ensureContractGame.js
 */

require('dotenv').config();
const database = require('../../config/database');
const { setupContractGame } = require('./setupContractGame');

const ensureContractGame = async () => {
  try {
    console.log('🔍 Checking for Active Contract Game\n');
    console.log('='.repeat(70));
    
    await database.connect();
    const prisma = database.getClient();

    // Check if active contract game exists
    const activeGame = await prisma.contractGame.findFirst({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        createdAt: true
      }
    });

    if (activeGame) {
      console.log(`\n✅ Active contract game found:`);
      console.log(`   Name: ${activeGame.name}`);
      console.log(`   ID: ${activeGame.id}`);
      console.log(`   Created: ${activeGame.createdAt}`);
      
      // Check if system root tree exists
      const systemRootCount = await prisma.unit.count({
        where: {
          contractGameId: activeGame.id,
          isSystemRoot: true
        }
      });
      
      console.log(`\n📊 System Root Tree Status:`);
      console.log(`   System Root Units: ${systemRootCount}`);
      
      if (systemRootCount === 0) {
        console.log(`\n⚠️  No system root tree found. Run setupContractGame.js to create it.`);
      } else if (systemRootCount < 2047) {
        console.log(`\n⚠️  Incomplete system root tree (expected 2047, found ${systemRootCount}).`);
        console.log(`   Run setupContractGame.js to recreate it.`);
      } else {
        console.log(`   ✅ Complete level 10 binary tree exists (${systemRootCount} units)`);
      }
      
      console.log('\n✨ Contract game is ready!\n');
      return;
    }

    console.log('\n❌ No active contract game found.');
    console.log('   Creating new contract game with system root tree...\n');
    
    // Create contract game
    await setupContractGame();
    
    console.log('\n✅ Contract game created successfully!\n');
  } catch (error) {
    console.error('❌ Error ensuring contract game:', error);
    console.error('\n💥 Script failed:', error.message);
    throw error;
  } finally {
    await database.disconnect();
  }
};

// Run the script
if (require.main === module) {
  ensureContractGame()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      process.exit(1);
    });
}

module.exports = { ensureContractGame };

