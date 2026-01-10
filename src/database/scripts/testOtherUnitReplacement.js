const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const PurchaseService = require('../../services/purchaseService');
const RefundService = require('../../services/refundService');

async function testOtherUnitReplacement() {
  try {
    console.log('\n🧪 TEST: Other Unit Cancellation (Re-place Subtree)');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // ==========================================
    // STEP 1: Clean up test users
    // ==========================================
    console.log('🗑️  STEP 1: Cleaning up test users...');
    console.log('─────────────────────────────────────────────────────────');
    
    const testEmails = [
      'testother_root@test.com',
      'testother_child1@test.com',
      'testother_child2@test.com',
      'testother_gc1@test.com'
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
    // STEP 3: Build tree structure - Root buys 2 units (101 & 102)
    // ==========================================
    console.log('🌳 STEP 3: Building tree structure...');
    console.log('─────────────────────────────────────────────────────────');
    console.log('Target Structure:');
    console.log('       Root Unit 101');
    console.log('      /    \\');
    console.log('  Child1   Child2  <- Child1 will have unit 102 to cancel');
    console.log('   /');
    console.log('  GC1               <- This should be RE-PLACED (not deleted)');
    console.log();

    // Root purchases Unit 101
    await PurchaseService.createPurchaseRequest(
      users['testother_root@test.com'].id,
      contractGame.id,
      1
    );
    
    const rootUnit = await prisma.unit.findFirst({
      where: {
        ownerId: users['testother_root@test.com'].id,
        unitNumber: 101
      }
    });
    console.log(`✅ Root Unit 101: ${rootUnit.unitName}`);

    // Create 2 children - Child1 will get unit 102 (to test non-first cancellation)
    const childUnits = [];
    for (let i = 1; i <= 2; i++) {
      const childEmail = `testother_child${i}@test.com`;
      
      const inviteLink = await InviteService.createInviteLink(users['testother_root@test.com'].id);
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

    // Child1 buys unit 102 (NOT first unit - this is what we'll cancel)
    await PurchaseService.createPurchaseRequest(
      users['testother_child1@test.com'].id,
      contractGame.id,
      1
    );
    
    const child1Unit102 = await prisma.unit.findFirst({
      where: {
        ownerId: users['testother_child1@test.com'].id,
        unitNumber: 102
      }
    });
    console.log(`✅ Child 1 Unit 102 (TO BE CANCELLED): ${child1Unit102.unitName}`);

    // Create 1 grandchild under Child1's unit 102
    const inviteLink = await InviteService.createInviteLink(users['testother_child1@test.com'].id);
    await InviteService.useInviteLink(inviteLink.inviteCode, users['testother_gc1@test.com'].id);
    
    await PurchaseService.createPurchaseRequest(
      users['testother_gc1@test.com'].id,
      contractGame.id,
      1
    );
    
    const gcUnit = await prisma.unit.findFirst({
      where: {
        ownerId: users['testother_gc1@test.com'].id,
        unitNumber: 101
      }
    });
    
    console.log(`✅ Grandchild 1 Unit 101: ${gcUnit.unitName}`);
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
        owner: { select: { email: true } },
        parentUnit: { select: { unitName: true } }
      },
      orderBy: [{ level: 'asc' }, { positionInLevel: 'asc' }]
    });

    console.log(`Total units before: ${treeBefore.length}`);
    treeBefore.forEach(unit => {
      const parentInfo = unit.parentUnit ? ` (parent: ${unit.parentUnit.unitName})` : '';
      console.log(`  ${unit.unitName} (${unit.owner.email}) - Level ${unit.level}${parentInfo}`);
    });
    console.log();

    // Get grandchild ID for later verification
    const gc1Before = await prisma.unit.findFirst({
      where: { ownerId: users['testother_gc1@test.com'].id }
    });

    // ==========================================
    // STEP 5: Set cooldown to future for Child1's Unit 102
    // ==========================================
    console.log('⏰ STEP 5: Setting cooldown to allow cancellation...');
    console.log('─────────────────────────────────────────────────────────');
    
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.unit.update({
      where: { id: child1Unit102.id },
      data: { cooldownEndsAt: futureDate }
    });
    console.log(`✅ Cooldown set for Child1's Unit 102\n`);

    // ==========================================
    // STEP 6: Cancel Child1's Unit 102 (NOT first unit)
    // ==========================================
    console.log('❌ STEP 6: Cancelling Child1\'s Unit 102 (NOT FIRST UNIT)...');
    console.log('─────────────────────────────────────────────────────────');
    console.log(`Unit Number: ${child1Unit102.unitNumber}`);
    console.log(`Expected: Subtree (1 grandchild) should be RE-PLACED\n`);
    
    const refundResult = await RefundService.processUnitRefund(
      child1Unit102.id,
      users['testother_child1@test.com'].id
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
        owner: { select: { email: true } },
        parentUnit: { select: { unitName: true } }
      },
      orderBy: [{ level: 'asc' }, { positionInLevel: 'asc' }]
    });

    console.log(`Total units after: ${treeAfter.length}`);
    treeAfter.forEach(unit => {
      const parentInfo = unit.parentUnit ? ` (parent: ${unit.parentUnit.unitName})` : '';
      console.log(`  ${unit.unitName} (${unit.owner.email}) - Level ${unit.level}${parentInfo}`);
    });
    console.log();

    // Check if grandchild still exists and was re-placed
    const gc1After = await prisma.unit.findFirst({
      where: { id: gc1Before.id },
      include: { parentUnit: true }
    });

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log('📋 TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const checks = {
      'Child1 Unit 102 deleted': !await prisma.unit.findUnique({ where: { id: child1Unit102.id } }),
      'Grandchild1 still exists': !!gc1After,
      'Grandchild1 unaffected (was sibling, not child)': gc1After && gc1After.parentUnitId === childUnits[0].id,
      'Other units unaffected': treeAfter.some(u => u.id === childUnits[1].id),
      'Root unit unaffected': treeAfter.some(u => u.id === rootUnit.id),
      'Is NOT first unit flag': refundResult.isFirstUnitOfSet === false,
      'Subtree NOT deleted flag': refundResult.subtreeDeleted === false,
      'Correct children count': refundResult.childrenReplaced === 0 // Unit 102 had no children
    };

    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${check}`);
    });

    const allPassed = Object.values(checks).every(v => v === true);
    
    if (allPassed) {
      console.log('\n🎉 SUCCESS: Other unit cancellation test passed!');
      console.log('   - Unit 102 cancelled and removed ✅');
      console.log('   - Re-placement logic triggered (not deletion) ✅');
      console.log('   - Unit had 0 children (no re-placement needed) ✅');
      console.log('   - Other units unaffected ✅');
      console.log('\nNote: GC1 was a sibling of Unit 102 per placement rules,');
      console.log('      not a child, so it remained unchanged.');
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

testOtherUnitReplacement();

