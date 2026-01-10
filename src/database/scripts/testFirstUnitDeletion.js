const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const PurchaseService = require('../../services/purchaseService');
const RefundService = require('../../services/refundService');

async function testFirstUnitDeletion() {
  try {
    console.log('\n🧪 TEST: First Unit Cancellation (Delete Entire Subtree)');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // ==========================================
    // STEP 1: Clean up test users
    // ==========================================
    console.log('🗑️  STEP 1: Cleaning up test users...');
    console.log('─────────────────────────────────────────────────────────');
    
    const testEmails = [
      'testfirst_root@test.com',
      'testfirst_child1@test.com',
      'testfirst_child2@test.com',
      'testfirst_gc1@test.com',
      'testfirst_gc2@test.com'
    ];

    for (const email of testEmails) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        await prisma.payout.deleteMany({ where: { userId: user.id } });
        await prisma.unit.deleteMany({ where: { ownerId: user.id } });
        await prisma.purchaseRequest.deleteMany({ where: { userId: user.id } });
        await prisma.inviteLink.deleteMany({ where: { inviterId: user.id } });
        await prisma.wallet.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
    }
    console.log('✅ Cleanup complete\n');

    // ==========================================
    // STEP 2: Create test users
    // ==========================================
    console.log('👤 STEP 2: Creating test users...');
    console.log('─────────────────────────────────────────────────────────');
    
    const users = {};
    for (const email of testEmails) {
      const user = await prisma.user.create({
        data: {
          email,
          password: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH',
          firstName: email.split('@')[0],
          lastName: 'Test',
          role: 'USER'
        }
      });
      
      await prisma.wallet.create({
        data: {
          userId: user.id,
          balance: 10000.00
        }
      });
      
      users[email] = user;
    }
    console.log('✅ Users created\n');

    const contractGame = await prisma.contractGame.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    const InviteService = require('../../modules/contract/inviteService');

    // ==========================================
    // STEP 3: Build tree structure
    // ==========================================
    console.log('🌳 STEP 3: Building tree structure...');
    console.log('─────────────────────────────────────────────────────────');
    console.log('Target Structure:');
    console.log('       Root Unit 101');
    console.log('      /    \\');
    console.log('  Child1   Child2  <- WILL CANCEL Child1 (Unit 101)');
    console.log('   /  \\');
    console.log('  GC1 GC2           <- These should be DELETED (not re-placed)');
    console.log();

    // Root purchases Unit 101
    const rootRequest = await PurchaseService.createPurchaseRequest(
      users['testfirst_root@test.com'].id,
      contractGame.id,
      1
    );
    
    const rootUnit = await prisma.unit.findFirst({
      where: {
        ownerId: users['testfirst_root@test.com'].id,
        unitNumber: 101
      }
    });
    console.log(`✅ Root Unit 101: ${rootUnit.unitName}`);

    // Create 2 children (both will be Unit 101)
    const childUnits = [];
    for (let i = 1; i <= 2; i++) {
      const childEmail = `testfirst_child${i}@test.com`;
      
      const inviteLink = await InviteService.createInviteLink(users['testfirst_root@test.com'].id);
      await InviteService.useInviteLink(inviteLink.inviteCode, users[childEmail].id);
      
      await PurchaseService.createPurchaseRequest(
        users[childEmail].id,
        contractGame.id,
        1
      );
      
      const childUnit = await prisma.unit.findFirst({
        where: {
          ownerId: users[childEmail].id,
          unitNumber: 101
        }
      });
      
      childUnits.push(childUnit);
      console.log(`✅ Child ${i} Unit 101: ${childUnit.unitName}`);
    }

    // Create 2 grandchildren under Child1
    for (let i = 1; i <= 2; i++) {
      const gcEmail = `testfirst_gc${i}@test.com`;
      
      const inviteLink = await InviteService.createInviteLink(users['testfirst_child1@test.com'].id);
      await InviteService.useInviteLink(inviteLink.inviteCode, users[gcEmail].id);
      
      await PurchaseService.createPurchaseRequest(
        users[gcEmail].id,
        contractGame.id,
        1
      );
      
      const gcUnit = await prisma.unit.findFirst({
        where: {
          ownerId: users[gcEmail].id,
          unitNumber: 101
        }
      });
      
      console.log(`✅ Grandchild ${i} Unit 101: ${gcUnit.unitName}`);
    }
    console.log();

    // ==========================================
    // STEP 4: Verify tree before cancellation
    // ==========================================
    console.log('🔍 STEP 4: Verifying tree before cancellation...');
    console.log('─────────────────────────────────────────────────────────');
    
    const treeBefore = await prisma.unit.findMany({
      where: {
        ownerId: {
          in: Object.values(users).map(u => u.id)
        }
      },
      include: {
        owner: { select: { email: true } }
      },
      orderBy: [{ level: 'asc' }, { positionInLevel: 'asc' }]
    });

    console.log(`Total units before: ${treeBefore.length}`);
    treeBefore.forEach(unit => {
      console.log(`  ${unit.unitName} (${unit.owner.email}) - Level ${unit.level}`);
    });
    console.log();

    // ==========================================
    // STEP 5: Set cooldown to future for Child1
    // ==========================================
    console.log('⏰ STEP 5: Setting cooldown to allow cancellation...');
    console.log('─────────────────────────────────────────────────────────');
    
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.unit.update({
      where: { id: childUnits[0].id },
      data: { cooldownEndsAt: futureDate }
    });
    console.log(`✅ Cooldown set for Child1\n`);

    // ==========================================
    // STEP 6: Cancel Child1 (Unit 101 - First unit of set)
    // ==========================================
    console.log('❌ STEP 6: Cancelling Child1 (Unit 101 - FIRST UNIT)...');
    console.log('─────────────────────────────────────────────────────────');
    console.log(`Unit Number: ${childUnits[0].unitNumber}`);
    console.log(`Expected: Entire subtree (2 grandchildren) should be DELETED\n`);
    
    const refundResult = await RefundService.processUnitRefund(
      childUnits[0].id,
      users['testfirst_child1@test.com'].id
    );
    
    console.log('Refund Result:');
    console.log(`  Unit: ${refundResult.unitName}`);
    console.log(`  Unit Number: ${refundResult.unitNumber}`);
    console.log(`  Is First Unit: ${refundResult.isFirstUnitOfSet}`);
    console.log(`  Subtree Deleted: ${refundResult.subtreeDeleted}`);
    console.log(`  Children Affected: ${refundResult.childrenAffected}`);
    console.log(`  Children Re-placed: ${refundResult.childrenReplaced}`);
    console.log();

    // ==========================================
    // STEP 7: Verify tree after cancellation
    // ==========================================
    console.log('🔍 STEP 7: Verifying tree after cancellation...');
    console.log('─────────────────────────────────────────────────────────');
    
    const treeAfter = await prisma.unit.findMany({
      where: {
        ownerId: {
          in: Object.values(users).map(u => u.id)
        }
      },
      include: {
        owner: { select: { email: true } }
      },
      orderBy: [{ level: 'asc' }, { positionInLevel: 'asc' }]
    });

    console.log(`Total units after: ${treeAfter.length}`);
    treeAfter.forEach(unit => {
      console.log(`  ${unit.unitName} (${unit.owner.email}) - Level ${unit.level}`);
    });
    console.log();

    // Check if grandchildren were deleted
    const gc1Exists = await prisma.unit.findFirst({
      where: { ownerId: users['testfirst_gc1@test.com'].id }
    });
    const gc2Exists = await prisma.unit.findFirst({
      where: { ownerId: users['testfirst_gc2@test.com'].id }
    });

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log('📋 TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const checks = {
      'Child1 deleted': !await prisma.unit.findUnique({ where: { id: childUnits[0].id } }),
      'Grandchild1 deleted': !gc1Exists,
      'Grandchild2 deleted': !gc2Exists,
      'Child2 still exists': treeAfter.some(u => u.id === childUnits[1].id),
      'Root still exists': treeAfter.some(u => u.id === rootUnit.id),
      'Correct units remaining': treeAfter.length === 2, // Root + Child2
      'Is first unit flag': refundResult.isFirstUnitOfSet === true,
      'Subtree deleted flag': refundResult.subtreeDeleted === true
    };

    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${check}`);
    });

    const allPassed = Object.values(checks).every(v => v === true);
    
    if (allPassed) {
      console.log('\n🎉 SUCCESS: First unit cancellation test passed!');
      console.log('   - Unit 101 cancelled and removed ✅');
      console.log('   - Entire subtree deleted (2 grandchildren) ✅');
      console.log('   - No re-placement occurred ✅');
      console.log('   - Other units unaffected ✅');
    } else {
      console.log('\n⚠️  SOME TESTS FAILED: Check results above');
    }
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testFirstUnitDeletion();

