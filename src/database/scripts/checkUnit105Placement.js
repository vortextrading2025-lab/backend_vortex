require('dotenv').config();
const database = require('../../config/database');

/**
 * Check why unit 105 is being placed under system root
 */
async function checkUnit105Placement() {
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

    // Get user's units 101-104
    const userUnits = await database.getClient().unit.findMany({
      where: {
        ownerId: user.id,
        unitNumber: { gte: 101, lte: 104 }
      },
      include: {
        parentUnit: {
          select: {
            id: true,
            unitName: true,
            unitNumber: true,
            ownerId: true,
            isSystemRoot: true
          }
        }
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log('📊 User\'s units 101-104:');
    userUnits.forEach(unit => {
      const parentInfo = unit.parentUnit 
        ? `${unit.parentUnit.unitName} (owner: ${unit.parentUnit.ownerId === user.id ? 'SELF' : unit.parentUnit.isSystemRoot ? 'SYSTEM_ROOT' : 'HOST'})`
        : 'no parent';
      console.log(`  - Unit ${unit.unitNumber} (${unit.unitName}):`);
      console.log(`    hostId: ${unit.hostId || 'null'}`);
      console.log(`    parent: ${parentInfo}`);
    });

    // Get hostId from user's first unit
    const firstUnit = userUnits.find(u => u.unitNumber === 101);
    if (firstUnit) {
      const hostId = firstUnit.hostId;
      console.log(`\n🔍 HostId from unit 101: ${hostId || 'null'}`);

      if (hostId) {
        // Check if host has units
        const hostUnits = await database.getClient().unit.findMany({
          where: {
            ownerId: hostId,
            isSystemRoot: false
          },
          include: {
            _count: {
              select: {
                childrenUnits: true
              }
            }
          },
          orderBy: { unitNumber: 'asc' },
          take: 5
        });

        console.log(`\n📊 Host's units (first 5):`);
        if (hostUnits.length > 0) {
          hostUnits.forEach(unit => {
            console.log(`  - Unit ${unit.unitNumber} (${unit.unitName}): ${unit._count.childrenUnits} children`);
          });
        } else {
          console.log('  ❌ Host has no units!');
        }

        // Check where user's units are placed (under host's units or system root)
        const unitsUnderHost = userUnits.filter(u => 
          u.parentUnit && 
          !u.parentUnit.isSystemRoot && 
          u.parentUnit.ownerId === hostId
        );
        const unitsUnderSystemRoot = userUnits.filter(u => 
          u.parentUnit && u.parentUnit.isSystemRoot
        );

        console.log(`\n📍 Placement analysis:`);
        console.log(`  - Units under host's units: ${unitsUnderHost.length}`);
        console.log(`  - Units under system root: ${unitsUnderSystemRoot.length}`);

        // Check unit 105 if it exists
        const unit105 = await database.getClient().unit.findFirst({
          where: {
            ownerId: user.id,
            unitNumber: 105
          },
          include: {
            parentUnit: {
              select: {
                id: true,
                unitName: true,
                unitNumber: true,
                ownerId: true,
                isSystemRoot: true
              }
            }
          }
        });

        if (unit105) {
          const parentInfo = unit105.parentUnit 
            ? `${unit105.parentUnit.unitName} (owner: ${unit105.parentUnit.ownerId === user.id ? 'SELF' : unit105.parentUnit.isSystemRoot ? 'SYSTEM_ROOT' : 'HOST'}, isSystemRoot: ${unit105.parentUnit.isSystemRoot})`
            : 'no parent';
          console.log(`\n❌ Unit 105 is placed:`);
          console.log(`  - parent: ${parentInfo}`);
          console.log(`  - hostId: ${unit105.hostId || 'null'}`);
          
          if (unit105.parentUnit && unit105.parentUnit.isSystemRoot) {
            console.log(`\n🔧 ISSUE: Unit 105 is under SYSTEM ROOT but should be under HOST's units!`);
          }
        } else {
          console.log(`\n✅ Unit 105 does not exist yet`);
        }
      } else {
        console.log(`\n⚠️  User has no hostId - this might be why 105 goes to system root`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await database.disconnect();
  }
}

checkUnit105Placement()
  .then(() => {
    console.log('\n✅ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });

