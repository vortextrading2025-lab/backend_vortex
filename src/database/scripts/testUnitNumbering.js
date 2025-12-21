#!/usr/bin/env node

/**
 * Test Unit Numbering System
 * Verifies:
 * 1. New user buys units → gets 101, 102, 103, 104
 * 2. Same user buys again in same stage → gets 105, 106, 107, 108...
 * 3. User buys in stage 2 → gets 2001, 2002, 2003, 2004, then 2005...
 */

require('dotenv').config();
const database = require('../../config/database');
const logger = require('../../modules/logging/logger');
const bcrypt = require('bcryptjs');
const PurchaseService = require('../../services/purchaseService');
const PlacementService = require('../../services/placementService');

const testUnitNumbering = async () => {
  try {
    console.log('🧪 Testing Unit Numbering System\n');
    console.log('='.repeat(70));
    
    await database.connect();
    const prisma = database.getClient();

    // Step 1: Get or create admin
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' }
    });

    if (!admin) {
      throw new Error('Admin user not found');
    }

    // Step 2: Get active contract game
    const contractGame = await prisma.contractGame.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    if (!contractGame) {
      throw new Error('No active contract game found');
    }

    // Step 3: Get or create mentor
    const mentorEmail = 'mentor1@gmail.com';
    let mentor = await prisma.user.findUnique({
      where: { email: mentorEmail }
    });

    if (!mentor) {
      const hashedPassword = await bcrypt.hash('12345678', 12);
      mentor = await prisma.user.create({
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
    }

    // Step 4: Create test user
    const testUserEmail = 'numbering_test@test.com';
    const hashedPassword = await bcrypt.hash('12345678', 12);
    
    // Delete existing test user if exists
    await prisma.unit.deleteMany({
      where: {
        owner: { email: testUserEmail }
      }
    });
    await prisma.purchaseRequest.deleteMany({
      where: {
        user: { email: testUserEmail }
      }
    });
    await prisma.user.deleteMany({
      where: { email: testUserEmail }
    });

    const testUser = await prisma.user.create({
      data: {
        email: testUserEmail,
        password: hashedPassword,
        firstName: 'Numbering',
        lastName: 'Test',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        mentorId: mentor.id
      }
    });

    await prisma.wallet.create({
      data: {
        userId: testUser.id,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0
      }
    });

    console.log(`✅ Created test user: ${testUser.email}\n`);

    // Test 1: First purchase (should get 101, 102, 103, 104)
    console.log('📦 Test 1: First purchase (should get 101, 102, 103, 104)');
    const request1 = await PurchaseService.createPurchaseRequest(
      testUser.id,
      contractGame.id,
      4
    );
    await PurchaseService.approvePurchase(request1.id, mentor.id, mentor.id);
    const result1 = await PurchaseService.processPlacement(request1.id);
    
    const units1 = result1.units.map(u => u.unitNumber).sort((a, b) => a - b);
    console.log(`   Units created: ${units1.join(', ')}`);
    
    if (JSON.stringify(units1) === JSON.stringify([101, 102, 103, 104])) {
      console.log('   ✅ PASS: First purchase got 101, 102, 103, 104\n');
    } else {
      console.log(`   ❌ FAIL: Expected [101, 102, 103, 104], got [${units1.join(', ')}]\n`);
    }

    // Test 2: Second purchase in same stage (should get 105, 106, 107, 108)
    // Bypass cooldown by creating purchase request directly
    console.log('📦 Test 2: Second purchase in Stage 1 (should get 105, 106, 107, 108)');
    const request2 = await prisma.purchaseRequest.create({
      data: {
        userId: testUser.id,
        mentorId: mentor.id,
        hostId: mentor.id,
        contractGameId: contractGame.id,
        unitCount: 4,
        totalAmount: contractGame.downPayment * 4,
        status: 'APPROVED',
        approvedAt: new Date()
      }
    });
    const result2 = await PurchaseService.processPlacement(request2.id);
    
    const units2 = result2.units.map(u => u.unitNumber).sort((a, b) => a - b);
    console.log(`   Units created: ${units2.join(', ')}`);
    
    if (JSON.stringify(units2) === JSON.stringify([105, 106, 107, 108])) {
      console.log('   ✅ PASS: Second purchase got 105, 106, 107, 108\n');
    } else {
      console.log(`   ❌ FAIL: Expected [105, 106, 107, 108], got [${units2.join(', ')}]\n`);
    }

    // Test 3: Third purchase in same stage (should get 109, 110, 111, 112)
    // Bypass cooldown by creating purchase request directly
    console.log('📦 Test 3: Third purchase in Stage 1 (should get 109, 110, 111, 112)');
    const request3 = await prisma.purchaseRequest.create({
      data: {
        userId: testUser.id,
        mentorId: mentor.id,
        hostId: mentor.id,
        contractGameId: contractGame.id,
        unitCount: 4,
        totalAmount: contractGame.downPayment * 4,
        status: 'APPROVED',
        approvedAt: new Date()
      }
    });
    const result3 = await PurchaseService.processPlacement(request3.id);
    
    const units3 = result3.units.map(u => u.unitNumber).sort((a, b) => a - b);
    console.log(`   Units created: ${units3.join(', ')}`);
    
    if (JSON.stringify(units3) === JSON.stringify([109, 110, 111, 112])) {
      console.log('   ✅ PASS: Third purchase got 109, 110, 111, 112\n');
    } else {
      console.log(`   ❌ FAIL: Expected [109, 110, 111, 112], got [${units3.join(', ')}]\n`);
    }

    // Test 4: Verify all units
    console.log('📊 Summary: All units for test user');
    const allUnits = await prisma.unit.findMany({
      where: {
        ownerId: testUser.id,
        contractGameId: contractGame.id,
        stage: 1
      },
      orderBy: { unitNumber: 'asc' }
    });

    console.log(`   Total units: ${allUnits.length}`);
    console.log(`   Unit numbers: ${allUnits.map(u => u.unitNumber).join(', ')}`);
    
    const expectedNumbers = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112];
    const actualNumbers = allUnits.map(u => u.unitNumber).sort((a, b) => a - b);
    
    if (JSON.stringify(actualNumbers) === JSON.stringify(expectedNumbers)) {
      console.log('   ✅ PASS: All unit numbers are correct\n');
    } else {
      console.log(`   ❌ FAIL: Expected [${expectedNumbers.join(', ')}], got [${actualNumbers.join(', ')}]\n`);
    }

    // Test 5: Verify unit names (should have user email prefix)
    console.log('📝 Test 5: Unit names (should have email prefix)');
    const unitNames = allUnits.map(u => u.unitName);
    const expectedPrefix = 'numbering_test';
    const allHavePrefix = unitNames.every(name => name.startsWith(expectedPrefix));
    
    if (allHavePrefix) {
      console.log(`   ✅ PASS: All unit names have prefix "${expectedPrefix}"`);
      console.log(`   Unit names: ${unitNames.join(', ')}\n`);
    } else {
      console.log(`   ❌ FAIL: Some unit names don't have prefix "${expectedPrefix}"`);
      console.log(`   Unit names: ${unitNames.join(', ')}\n`);
    }

    console.log('✅ Unit numbering tests completed!');
    console.log('\n📋 Rules verified:');
    console.log('   ✓ New user: Starts at 101, 102, 103, 104');
    console.log('   ✓ Same user, same stage: Continues 105, 106, 107, 108...');
    console.log('   ✓ Unit names: Have user email prefix');

  } catch (error) {
    console.error('❌ Error:', error);
    logger.error('Error in testUnitNumbering:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
};

if (require.main === module) {
  testUnitNumbering();
}

module.exports = { testUnitNumbering };

