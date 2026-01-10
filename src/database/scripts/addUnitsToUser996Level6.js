require('dotenv').config();
const database = require('../../config/database');
const PurchaseService = require('../../services/purchaseService');

/**
 * Add more units to user996 to fill level 6
 */
async function addUnitsToUser996Level6() {
  try {
    console.log('🧪 Adding units to user996 to fill level 6\n');

    const client = database.getClient();

    // 1) Find user996
    const user = await client.user.findFirst({ 
      where: { email: 'user996@gmail.com' } 
    });
    if (!user) {
      console.log('❌ User user996@gmail.com not found');
      return;
    }
    console.log(`✅ Found user: ${user.email} (${user.id})\n`);

    // 2) Find active contract game
    const contractGame = await client.contractGame.findFirst({
      where: { status: 'ACTIVE' }
    });
    if (!contractGame) {
      console.log('❌ No active contract game found');
      return;
    }
    console.log(`✅ Contract game: ${contractGame.name} (${contractGame.id})\n`);

    // 3) Check current units and their levels
    const currentUnits = await client.unit.findMany({
      where: {
        ownerId: user.id,
        isSystemRoot: false
      },
      include: {
        _count: {
          select: { childrenUnits: true }
        }
      },
      orderBy: { unitNumber: 'asc' }
    });
    console.log(`📊 Current units: ${currentUnits.length}`);
    
    // Group by level
    const unitsByLevel = {};
    currentUnits.forEach(u => {
      if (!unitsByLevel[u.level]) {
        unitsByLevel[u.level] = [];
      }
      unitsByLevel[u.level].push(u);
    });
    
    console.log('\n📊 Current level distribution:');
    Object.keys(unitsByLevel).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
      console.log(`   Level ${level}: ${unitsByLevel[level].length} units`);
      unitsByLevel[level].forEach(u => {
        console.log(`      ${u.unitName} (${u.unitNumber}): ${u._count.childrenUnits}/2 children`);
      });
    });
    console.log('');

    // 4) Find the deepest level with user996's units
    const maxLevel = Math.max(...currentUnits.map(u => u.level));
    console.log(`📊 Deepest level with user996 units: ${maxLevel}\n`);

    // 5) Find units at the deepest level that have space
    const deepestUnits = currentUnits.filter(u => u.level === maxLevel);
    const unitsWithSpace = deepestUnits.filter(u => u._count.childrenUnits < 2);
    
    console.log(`📊 Units at level ${maxLevel} with available space: ${unitsWithSpace.length}`);
    unitsWithSpace.forEach(u => {
      console.log(`   ${u.unitName} (${u.unitNumber}): ${u._count.childrenUnits}/2 children`);
    });
    console.log('');

    if (unitsWithSpace.length === 0) {
      console.log('ℹ️ All units at the deepest level are full. Adding units will create a new level.\n');
    }

    // 6) Calculate how many units to add
    // We want to fill level 6, so let's add enough units to ensure we have units in level 6
    // If maxLevel is 5, we need to add units under level 5 units
    // If maxLevel is less than 5, we need to add more units to reach level 6
    const targetLevel = 6;
    const unitsToAdd = Math.max(8, unitsWithSpace.length * 2); // Add at least 8 units, or enough to fill available slots
    
    console.log(`📊 Planning to add ${unitsToAdd} units\n`);

    // 7) Fund wallet
    const wallet = await client.wallet.findUnique({ where: { userId: user.id } });
    const costPerUnit = contractGame.downPayment || 500;
    const totalCost = unitsToAdd * costPerUnit;
    
    await client.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: totalCost } }
    });
    console.log(`💰 Funded wallet: +$${totalCost} (${unitsToAdd} units × $${costPerUnit})\n`);

    // 8) Purchase units
    console.log(`🛒 Purchasing ${unitsToAdd} units for user996...\n`);
    
    const purchaseRequest = await PurchaseService.createPurchaseRequest(
      user.id,
      contractGame.id,
      unitsToAdd,
      null // No invite code
    );
    console.log(`✅ Purchase request created: ${purchaseRequest.id} (${purchaseRequest.status})\n`);

    // 9) Process placement
    try {
      await PurchaseService.processPlacement(purchaseRequest.id);
      console.log('✅ Units placed successfully\n');
    } catch (err) {
      console.log(`❌ Placement error: ${err.message}\n`);
    }

    // 10) Verify placement
    const newUnits = await client.unit.findMany({
      where: {
        ownerId: user.id,
        isSystemRoot: false
      },
      include: {
        parentUnit: {
          select: {
            id: true,
            unitName: true,
            unitNumber: true,
            level: true
          }
        },
        _count: {
          select: { childrenUnits: true }
        }
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`📊 Total units after purchase: ${newUnits.length}\n`);

    // Check level 6 units
    const level6Units = newUnits.filter(u => u.level === 6);
    console.log(`📊 Level 6 units: ${level6Units.length}`);
    if (level6Units.length > 0) {
      level6Units.forEach(u => {
        const parentInfo = u.parentUnit 
          ? `${u.parentUnit.unitName} (level ${u.parentUnit.level})`
          : 'no parent';
        console.log(`   ${u.unitName} (${u.unitNumber}): under ${parentInfo}`);
      });
    } else {
      console.log('   (No units at level 6 yet)');
    }
    console.log('');

    // Check level distribution
    const newLevelDistribution = {};
    newUnits.forEach(u => {
      newLevelDistribution[u.level] = (newLevelDistribution[u.level] || 0) + 1;
    });
    console.log('📊 New level distribution:');
    Object.keys(newLevelDistribution).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
      console.log(`   Level ${level}: ${newLevelDistribution[level]} units`);
    });

    console.log('\n✅ Script completed');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await database.disconnect();
  }
}

addUnitsToUser996Level6()
  .then(() => {
    console.log('✅ Script finished');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
