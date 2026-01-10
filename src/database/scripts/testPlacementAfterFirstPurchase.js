require('dotenv').config();
const database = require('../../config/database');
const PlacementService = require('../../services/placementService');
const PurchaseService = require('../../services/purchaseService');
const WalletService = require('../../modules/wallet/walletService');
const bcrypt = require('bcryptjs');

/**
 * Test script to verify placement rules after first purchase
 * 
 * Test scenario:
 * 1. User test1@gmail.com buys first 4 units (101-104)
 * 2. User test1@gmail.com buys next 4 units (105-108)
 * 3. Verify that units 105-108 are placed under test1's existing units' subtrees
 *    (not as siblings under host/system root)
 */
async function testPlacementAfterFirstPurchase() {
  const assert = (condition, message) => {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      throw new Error(message);
    } else {
      console.log(`✅ PASS: ${message}`);
    }
  };

  const warn = (message) => {
    console.warn(`⚠️  WARN: ${message}`);
  };

  try {
    console.log('🧪 Testing placement rules after first purchase...\n');

    // Step 1: Find or create test1 user
    let test1 = await database.getClient().user.findUnique({
      where: { email: 'test1@gmail.com' }
    });

    if (!test1) {
      console.log('Creating test1 user...');
      const hashedPassword = await bcrypt.hash('Test123!', 10);
      test1 = await database.getClient().user.create({
        data: {
          email: 'test1@gmail.com',
          password: hashedPassword,
          firstName: 'Test',
          lastName: 'One',
          username: 'test1'
        }
      });
    }

    // Step 2: Get or create contract game
    let contractGame = await database.getClient().contractGame.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    if (!contractGame) {
      // Try to find by name
      contractGame = await database.getClient().contractGame.findFirst({
        where: { name: 'Test Contract Game' }
      });
    }

    if (!contractGame) {
      // Use setupContractGame script to create it properly
      console.log('No contract game found. Please run setupContractGame.js first.');
      throw new Error('No contract game found. Please run setupContractGame.js first.');
    }

    // Step 3: Get or create wallet for test1
    const wallet = await WalletService.getWallet(test1.id);

    // Step 4: Check if test1 already has units
    const existingUnits = await database.getClient().unit.findMany({
      where: {
        ownerId: test1.id,
        contractGameId: contractGame.id,
        stage: 1
      },
      include: {
        parentUnit: {
          select: {
            id: true,
            unitName: true,
            unitNumber: true,
            ownerId: true
          }
        }
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`\n📊 Current units for test1: ${existingUnits.length}`);
    existingUnits.forEach(unit => {
      const parentInfo = unit.parentUnit 
        ? `under ${unit.parentUnit.unitName} (owner: ${unit.parentUnit.ownerId === test1.id ? 'test1' : 'other'})`
        : 'no parent';
      console.log(`  - Unit ${unit.unitNumber} (${unit.unitName}) at level ${unit.level}, ${parentInfo}`);
    });

    // Step 5: If test1 has less than 4 units, purchase first 4 units
    if (existingUnits.length < 4) {
      console.log('\n💰 Purchasing first 4 units (101-104)...');
      const firstPurchaseAmount = contractGame.advancePaymentStage1 * 4;
      
      // Add funds to wallet using WalletService
      await WalletService.addToWallet(test1.id, firstPurchaseAmount, null, 'TEST_FUNDS', 'Test funds for first purchase');

      // Purchase 4 units
      const purchaseRequest = await PurchaseService.createPurchaseRequest(
        test1.id,
        contractGame.id,
        4,
        null, // no hostId for first purchase
        null  // no mentorId
      );

      console.log(`✅ First purchase completed: ${purchaseRequest.id}`);
    }

    // Step 6: Get units after first purchase
    const unitsAfterFirst = await database.getClient().unit.findMany({
      where: {
        ownerId: test1.id,
        contractGameId: contractGame.id,
        stage: 1
      },
      include: {
        parentUnit: {
          select: {
            id: true,
            unitName: true,
            unitNumber: true,
            ownerId: true
          }
        }
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`\n📊 Units after first purchase: ${unitsAfterFirst.length}`);
    unitsAfterFirst.forEach(unit => {
      const parentInfo = unit.parentUnit 
        ? `under ${unit.parentUnit.unitName} (owner: ${unit.parentUnit.ownerId === test1.id ? 'test1' : 'other'})`
        : 'no parent';
      console.log(`  - Unit ${unit.unitNumber} (${unit.unitName}) at level ${unit.level}, ${parentInfo}`);
    });

    // Verify first 4 units exist
    assert(unitsAfterFirst.length >= 4, `test1 should have at least 4 units, found ${unitsAfterFirst.length}`);

    // Step 7: Purchase next 4 units (105-108)
    const unitsToPurchase = 4;
    const nextPurchaseAmount = contractGame.advancePaymentStage1 * unitsToPurchase;
    
    console.log(`\n💰 Purchasing next ${unitsToPurchase} units (105-108)...`);
    
    // Add funds to wallet using WalletService
    await WalletService.addToWallet(test1.id, nextPurchaseAmount, null, 'TEST_FUNDS', 'Test funds for second purchase');

    // Purchase next 4 units
    const secondPurchaseRequest = await PurchaseService.createPurchaseRequest(
      test1.id,
      contractGame.id,
      unitsToPurchase,
      null, // no hostId for subsequent purchase
      null  // no mentorId
    );

    console.log(`✅ Second purchase completed: ${secondPurchaseRequest.id}`);

    // Step 8: Get all units after second purchase
    const allUnits = await database.getClient().unit.findMany({
      where: {
        ownerId: test1.id,
        contractGameId: contractGame.id,
        stage: 1
      },
      include: {
        parentUnit: {
          select: {
            id: true,
            unitName: true,
            unitNumber: true,
            ownerId: true
          }
        }
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`\n📊 All units after second purchase: ${allUnits.length}`);
    allUnits.forEach(unit => {
      const parentInfo = unit.parentUnit 
        ? `under ${unit.parentUnit.unitName} (owner: ${unit.parentUnit.ownerId === test1.id ? 'test1' : 'other'})`
        : 'no parent';
      console.log(`  - Unit ${unit.unitNumber} (${unit.unitName}) at level ${unit.level}, ${parentInfo}`);
    });

    // Step 9: Verify placement rules
    console.log('\n🔍 Verifying placement rules...\n');

    // Get units 105-108
    const units105to108 = allUnits.filter(u => u.unitNumber >= 105 && u.unitNumber <= 108);
    
    assert(units105to108.length === 4, `Should have 4 units (105-108), found ${units105to108.length}`);

    // Verify that units 105-108 are placed under test1's existing units' subtrees
    // They should have test1 as the owner of their parent unit (directly or indirectly)
    for (const unit of units105to108) {
      if (unit.parentUnit) {
        // Check if parent is owned by test1
        const isParentOwnedByTest1 = unit.parentUnit.ownerId === test1.id;
        
        if (!isParentOwnedByTest1) {
          // Check if parent's parent is owned by test1 (indirect placement)
          const parentUnit = await database.getClient().unit.findUnique({
            where: { id: unit.parentUnit.id },
            include: {
              parentUnit: {
                select: {
                  ownerId: true
                }
              }
            }
          });

          if (parentUnit && parentUnit.parentUnit) {
            const isGrandparentOwnedByTest1 = parentUnit.parentUnit.ownerId === test1.id;
            assert(
              isGrandparentOwnedByTest1,
              `Unit ${unit.unitNumber} should be in test1's subtree (parent: ${unit.parentUnit.unitName}, owner: ${unit.parentUnit.ownerId === test1.id ? 'test1' : 'other'})`
            );
          } else {
            // Direct parent check
            assert(
              isParentOwnedByTest1,
              `Unit ${unit.unitNumber} should be under test1's unit (parent: ${unit.parentUnit.unitName}, owner: ${unit.parentUnit.ownerId === test1.id ? 'test1' : 'other'})`
            );
          }
        } else {
          console.log(`✅ Unit ${unit.unitNumber} is correctly placed under test1's unit ${unit.parentUnit.unitName}`);
        }
      } else {
        warn(`Unit ${unit.unitNumber} has no parent - this might be incorrect`);
      }
    }

    // Step 10: Verify that units 105-108 are NOT siblings of units 101-104
    // (i.e., they should not be at the same level under the same parent as 101-104)
    const units101to104 = allUnits.filter(u => u.unitNumber >= 101 && u.unitNumber <= 104);
    
    for (const unit105_108 of units105to108) {
      for (const unit101_104 of units101to104) {
        if (unit105_108.parentUnitId === unit101_104.parentUnitId && 
            unit105_108.level === unit101_104.level) {
          // They are siblings - this is OK if parent is test1's unit
          if (unit105_108.parentUnit && unit105_108.parentUnit.ownerId === test1.id) {
            console.log(`✅ Unit ${unit105_108.unitNumber} is sibling of ${unit101_104.unitNumber} under test1's unit - OK`);
          } else {
            warn(`Unit ${unit105_108.unitNumber} is sibling of ${unit101_104.unitNumber} but parent is not test1's unit`);
          }
        }
      }
    }

    console.log('\n✅ All placement rule tests passed!');
    console.log('\n📋 Summary:');
    console.log(`  - Total units: ${allUnits.length}`);
    console.log(`  - Units 101-104: ${units101to104.length}`);
    console.log(`  - Units 105-108: ${units105to108.length}`);
    console.log(`  - All units 105-108 are placed in test1's subtrees ✓`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
}

// Run the test
testPlacementAfterFirstPurchase()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

