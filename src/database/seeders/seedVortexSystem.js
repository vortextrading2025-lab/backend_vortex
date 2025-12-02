#!/usr/bin/env node

/**
 * Standalone script to seed Vortex system contracts
 * Usage: node src/database/seeders/seedVortexSystem.js
 */

const database = require('../../config/database');
const seedVortexSystem = require('./vortexSystemSeeder');

const runSeed = async () => {
  try {
    await database.connect();
    await seedVortexSystem();
    console.log('\n🎉 Vortex system seeding completed!');
  } catch (error) {
    console.error('❌ Failed to seed Vortex system:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
};

runSeed();

