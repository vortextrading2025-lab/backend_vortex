#!/usr/bin/env node

/**
 * Check Placement Issues
 * Diagnoses why purchase requests might be stuck in APPROVED status
 * 
 * Usage: node src/database/scripts/checkPlacementIssues.js
 */

require('dotenv').config();
const database = require('../../config/database');

const checkPlacementIssues = async () => {
  try {
    console.log('🔍 Checking Placement Issues\n');
    console.log('='.repeat(70));
    
    await database.connect();
    const prisma = database.getClient();

    // Check for stuck APPROVED requests
    console.log('\n📋 Checking for stuck APPROVED purchase requests...');
    const approvedRequests = await prisma.purchaseRequest.findMany({
      where: {
        status: 'APPROVED',
        refundedAt: null
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        },
        contractGame: {
          select: {
            id: true,
            name: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (approvedRequests.length === 0) {
      console.log('   ✅ No stuck APPROVED requests found.');
    } else {
      console.log(`   ⚠️  Found ${approvedRequests.length} stuck APPROVED request(s):`);
      approvedRequests.forEach((req, index) => {
        console.log(`\n   ${index + 1}. Request ${req.id}`);
        console.log(`      User: ${req.user.email}`);
        console.log(`      Contract Game: ${req.contractGame.name} (${req.contractGame.status})`);
        console.log(`      Units: ${req.unitCount}`);
        console.log(`      Created: ${req.createdAt}`);
        console.log(`      Cooldown Ends: ${req.cooldownEndsAt || 'Not set'}`);
      });
    }

    // Check for active contract games
    console.log('\n🎮 Checking active contract games...');
    const activeGames = await prisma.contractGame.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        createdAt: true
      }
    });

    if (activeGames.length === 0) {
      console.log('   ❌ No active contract games found!');
      console.log('   💡 Run setupContractGame.js to create a contract game.');
    } else {
      console.log(`   ✅ Found ${activeGames.length} active contract game(s):`);
      for (const game of activeGames) {
        console.log(`\n   Game: ${game.name} (${game.id})`);
        
        // Check system root tree
        const systemRootCount = await prisma.unit.count({
          where: {
            contractGameId: game.id,
            isSystemRoot: true
          }
        });
        
        const level0Root = await prisma.unit.findFirst({
          where: {
            contractGameId: game.id,
            isSystemRoot: true,
            level: 0,
            parentUnitId: null
          }
        });
        
        console.log(`      System Root Units: ${systemRootCount}`);
        if (systemRootCount === 0) {
          console.log(`      ❌ No system root tree found!`);
          console.log(`      💡 Run setupContractGame.js to create system root tree.`);
        } else if (systemRootCount < 2047) {
          console.log(`      ⚠️  Incomplete system root tree (expected 2047, found ${systemRootCount})`);
        } else {
          console.log(`      ✅ Complete system root tree (${systemRootCount} units)`);
        }
        
        if (!level0Root) {
          console.log(`      ❌ No level 0 root found!`);
        } else {
          console.log(`      ✅ Level 0 root: ${level0Root.unitName}`);
          
          // Check if root has space
          const directChildren = await prisma.unit.count({
            where: {
              parentUnitId: level0Root.id,
              level: 1
            }
          });
          console.log(`      Root children: ${directChildren}/2`);
        }
      }
    }

    // Check for APPROVED requests and try to identify issues
    if (approvedRequests.length > 0) {
      console.log('\n🔧 Diagnosing placement issues...');
      for (const req of approvedRequests) {
        console.log(`\n   Request ${req.id}:`);
        
        // Check if contract game is active
        if (req.contractGame.status !== 'ACTIVE') {
          console.log(`      ❌ Contract game is not ACTIVE (status: ${req.contractGame.status})`);
        }
        
        // Check if system root exists
        const systemRoot = await prisma.unit.findFirst({
          where: {
            contractGameId: req.contractGameId,
            isSystemRoot: true,
            level: 0,
            parentUnitId: null
          }
        });
        
        if (!systemRoot) {
          console.log(`      ❌ No system root found for contract game ${req.contractGameId}`);
          console.log(`      💡 This is likely why placement is failing. Run setupContractGame.js`);
        } else {
          console.log(`      ✅ System root exists: ${systemRoot.unitName}`);
        }
        
        // Check if any units were created
        const units = await prisma.unit.findMany({
          where: {
            ownerId: req.userId,
            contractGameId: req.contractGameId,
            isSystemRoot: false,
            createdAt: {
              gte: req.createdAt
            }
          }
        });
        
        console.log(`      Units created: ${units.length}/${req.unitCount}`);
        if (units.length > 0 && units.length < req.unitCount) {
          console.log(`      ⚠️  Partial placement - ${units.length} of ${req.unitCount} units were placed`);
        }
      }
    }

    console.log('\n✨ Diagnostic complete!\n');
  } catch (error) {
    console.error('❌ Error checking placement issues:', error);
    console.error('\n💥 Script failed:', error.message);
    throw error;
  } finally {
    await database.disconnect();
  }
};

// Run the script
if (require.main === module) {
  checkPlacementIssues()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      process.exit(1);
    });
}

module.exports = { checkPlacementIssues };

