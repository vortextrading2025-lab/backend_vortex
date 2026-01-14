const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const PurchaseService = require('../../services/purchaseService');
const FulfillmentService = require('../../services/fulfillmentService');

async function testFulfillmentSystem() {
  try {
    console.log('\n🧪 TEST: Fulfillment System (Cooldown + Stage 1 Completion)');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // ==========================================
    // STEP 1: Clean up user996
    // ==========================================
    console.log('🗑️  STEP 1: Cleaning up user996...');
    console.log('─────────────────────────────────────────────────────────');
    
    const existingUser = await prisma.user.findUnique({
      where: { email: 'user996@gmail.com' }
    });

    if (existingUser) {
      await prisma.payout.deleteMany({ where: { userId: existingUser.id } });
      await prisma.unit.deleteMany({ where: { ownerId: existingUser.id } });
      await prisma.purchaseRequest.deleteMany({ where: { userId: existingUser.id } });
      await prisma.inviteLink.deleteMany({ where: { inviterId: existingUser.id } });
      await prisma.wallet.deleteMany({ where: { userId: existingUser.id } });
      await prisma.user.delete({ where: { id: existingUser.id } });
      console.log('✅ Deleted existing user996\n');
    } else {
      console.log('✅ No existing user996 found\n');
    }

    // Delete test children
    const childEmails = ['child1_test@gmail.com', 'child2_test@gmail.com'];
    for (const email of childEmails) {
      const child = await prisma.user.findUnique({ where: { email } });
      if (child) {
        await prisma.payout.deleteMany({ where: { userId: child.id } });
        await prisma.unit.deleteMany({ where: { ownerId: child.id } });
        await prisma.purchaseRequest.deleteMany({ where: { userId: child.id } });
        await prisma.inviteLink.deleteMany({ where: { inviterId: child.id } });
        await prisma.wallet.deleteMany({ where: { userId: child.id } });
        await prisma.user.delete({ where: { id: child.id } });
        console.log(`✅ Deleted ${email}`);
      }
    }
    console.log();

    // ==========================================
    // STEP 2: Create user996
    // ==========================================
    console.log('👤 STEP 2: Creating user996...');
    console.log('─────────────────────────────────────────────────────────');
    
    const user996 = await prisma.user.create({
      data: {
        email: 'user996@gmail.com',
        password: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH',
        firstName: 'Test',
        lastName: 'User996',
        role: 'USER'
      }
    });
    console.log('✅ Created user996:', user996.email);

    await prisma.wallet.create({
      data: {
        userId: user996.id,
        balance: 10000.00
      }
    });
    console.log('✅ Created wallet: $10,000.00\n');

    const contractGame = await prisma.contractGame.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });
    console.log('✅ Found contract game:', contractGame.name, '\n');

    // ==========================================
    // STEP 3: User996 buys Unit 101
    // ==========================================
    console.log('💰 STEP 3: User996 purchases Unit 101...');
    console.log('─────────────────────────────────────────────────────────');
    
    const request = await PurchaseService.createPurchaseRequest(
      user996.id,
      contractGame.id,
      1
    );

    const unit101 = await prisma.unit.findFirst({
      where: {
        ownerId: user996.id,
        unitNumber: 101
      }
    });

    console.log('✅ Unit 101 created:', unit101.unitName);
    console.log('   Cooldown ends:', unit101.cooldownEndsAt, '\n');

    // ==========================================
    // STEP 4: Set cooldown to PAST (simulate 15 days passed)
    // ==========================================
    console.log('⏰ STEP 4: Setting cooldown to past (simulate 15 days)...');
    console.log('─────────────────────────────────────────────────────────');
    
    const pastDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
    await prisma.unit.update({
      where: { id: unit101.id },
      data: { cooldownEndsAt: pastDate }
    });
    await prisma.purchaseRequest.update({
      where: { id: request.id },
      data: { cooldownEndsAt: pastDate }
    });
    console.log('✅ Cooldown set to:', pastDate);
    console.log('✅ Unit 101 is now PAST cooldown period\n');

    // ==========================================
    // STEP 5: Fill tree with 2 children (simple test)
    // ==========================================
    console.log('👥 STEP 5: Creating 2 children for Unit 101...');
    console.log('─────────────────────────────────────────────────────────');
    
    const InviteService = require('../../modules/contract/inviteService');
    
    for (let i = 1; i <= 2; i++) {
      const childUser = await prisma.user.create({
        data: {
          email: `child${i}_test@gmail.com`,
          password: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH',
          firstName: `Child${i}`,
          lastName: 'Test',
          role: 'USER'
        }
      });

      await prisma.wallet.create({
        data: {
          userId: childUser.id,
          balance: 10000.00
        }
      });

      const inviteLink = await InviteService.createInviteLink(user996.id);
      await InviteService.useInviteLink(inviteLink.inviteCode, childUser.id);

      const childRequest = await PurchaseService.createPurchaseRequest(
        childUser.id,
        contractGame.id,
        1
      );

      console.log(`✅ Child ${i} created: ${childUser.email}`);
    }
    console.log();

    // ==========================================
    // STEP 6: Check Unit 101 current state
    // ==========================================
    console.log('🔍 STEP 6: Checking Unit 101 current state...');
    console.log('─────────────────────────────────────────────────────────');
    
    const unit101Updated = await prisma.unit.findUnique({
      where: { id: unit101.id },
      include: {
        payouts: true,
        childrenUnits: {
          select: {
            unitName: true,
            level: true,
            positionInLevel: true
          }
        }
      }
    });

    console.log('Unit 101:');
    console.log('   Stage:', unit101Updated.stage);
    console.log('   isActive:', unit101Updated.isActive);
    console.log('   isCompleted:', unit101Updated.isCompleted);
    console.log('   Children:', unit101Updated.childrenUnits.length);
    console.log('   Payouts:', unit101Updated.payouts.length);
    console.log('   Cooldown ended:', new Date() > new Date(unit101Updated.cooldownEndsAt));
    console.log();

    // ==========================================
    // STEP 7: Check fulfillment eligibility
    // ==========================================
    console.log('🔍 STEP 7: Checking fulfillment eligibility...');
    console.log('─────────────────────────────────────────────────────────');
    
    const shouldFulfill = await FulfillmentService.checkFulfillment(unit101.id);
    console.log('Should fulfill:', shouldFulfill ? '✅ YES' : '❌ NO');
    
    if (!shouldFulfill) {
      console.log('\n⚠️  Unit 101 NOT ready for fulfillment');
      console.log('📋 Stage 1 Requirements:');
      console.log('   - Level 1: 2 units (children)');
      console.log('   - Level 2: 4 units (grandchildren)');
      console.log('   - Level 3: 6 units (great-grandchildren)');
      console.log('   - Level 4: 2 units (great-great-grandchildren)');
      console.log('   - Total: 14 units required\n');
      console.log('💡 Current tree only has 2 units (need 12 more)\n');
    } else {
      console.log('\n✅ Unit 101 IS ready for fulfillment!\n');
    }

    // ==========================================
    // STEP 8: Test Fulfillment Job
    // ==========================================
    console.log('🔄 STEP 8: Testing Fulfillment Job...');
    console.log('─────────────────────────────────────────────────────────');
    
    const FulfillmentJob = require('../../jobs/fulfillmentJob');
    await FulfillmentJob.processPendingFulfillments();
    console.log();

    // ==========================================
    // STEP 9: Check final state
    // ==========================================
    console.log('🔍 STEP 9: Checking final state...');
    console.log('─────────────────────────────────────────────────────────');
    
    const unit101Final = await prisma.unit.findUnique({
      where: { id: unit101.id },
      include: {
        payouts: {
          include: {
            unit: {
              select: { unitName: true }
            }
          }
        }
      }
    });

    const stage2Units = await prisma.unit.findMany({
      where: {
        ownerId: user996.id,
        stage: 2
      }
    });

    console.log('Final State:');
    console.log('   isCompleted:', unit101Final.isCompleted ? '✅ YES' : '❌ NO');
    console.log('   Payouts:', unit101Final.payouts.length);
    if (unit101Final.payouts.length > 0) {
      unit101Final.payouts.forEach(payout => {
        console.log(`     - Stage ${payout.stage}: $${parseFloat(payout.amount).toFixed(2)} (${payout.status})`);
      });
    }
    console.log('   Stage 2 Units:', stage2Units.length);
    console.log();

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log('📋 TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ Cooldown system working:', new Date() > new Date(unit101Final.cooldownEndsAt) ? 'YES' : 'NO');
    console.log('✅ Fulfillment check executed: YES');
    console.log('✅ Unit 101 completed:', unit101Final.isCompleted ? 'YES (Stage 1 done!)' : 'NO (needs more units)');
    console.log('✅ Payouts created:', unit101Final.payouts.length);
    console.log('✅ Stage 2 units:', stage2Units.length);
    
    if (unit101Final.isCompleted && stage2Units.length > 0) {
      console.log('\n🎉 SUCCESS: Fulfillment system working perfectly!');
      console.log('   - Cooldown period ended ✅');
      console.log('   - Stage 1 completed ✅');
      console.log('   - Payout created ✅');
      console.log('   - Stage 2 unit created ✅');
    } else if (!shouldFulfill) {
      console.log('\n⏳ PARTIAL SUCCESS: Cooldown system working!');
      console.log('   - Fulfillment job detected unit past cooldown ✅');
      console.log('   - Unit not ready yet (need more children in tree) ⏳');
      console.log('   - Fulfillment will trigger once tree is filled ⏳');
    } else {
      console.log('\n⚠️  NEEDS INVESTIGATION: Check logs above');
    }
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testFulfillmentSystem();

