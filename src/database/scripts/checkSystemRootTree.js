#!/usr/bin/env node

/**
 * Check System Root Tree
 * Checks if a level 10 binary tree of system root units already exists
 * 
 * Usage: node src/database/scripts/checkSystemRootTree.js
 */

require('dotenv').config();
const database = require('../../config/database');

const checkSystemRootTree = async () => {
  try {
    console.log('🔍 Checking System Root Tree Status\n');
    console.log('='.repeat(70));
    
    await database.connect();
    const prisma = database.getClient();

    // Get all contract games
    const contractGames = await prisma.contractGame.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        createdAt: true
      }
    });

    if (contractGames.length === 0) {
      console.log('\n❌ No active contract games found.');
      console.log('   Run setupContractGame.js to create a contract game with system root tree.\n');
      return;
    }

    console.log(`\n📊 Found ${contractGames.length} active contract game(s):`);
    contractGames.forEach((game, index) => {
      console.log(`   ${index + 1}. ${game.name} (ID: ${game.id})`);
    });

    // Check system root units for each contract game
    for (const game of contractGames) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`\n🎮 Checking: ${game.name} (${game.id})`);
      
      // Get all system root units for this game
      const systemRoots = await prisma.unit.findMany({
        where: {
          contractGameId: game.id,
          isSystemRoot: true
        },
        select: {
          id: true,
          unitName: true,
          unitNumber: true,
          level: true,
          stage: true,
          parentUnitId: true
        },
        orderBy: [
          { level: 'asc' },
          { positionInLevel: 'asc' }
        ]
      });

      if (systemRoots.length === 0) {
        console.log('\n❌ No system root units found for this contract game.');
        console.log('   Run setupContractGame.js to create system root tree.\n');
        continue;
      }

      // Group by level
      const byLevel = {};
      systemRoots.forEach(unit => {
        if (!byLevel[unit.level]) {
          byLevel[unit.level] = [];
        }
        byLevel[unit.level].push(unit);
      });

      const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);
      const maxLevel = Math.max(...levels);
      const expectedTotal = Math.pow(2, 11) - 1; // 2^11 - 1 = 2047 for level 0-10

      console.log(`\n📈 System Root Tree Status:`);
      console.log(`   Total System Root Units: ${systemRoots.length}`);
      console.log(`   Expected Total (Level 0-10): ${expectedTotal}`);
      console.log(`   Maximum Level Found: ${maxLevel}`);
      console.log(`   Expected Maximum Level: 10`);

      // Check each level
      console.log(`\n📊 Breakdown by Level:`);
      let isComplete = true;
      for (let level = 0; level <= 10; level++) {
        const unitsAtLevel = byLevel[level] || [];
        const expectedAtLevel = level === 0 ? 1 : Math.pow(2, level);
        const status = unitsAtLevel.length === expectedAtLevel ? '✅' : '❌';
        
        if (unitsAtLevel.length !== expectedAtLevel) {
          isComplete = false;
        }

        console.log(`   Level ${level.toString().padStart(2)}: ${unitsAtLevel.length.toString().padStart(4)} / ${expectedAtLevel.toString().padStart(4)} units ${status}`);
      }

      // Check for level 0 root
      const level0Root = systemRoots.find(u => u.level === 0 && u.parentUnitId === null);
      if (level0Root) {
        console.log(`\n✅ Level 0 Root Found: ${level0Root.unitName} (Unit #${level0Root.unitNumber})`);
      } else {
        console.log(`\n❌ Level 0 Root NOT Found`);
        isComplete = false;
      }

      // Final status
      console.log(`\n${'='.repeat(70)}`);
      if (isComplete && maxLevel === 10 && systemRoots.length === expectedTotal) {
        console.log(`\n✅ COMPLETE: Level 10 binary tree exists!`);
        console.log(`   All ${expectedTotal} system root units are present (levels 0-10).`);
      } else {
        console.log(`\n⚠️  INCOMPLETE: System root tree is not complete.`);
        if (maxLevel < 10) {
          console.log(`   Maximum level is ${maxLevel}, but level 10 is required.`);
        }
        if (systemRoots.length !== expectedTotal) {
          console.log(`   Found ${systemRoots.length} units, but ${expectedTotal} are expected.`);
        }
        console.log(`   Run setupContractGame.js to create/update the system root tree.`);
      }
    }

    console.log('\n✨ Check completed!\n');
  } catch (error) {
    console.error('❌ Error checking system root tree:', error);
    console.error('\n💥 Script failed:', error.message);
    throw error;
  } finally {
    await database.disconnect();
  }
};

// Run the script
if (require.main === module) {
  checkSystemRootTree()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      process.exit(1);
    });
}

module.exports = { checkSystemRootTree };

