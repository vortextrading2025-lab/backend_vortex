require('dotenv').config();
const database = require('../../config/database');
const PurchaseService = require('../../services/purchaseService');

/**
 * Delete user's units and test placement with 4 sets (16 units)
 */
async function deleteAndTestPlacement() {
  try {
    console.log('🧪 Delete and Test Placement: 4 sets (16 units)\n');

    // Find user
    const user = await database.getClient().user.findFirst({
      where: { email: 'user996@gmail.com' }
    });

    if (!user) {
      console.log('❌ User user996@gmail.com not found');
      return;
    }

    console.log(`✅ Found user: ${user.email} (${user.id})\n`);

    // Find active contract game
    const contractGame = await database.getClient().contractGame.findFirst({
      where: { status: 'ACTIVE' }
    });

    if (!contractGame) {
      console.log('❌ No active contract game found');
      return;
    }

    console.log(`✅ Found contract game: ${contractGame.name} (${contractGame.id})\n`);

    // Step 1: Delete all user's units
    console.log('🗑️  Step 1: Deleting all user units...\n');
    
    const userUnits = await database.getClient().unit.findMany({
      where: {
        ownerId: user.id,
        contractGameId: contractGame.id,
        isSystemRoot: false
      },
      include: {
        childrenUnits: true
      }
    });

    console.log(`Found ${userUnits.length} units to delete`);

    // Delete children first (to maintain referential integrity)
    for (const unit of userUnits) {
      if (unit.childrenUnits && unit.childrenUnits.length > 0) {
        await database.getClient().unit.deleteMany({
          where: {
            id: { in: unit.childrenUnits.map(c => c.id) }
          }
        });
      }
    }

    // Delete user's units
    const deleteResult = await database.getClient().unit.deleteMany({
      where: {
        ownerId: user.id,
        contractGameId: contractGame.id,
        isSystemRoot: false
      }
    });

    console.log(`✅ Deleted ${deleteResult.count} units\n`);

    // Step 2: Ensure user has wallet with enough balance
    let wallet = await database.getClient().wallet.findUnique({
      where: { userId: user.id }
    });

    if (!wallet) {
      wallet = await database.getClient().wallet.create({
        data: {
          userId: user.id,
          balance: 0,
          totalEarned: 0
        }
      });
    }

    const requiredBalance = 16 * 500; // 16 units * 500 each
    if (wallet.balance < requiredBalance) {
      console.log(`💰 Adding balance to wallet (current: ${wallet.balance}, required: ${requiredBalance})`);
      await database.getClient().wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: requiredBalance }
        }
      });
      console.log(`✅ Wallet balance updated\n`);
    }

    // Step 3: Purchase 4 sets (16 units total)
    console.log('🛒 Step 2: Purchasing 4 sets (16 units: 101-116)...\n');

    for (let set = 0; set < 4; set++) {
      const setNumber = set + 1;
      console.log(`📦 Purchasing Set ${setNumber} (units ${101 + set * 4}-${104 + set * 4})...`);

      // Create purchase request
      const purchaseRequest = await PurchaseService.createPurchaseRequest(
        user.id,
        contractGame.id,
        4, // 4 units per set
        null // no invite code
      );

      console.log(`   ✅ Purchase request created: ${purchaseRequest.id} (${purchaseRequest.status})`);

      // Process placement (this will auto-place the units)
      try {
        await PurchaseService.processPlacement(purchaseRequest.id);
        console.log(`   ✅ Set ${setNumber} placed successfully\n`);
      } catch (error) {
        console.log(`   ❌ Error placing set ${setNumber}: ${error.message}\n`);
      }

      // Small delay between sets
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Step 4: Verify placement
    console.log('🔍 Step 3: Verifying placement...\n');

    const allUnits = await database.getClient().unit.findMany({
      where: {
        ownerId: user.id,
        contractGameId: contractGame.id,
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

    console.log(`📊 Total units placed: ${allUnits.length}\n`);

    // Display all units
    console.log('📋 Unit Placement:\n');
    allUnits.forEach(unit => {
      const parentInfo = unit.parentUnit 
        ? `${unit.parentUnit.unitName} (${unit.parentUnit.unitNumber})`
        : 'no parent';
      console.log(`   Unit ${unit.unitNumber}: ${parentInfo}`);
    });

    // Verify pattern for each set
    console.log('\n✅ Pattern Verification:\n');

    // Set 1: 101-104
    console.log('Set 1 (101-104):');
    const unit101 = allUnits.find(u => u.unitNumber === 101);
    const unit102 = allUnits.find(u => u.unitNumber === 102);
    const unit103 = allUnits.find(u => u.unitNumber === 103);
    const unit104 = allUnits.find(u => u.unitNumber === 104);

    if (unit102 && unit101 && unit102.parentUnitId === unit101.id) {
      console.log('   ✅ 102 under 101');
    } else {
      console.log('   ❌ 102 should be under 101');
    }

    if (unit104 && unit101 && unit104.parentUnitId === unit101.id) {
      console.log('   ✅ 104 under 101');
    } else {
      console.log('   ❌ 104 should be under 101');
    }

    // Set 2: 105-108
    console.log('\nSet 2 (105-108):');
    const unit105 = allUnits.find(u => u.unitNumber === 105);
    const unit106 = allUnits.find(u => u.unitNumber === 106);
    const unit107 = allUnits.find(u => u.unitNumber === 107);
    const unit108 = allUnits.find(u => u.unitNumber === 108);

    if (unit106 && unit105 && unit106.parentUnitId === unit105.id) {
      console.log('   ✅ 106 under 105');
    } else {
      console.log(`   ❌ 106 should be under 105, but is under ${unit106?.parentUnit?.unitNumber || 'unknown'}`);
    }

    if (unit108 && unit105 && unit108.parentUnitId === unit105.id) {
      console.log('   ✅ 108 under 105');
    } else {
      console.log(`   ❌ 108 should be under 105, but is under ${unit108?.parentUnit?.unitNumber || 'unknown'}`);
    }

    // Check if 105 and 107 are under owner's existing units (102, 104)
    const unit102ForCheck = allUnits.find(u => u.unitNumber === 102);
    const unit104ForCheck = allUnits.find(u => u.unitNumber === 104);
    
    if (unit105) {
      const isInOwnerSubtree = unit105.parentUnit && 
        (unit105.parentUnit.unitNumber === 102 || 
         unit105.parentUnit.unitNumber === 104 ||
         (unit102ForCheck && unit105.parentUnitId === unit102ForCheck.id) ||
         (unit104ForCheck && unit105.parentUnitId === unit104ForCheck.id));
      if (isInOwnerSubtree) {
        console.log(`   ✅ 105 in owner's existing units subtree (under ${unit105.parentUnit.unitNumber})`);
      } else {
        console.log(`   ⚠️  105 placement: ${unit105.parentUnit?.unitNumber || 'unknown'}`);
      }
    }

    // Set 3: 109-112
    console.log('\nSet 3 (109-112):');
    const unit109 = allUnits.find(u => u.unitNumber === 109);
    const unit110 = allUnits.find(u => u.unitNumber === 110);
    const unit111 = allUnits.find(u => u.unitNumber === 111);
    const unit112 = allUnits.find(u => u.unitNumber === 112);

    if (unit110 && unit109 && unit110.parentUnitId === unit109.id) {
      console.log('   ✅ 110 under 109');
    } else {
      console.log(`   ❌ 110 should be under 109, but is under ${unit110?.parentUnit?.unitNumber || 'unknown'}`);
    }

    if (unit112 && unit109 && unit112.parentUnitId === unit109.id) {
      console.log('   ✅ 112 under 109');
    } else {
      console.log(`   ❌ 112 should be under 109, but is under ${unit112?.parentUnit?.unitNumber || 'unknown'}`);
    }

    // Set 4: 113-116
    console.log('\nSet 4 (113-116):');
    const unit113 = allUnits.find(u => u.unitNumber === 113);
    const unit114 = allUnits.find(u => u.unitNumber === 114);
    const unit115 = allUnits.find(u => u.unitNumber === 115);
    const unit116 = allUnits.find(u => u.unitNumber === 116);

    if (unit114 && unit113 && unit114.parentUnitId === unit113.id) {
      console.log('   ✅ 114 under 113');
    } else {
      console.log(`   ❌ 114 should be under 113, but is under ${unit114?.parentUnit?.unitNumber || 'unknown'}`);
    }

    if (unit116 && unit113 && unit116.parentUnitId === unit113.id) {
      console.log('   ✅ 116 under 113');
    } else {
      console.log(`   ❌ 116 should be under 113, but is under ${unit116?.parentUnit?.unitNumber || 'unknown'}`);
    }

    console.log('\n✅ Test completed!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await database.disconnect();
  }
}

deleteAndTestPlacement()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

