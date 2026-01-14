const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testUser996Stage1ToStage2() {
  try {
    console.log('\n🧪 TEST: User996 Stage 1 → Stage 2 Progression');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // ==========================================
    // STEP 1: Clean up user996 data
    // ==========================================
    console.log('🗑️  STEP 1: Cleaning up user996 data...');
    console.log('─────────────────────────────────────────────────────────');
    
    const existingUser = await prisma.user.findUnique({
      where: { email: 'user996@gmail.com' }
    });

    if (existingUser) {
      // Delete in order: payouts → units → purchase requests → invite links → wallet → user
      await prisma.payout.deleteMany({ where: { userId: existingUser.id } });
      await prisma.unit.deleteMany({ where: { ownerId: existingUser.id } });
      await prisma.purchaseRequest.deleteMany({ where: { userId: existingUser.id } });
      await prisma.inviteLink.deleteMany({ where: { inviterId: existingUser.id } });
      await prisma.wallet.deleteMany({ where: { userId: existingUser.id } });
      await prisma.user.delete({ where: { id: existingUser.id } });
      console.log('✅ Deleted existing user996 and all related data\n');
    } else {
      console.log('✅ No existing user996 found\n');
    }

    // Also delete child users and grandchildren from previous tests
    const childEmails = [
      'child1_user996@gmail.com',
      'child2_user996@gmail.com',
      'grandchild1_1_user996@gmail.com',
      'grandchild1_2_user996@gmail.com',
      'grandchild2_1_user996@gmail.com',
      'grandchild2_2_user996@gmail.com'
    ];
    for (const email of childEmails) {
      const childUser = await prisma.user.findUnique({ where: { email } });
      if (childUser) {
        await prisma.payout.deleteMany({ where: { userId: childUser.id } });
        await prisma.unit.deleteMany({ where: { ownerId: childUser.id } });
        await prisma.purchaseRequest.deleteMany({ where: { userId: childUser.id } });
        await prisma.inviteLink.deleteMany({ where: { inviterId: childUser.id } });
        await prisma.wallet.deleteMany({ where: { userId: childUser.id } });
        await prisma.user.delete({ where: { id: childUser.id } });
        console.log(`✅ Deleted existing ${email}`);
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
    console.log('✅ Created user996:', user996.email, '\n');

    // Create wallet
    const wallet = await prisma.wallet.create({
      data: {
        userId: user996.id,
        balance: 10000.00 // Give enough balance
      }
    });
    console.log('✅ Created wallet with balance: $10,000.00\n');

    // Get active contract game
    const contractGame = await prisma.contractGame.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    if (!contractGame) {
      console.log('❌ No active contract game found!');
      return;
    }
    console.log('✅ Found active contract game:', contractGame.name, '\n');

    // ==========================================
    // STEP 3: User996 buys Unit 101
    // ==========================================
    console.log('💰 STEP 3: User996 purchases Unit 101...');
    console.log('─────────────────────────────────────────────────────────');
    
    const PurchaseService = require('../../services/purchaseService');
    const request = await PurchaseService.createPurchaseRequest(
      user996.id,
      contractGame.id,
      1 // Buy 1 unit
    );
    console.log('✅ Purchase request created and auto-processed\n');

    // Get Unit 101
    const unit101 = await prisma.unit.findFirst({
      where: {
        ownerId: user996.id,
        unitNumber: 101
      },
      include: {
        parentUnit: { select: { unitName: true, ownerId: true } },
        host: { select: { email: true } },
        payouts: true
      }
    });

    console.log('📦 Unit 101 Created:');
    console.log('   Unit Name:', unit101.unitName);
    console.log('   Stage:', unit101.stage);
    console.log('   Level:', unit101.level);
    console.log('   Position:', unit101.positionInLevel);
    console.log('   isActive:', unit101.isActive);
    console.log('   isCompleted:', unit101.isCompleted);
    console.log('   Parent:', unit101.parentUnit ? unit101.parentUnit.unitName : 'System Root');
    console.log('   Host:', unit101.host ? unit101.host.email : 'None');
    console.log('   Payouts:', unit101.payouts.length, '\n');

    // ==========================================
    // STEP 4: Fill Unit 101's left and right children
    // ==========================================
    console.log('👥 STEP 4: Creating child users to fill Unit 101...');
    console.log('─────────────────────────────────────────────────────────');
    console.log('📋 RULE: Unit 101 needs 2 children (left + right) to complete Stage 1\n');

    // Create 2 users who will place units under user996's Unit 101
    const childUsers = [];
    for (let i = 1; i <= 2; i++) {
      const childUser = await prisma.user.create({
        data: {
          email: `child${i}_user996@gmail.com`,
          password: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH',
          firstName: `Child${i}`,
          lastName: 'User996',
          role: 'USER'
        }
      });

      // Create wallet for child
      await prisma.wallet.create({
        data: {
          userId: childUser.id,
          balance: 10000.00
        }
      });

      // Create invite link for this child (user996 invites them)
      const InviteService = require('../../modules/contract/inviteService');
      const inviteLink = await InviteService.createInviteLink(user996.id);
      
      // Mark invite as used
      await InviteService.useInviteLink(inviteLink.inviteCode, childUser.id);

      // Child purchases Unit 101 (will be placed under user996's Unit 101)
      const childRequest = await PurchaseService.createPurchaseRequest(
        childUser.id,
        contractGame.id,
        1
      );

      const childUnit = await prisma.unit.findFirst({
        where: {
          ownerId: childUser.id,
          unitNumber: 101
        },
        include: {
          parentUnit: { select: { unitName: true, ownerId: true } },
          host: { select: { email: true } }
        }
      });

      childUsers.push({ user: childUser, unit: childUnit });

      console.log(`✅ Child ${i} created:`);
      console.log(`   Email: ${childUser.email}`);
      console.log(`   Unit: ${childUnit.unitName}`);
      console.log(`   Parent: ${childUnit.parentUnit.unitName}`);
      console.log(`   Host: ${childUnit.host.email}`);
      console.log(`   Position: Level ${childUnit.level}, Position ${childUnit.positionInLevel}\n`);
    }

    // ==========================================
    // STEP 5: Fill children's children to trigger Stage 1 completion
    // ==========================================
    console.log('👥 STEP 5: Filling children\'s children to trigger fulfillment...');
    console.log('─────────────────────────────────────────────────────────');
    console.log('📋 RULE: For Stage 1 to complete, EACH child needs 2 children\n');

    // For each of the 2 children, create 2 grandchildren
    for (let childIdx = 0; childIdx < childUsers.length; childIdx++) {
      const childInfo = childUsers[childIdx];
      console.log(`Creating grandchildren for Child ${childIdx + 1} (${childInfo.user.email})...\n`);

      for (let grandchildIdx = 1; grandchildIdx <= 2; grandchildIdx++) {
        const grandchildUser = await prisma.user.create({
          data: {
            email: `grandchild${childIdx + 1}_${grandchildIdx}_user996@gmail.com`,
            password: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH',
            firstName: `Grandchild${childIdx + 1}_${grandchildIdx}`,
            lastName: 'User996',
            role: 'USER'
          }
        });

        await prisma.wallet.create({
          data: {
            userId: grandchildUser.id,
            balance: 10000.00
          }
        });

        // Create invite from the child
        const InviteService = require('../../modules/contract/inviteService');
        const grandchildInvite = await InviteService.createInviteLink(childInfo.user.id);
        await InviteService.useInviteLink(grandchildInvite.inviteCode, grandchildUser.id);

        const grandchildRequest = await PurchaseService.createPurchaseRequest(
          grandchildUser.id,
          contractGame.id,
          1
        );

        console.log(`  ✅ Grandchild ${grandchildIdx} created: ${grandchildUser.email}`);
      }
      console.log();
    }

    console.log('✅ All grandchildren created\n');

    // ==========================================
    // STEP 6: Check if Unit 101 completed Stage 1
    // ==========================================
    console.log('🔍 STEP 6: Checking Unit 101 Stage 1 completion...');
    console.log('─────────────────────────────────────────────────────────');

    // Refresh Unit 101 data
    const unit101Updated = await prisma.unit.findUnique({
      where: { id: unit101.id },
      include: {
        payouts: {
          orderBy: { createdAt: 'desc' }
        },
        childrenUnits: {
          select: {
            unitName: true,
            unitNumber: true,
            level: true,
            positionInLevel: true,
            owner: { select: { email: true } }
          }
        }
      }
    });

    console.log('📊 Unit 101 Status:');
    console.log('   Stage:', unit101Updated.stage);
    console.log('   isActive:', unit101Updated.isActive);
    console.log('   isCompleted:', unit101Updated.isCompleted);
    console.log('   Children:', unit101Updated.childrenUnits.length);
    console.log('   Payouts:', unit101Updated.payouts.length, '\n');

    if (unit101Updated.childrenUnits.length > 0) {
      console.log('   Child Units:');
      unit101Updated.childrenUnits.forEach((child, idx) => {
        console.log(`     ${idx + 1}. ${child.unitName} (${child.owner.email})`);
        console.log(`        Level: ${child.level}, Position: ${child.positionInLevel}`);
      });
      console.log();
    }

    if (unit101Updated.payouts.length > 0) {
      console.log('💰 Payouts Received:');
      unit101Updated.payouts.forEach((payout, idx) => {
        console.log(`   ${idx + 1}. Stage ${payout.stage}: $${parseFloat(payout.amount).toFixed(2)} CAD`);
        console.log(`      Status: ${payout.status}`);
        console.log(`      Created: ${payout.createdAt}`);
        if (payout.creditedAt) {
          console.log(`      Credited: ${payout.creditedAt}`);
        }
      });
      console.log();
    }

    // ==========================================
    // STEP 7: Check for Stage 2 unit
    // ==========================================
    console.log('🔍 STEP 7: Checking for Stage 2 unit...');
    console.log('─────────────────────────────────────────────────────────');

    const stage2Units = await prisma.unit.findMany({
      where: {
        ownerId: user996.id,
        stage: 2
      },
      include: {
        parentUnit: { select: { unitName: true } },
        contractGame: { select: { name: true } }
      }
    });

    if (stage2Units.length > 0) {
      console.log(`✅ Found ${stage2Units.length} Stage 2 unit(s):\n`);
      stage2Units.forEach((unit, idx) => {
        console.log(`   ${idx + 1}. ${unit.unitName}`);
        console.log(`      Unit Number: ${unit.unitNumber}`);
        console.log(`      Stage: ${unit.stage}`);
        console.log(`      isActive: ${unit.isActive}`);
        console.log(`      Parent: ${unit.parentUnit ? unit.parentUnit.unitName : 'System Root'}`);
        console.log(`      Contract: ${unit.contractGame.name}\n`);
      });
    } else {
      console.log('⚠️  No Stage 2 units found yet');
      console.log('💡 Stage 2 unit is created when Stage 1 completes (both children filled)\n');
    }

    // ==========================================
    // STEP 8: Summary
    // ==========================================
    console.log('📋 TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('User996 Email:', user996.email);
    console.log('Unit 101 Stage:', unit101Updated.stage);
    console.log('Unit 101 Completed:', unit101Updated.isCompleted ? '✅ YES' : '❌ NO');
    console.log('Unit 101 Children:', unit101Updated.childrenUnits.length, '/ 2 required');
    console.log('Stage 1 Payouts:', unit101Updated.payouts.filter(p => p.stage === 1).length);
    console.log('Stage 2 Units:', stage2Units.length);
    
    if (unit101Updated.isCompleted && stage2Units.length > 0) {
      console.log('\n🎉 SUCCESS: Unit 101 completed Stage 1 and progressed to Stage 2!');
    } else if (unit101Updated.childrenUnits.length === 2 && !unit101Updated.isCompleted) {
      console.log('\n⏳ Unit 101 has 2 children but fulfillment may be pending...');
      console.log('💡 Fulfillment runs when both children are placed');
    } else {
      console.log('\n⚠️  Unit 101 Stage 1 not completed yet');
      console.log(`   Need ${2 - unit101Updated.childrenUnits.length} more children`);
    }
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testUser996Stage1ToStage2();

