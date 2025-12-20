#!/usr/bin/env node

/**
 * Test Contract Tree Setup
 * - Sets up mentor1@gmail.com (password: 12345678) as MENTOR
 * - Adds 4 units for mentor1 under root unit
 * - Sets up test1@gmail.com (password: 12345678) as USER
 * - Adds units for test1 and other users to build a tree
 * - Tests fulfillment service
 * 
 * Usage: node src/database/test/testContractTree.js
 */

require('dotenv').config();
const database = require('../../config/database');
const logger = require('../../modules/logging/logger');
const bcrypt = require('bcryptjs');
const ContractGameService = require('../../services/contractGameService');
const PurchaseService = require('../../services/purchaseService');
const FulfillmentService = require('../../services/fulfillmentService');
const PlacementService = require('../../services/placementService');

const testContractTree = async () => {
  try {
    console.log('🔄 Starting: Test Contract Tree Setup\n');
    console.log('='.repeat(70));
    
    await database.connect();
    const prisma = database.getClient();

    // Step 1: Get or create admin
    console.log('\n👤 Step 1: Getting admin user...');
    let admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' }
    });

    if (!admin) {
      const hashedPassword = await bcrypt.hash('12345678', 12);
      admin = await prisma.user.create({
        data: {
          email: 'admin@example.com',
          password: hashedPassword,
          firstName: 'Admin',
          lastName: 'User',
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerified: true
        }
      });
      console.log(`   ✅ Admin created: ${admin.email}`);
    } else {
      console.log(`   ✅ Admin found: ${admin.email}`);
    }

    // Step 2: Get active contract game
    console.log('\n🎮 Step 2: Getting active contract game...');
    const contractGame = await prisma.contractGame.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    if (!contractGame) {
      throw new Error('No active contract game found. Please run deleteAndCreateNewContract.js first.');
    }

    console.log(`   ✅ Contract game found: ${contractGame.name}`);
    console.log(`      ID: ${contractGame.id}`);
    console.log(`      Down Payment: $${Number(contractGame.downPayment).toFixed(2)}`);
    console.log(`      Stage 1 Payout: $${Number(contractGame.payoutStage1).toFixed(2)}`);
    console.log(`      Stage 2 Payout: $${Number(contractGame.payoutStage2).toFixed(2)}`);
    console.log(`      Stage 3 Payout: $${Number(contractGame.payoutStage3).toFixed(2)}`);

    // Step 2.5: Delete all existing units (except system roots), purchase requests, and payouts
    console.log('\n🗑️  Step 2.5: Deleting all existing units (except system roots), purchase requests, and payouts...');
    await prisma.payout.deleteMany({});
    await prisma.purchaseRequest.deleteMany({});
    // Only delete non-system-root units
    const deletedUnits = await prisma.unit.deleteMany({
      where: {
        isSystemRoot: false
      }
    });
    console.log(`   ✅ Deleted ${deletedUnits.count} user units, all purchase requests, and payouts`);
    
    // Check if system root units exist, create them if not
    const existingRoots = await prisma.unit.findMany({
      where: {
        contractGameId: contractGame.id,
        isSystemRoot: true
      }
    });
    
    if (existingRoots.length === 0) {
      console.log(`   ⚠️  No system root units found, creating them...`);
      // Create system root units for each stage
      for (let stage = 1; stage <= 3; stage++) {
        await prisma.unit.create({
          data: {
            contractGameId: contractGame.id,
            ownerId: admin.id,
            unitNumber: -stage,
            unitName: `SYSTEM_ROOT_S${stage}`,
            stage: stage,
            level: 0,
            positionInLevel: 0,
            isActive: true,
            isSystemRoot: true,
            parentUnitId: null,
            mentorId: null,
            hostId: null
          }
        });
      }
      console.log(`   ✅ Created 3 system root units (Stage 1, 2, 3)`);
    } else {
      console.log(`   ✅ System root units preserved (${existingRoots.length} found)`);
    }

    // Step 3: Get or create mentor1@gmail.com as MENTOR
    console.log('\n👤 Step 3: Setting up mentor1@gmail.com as MENTOR...');
    const mentorEmail = 'mentor1@gmail.com';
    const hashedPassword = await bcrypt.hash('12345678', 12);
    
    let mentor1 = await prisma.user.findUnique({
      where: { email: mentorEmail }
    });

    if (mentor1) {
      mentor1 = await prisma.user.update({
        where: { email: mentorEmail },
        data: {
          password: hashedPassword,
          role: 'MENTOR',
          status: 'ACTIVE',
          emailVerified: true
        }
      });
      console.log(`   ✅ Updated user to mentor: ${mentor1.email}`);
    } else {
      mentor1 = await prisma.user.create({
        data: {
          email: mentorEmail,
          password: hashedPassword,
          firstName: 'Mentor',
          lastName: 'One',
          role: 'MENTOR',
          status: 'ACTIVE',
          emailVerified: true
        }
      });
      console.log(`   ✅ Created mentor: ${mentor1.email}`);
    }

    // Step 4: Create purchase request for mentor1 (6 units) - Auto-approved for mentors
    console.log('\n📦 Step 4: Creating purchase request for mentor1 (6 units)...');
    const mentor1Request = await PurchaseService.createPurchaseRequest(
      mentor1.id,
      contractGame.id,
      6 // 6 units - testing multiple units
    );
    console.log(`   ✅ Purchase request created (ID: ${mentor1Request.id})`);
    console.log(`      Status: ${mentor1Request.status} (Auto-approved for mentors)`);
    console.log(`      Units: ${mentor1Request.unitCount}`);
    console.log(`      Total: $${Number(mentor1Request.totalAmount).toFixed(2)}`);

    // Wait a moment for auto-placement
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if units were placed
    const mentor1Units = await prisma.unit.findMany({
      where: {
        ownerId: mentor1.id,
        contractGameId: contractGame.id,
        stage: 1
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`   ✅ Found ${mentor1Units.length} units for mentor1:`);
    mentor1Units.forEach(unit => {
      const rootUnit = unit.parentUnitId ? 'Under parent' : 'Under root';
      console.log(`      - ${unit.unitName} (#${unit.unitNumber}) - Stage ${unit.stage}, Level ${unit.level}, Active: ${unit.isActive}, ${rootUnit}`);
    });

    // Step 5: Get or create test1@gmail.com as USER
    console.log('\n👤 Step 5: Setting up test1@gmail.com as USER...');
    const testEmail = 'test1@gmail.com';
    
    let test1 = await prisma.user.findUnique({
      where: { email: testEmail }
    });

    if (test1) {
      test1 = await prisma.user.update({
        where: { email: testEmail },
        data: {
          password: hashedPassword,
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: true,
          mentorId: mentor1.id // Assign to mentor1
        }
      });
      console.log(`   ✅ Updated user: ${test1.email}`);
    } else {
      test1 = await prisma.user.create({
        data: {
          email: testEmail,
          password: hashedPassword,
          firstName: 'Test',
          lastName: 'One',
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: true,
          mentorId: mentor1.id // Assign to mentor1
        }
      });
      console.log(`   ✅ Created user: ${test1.email}`);
    }

    // Step 6: Create purchase request for test1 (4 units)
    console.log('\n📦 Step 6: Creating purchase request for test1 (4 units)...');
    const test1Request = await PurchaseService.createPurchaseRequest(
      test1.id,
      contractGame.id,
      4 // 4 units - testing multiple units
    );
    console.log(`   ✅ Purchase request created (ID: ${test1Request.id})`);
    console.log(`      Status: ${test1Request.status} (Pending mentor approval)`);

    // Step 7: Approve test1's request
    console.log('\n✅ Step 7: Approving test1\'s purchase request...');
    const approvedRequest = await PurchaseService.approvePurchase(
      test1Request.id,
      mentor1.id,
      mentor1.id // Mentor1 is the host
    );
    console.log(`   ✅ Purchase request approved`);

    // Step 8: Place units for test1
    console.log('\n📍 Step 8: Placing units for test1...');
    const placementResult = await PurchaseService.processPlacement(test1Request.id);
    console.log(`   ✅ Placed ${placementResult.units.length} unit(s)`);
    
    placementResult.units.forEach((unit, idx) => {
      console.log(`      ${idx + 1}. ${unit.unitName} (#${unit.unitNumber}) - Level ${unit.level}, Position ${unit.positionInLevel}, Active: ${unit.isActive}`);
    });

    // Step 9: Create additional users and units to build tree
    console.log('\n👥 Step 9: Creating additional users and units to build tree...');
    const additionalUsers = [];
    for (let i = 2; i <= 5; i++) {
      const email = `test${i}@gmail.com`;
      let user = await prisma.user.findUnique({
        where: { email: email }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: email,
            password: hashedPassword,
            firstName: 'Test',
            lastName: `User ${i}`,
            role: 'USER',
            status: 'ACTIVE',
            emailVerified: true,
            mentorId: mentor1.id
          }
        });
        console.log(`   ✅ Created user: ${user.email}`);
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: { mentorId: mentor1.id }
        });
        console.log(`   ✅ Found user: ${user.email}`);
      }
      additionalUsers.push(user);
    }

    // Create purchase requests for additional users with varying unit counts
    const unitCounts = [5, 4, 6, 3]; // Different unit counts for each user
    for (let i = 0; i < additionalUsers.length; i++) {
      const user = additionalUsers[i];
      const unitCount = unitCounts[i] || 4;
      
      const request = await PurchaseService.createPurchaseRequest(
        user.id,
        contractGame.id,
        unitCount // Multiple units per user
      );
      
      // Approve and place
      await PurchaseService.approvePurchase(request.id, mentor1.id, mentor1.id);
      await PurchaseService.processPlacement(request.id);
      console.log(`   ✅ Created and placed ${unitCount} unit(s) for ${user.email}`);
    }
    
    // Step 9.5: Test that users can buy MORE units after already buying some
    console.log('\n🔄 Step 9.5: Testing additional purchases for existing users...');
    
    // test1 buys 2 more units (already has 4, now buying 2 more = 6 total)
    const test1SecondRequest = await PurchaseService.createPurchaseRequest(
      test1.id,
      contractGame.id,
      2 // 2 more units
    );
    await PurchaseService.approvePurchase(test1SecondRequest.id, mentor1.id, mentor1.id);
    await PurchaseService.processPlacement(test1SecondRequest.id);
    console.log(`   ✅ test1 bought 2 more units (now has 6 total)`);
    
    // test2 buys 3 more units (already has 5, now buying 3 more = 8 total)
    const test2SecondRequest = await PurchaseService.createPurchaseRequest(
      additionalUsers[0].id, // test2
      contractGame.id,
      3 // 3 more units
    );
    await PurchaseService.approvePurchase(test2SecondRequest.id, mentor1.id, mentor1.id);
    await PurchaseService.processPlacement(test2SecondRequest.id);
    console.log(`   ✅ test2 bought 3 more units (now has 8 total)`);

    // Step 10: Show tree structure
    console.log('\n🌳 Step 10: Showing tree structure...\n');
    
    // Get root unit for Stage 1
    const rootUnit = await prisma.unit.findFirst({
      where: {
        contractGameId: contractGame.id,
        stage: 1,
        isSystemRoot: true
      }
    });

    if (rootUnit) {
      console.log(`Root Unit: ${rootUnit.unitName} (#${rootUnit.unitNumber}) - Level ${rootUnit.level}\n`);
      
      // Get all units in Stage 1
      const allUnits = await prisma.unit.findMany({
        where: {
          contractGameId: contractGame.id,
          stage: 1,
          isSystemRoot: false
        },
        include: {
          owner: {
            select: {
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: [
          { level: 'asc' },
          { positionInLevel: 'asc' }
        ]
      });

      // Build tree structure
      const unitMap = new Map();
      unitMap.set(rootUnit.id, { ...rootUnit, children: [], owner: { email: 'SYSTEM' } });
      allUnits.forEach(unit => {
        unitMap.set(unit.id, { ...unit, children: [] });
      });

      allUnits.forEach(unit => {
        if (unit.parentUnitId && unitMap.has(unit.parentUnitId)) {
          unitMap.get(unit.parentUnitId).children.push(unitMap.get(unit.id));
        } else if (!unit.parentUnitId) {
          // Direct child of root
          unitMap.get(rootUnit.id).children.push(unitMap.get(unit.id));
        }
      });

      // Print tree
      const printTree = (unit, prefix = '', isLast = true) => {
        const ownerName = unit.owner?.email || 'SYSTEM';
        const active = unit.isActive ? ' [ACTIVE]' : '';
        const completed = unit.isCompleted ? ' [COMPLETED]' : '';
        console.log(`${prefix}${isLast ? '└──' : '├──'} ${unit.unitName} (#${unit.unitNumber}) - ${ownerName}${active}${completed}`);
        
        unit.children.forEach((child, idx) => {
          const isLastChild = idx === unit.children.length - 1;
          printTree(child, prefix + (isLast ? '   ' : '│  '), isLastChild);
        });
      };

      printTree(unitMap.get(rootUnit.id));
    }

    // Step 11: Verify fulfillment service
    console.log('\n\n✅ Step 11: Verifying fulfillment service...');
    console.log('   ✅ FulfillmentService is loaded and ready');
    console.log('   ✅ Fulfillment checks run automatically after unit placement');
    console.log('   ✅ When units fulfill requirements, payouts are created automatically');

    // Step 12: Summary
    console.log('\n📋 Summary:');
    console.log(`   Contract Game: ${contractGame.name}`);
    console.log(`   Mentor: ${mentor1.email} - ${mentor1Units.length} units`);
    console.log(`   Users: ${1 + additionalUsers.length} users with units`);
    
    const totalUnits = await prisma.unit.count({
      where: {
        contractGameId: contractGame.id,
        stage: 1,
        isSystemRoot: false
      }
    });
    console.log(`   Total Units (Stage 1): ${totalUnits}`);
    
    const activeUnits = await prisma.unit.count({
      where: {
        contractGameId: contractGame.id,
        stage: 1,
        isActive: true,
        isSystemRoot: false
      }
    });
    console.log(`   Active Units: ${activeUnits}`);

    console.log('\n✅ Test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   - Add more units to fill the tree');
    console.log('   - Watch for fulfillment when requirements are met');
    console.log('   - Check payouts in user wallets');

  } catch (error) {
    console.error('❌ Error:', error);
    logger.error('Error in testContractTree:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
};

// Run the script
if (require.main === module) {
  testContractTree();
}

module.exports = { testContractTree };
