require('dotenv').config({ path: '.env.development' });
const database = require('../../config/database');

const checkTest1Placement = async () => {
  try {
    console.log('🔍 Checking test1@gmail.com unit placement structure...\n');
    
    await database.connect();
    const prisma = database.getClient();

    // Get test1 user
    const test1 = await prisma.user.findUnique({
      where: { email: 'test1@gmail.com' }
    });

    if (!test1) {
      throw new Error('test1@gmail.com not found');
    }

    // Get contract game
    const contractGame = await prisma.contractGame.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    if (!contractGame) {
      throw new Error('No active contract game found');
    }

    // Get all test1's units (101-108)
    const test1Units = await prisma.unit.findMany({
      where: {
        ownerId: test1.id,
        contractGameId: contractGame.id,
        stage: 1,
        isSystemRoot: false
      },
      include: {
        parentUnit: {
          select: {
            id: true,
            unitName: true,
            unitNumber: true,
            owner: {
              select: { email: true, firstName: true, lastName: true }
            }
          }
        },
        childrenUnits: {
          select: {
            id: true,
            unitName: true,
            unitNumber: true,
            level: true,
            owner: {
              select: { email: true }
            }
          },
          orderBy: { unitNumber: 'asc' }
        }
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`📦 test1@gmail.com has ${test1Units.length} units:\n`);

    for (const unit of test1Units) {
      const parentInfo = unit.parentUnit 
        ? `${unit.parentUnit.unitName} (#${unit.parentUnit.unitNumber}) - Owner: ${unit.parentUnit.owner.email}`
        : 'SYSTEM_ROOT';
      
      const childrenInfo = unit.childrenUnits.length > 0
        ? `\n      Children (${unit.childrenUnits.length}): ${unit.childrenUnits.map(c => `${c.unitName} (#${c.unitNumber}) [L${c.level}] - ${c.owner.email}`).join(', ')}`
        : '';

      console.log(`   ${unit.unitName} (#${unit.unitNumber})`);
      console.log(`      Level: ${unit.level}`);
      console.log(`      Active: ${unit.isActive}`);
      console.log(`      Parent: ${parentInfo}`);
      if (childrenInfo) console.log(childrenInfo);
      console.log('');
    }

    // Check specific placement rules for units 105-108
    console.log('\n🔍 Checking placement rules for units 105-108:\n');
    
    const unit101 = test1Units.find(u => u.unitNumber === 101);
    const unit102 = test1Units.find(u => u.unitNumber === 102);
    const unit103 = test1Units.find(u => u.unitNumber === 103);
    const unit104 = test1Units.find(u => u.unitNumber === 104);
    const unit105 = test1Units.find(u => u.unitNumber === 105);
    const unit106 = test1Units.find(u => u.unitNumber === 106);
    const unit107 = test1Units.find(u => u.unitNumber === 107);
    const unit108 = test1Units.find(u => u.unitNumber === 108);

    // Check if 105-108 are descendants of 101-104
    const checkIsDescendant = (childUnit, ancestorUnit) => {
      if (!childUnit || !ancestorUnit) return false;
      if (childUnit.parentUnitId === ancestorUnit.id) return true;
      // Recursively check if parent is a descendant
      if (childUnit.parentUnit) {
        return checkIsDescendant(childUnit.parentUnit, ancestorUnit);
      }
      return false;
    };

    const getAncestorChain = (unit) => {
      const chain = [];
      let current = unit;
      while (current && current.parentUnit) {
        chain.push(`${current.parentUnit.unitName} (#${current.parentUnit.unitNumber})`);
        current = current.parentUnit;
      }
      return chain.reverse();
    };

    if (unit105) {
      const isUnderOwner = unit105.parentUnit && 
        (unit105.parentUnit.unitNumber === 101 || 
         unit105.parentUnit.unitNumber === 102 || 
         unit105.parentUnit.unitNumber === 103 || 
         unit105.parentUnit.unitNumber === 104 ||
         checkIsDescendant(unit105, unit101) ||
         checkIsDescendant(unit105, unit102) ||
         checkIsDescendant(unit105, unit103) ||
         checkIsDescendant(unit105, unit104));
      
      console.log(`   Unit 105 (${unit105.unitName}):`);
      console.log(`      Level: ${unit105.level}`);
      console.log(`      Parent: ${unit105.parentUnit ? unit105.parentUnit.unitName : 'NONE'}`);
      console.log(`      Ancestor Chain: ${getAncestorChain(unit105).join(' -> ') || 'NONE'}`);
      console.log(`      Is under owner's units (101-104): ${isUnderOwner ? '✅ YES' : '❌ NO'}`);
    }

    if (unit106) {
      const isUnder101 = checkIsDescendant(unit106, unit101);
      console.log(`   Unit 106 (${unit106.unitName}):`);
      console.log(`      Level: ${unit106.level}`);
      console.log(`      Parent: ${unit106.parentUnit ? unit106.parentUnit.unitName : 'NONE'}`);
      console.log(`      Ancestor Chain: ${getAncestorChain(unit106).join(' -> ') || 'NONE'}`);
      console.log(`      Is under Unit 101: ${isUnder101 ? '✅ YES' : '❌ NO'}`);
    }

    if (unit107) {
      const isUnderOwner = unit107.parentUnit && 
        (unit107.parentUnit.unitNumber === 101 || 
         unit107.parentUnit.unitNumber === 102 || 
         unit107.parentUnit.unitNumber === 103 || 
         unit107.parentUnit.unitNumber === 104 ||
         checkIsDescendant(unit107, unit101) ||
         checkIsDescendant(unit107, unit102) ||
         checkIsDescendant(unit107, unit103) ||
         checkIsDescendant(unit107, unit104));
      
      console.log(`   Unit 107 (${unit107.unitName}):`);
      console.log(`      Level: ${unit107.level}`);
      console.log(`      Parent: ${unit107.parentUnit ? unit107.parentUnit.unitName : 'NONE'}`);
      console.log(`      Ancestor Chain: ${getAncestorChain(unit107).join(' -> ') || 'NONE'}`);
      console.log(`      Is under owner's units (101-104): ${isUnderOwner ? '✅ YES' : '❌ NO'}`);
    }

    if (unit108) {
      const isUnder101 = checkIsDescendant(unit108, unit101);
      console.log(`   Unit 108 (${unit108.unitName}):`);
      console.log(`      Level: ${unit108.level}`);
      console.log(`      Parent: ${unit108.parentUnit ? unit108.parentUnit.unitName : 'NONE'}`);
      console.log(`      Ancestor Chain: ${getAncestorChain(unit108).join(' -> ') || 'NONE'}`);
      console.log(`      Is under Unit 101: ${isUnder101 ? '✅ YES' : '❌ NO'}`);
    }

    console.log('\n✅ Check complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
};

if (require.main === module) {
  checkTest1Placement();
}

module.exports = checkTest1Placement;

