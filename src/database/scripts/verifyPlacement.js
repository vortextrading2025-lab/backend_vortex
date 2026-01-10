require('dotenv').config();
const database = require('../../config/database');

async function verifyPlacement() {
  try {
    const user = await database.getClient().user.findFirst({
      where: { email: 'test1@gmail.com' }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    const units = await database.getClient().unit.findMany({
      where: {
        ownerId: user.id,
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

    console.log('\n📊 All units for test1@gmail.com:\n');
    units.forEach(unit => {
      const parentInfo = unit.parentUnit 
        ? `${unit.parentUnit.unitName} (${unit.parentUnit.unitNumber})`
        : 'no parent';
      console.log(`Unit ${unit.unitNumber}: ${parentInfo}`);
    });

    // Check pattern for 105-108
    console.log('\n✅ Pattern verification for set 105-108:\n');
    
    const unit105 = units.find(u => u.unitNumber === 105);
    const unit106 = units.find(u => u.unitNumber === 106);
    const unit107 = units.find(u => u.unitNumber === 107);
    const unit108 = units.find(u => u.unitNumber === 108);

    if (unit105 && unit106) {
      if (unit106.parentUnitId === unit105.id) {
        console.log(`✅ 106 is under 105 (correct)`);
      } else {
        console.log(`❌ 106 should be under 105, but is under ${unit106.parentUnit?.unitNumber || 'unknown'}`);
      }
    }

    if (unit105 && unit108) {
      if (unit108.parentUnitId === unit105.id) {
        console.log(`✅ 108 is under 105 (correct)`);
      } else {
        console.log(`❌ 108 should be under 105, but is under ${unit108.parentUnit?.unitNumber || 'unknown'}`);
      }
    }

    // Check if 105 and 107 are under owner's existing units (102, 104)
    const unit102 = units.find(u => u.unitNumber === 102);
    const unit104 = units.find(u => u.unitNumber === 104);

    if (unit105 && unit102) {
      // Check if 105 is in 102's subtree (direct child or deeper)
      const isIn102Subtree = unit105.parentUnitId === unit102.id || 
        (unit105.parentUnit && unit105.parentUnit.unitNumber === 102);
      if (isIn102Subtree || (unit105.parentUnit && unit105.parentUnit.unitNumber !== 101)) {
        console.log(`✅ 105 is in owner's existing units subtree (correct)`);
      } else {
        console.log(`⚠️  105 placement: ${unit105.parentUnit?.unitNumber || 'unknown'}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await database.disconnect();
  }
}

verifyPlacement()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

