#!/usr/bin/env node

/**
 * Verify System Features
 * Checks all the features we've implemented
 */

const database = require('../../config/database');
const logger = require('../../modules/logging/logger');

const verifySystem = async () => {
  try {
    console.log('🔍 Verifying System Features...\n');
    
    await database.connect();
    const prisma = database.getClient();

    // 1. Check Contract Games
    console.log('📊 1. Contract Games:');
    const contractGames = await prisma.contractGame.findMany({
      include: {
        _count: {
          select: { units: true, purchaseRequests: true }
        }
      }
    });
    console.log(`   ✅ Found ${contractGames.length} contract game(s)`);
    contractGames.forEach(game => {
      console.log(`      - ${game.name} (${game._count.units} units, ${game._count.purchaseRequests} requests)`);
    });

    // 2. Check Users
    console.log('\n👥 2. Users:');
    const users = await prisma.user.findMany({
      where: {
        email: {
          in: ['test1@gmail.com', 'mentor1@gmail.com', 'admin@example.com']
        }
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        mentorId: true
      }
    });
    console.log(`   ✅ Found ${users.length} test user(s)`);
    users.forEach(user => {
      console.log(`      - ${user.email} (${user.role}, ${user.status})${user.mentorId ? ` - Mentor: ${user.mentorId}` : ''}`);
    });

    // 3. Check Units
    console.log('\n🎯 3. Units:');
    const units = await prisma.unit.findMany({
      include: {
        owner: { select: { email: true, firstName: true, lastName: true } },
        host: { select: { email: true } },
        mentor: { select: { email: true } },
        contractGame: { select: { name: true } }
      },
      orderBy: [
        { contractGameId: 'asc' },
        { ownerId: 'asc' },
        { unitNumber: 'asc' }
      ]
    });
    console.log(`   ✅ Found ${units.length} unit(s)`);
    
    // Group by owner
    const unitsByOwner = {};
    units.forEach(unit => {
      const ownerEmail = unit.owner.email;
      if (!unitsByOwner[ownerEmail]) {
        unitsByOwner[ownerEmail] = [];
      }
      unitsByOwner[ownerEmail].push(unit);
    });

    Object.keys(unitsByOwner).forEach(ownerEmail => {
      const ownerUnits = unitsByOwner[ownerEmail];
      const activeUnits = ownerUnits.filter(u => u.isActive).length;
      console.log(`      - ${ownerEmail}: ${ownerUnits.length} units (${activeUnits} active)`);
      ownerUnits.forEach(unit => {
        console.log(`         • ${unit.unitName} (#${unit.unitNumber}) - Stage ${unit.stage}, Level ${unit.level}, Active: ${unit.isActive}`);
        if (unit.host && unit.host.email !== unit.owner.email) {
          console.log(`           Host: ${unit.host.email}`);
        }
      });
    });

    // 4. Check Purchase Requests
    console.log('\n🛒 4. Purchase Requests:');
    const requests = await prisma.purchaseRequest.findMany({
      include: {
        user: { select: { email: true } },
        mentor: { select: { email: true } },
        host: { select: { email: true } },
        contractGame: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`   ✅ Found ${requests.length} purchase request(s)`);
    requests.forEach(request => {
      console.log(`      - ${request.user.email} → ${request.contractGame.name}`);
      console.log(`        Status: ${request.status}, Units: ${request.unitCount}, Amount: $${Number(request.totalAmount)}`);
      console.log(`        Mentor: ${request.mentor.email}${request.host ? `, Host: ${request.host.email}` : ''}`);
    });

    // 5. Check Tree Structure
    console.log('\n🌳 5. Tree Structure:');
    const test1Units = units.filter(u => u.owner.email === 'test1@gmail.com');
    if (test1Units.length > 0) {
      const gameId = test1Units[0].contractGameId;
      const gameUnits = units.filter(u => u.contractGameId === gameId);
      
      // Find root units
      const rootUnits = gameUnits.filter(u => u.isSystemRoot);
      console.log(`   ✅ Contract Game has ${rootUnits.length} system root(s)`);
      
      // Check binary tree structure
      const unitsByParent = {};
      gameUnits.forEach(unit => {
        if (unit.parentUnitId) {
          if (!unitsByParent[unit.parentUnitId]) {
            unitsByParent[unit.parentUnitId] = [];
          }
          unitsByParent[unit.parentUnitId].push(unit);
        }
      });

      // Check if any parent has more than 2 children (violates binary tree)
      let violations = 0;
      Object.keys(unitsByParent).forEach(parentId => {
        const children = unitsByParent[parentId];
        if (children.length > 2) {
          violations++;
          const parent = gameUnits.find(u => u.id === parentId);
          console.log(`      ⚠️  Parent ${parent?.unitName} has ${children.length} children (should be max 2)`);
        }
      });

      if (violations === 0) {
        console.log(`   ✅ Binary tree structure is valid (no parent has more than 2 children)`);
      }

      // Check levels
      const levels = {};
      gameUnits.forEach(unit => {
        if (!levels[unit.level]) {
          levels[unit.level] = 0;
        }
        levels[unit.level]++;
      });
      console.log(`   ✅ Unit distribution by level:`);
      Object.keys(levels).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
        console.log(`      - Level ${level}: ${levels[level]} units`);
      });
    }

    // 6. Check Active Units
    console.log('\n⚡ 6. Active Units:');
    const activeUnits = units.filter(u => u.isActive);
    console.log(`   ✅ Found ${activeUnits.length} active unit(s)`);
    
    // Group by owner
    const activeByOwner = {};
    activeUnits.forEach(unit => {
      const ownerEmail = unit.owner.email;
      if (!activeByOwner[ownerEmail]) {
        activeByOwner[ownerEmail] = [];
      }
      activeByOwner[ownerEmail].push(unit);
    });

    Object.keys(activeByOwner).forEach(ownerEmail => {
      const ownerActiveUnits = activeByOwner[ownerEmail];
      ownerActiveUnits.forEach(unit => {
        console.log(`      - ${ownerEmail}: ${unit.unitName} (Stage ${unit.stage}, Level ${unit.level})`);
      });
    });

    // 7. Check Host Assignment
    console.log('\n👑 7. Host Assignment:');
    const unitsWithHost = units.filter(u => u.hostId && u.hostId !== u.ownerId);
    console.log(`   ✅ Found ${unitsWithHost.length} unit(s) with different host than owner`);
    unitsWithHost.forEach(unit => {
      console.log(`      - ${unit.unitName} (Owner: ${unit.owner.email}, Host: ${unit.host?.email})`);
    });

    // 8. Summary
    console.log('\n📋 Summary:');
    console.log(`   ✅ Contract Games: ${contractGames.length}`);
    console.log(`   ✅ Total Units: ${units.length}`);
    console.log(`   ✅ Active Units: ${activeUnits.length}`);
    console.log(`   ✅ Purchase Requests: ${requests.length}`);
    console.log(`   ✅ Test User (test1@gmail.com): ${units.filter(u => u.owner.email === 'test1@gmail.com').length} units`);
    console.log(`   ✅ Mentor (mentor1@gmail.com): ${units.filter(u => u.owner.email === 'mentor1@gmail.com').length} units`);

    console.log('\n✅ System verification complete!');

  } catch (error) {
    console.error('❌ Error during verification:', error);
    logger.error('Error in verifySystem:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
};

// Run the script
if (require.main === module) {
  verifySystem();
}

module.exports = { verifySystem };

