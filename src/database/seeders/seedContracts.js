#!/usr/bin/env node

/**
 * Standalone script to seed contracts
 * Usage: node src/database/seeders/seedContracts.js
 */

const database = require('../../config/database');
const seedContracts = require('./contractSeeder');

const runSeed = async () => {
  try {
    await database.connect();
    await seedContracts();
    console.log('\n🎉 Contract seeding completed!');
  } catch (error) {
    console.error('❌ Failed to seed contracts:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
};

runSeed();

