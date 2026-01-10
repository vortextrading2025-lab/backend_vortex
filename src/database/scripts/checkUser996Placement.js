require('dotenv').config();
const database = require('../../config/database');

/**
 * Check placement of user996 units to understand the tree structure
 */
async function checkUser996Placement() {
  try {
    // Find user996
    const user = await database.getClient().user.findFirst({
      where: {
        OR: [
          { email: { contains: 'user996' } },
          { username: { contains: 'user996' } }
        ]
      }
    });

    if (!user) {
      console.log('❌ User996 not found');
      return;
    }

    console.log(`\n👤 Found user: ${user.email} (${user.id})\n`);

    // Get all units for this user
    const units = await database.getClient().unit.findMany({
      where: {
        ownerId: user.id
      },
      include: {
        parentUnit: {
          select: {
            id: true,
            unitName: true,
            unitNumber: true,
            level: true,
            ownerId: true
          }
        }
      },
      orderBy: [
        { unitNumber: 'asc' }
      ]
    });

    console.log(`📊 Total units: ${units.length}\n`);

    // Group by level
    const unitsByLevel = {};
    units.forEach(unit => {
      if (!unitsByLevel[unit.level]) {
        unitsByLevel[unit.level] = [];
      }
      unitsByLevel[unit.level].push(unit);
    });

    // Display units by level
    console.log('📋 Units by Level:\n');
    Object.keys(unitsByLevel).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
      console.log(`Level ${level}:`);
      unitsByLevel[level].forEach(unit => {
        const parentInfo = unit.parentUnit 
          ? `under ${unit.parentUnit.unitName} (level ${unit.parentUnit.level}, owner: ${unit.parentUnit.ownerId === user.id ? 'SELF' : 'OTHER'})`
          : 'no parent';
        console.log(`  - Unit ${unit.unitNumber} (${unit.unitName}) at position ${unit.positionInLevel}, ${parentInfo}`);
      });
      console.log('');
    });

    // Check placement rules
    console.log('\n🔍 Placement Rule Verification:\n');
    
    // First purchase: 101, 102, 103, 104
    const firstPurchase = units.filter(u => u.unitNumber >= 101 && u.unitNumber <= 104);
    console.log('First Purchase (101-104):');
    firstPurchase.forEach(unit => {
      const isOdd = unit.unitNumber % 2 === 1;
      const expectedPlacement = isOdd 
        ? 'under host/system root (sibling of other odd units)'
        : 'under owner\'s first odd unit (101)';
      
      const actualPlacement = unit.parentUnit
        ? `under ${unit.parentUnit.unitName} (owner: ${unit.parentUnit.ownerId === user.id ? 'SELF' : 'OTHER'})`
        : 'no parent';
      
      const isCorrect = isOdd 
        ? (unit.parentUnit && unit.parentUnit.ownerId !== user.id) || !unit.parentUnit
        : (unit.parentUnit && unit.parentUnit.unitNumber === 101 && unit.parentUnit.ownerId === user.id);
      
      console.log(`  Unit ${unit.unitNumber} (${isOdd ? 'ODD' : 'EVEN'}):`);
      console.log(`    Expected: ${expectedPlacement}`);
      console.log(`    Actual: ${actualPlacement}`);
      console.log(`    ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);
    });

    // Second purchase: 105, 106, 107, 108
    const secondPurchase = units.filter(u => u.unitNumber >= 105 && u.unitNumber <= 108);
    console.log('\nSecond Purchase (105-108):');
    for (const unit of secondPurchase) {
      const isOdd = unit.unitNumber % 2 === 1;
      const expectedPlacement = 'in owner\'s existing units\' subtrees';
      
      // Check if parent or grandparent is owned by user
      let actualPlacement = 'unknown';
      let isInOwnerSubtree = false;
      
      if (unit.parentUnit) {
        if (unit.parentUnit.ownerId === user.id) {
          actualPlacement = `under ${unit.parentUnit.unitName} (owner: SELF)`;
          isInOwnerSubtree = true;
        } else {
          // Check grandparent
          const parentUnitFull = await database.getClient().unit.findUnique({
            where: { id: unit.parentUnit.id },
            select: { parentUnitId: true }
          });
          
          if (parentUnitFull && parentUnitFull.parentUnitId) {
            const grandparent = await database.getClient().unit.findUnique({
              where: { id: parentUnitFull.parentUnitId },
              select: { ownerId: true, unitName: true }
            });
            if (grandparent && grandparent.ownerId === user.id) {
              actualPlacement = `under ${unit.parentUnit.unitName} -> ${grandparent.unitName} (owner: SELF)`;
              isInOwnerSubtree = true;
            } else {
              actualPlacement = `under ${unit.parentUnit.unitName} (owner: OTHER)`;
            }
          } else {
            actualPlacement = `under ${unit.parentUnit.unitName} (owner: OTHER)`;
          }
        }
      } else {
        actualPlacement = 'no parent';
      }
      
      console.log(`  Unit ${unit.unitNumber} (${isOdd ? 'ODD' : 'EVEN'}):`);
      console.log(`    Expected: ${expectedPlacement}`);
      console.log(`    Actual: ${actualPlacement}`);
      console.log(`    ${isInOwnerSubtree ? '✅ CORRECT' : '❌ INCORRECT'}`);
    }

    // Display tree structure
    console.log('\n🌳 Tree Structure:\n');
    const rootUnits = units.filter(u => !u.parentUnit || u.isSystemRoot);
    if (rootUnits.length === 0) {
      // Find units at lowest level (likely under system root)
      const minLevel = Math.min(...units.map(u => u.level));
      const rootLevelUnits = units.filter(u => u.level === minLevel);
      console.log(`Root level (Level ${minLevel}):`);
      rootLevelUnits.forEach(unit => {
        console.log(`  ${unit.unitNumber} (${unit.unitName})`);
      });
    } else {
      rootUnits.forEach(root => {
        console.log(`Root: ${root.unitNumber} (${root.unitName})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await database.disconnect();
  }
}

checkUser996Placement()
  .then(() => {
    console.log('\n✅ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });

