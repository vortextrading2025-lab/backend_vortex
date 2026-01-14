require('dotenv').config();
const database = require('../../config/database');
const PurchaseService = require('../../services/purchaseService');

/**
 * Delete user996's units and test placement with 5 sets (20 units: 101-120)
 */
async function testUser996FiveSets() {
  try {
    console.log('🧪 Delete and Test Placement: user996 - 5 sets (20 units: 101-120)\n');
    console.log('='.repeat(70));

    await database.connect();

    // Find user996
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

    // Step 1: Delete all user's units and purchase requests
    console.log('🗑️  Step 1: Deleting all user996 units and purchase requests...\n');
    
    // Delete purchase requests first
    const deletedRequests = await database.getClient().purchaseRequest.deleteMany({
      where: {
        userId: user.id
      }
    });
    console.log(`   ✅ Deleted ${deletedRequests.count} purchase requests`);

    // Delete units
    const deleteResult = await database.getClient().unit.deleteMany({
      where: {
        ownerId: user.id,
        contractGameId: contractGame.id,
        isSystemRoot: false
      }
    });

    console.log(`   ✅ Deleted ${deleteResult.count} units\n`);

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

    const requiredBalance = 20 * 500; // 20 units * 500 each
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

    // Step 3: Purchase 5 sets (20 units total: 101-120)
    console.log('🛒 Step 2: Purchasing 5 sets (20 units: 101-120)...\n');
    console.log('='.repeat(70));

    for (let set = 0; set < 5; set++) {
      const setNumber = set + 1;
      const firstUnit = 101 + set * 4;
      const lastUnit = 104 + set * 4;
      
      console.log(`\n📦 SET ${setNumber}: Purchasing units ${firstUnit}-${lastUnit}...`);

      // Create purchase request
      const purchaseRequest = await PurchaseService.createPurchaseRequest(
        user.id,
        contractGame.id,
        4 // 4 units per set
      );

      console.log(`   ✅ Purchase request created: ${purchaseRequest.id} (${purchaseRequest.status})`);

      // Process placement (this will auto-place the units)
      try {
        await PurchaseService.processPlacement(purchaseRequest.id);
        console.log(`   ✅ Set ${setNumber} (${firstUnit}-${lastUnit}) placed successfully`);
      } catch (error) {
        console.log(`   ❌ Error placing set ${setNumber}: ${error.message}`);
      }

      // Small delay between sets
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n🔍 Step 3: Verifying placement...\n');

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
            unitNumber: true,
            ownerId: true
          }
        },
        owner: {
          select: {
            email: true
          }
        },
        host: {
          select: {
            email: true
          }
        }
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`📊 Total units placed: ${allUnits.length}\n`);

    // Display all units with their relationships
    console.log('📋 UNIT PLACEMENT DETAILS:\n');
    console.log('='.repeat(70));
    allUnits.forEach(unit => {
      const parentInfo = unit.parentUnit 
        ? `${unit.parentUnit.unitName} (${unit.parentUnit.unitNumber})`
        : 'NO PARENT';
      const isOdd = unit.unitNumber % 2 === 1 ? 'ODD' : 'EVEN';
      const hostInfo = unit.host ? unit.host.email : 'no host';
      
      console.log(`Unit ${unit.unitNumber} [${isOdd}]:`);
      console.log(`   └─ Parent: ${parentInfo}`);
      console.log(`   └─ Host: ${hostInfo}`);
      console.log(`   └─ Level: ${unit.level}`);
      console.log('');
    });

    // Verify pattern for each set
    console.log('='.repeat(70));
    console.log('\n✅ PATTERN VERIFICATION:\n');
    console.log('='.repeat(70));

    for (let set = 0; set < 5; set++) {
      const setNumber = set + 1;
      const firstOdd = 101 + set * 4;
      const firstEven = 102 + set * 4;
      const secondOdd = 103 + set * 4;
      const secondEven = 104 + set * 4;

      console.log(`\n📦 SET ${setNumber} (${firstOdd}-${secondEven}):`);

      const oddUnit1 = allUnits.find(u => u.unitNumber === firstOdd);
      const evenUnit1 = allUnits.find(u => u.unitNumber === firstEven);
      const oddUnit2 = allUnits.find(u => u.unitNumber === secondOdd);
      const evenUnit2 = allUnits.find(u => u.unitNumber === secondEven);

      // Check even units under first odd
      if (evenUnit1 && oddUnit1 && evenUnit1.parentUnitId === oddUnit1.id) {
        console.log(`   ✅ ${firstEven} under ${firstOdd} (correct: even under first odd of set)`);
      } else {
        const actualParent = evenUnit1?.parentUnit?.unitNumber || 'unknown';
        console.log(`   ❌ ${firstEven} should be under ${firstOdd}, but is under ${actualParent}`);
      }

      if (evenUnit2 && oddUnit1 && evenUnit2.parentUnitId === oddUnit1.id) {
        console.log(`   ✅ ${secondEven} under ${firstOdd} (correct: even under first odd of set)`);
      } else {
        const actualParent = evenUnit2?.parentUnit?.unitNumber || 'unknown';
        console.log(`   ❌ ${secondEven} should be under ${firstOdd}, but is under ${actualParent}`);
      }

      // Show where odd units are placed
      if (oddUnit1) {
        const parentInfo = oddUnit1.parentUnit?.unitNumber || 'system/root';
        const hostEmail = oddUnit1.host?.email || 'no host';
        console.log(`   ℹ️  ${firstOdd} placed under: ${parentInfo} (host: ${hostEmail})`);
      }

      if (oddUnit2) {
        const parentInfo = oddUnit2.parentUnit?.unitNumber || 'system/root';
        const hostEmail = oddUnit2.host?.email || 'no host';
        console.log(`   ℹ️  ${secondOdd} placed under: ${parentInfo} (host: ${hostEmail})`);
      }
    }

    // Check HOST consistency
    console.log('\n' + '='.repeat(70));
    console.log('\n🎯 HOST VERIFICATION:\n');
    const uniqueHosts = [...new Set(allUnits.map(u => u.host?.email).filter(h => h))];
    console.log(`All units should have the same HOST: ${uniqueHosts.length === 1 ? '✅ YES' : '❌ NO'}`);
    if (uniqueHosts.length === 1) {
      console.log(`   Host for all units: ${uniqueHosts[0]}`);
    } else {
      console.log(`   Multiple hosts found: ${uniqueHosts.join(', ')}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n✅ TEST COMPLETED!\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await database.disconnect();
  }
}

testUser996FiveSets()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

