#!/usr/bin/env node

/**
 * Test Placement Purchase
 * - Deletes all user units
 * - Makes test1@gmail.com buy 4 units
 * - Makes other users buy units
 * 
 * Usage: node src/database/scripts/testPlacementPurchase.js
 */

require('dotenv').config();
const database = require('../../config/database');
const PurchaseService = require('../../services/purchaseService');

const testPlacementPurchase = async () => {
  try {
    console.log('🔄 Starting: Test Placement Purchase\n');
    console.log('='.repeat(70));
    
    await database.connect();
    const prisma = database.getClient();

    // Step 1: Delete all user units first
    console.log('\n🗑️  Step 1: Deleting all user units...');
    const deletedPayouts = await prisma.payout.deleteMany({});
    console.log(`   ✅ Deleted ${deletedPayouts.count} payouts`);
    
    const deletedRequests = await prisma.purchaseRequest.deleteMany({});
    console.log(`   ✅ Deleted ${deletedRequests.count} purchase requests`);
    
    const deletedUnits = await prisma.unit.deleteMany({
      where: { isSystemRoot: false }
    });
    console.log(`   ✅ Deleted ${deletedUnits.count} user units`);

    // Step 2: Get active contract game
    console.log('\n🎮 Step 2: Getting active contract game...');
    const contractGame = await prisma.contractGame.findFirst({
      where: { status: 'ACTIVE' }
    });

    if (!contractGame) {
      console.log('   ❌ No active contract game found. Please create one first.');
      return;
    }
    console.log(`   ✅ Found active contract: ${contractGame.name} (${contractGame.id})`);

    // Step 3: Get or create test1@gmail.com
    console.log('\n👤 Step 3: Getting test1@gmail.com...');
    let test1 = await prisma.user.findUnique({
      where: { email: 'test1@gmail.com' }
    });

    if (!test1) {
      console.log('   ⚠️  test1@gmail.com not found. Creating user...');
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('test123', 12);
      
      test1 = await prisma.user.create({
        data: {
          email: 'test1@gmail.com',
          password: hashedPassword,
          firstName: 'Test',
          lastName: 'One',
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: true
        }
      });
      console.log(`   ✅ Created test1@gmail.com: ${test1.id}`);
    } else {
      console.log(`   ✅ Found test1@gmail.com: ${test1.id}`);
    }

    // Step 4: Ensure test1 has wallet with balance
    console.log('\n💰 Step 4: Ensuring test1 has wallet balance...');
    const WalletService = require('../../modules/wallet/walletService');
    let wallet = await WalletService.getWallet(test1.id);
    
    if (wallet.balance < 2000) {
      // Add balance to wallet
      await WalletService.addToWallet(test1.id, 2000 - wallet.balance, null, 'DEPOSIT', 'Test deposit for unit purchase');
      wallet = await WalletService.getWallet(test1.id);
      console.log(`   ✅ Wallet balance: C$${wallet.balance.toFixed(2)}`);
    } else {
      console.log(`   ✅ Wallet balance: C$${wallet.balance.toFixed(2)}`);
    }

    // Step 5: Purchase 4 units for test1@gmail.com
    console.log('\n📦 Step 5: Purchasing 4 units for test1@gmail.com...');
    try {
      const purchaseRequest1 = await PurchaseService.createPurchaseRequest(
        test1.id,
        contractGame.id,
        4
      );
      console.log(`   ✅ Purchase request created: ${purchaseRequest1.id}`);
      console.log(`   Status: ${purchaseRequest1.status}`);
      console.log(`   Unit Count: ${purchaseRequest1.unitCount}`);
      console.log(`   Total Amount: C$${purchaseRequest1.totalAmount.toFixed(2)}`);
      
      // Wait a moment for placement
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check placed units
      const test1Units = await prisma.unit.findMany({
        where: {
          ownerId: test1.id,
          isSystemRoot: false
        },
        orderBy: { unitNumber: 'asc' },
        include: {
          parentUnit: {
            select: {
              unitName: true,
              unitNumber: true,
              isSystemRoot: true
            }
          }
        }
      });
      
      console.log(`   📦 Placed ${test1Units.length} units:`);
      test1Units.forEach(unit => {
        const parentInfo = unit.parentUnit 
          ? (unit.parentUnit.isSystemRoot ? 'System Root' : `Unit ${unit.parentUnit.unitNumber}`)
          : 'None';
        console.log(`      - Unit ${unit.unitNumber} (${unit.unitName}) - Parent: ${parentInfo}, Active: ${unit.isActive}`);
      });
    } catch (error) {
      console.error(`   ❌ Error purchasing units for test1: ${error.message}`);
      throw error;
    }

    // Step 6: Create other test users and purchase units
    console.log('\n👥 Step 6: Creating other users and purchasing units...');
    const otherUsers = [
      { email: 'test2@gmail.com', firstName: 'Test', lastName: 'Two' },
      { email: 'test3@gmail.com', firstName: 'Test', lastName: 'Three' },
      { email: 'test4@gmail.com', firstName: 'Test', lastName: 'Four' }
    ];

    for (const userData of otherUsers) {
      let user = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (!user) {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('test123', 12);
        
        user = await prisma.user.create({
          data: {
            email: userData.email,
            password: hashedPassword,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: 'USER',
            status: 'ACTIVE',
            emailVerified: true
          }
        });
        console.log(`   ✅ Created ${userData.email}: ${user.id}`);
      } else {
        console.log(`   ✅ Found ${userData.email}: ${user.id}`);
      }

      // Ensure wallet balance
      let userWallet = await WalletService.getWallet(user.id);
      if (userWallet.balance < 2000) {
        await WalletService.addToWallet(user.id, 2000 - userWallet.balance, null, 'DEPOSIT', 'Test deposit for unit purchase');
        userWallet = await WalletService.getWallet(user.id);
      }

      // Purchase 4 units
      try {
        console.log(`   📦 Purchasing 4 units for ${userData.email}...`);
        const purchaseRequest = await PurchaseService.createPurchaseRequest(
          user.id,
          contractGame.id,
          4
        );
        console.log(`      ✅ Purchase request created: ${purchaseRequest.id} (Status: ${purchaseRequest.status})`);
        
        // Wait a moment for placement
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check placed units
        const userUnits = await prisma.unit.findMany({
          where: {
            ownerId: user.id,
            isSystemRoot: false
          },
          orderBy: { unitNumber: 'asc' },
          include: {
            parentUnit: {
              select: {
                unitName: true,
                unitNumber: true,
                isSystemRoot: true,
                owner: {
                  select: {
                    email: true
                  }
                }
              }
            }
          }
        });
        
        console.log(`      📦 Placed ${userUnits.length} units:`);
        userUnits.forEach(unit => {
          const parentInfo = unit.parentUnit 
            ? (unit.parentUnit.isSystemRoot 
                ? 'System Root' 
                : `Unit ${unit.parentUnit.unitNumber} (${unit.parentUnit.owner.email})`)
            : 'None';
          console.log(`         - Unit ${unit.unitNumber} (${unit.unitName}) - Parent: ${parentInfo}, Active: ${unit.isActive}`);
        });
      } catch (error) {
        console.error(`      ❌ Error purchasing units for ${userData.email}: ${error.message}`);
      }
    }

    // Step 7: Summary
    console.log('\n📊 Step 7: Summary...');
    const allUserUnits = await prisma.unit.findMany({
      where: { isSystemRoot: false },
      include: {
        owner: {
          select: {
            email: true
          }
        },
        parentUnit: {
          select: {
            unitName: true,
            unitNumber: true,
            isSystemRoot: true,
            owner: {
              select: {
                email: true
              }
            }
          }
        }
      },
      orderBy: [
        { owner: { email: 'asc' } },
        { unitNumber: 'asc' }
      ]
    });

    console.log(`\n   Total user units: ${allUserUnits.length}`);
    console.log(`   Units by user:`);
    const unitsByUser = {};
    allUserUnits.forEach(unit => {
      if (!unitsByUser[unit.owner.email]) {
        unitsByUser[unit.owner.email] = [];
      }
      unitsByUser[unit.owner.email].push(unit);
    });

    Object.keys(unitsByUser).forEach(email => {
      console.log(`\n   ${email}:`);
      unitsByUser[email].forEach(unit => {
        const parentInfo = unit.parentUnit 
          ? (unit.parentUnit.isSystemRoot 
              ? 'System Root' 
              : `Unit ${unit.parentUnit.unitNumber} (${unit.parentUnit.owner.email})`)
          : 'None';
        console.log(`      - Unit ${unit.unitNumber} (${unit.unitName}) - Parent: ${parentInfo}, Active: ${unit.isActive}`);
      });
    });

    console.log('\n✅ Test completed successfully!\n');
  } catch (error) {
    console.error('❌ Error in test:', error);
    console.error('\n💥 Script failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    throw error;
  } finally {
    await database.disconnect();
  }
};

// Run the script
if (require.main === module) {
  testPlacementPurchase()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      process.exit(1);
    });
}

module.exports = { testPlacementPurchase };

