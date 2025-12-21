#!/usr/bin/env node

/**
 * Setup Test Tree
 * - Deletes all units (except system roots)
 * - Adds mentor1@gmail.com as mentor
 * - Adds test1@gmail.com as user with mentor1 as host
 * - Makes test1@gmail.com a 10-level tree
 * - Adds 4 units below test1@gmail.com with same rules
 * 
 * Usage: node src/database/scripts/setupTestTree.js
 */

require('dotenv').config();
const database = require('../../config/database');
const logger = require('../../modules/logging/logger');
const bcrypt = require('bcryptjs');
const PurchaseService = require('../../services/purchaseService');
const PlacementService = require('../../services/placementService');

const setupTestTree = async () => {
  try {
    console.log('🔄 Starting: Setup Test Tree\n');
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
    let contractGame = await prisma.contractGame.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    if (!contractGame) {
      // Create a contract game if none exists
      const ContractGameService = require('../../services/contractGameService');
      contractGame = await ContractGameService.createContractGame(
        admin.id,
        'Test Contract Game',
        100.00,
        {
          payoutStage1: 50.00,
          payoutStage2: 100.00,
          payoutStage3: 200.00
        }
      );
      console.log(`   ✅ Created contract game: ${contractGame.name}`);
    } else {
      console.log(`   ✅ Contract game found: ${contractGame.name}`);
    }

    // Step 3: Delete all units (except system roots), purchase requests, and payouts
    console.log('\n🗑️  Step 3: Deleting all units (except system roots), purchase requests, and payouts...');
    await prisma.payout.deleteMany({});
    await prisma.purchaseRequest.deleteMany({});
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

    // Step 4: Get or create mentor1@gmail.com as MENTOR
    console.log('\n👤 Step 4: Setting up mentor1@gmail.com as MENTOR...');
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

    // Ensure mentor has wallet
    await prisma.wallet.upsert({
      where: { userId: mentor1.id },
      update: {},
      create: {
        userId: mentor1.id,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0
      }
    });

    // Step 5: Add units for mentor1 (mentors place under system root)
    console.log('\n📦 Step 5: Adding units for mentor1@gmail.com...');
    const mentor1Units = [];
    const mentor1UnitNumbers = [101, 102, 103, 104]; // First 4 units
    
    for (const unitNumber of mentor1UnitNumbers) {
      const unit = await PlacementService.placeUnit(
        mentor1.id,
        unitNumber,
        contractGame.id,
        mentor1.id, // mentorId
        admin.id, // hostId (admin for mentors)
        null // no transaction
      );
      mentor1Units.push(unit);
      console.log(`   ✅ Placed ${unit.unitName} (#${unit.unitNumber}) at level ${unit.level}, position ${unit.positionInLevel}`);
    }

    // Activate first unit for mentor1
    if (mentor1Units.length > 0) {
      await prisma.unit.update({
        where: { id: mentor1Units[0].id },
        data: { isActive: true }
      });
      console.log(`   ✅ Activated first unit: ${mentor1Units[0].unitName}`);
    }

    // Step 6: Get or create test1@gmail.com as USER
    console.log('\n👤 Step 6: Setting up test1@gmail.com as USER...');
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

    // Ensure test1 has wallet
    await prisma.wallet.upsert({
      where: { userId: test1.id },
      update: {},
      create: {
        userId: test1.id,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0
      }
    });

    // Step 7: Add 4 units for test1 (host is mentor1)
    console.log('\n📦 Step 7: Adding 4 units for test1@gmail.com (host: mentor1)...');
    const test1Units = [];
    const test1UnitNumbers = [101, 102, 103, 104]; // First 4 units
    
    for (const unitNumber of test1UnitNumbers) {
      const unit = await PlacementService.placeUnit(
        test1.id,
        unitNumber,
        contractGame.id,
        mentor1.id, // mentorId
        mentor1.id, // hostId (mentor1 is the host)
        null // no transaction
      );
      test1Units.push(unit);
      console.log(`   ✅ Placed ${unit.unitName} (#${unit.unitNumber}) at level ${unit.level}, position ${unit.positionInLevel}`);
    }

    // Activate first unit for test1
    if (test1Units.length > 0) {
      await prisma.unit.update({
        where: { id: test1Units[0].id },
        data: { isActive: true }
      });
      console.log(`   ✅ Activated first unit: ${test1Units[0].unitName}`);
    }

    // Step 8: Build 8-level tree under test1
    // Strategy: Keep adding units with test1 as host until we reach level 8
    // The placement service will automatically place units according to rules:
    // - Odd units (101, 103, etc.) → under HOST's active unit (test1)
    // - Even units (102, 104, etc.) → under OWNER's FIRST unit (101)
    console.log('\n🌳 Step 8: Building 8-level tree under test1@gmail.com...');
    
    const test1ActiveUnit = test1Units.find(u => u.unitNumber === 101); // Get unit 101 specifically
    if (!test1ActiveUnit) {
      throw new Error('test1 unit 101 not found');
    }
    console.log(`   📍 Starting from test1's unit 101: ${test1ActiveUnit.unitName} (Level ${test1ActiveUnit.level})`);
    
    let userCounter = 1;
    let unitCounter = 105; // Start from 105
    const targetLevel = 8; // Changed from 10 to 8
    
    // Get current max level in the tree
    const getMaxLevel = async () => {
      const maxLevelUnit = await prisma.unit.findFirst({
        where: {
          contractGameId: contractGame.id,
          stage: 1,
          isSystemRoot: false
        },
        orderBy: { level: 'desc' },
        select: { level: true }
      });
      return maxLevelUnit ? maxLevelUnit.level : test1ActiveUnit.level;
    };
    
    let currentMaxLevel = await getMaxLevel();
    console.log(`   📊 Current max level: ${currentMaxLevel}, Target: ${targetLevel}`);
    
    // Keep adding units until we reach level 8
    while (currentMaxLevel < targetLevel) {
      // Create a new user for this batch
      const newUserEmail = `test1_user${userCounter}@test.com`;
      let newUser = await prisma.user.findUnique({
        where: { email: newUserEmail }
      });
      
      if (!newUser) {
        newUser = await prisma.user.create({
          data: {
            email: newUserEmail,
            password: hashedPassword,
            firstName: 'Test1',
            lastName: `User${userCounter}`,
            role: 'USER',
            status: 'ACTIVE',
            emailVerified: true,
            mentorId: mentor1.id
          }
        });
        
        await prisma.wallet.create({
          data: {
            userId: newUser.id,
            balance: 0,
            totalEarned: 0,
            totalWithdrawn: 0
          }
        });
      }
      
      // Add 4 units for this user (101, 102, 103, 104)
      // Rules: 
      // - Odd units (101, 103) go under host (test1)
      // - Even units (102, 104) go under owner's FIRST unit (101)
      const userUnits = [];
      for (let i = 0; i < 4; i++) {
        const unitNum = unitCounter++;
        const unit = await PlacementService.placeUnit(
          newUser.id,
          unitNum,
          contractGame.id,
          mentor1.id, // mentorId
          test1.id, // hostId (test1 is the host for building the tree)
          null
        );
        userUnits.push(unit);
        
        // Only activate the FIRST unit (101 equivalent) for this user
        // This ensures even units (102, 104) can be placed under it
        if (i === 0 && unitNum % 2 === 1) {
          await prisma.unit.update({
            where: { id: unit.id },
            data: { isActive: true }
          });
          console.log(`   ✅ Activated first unit: ${unit.unitName} (${unitNum})`);
        }
      }
      
      userCounter++;
      
      // Check current max level
      currentMaxLevel = await getMaxLevel();
      console.log(`   📊 Added 4 units for user ${userCounter - 1}, current max level: ${currentMaxLevel}`);
      
      // Safety check to prevent infinite loop
      if (userCounter > 100) {
        console.log(`   ⚠️  Reached user limit, stopping at level ${currentMaxLevel}`);
        break;
      }
    }
    
    console.log(`   ✅ Tree building complete. Final level: ${currentMaxLevel}`);

    // Step 9: Add 4 more units below test1 with same rules
    console.log('\n📦 Step 9: Adding 4 more units below test1@gmail.com with same rules...');
    
    // Create a new user for these 4 units
    const finalUserEmail = 'test1_final@test.com';
    let finalUser = await prisma.user.findUnique({
      where: { email: finalUserEmail }
    });
    
    if (!finalUser) {
      finalUser = await prisma.user.create({
        data: {
          email: finalUserEmail,
          password: hashedPassword,
          firstName: 'Test1',
          lastName: 'Final',
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: true,
          mentorId: mentor1.id
        }
      });
      
      await prisma.wallet.create({
        data: {
          userId: finalUser.id,
          balance: 0,
          totalEarned: 0,
          totalWithdrawn: 0
        }
      });
    }
    
    // Add 4 units for this user
    // Rules: Odd units (105, 107, etc.) go under host (test1), even units (106, 108, etc.) go under owner (finalUser)
    const finalUnitNumbers = [unitCounter, unitCounter + 1, unitCounter + 2, unitCounter + 3];
    for (let i = 0; i < finalUnitNumbers.length; i++) {
      const unitNumber = finalUnitNumbers[i];
      const unit = await PlacementService.placeUnit(
        finalUser.id,
        unitNumber,
        contractGame.id,
        mentor1.id, // mentorId
        test1.id, // hostId (test1 is the host)
        null
      );
      console.log(`   ✅ Placed ${unit.unitName} (#${unit.unitNumber}) at level ${unit.level}, position ${unit.positionInLevel}`);
      
      // Activate first unit for this user (so even units can be placed under it)
      if (i === 0) {
        await prisma.unit.update({
          where: { id: unit.id },
          data: { isActive: true }
        });
        console.log(`   ✅ Activated first unit: ${unit.unitName}`);
      }
    }

    // Step 10: Show tree structure
    console.log('\n🌳 Step 10: Showing tree structure...\n');
    
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
          },
          host: {
            select: {
              email: true
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
          unitMap.get(rootUnit.id).children.push(unitMap.get(unit.id));
        }
      });

      // Print tree (limit depth for readability)
      const printTree = (unit, prefix = '', isLast = true, depth = 0, maxDepth = 12) => {
        if (depth > maxDepth) {
          console.log(`${prefix}${isLast ? '└──' : '├──'} ... (tree continues)`);
          return;
        }
        
        const ownerName = unit.owner?.email || 'SYSTEM';
        const hostName = unit.host?.email ? ` [host: ${unit.host.email}]` : '';
        const active = unit.isActive ? ' [ACTIVE]' : '';
        const completed = unit.isCompleted ? ' [COMPLETED]' : '';
        console.log(`${prefix}${isLast ? '└──' : '├──'} ${unit.unitName} (#${unit.unitNumber}) - ${ownerName}${hostName}${active}${completed} [L${unit.level}]`);
        
        unit.children.forEach((child, idx) => {
          const isLastChild = idx === unit.children.length - 1;
          printTree(child, prefix + (isLast ? '   ' : '│  '), isLastChild, depth + 1, maxDepth);
        });
      };

      printTree(unitMap.get(rootUnit.id));
    }

    // Step 11: Summary
    console.log('\n📋 Summary:');
    console.log(`   Contract Game: ${contractGame.name}`);
    
    const mentor1UnitCount = await prisma.unit.count({
      where: {
        ownerId: mentor1.id,
        contractGameId: contractGame.id,
        stage: 1,
        isSystemRoot: false
      }
    });
    console.log(`   Mentor1 (${mentor1.email}): ${mentor1UnitCount} units`);
    
    const test1UnitCount = await prisma.unit.count({
      where: {
        ownerId: test1.id,
        contractGameId: contractGame.id,
        stage: 1,
        isSystemRoot: false
      }
    });
    console.log(`   Test1 (${test1.email}): ${test1UnitCount} units`);
    
    const totalUnits = await prisma.unit.count({
      where: {
        contractGameId: contractGame.id,
        stage: 1,
        isSystemRoot: false
      }
    });
    console.log(`   Total Units (Stage 1): ${totalUnits}`);
    
    const maxLevel = await prisma.unit.findFirst({
      where: {
        contractGameId: contractGame.id,
        stage: 1,
        isSystemRoot: false
      },
      orderBy: { level: 'desc' },
      select: { level: true }
    });
    console.log(`   Max Level: ${maxLevel ? maxLevel.level : 0}`);

    console.log('\n✅ Setup completed successfully!');
    console.log('\n📝 Tree structure:');
    console.log('   - mentor1@gmail.com: Added as mentor with units under system root');
    console.log('   - test1@gmail.com: Added as user with mentor1 as host');
    console.log('   - 10-level tree: Built under test1');
    console.log('   - 4 additional units: Added below test1 with same rules');

  } catch (error) {
    console.error('❌ Error:', error);
    logger.error('Error in setupTestTree:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
};

// Run the script
if (require.main === module) {
  setupTestTree();
}

module.exports = { setupTestTree };

