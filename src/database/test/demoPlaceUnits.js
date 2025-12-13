#!/usr/bin/env node

/**
 * Demo Script: Approve and Place Units for mentor1@gmail.com
 * - Uses existing mentor1@gmail.com account
 * - Finds pending purchase requests
 * - Approves and places units
 * - Shows tree structure to demonstrate algorithm
 * 
 * Usage: node src/database/test/demoPlaceUnits.js
 */

const database = require('../../config/database');
const logger = require('../../modules/logging/logger');
const PurchaseService = require('../../services/purchaseService');
const PlacementService = require('../../services/placementService');

const demoPlaceUnits = async () => {
  try {
    console.log('🎯 DEMO: Approve and Place Units for mentor1@gmail.com\n');
    console.log('='.repeat(70));
    
    await database.connect();
    const prisma = database.getClient();

    // Step 1: Get existing mentor1 account
    console.log('\n👤 Step 1: Finding mentor1@gmail.com account...');
    const mentor1 = await prisma.user.findUnique({
      where: { email: 'mentor1@gmail.com' }
    });

    if (!mentor1) {
      throw new Error('mentor1@gmail.com account not found! Please create it first.');
    }

    if (mentor1.role !== 'MENTOR') {
      console.log(`   ⚠️  User exists but role is ${mentor1.role}, updating to MENTOR...`);
      await prisma.user.update({
        where: { id: mentor1.id },
        data: { role: 'MENTOR', status: 'ACTIVE' }
      });
    }

    console.log(`   ✅ Found mentor: ${mentor1.email} (ID: ${mentor1.id})`);
    console.log(`   📊 Role: ${mentor1.role}, Status: ${mentor1.status}`);

    // Step 2: Find pending purchase requests assigned to mentor1
    console.log('\n📋 Step 2: Finding pending purchase requests...');
    const pendingRequests = await prisma.purchaseRequest.findMany({
      where: {
        mentorId: mentor1.id,
        status: 'PENDING'
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        contractGame: {
          select: {
            id: true,
            name: true,
            downPayment: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`   📦 Found ${pendingRequests.length} pending request(s)`);

    if (pendingRequests.length === 0) {
      console.log('\n   ⚠️  No pending requests found!');
      console.log('   💡 Tip: Create some purchase requests first, or check if requests are assigned to this mentor.');
      
      // Show all requests for this mentor (any status)
      const allRequests = await prisma.purchaseRequest.findMany({
        where: { mentorId: mentor1.id },
        include: {
          user: { select: { email: true } },
          contractGame: { select: { name: true } }
        }
      });
      
      if (allRequests.length > 0) {
        console.log(`\n   📊 Total requests for mentor1: ${allRequests.length}`);
        const statusCounts = allRequests.reduce((acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1;
          return acc;
        }, {});
        console.log('   Status breakdown:', statusCounts);
      }
      
      return;
    }

    // Step 3: Approve and place each request
    console.log('\n✅ Step 3: Approving and placing units...\n');
    
    for (let i = 0; i < pendingRequests.length; i++) {
      const request = pendingRequests[i];
      console.log(`\n   📦 Request ${i + 1}/${pendingRequests.length}:`);
      console.log(`      User: ${request.user.email} (${request.user.firstName} ${request.user.lastName})`);
      console.log(`      Game: ${request.contractGame.name}`);
      console.log(`      Units: ${request.unitCount}`);
      console.log(`      Amount: $${Number(request.totalAmount)}`);

      try {
        // Approve the request (mentor1 is the host by default)
        console.log(`      🔄 Approving request...`);
        await PurchaseService.approvePurchase(
          request.id,
          mentor1.id,
          mentor1.id // Host is mentor1
        );
        console.log(`      ✅ Request approved`);

        // Place the units
        console.log(`      🔄 Placing units...`);
        const placementResult = await PurchaseService.processPlacement(request.id);
        console.log(`      ✅ Placed ${placementResult.units.length} unit(s)`);
        
        // Show where units were placed
        placementResult.units.forEach((unit, idx) => {
          console.log(`         ${idx + 1}. ${unit.unitName} (#${unit.unitNumber}) - Level ${unit.level}, Position ${unit.positionInLevel}`);
        });

      } catch (error) {
        console.log(`      ❌ Error: ${error.message}`);
      }
    }

    // Step 4: Show tree structure
    console.log('\n🌳 Step 4: Showing tree structure...\n');
    
    // Get all contract games
    const contractGames = await prisma.contractGame.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    for (const game of contractGames) {
      console.log(`\n   🎮 Game: ${game.name} (ID: ${game.id})`);
      
      // Get all units in this game
      const units = await prisma.unit.findMany({
        where: {
          contractGameId: game.id,
          stage: 1
        },
        include: {
          owner: {
            select: {
              email: true,
              firstName: true,
              lastName: true
            }
          },
          parentUnit: {
            select: {
              unitName: true,
              unitNumber: true
            }
          }
        },
        orderBy: [
          { level: 'asc' },
          { positionInLevel: 'asc' }
        ]
      });

      console.log(`   📊 Total units: ${units.length}`);
      
      // Group by level
      const unitsByLevel = {};
      units.forEach(unit => {
        if (!unitsByLevel[unit.level]) {
          unitsByLevel[unit.level] = [];
        }
        unitsByLevel[unit.level].push(unit);
      });

      // Show tree structure
      Object.keys(unitsByLevel).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
        const levelUnits = unitsByLevel[level];
        console.log(`\n      Level ${level} (${levelUnits.length} units):`);
        levelUnits.forEach(unit => {
          const parentInfo = unit.parentUnit 
            ? `under ${unit.parentUnit.unitName}` 
            : 'ROOT';
          const status = unit.isActive ? '🟢 ACTIVE' : unit.isCompleted ? '✅ COMPLETED' : '⚪ INACTIVE';
          console.log(`         - ${unit.unitName} (#${unit.unitNumber}) - ${status} - ${parentInfo}`);
          console.log(`           Owner: ${unit.owner.email}`);
        });
      });
    }

    // Step 5: Summary
    console.log('\n📊 Step 5: Summary...\n');
    
    const allRequests = await prisma.purchaseRequest.findMany({
      where: { mentorId: mentor1.id },
      include: {
        user: { select: { email: true } },
        contractGame: { select: { name: true } }
      }
    });

    const statusCounts = allRequests.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    console.log(`   📦 Total requests for mentor1: ${allRequests.length}`);
    console.log(`   Status breakdown:`);
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`      - ${status}: ${count}`);
    });

    const totalUnitsPlaced = allRequests
      .filter(r => r.status === 'PLACED')
      .reduce((sum, r) => sum + r.unitCount, 0);
    
    console.log(`\n   ✅ Total units placed: ${totalUnitsPlaced}`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ DEMO COMPLETE: Algorithm is working!');
    console.log('='.repeat(70) + '\n');
    console.log('💡 Next steps for demo:');
    console.log('   1. Login to frontend as mentor1@gmail.com');
    console.log('   2. Go to /mentor/requests to see the requests');
    console.log('   3. Go to /contract-games to see the tree structure');
    console.log('   4. Show how units are placed in the tree algorithm\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    logger.error('Error in demoPlaceUnits:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
};

// Run if called directly
if (require.main === module) {
  demoPlaceUnits();
}

module.exports = demoPlaceUnits;

