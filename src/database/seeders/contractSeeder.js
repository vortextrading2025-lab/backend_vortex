const database = require('../../config/database');
const bcrypt = require('bcryptjs');

/**
 * Seed example contracts for demo purposes
 * Creates a tree structure with multiple users and contracts
 */
const seedContracts = async () => {
  try {
    console.log('🌱 Starting contract seeding...');

    // Get or create demo users
    const demoUsers = [
      {
        email: 'demo1@example.com',
        firstName: 'John',
        lastName: 'Smith',
        role: 'USER'
      },
      {
        email: 'demo2@example.com',
        firstName: 'Sarah',
        lastName: 'Johnson',
        role: 'USER'
      },
      {
        email: 'demo3@example.com',
        firstName: 'Mike',
        lastName: 'Williams',
        role: 'USER'
      },
      {
        email: 'demo4@example.com',
        firstName: 'Emily',
        lastName: 'Brown',
        role: 'USER'
      },
      {
        email: 'demo5@example.com',
        firstName: 'David',
        lastName: 'Jones',
        role: 'USER'
      },
      {
        email: 'demo6@example.com',
        firstName: 'Lisa',
        lastName: 'Davis',
        role: 'USER'
      },
      {
        email: 'demo7@example.com',
        firstName: 'Tom',
        lastName: 'Wilson',
        role: 'USER'
      },
      {
        email: 'demo8@example.com',
        firstName: 'Anna',
        lastName: 'Martinez',
        role: 'USER'
      },
      {
        email: 'demo9@example.com',
        firstName: 'Chris',
        lastName: 'Anderson',
        role: 'USER'
      },
      {
        email: 'demo10@example.com',
        firstName: 'Jessica',
        lastName: 'Taylor',
        role: 'USER'
      },
      {
        email: 'demo11@example.com',
        firstName: 'Ryan',
        lastName: 'Thomas',
        role: 'USER'
      },
      {
        email: 'demo12@example.com',
        firstName: 'Amanda',
        lastName: 'Jackson',
        role: 'USER'
      },
      {
        email: 'demo13@example.com',
        firstName: 'Kevin',
        lastName: 'White',
        role: 'USER'
      },
      {
        email: 'demo14@example.com',
        firstName: 'Michelle',
        lastName: 'Harris',
        role: 'USER'
      },
      {
        email: 'demo15@example.com',
        firstName: 'Daniel',
        lastName: 'Martin',
        role: 'USER'
      }
    ];

    console.log('👥 Creating demo users...');
    const createdUsers = [];
    const hashedPassword = await bcrypt.hash('demo123', 12);

    for (const userData of demoUsers) {
      const user = await database.getClient().user.upsert({
        where: { email: userData.email },
        update: {
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          status: 'ACTIVE',
          emailVerified: true
        },
        create: {
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          status: 'ACTIVE',
          emailVerified: true
        }
      });
      createdUsers.push(user);
    }

    console.log('📋 Creating example contracts...');

    // Clear existing contracts (optional - comment out if you want to keep existing)
    // await database.getClient().contract.deleteMany({});
    // await database.getClient().payout.deleteMany({});

    // Contract 1: Root contract for User 1 (John Smith)
    // This is the first contract (101) - odd number, so it needs a host
    // Try to use admin user, or create one if it doesn't exist
    let adminUser = await database.getClient().user.findUnique({
      where: { email: 'admin@example.com' }
    });

    if (!adminUser) {
      console.log('⚠️  Admin user not found. Creating admin user...');
      const adminHashedPassword = await bcrypt.hash('12345678', 12);
      adminUser = await database.getClient().user.create({
        data: {
          email: 'admin@example.com',
          password: adminHashedPassword,
          firstName: 'Admin',
          lastName: 'User',
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerified: true
        }
      });
      console.log('✅ Admin user created');
    }

    // Create root contract for User 1 (John Smith)
    const rootContract = await database.getClient().contract.create({
      data: {
        contractNumber: 101,
        ownerId: createdUsers[0].id, // John Smith
        hostId: adminUser.id, // Admin as initial host
        parentId: null,
        stage: 'STAGE_1',
        status: 'ACTIVE',
        level: 0,
        position: 0,
        positionInLevel: 0,
        isActive: true,
        downPayment: 1000.00 // $1000 down payment
      }
    });

    console.log(`✅ Created root contract #101 for ${createdUsers[0].firstName} ${createdUsers[0].lastName}`);

    // Level 1: Create 3 contracts under root (positions 0, 1, 2)
    const level1Contracts = [];
    for (let i = 0; i < 3; i++) {
      const user = createdUsers[i + 1]; // Users 2, 3, 4
      const contract = await database.getClient().contract.create({
        data: {
          contractNumber: 101 + (i + 1), // 102, 103, 104
          ownerId: user.id,
          hostId: createdUsers[0].id, // Hosted by John Smith
          parentId: rootContract.id,
          stage: 'STAGE_1',
          status: 'ACTIVE',
          level: 1,
          position: i,
          positionInLevel: 0,
          isActive: true,
          downPayment: 1000.00
        }
      });
      level1Contracts.push(contract);
      console.log(`✅ Created contract #${contract.contractNumber} for ${user.firstName} ${user.lastName} (Level 1, Position ${i})`);
    }

    // Level 2: Create 4 contracts under first level contract (positions 0, 1, 2, 3)
    const level2Contracts = [];
    let userIndex = 4; // Start from user 5
    for (let i = 0; i < 3; i++) {
      const parentContract = level1Contracts[i];
      // Create contracts under each level 1 contract
      for (let j = 0; j < 4; j++) {
        if (userIndex < createdUsers.length) {
          const user = createdUsers[userIndex];
          const contract = await database.getClient().contract.create({
            data: {
              contractNumber: 105 + (i * 4) + j, // 105-116
              ownerId: user.id,
              hostId: parentContract.ownerId,
              parentId: parentContract.id,
              stage: 'STAGE_1',
              status: 'ACTIVE',
              level: 2,
              position: j,
              positionInLevel: 0,
              isActive: true,
              downPayment: 1000.00
            }
          });
          level2Contracts.push(contract);
          console.log(`✅ Created contract #${contract.contractNumber} for ${user.firstName} ${user.lastName} (Level 2, Position ${j}, under contract #${parentContract.contractNumber})`);
          userIndex++;
        }
      }
    }

    // Level 3: Create 4 contracts under first level 2 contract to show partial fulfillment
    const level3Contracts = [];
    if (level2Contracts.length > 0 && userIndex < createdUsers.length) {
      const parentContract = level2Contracts[0]; // First level 2 contract
      for (let j = 0; j < 4 && userIndex < createdUsers.length; j++) {
        const user = createdUsers[userIndex];
        const contract = await database.getClient().contract.create({
          data: {
            contractNumber: 117 + j, // 117-120
            ownerId: user.id,
            hostId: parentContract.ownerId,
            parentId: parentContract.id,
            stage: 'STAGE_1',
            status: 'ACTIVE',
            level: 3,
            position: 0,
            positionInLevel: j,
            isActive: true,
            downPayment: 1000.00
          }
        });
        level3Contracts.push(contract);
        console.log(`✅ Created contract #${contract.contractNumber} for ${user.firstName} ${user.lastName} (Level 3, Position ${j})`);
        userIndex++;
      }
    }

    // Level 4: Create 4 contracts to show active status requirement
    if (level3Contracts.length > 0 && userIndex < createdUsers.length) {
      const parentContract = level3Contracts[0]; // First level 3 contract
      for (let j = 0; j < 4 && userIndex < createdUsers.length; j++) {
        const user = createdUsers[userIndex];
        const contract = await database.getClient().contract.create({
          data: {
            contractNumber: 121 + j, // 121-124
            ownerId: user.id,
            hostId: parentContract.ownerId,
            parentId: parentContract.id,
            stage: 'STAGE_1',
            status: 'ACTIVE',
            level: 4,
            position: 0,
            positionInLevel: j,
            isActive: true,
            downPayment: 1000.00
          }
        });
        console.log(`✅ Created contract #${contract.contractNumber} for ${user.firstName} ${user.lastName} (Level 4, Position ${j})`);
        userIndex++;
      }
    }

    // Create a second root contract for User 2 (Sarah Johnson) to show multiple trees
    const rootContract2 = await database.getClient().contract.create({
      data: {
        contractNumber: 101,
        ownerId: createdUsers[1].id, // Sarah Johnson
        hostId: adminUser.id,
        parentId: null,
        stage: 'STAGE_1',
        status: 'ACTIVE',
        level: 0,
        position: 0,
        positionInLevel: 0,
        isActive: true,
        downPayment: 1000.00
      }
    });

    console.log(`✅ Created second root contract #101 for ${createdUsers[1].firstName} ${createdUsers[1].lastName}`);

    // Create a fulfilled contract example (Stage 1 completed, moved to Stage 2)
    // Use a different user (user 3) to avoid conflict with existing contracts
    // First, get the next available contract number for this user
    const fulfilledUser = createdUsers[2]; // Mike Williams (user 3)
    const lastContractForUser = await database.getClient().contract.findFirst({
      where: { ownerId: fulfilledUser.id },
      orderBy: { contractNumber: 'desc' }
    });
    const nextContractNumber = lastContractForUser ? lastContractForUser.contractNumber + 1 : 101;

    const fulfilledContract = await database.getClient().contract.create({
      data: {
        contractNumber: nextContractNumber,
        ownerId: fulfilledUser.id, // Mike Williams
        hostId: fulfilledUser.id,
        parentId: rootContract2.id, // Under Sarah's root contract
        stage: 'STAGE_2', // Already moved to Stage 2
        status: 'FULFILLED',
        level: 1,
        position: 0,
        positionInLevel: 0,
        isActive: false,
        fulfilledAt: new Date(),
        movedToStage2At: new Date(),
        payoutAmount: 1000.00, // Stage 1 payout
        downPayment: 1000.00
      }
    });

    // Create payout record for fulfilled contract
    await database.getClient().payout.create({
      data: {
        contractId: fulfilledContract.id,
        userId: fulfilledContract.ownerId,
        amount: 1000.00,
        stage: 'STAGE_1',
        status: 'PROCESSED',
        processedAt: new Date()
      }
    });

    console.log(`✅ Created fulfilled contract example with payout`);

    console.log('\n✅ Contract seeding completed successfully!');
    console.log('\n📊 Demo Contract Structure:');
    console.log('   Root Contract #101 (John Smith) - Level 0');
    console.log('   ├── Level 1: 3 contracts (102, 103, 104)');
    console.log('   │   ├── Level 2: 4 contracts each (105-116)');
    console.log('   │   │   └── Level 3: 4 contracts (117-120)');
    console.log('   │   │       └── Level 4: 4 contracts (121-124)');
    console.log('   Root Contract #101 (Sarah Johnson) - Level 0');
    console.log('   └── Contract #102 (FULFILLED, moved to Stage 2)');
    console.log('\n💰 All contracts have $1000 down payment');
    console.log('\n👤 Demo User Accounts (password: demo123):');
    demoUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} - ${user.firstName} ${user.lastName}`);
    });

  } catch (error) {
    console.error('❌ Contract seeding failed:', error);
    throw error;
  }
};

module.exports = seedContracts;

