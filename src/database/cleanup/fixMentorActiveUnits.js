#!/usr/bin/env node

const database = require('../../config/database');
const logger = require('../../modules/logging/logger');

/**
 * Fix mentor active units - ensure only ONE active unit per mentor per game per stage
 * This script deactivates all mentor units except the first one (by creation date)
 */
const fixMentorActiveUnits = async () => {
  try {
    console.log('🔄 Starting fix for mentor active units...\n');
    await database.connect();
    const prisma = database.getClient();

    // Get all contract games
    const contractGames = await prisma.contractGame.findMany({
      where: { status: 'ACTIVE' }
    });

    console.log(`📊 Found ${contractGames.length} active contract games\n`);

    for (const game of contractGames) {
      console.log(`\n🎮 Processing game: ${game.name} (${game.id})`);

      // Get all mentors
      const mentors = await prisma.user.findMany({
        where: { role: 'MENTOR', status: 'ACTIVE' }
      });

      console.log(`   Found ${mentors.length} active mentors`);

      for (const mentor of mentors) {
        // For each stage (1, 2, 3)
        for (let stage = 1; stage <= 3; stage++) {
          // Get all units owned by this mentor in this game and stage
          const mentorUnits = await prisma.unit.findMany({
            where: {
              ownerId: mentor.id,
              contractGameId: game.id,
              stage: stage,
              isSystemRoot: false
            },
            orderBy: {
              createdAt: 'asc' // First created unit should be active
            }
          });

          if (mentorUnits.length === 0) continue;

          // Find the first unit (should be active)
          const firstUnit = mentorUnits[0];
          const otherUnits = mentorUnits.slice(1);

          // Count how many are currently active
          const activeCount = mentorUnits.filter(u => u.isActive).length;

          if (activeCount > 1 || (activeCount === 0 && mentorUnits.length > 0)) {
            console.log(`   👤 Mentor ${mentor.email} - Stage ${stage}:`);
            console.log(`      Total units: ${mentorUnits.length}`);
            console.log(`      Currently active: ${activeCount}`);

            // Ensure first unit is active
            if (!firstUnit.isActive) {
              await prisma.unit.update({
                where: { id: firstUnit.id },
                data: { isActive: true }
              });
              console.log(`      ✅ Activated first unit: ${firstUnit.unitName}`);
            }

            // Deactivate all other units
            if (otherUnits.length > 0) {
              const deactivatedCount = await prisma.unit.updateMany({
                where: {
                  id: { in: otherUnits.map(u => u.id) },
                  isActive: true
                },
                data: { isActive: false }
              });
              if (deactivatedCount.count > 0) {
                console.log(`      ✅ Deactivated ${deactivatedCount.count} other unit(s)`);
              }
            }
          }
        }
      }
    }

    console.log('\n✅ Fix completed successfully!\n');
    console.log('📝 Summary:');
    console.log('   - Only the first unit (by creation date) per mentor per game per stage is now active');
    console.log('   - All other mentor units are inactive');
    console.log('   - User units will be placed under the mentor\'s active unit\n');
  } catch (error) {
    logger.error('❌ Error fixing mentor active units:', error);
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
};

if (require.main === module) {
  fixMentorActiveUnits();
}

module.exports = { fixMentorActiveUnits };

