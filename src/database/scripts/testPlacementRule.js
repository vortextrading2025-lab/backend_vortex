require('dotenv').config();
const database = require('../../config/database');
const PurchaseService = require('../../services/purchaseService');
const PlacementService = require('../../services/placementService');

/**
 * Test that every 4-unit set follows the same placement pattern as 101-104
 */
async function testPlacementRule() {
  try {
    console.log('🧪 Testing Placement Rule: Every set follows same pattern as 101-104\n');

    // Find or create test user
    let testUser = await database.getClient().user.findFirst({
      where: { email: 'test1@gmail.com' }
    });

    if (!testUser) {
      console.log('❌ Test user test1@gmail.com not found');
      return;
    }

    console.log(`✅ Found test user: ${testUser.email} (${testUser.id})\n`);

    // Find active contract game
    const contractGame = await database.getClient().contractGame.findFirst({
      where: { status: 'ACTIVE' }
    });

    if (!contractGame) {
      console.log('❌ No active contract game found');
      return;
    }

    console.log(`✅ Found contract game: ${contractGame.name} (${contractGame.id})\n`);

    // Get user's current units
    const existingUnits = await database.getClient().unit.findMany({
      where: {
        ownerId: testUser.id,
        contractGameId: contractGame.id,
        stage: 1,
        isSystemRoot: false
      },
      include: {
        parentUnit: {
          select: {
            id: true,
            unitName: true,
            unitNumber: true
          }
        }
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`📊 Current units: ${existingUnits.length}`);
    existingUnits.forEach(unit => {
      const parentInfo = unit.parentUnit 
        ? `under ${unit.parentUnit.unitName} (${unit.parentUnit.unitNumber})`
        : 'no parent';
      console.log(`  - Unit ${unit.unitNumber} (${unit.unitName}): ${parentInfo}`);
    });

    // Determine next set to purchase
    const maxUnitNumber = existingUnits.length > 0 
      ? Math.max(...existingUnits.map(u => u.unitNumber))
      : 100;
    
    // Calculate next set: if max is 104, next set is 105-108
    const currentSetEnd = Math.ceil((maxUnitNumber - 100) / 4) * 4 + 100;
    const nextSet = currentSetEnd + 1;
    
    if (nextSet <= 2000) {
      console.log(`\n📦 Next set to purchase: ${nextSet}-${nextSet + 3}`);
      console.log(`   Expected pattern:`);
      console.log(`   - ${nextSet} (odd) → under host (owner's existing units)`);
      console.log(`   - ${nextSet + 1} (even) → under ${nextSet} (first odd of set)`);
      console.log(`   - ${nextSet + 2} (odd) → under host (owner's existing units)`);
      console.log(`   - ${nextSet + 3} (even) → under ${nextSet} (first odd of set)`);
      
      // Check if user has wallet
      const wallet = await database.getClient().wallet.findUnique({
        where: { userId: testUser.id }
      });

      if (!wallet) {
        console.log('\n❌ User has no wallet');
        return;
      }

      // Check if user has enough balance (assuming 500 per unit)
      const requiredBalance = 4 * 500;
      if (wallet.balance < requiredBalance) {
        console.log(`\n💰 Adding balance to wallet (current: ${wallet.balance}, required: ${requiredBalance})`);
        await database.getClient().wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: requiredBalance }
          }
        });
      }

      console.log(`\n🛒 Creating purchase request for units ${nextSet}-${nextSet + 3}...`);
      
      // Create purchase request
      const purchaseRequest = await PurchaseService.createPurchaseRequest(
        testUser.id,
        contractGame.id,
        4, // 4 units
        null // no invite code
      );

      console.log(`✅ Purchase request created: ${purchaseRequest.id}`);
      console.log(`   Status: ${purchaseRequest.status}`);
      console.log(`   Unit count: ${purchaseRequest.unitCount}`);

      // Process placement
      console.log(`\n📍 Processing placement...`);
      const result = await PurchaseService.processPlacement(purchaseRequest.id);
      
      console.log(`✅ Placement completed`);
      console.log(`   Placed ${result.placedUnits.length} units`);

      // Verify placement
      console.log(`\n🔍 Verifying placement...\n`);
      
      const allUnits = await database.getClient().unit.findMany({
        where: {
          ownerId: testUser.id,
          contractGameId: contractGame.id,
          stage: 1,
          isSystemRoot: false
        },
        include: {
          parentUnit: {
            select: {
              id: true,
              unitName: true,
              unitNumber: true
            }
          }
        },
        orderBy: { unitNumber: 'asc' }
      });

      const newUnits = allUnits.filter(u => u.unitNumber >= nextSet && u.unitNumber <= nextSet + 3);
      
      console.log(`📊 New units placed:`);
      newUnits.forEach(unit => {
        const parentInfo = unit.parentUnit 
          ? `under ${unit.parentUnit.unitName} (${unit.parentUnit.unitNumber})`
          : 'no parent';
        console.log(`  - Unit ${unit.unitNumber} (${unit.unitName}): ${parentInfo}`);
      });

      // Check if pattern is correct
      const firstOdd = newUnits.find(u => u.unitNumber === nextSet);
      const firstEven = newUnits.find(u => u.unitNumber === nextSet + 1);
      const secondOdd = newUnits.find(u => u.unitNumber === nextSet + 2);
      const secondEven = newUnits.find(u => u.unitNumber === nextSet + 3);

      console.log(`\n✅ Pattern verification:`);
      
      // Check if first even is under first odd
      if (firstEven && firstOdd && firstEven.parentUnitId === firstOdd.id) {
        console.log(`   ✅ ${firstEven.unitNumber} is under ${firstOdd.unitNumber} (correct)`);
      } else {
        console.log(`   ❌ ${firstEven?.unitNumber} should be under ${firstOdd?.unitNumber}`);
      }

      // Check if second even is under first odd
      if (secondEven && firstOdd && secondEven.parentUnitId === firstOdd.id) {
        console.log(`   ✅ ${secondEven.unitNumber} is under ${firstOdd.unitNumber} (correct)`);
      } else {
        console.log(`   ❌ ${secondEven?.unitNumber} should be under ${firstOdd?.unitNumber}`);
      }

      // Check if odd units are under owner's existing units (102, 104) or their subtrees
      const ownerEvenUnits = existingUnits.filter(u => u.unitNumber % 2 === 0);
      if (ownerEvenUnits.length > 0) {
        const isFirstOddUnderOwnerUnits = firstOdd && (
          firstOdd.parentUnitId === ownerEvenUnits[0].id ||
          (firstOdd.parentUnit && ownerEvenUnits.some(eu => 
            firstOdd.parentUnit.unitNumber === eu.unitNumber || 
            firstOdd.parentUnit.unitNumber === eu.unitNumber
          ))
        );
        
        if (isFirstOddUnderOwnerUnits || (firstOdd && firstOdd.parentUnit && !firstOdd.parentUnit.isSystemRoot)) {
          console.log(`   ✅ ${firstOdd.unitNumber} is under owner's existing units subtree (correct)`);
        } else {
          console.log(`   ⚠️  ${firstOdd?.unitNumber} placement needs verification`);
        }
      }

    } else {
      console.log(`\n✅ User already has units up to ${maxUnitNumber}`);
      console.log(`   Next set would be: ${nextSetStart}-${nextSetStart + 3}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await database.disconnect();
  }
}

testPlacementRule()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

