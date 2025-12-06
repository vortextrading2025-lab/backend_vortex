#!/usr/bin/env node

/**
 * Create Mentor User Script
 * Creates a mentor user with specified email and password
 * Usage: node src/database/seeders/createMentor.js
 */

const database = require('../../config/database');
const bcrypt = require('bcryptjs');

const createMentor = async () => {
  try {
    console.log('👤 Creating mentor user...');

    // Connect to database
    await database.connect();

    const email = 'mentor1@gmail.com';
    const password = '12345678';
    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if user already exists
    const existingUser = await database.getClient().user.findUnique({
      where: { email: email }
    });

    if (existingUser) {
      console.log(`⚠️  User with email ${email} already exists. Updating to MENTOR role...`);
      
      const updatedUser = await database.getClient().user.update({
        where: { email: email },
        data: {
          password: hashedPassword,
          role: 'MENTOR',
          status: 'ACTIVE',
          emailVerified: true
        }
      });

      console.log('✅ User updated successfully!');
      console.log(`   Email: ${updatedUser.email}`);
      console.log(`   Role: ${updatedUser.role}`);
      console.log(`   Status: ${updatedUser.status}`);
    } else {
      // Create new mentor user
      const mentorUser = await database.getClient().user.create({
        data: {
          email: email,
          password: hashedPassword,
          firstName: 'Mentor',
          lastName: 'One',
          role: 'MENTOR',
          status: 'ACTIVE',
          emailVerified: true
        }
      });

      console.log('✅ Mentor user created successfully!');
      console.log(`   Email: ${mentorUser.email}`);
      console.log(`   Password: ${password}`);
      console.log(`   Role: ${mentorUser.role}`);
      console.log(`   Status: ${mentorUser.status}`);
      console.log(`   ID: ${mentorUser.id}`);
    }

    // Create mentor profile if it doesn't exist
    const user = await database.getClient().user.findUnique({
      where: { email: email }
    });

    if (user) {
      const existingProfile = await database.getClient().mentorProfile.findUnique({
        where: { userId: user.id }
      });

      if (!existingProfile) {
        await database.getClient().mentorProfile.create({
          data: {
            userId: user.id,
            expertise: ['Contract Management', 'Business Development'],
            experience: 5,
            bio: 'Experienced mentor in contract management',
            isVerified: true
          }
        });
        console.log('✅ Mentor profile created!');
      } else {
        console.log('ℹ️  Mentor profile already exists');
      }
    }

    console.log('\n✅ Process completed successfully!');
  } catch (error) {
    console.error('❌ Error creating mentor user:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
};

// Run if called directly
if (require.main === module) {
  createMentor();
}

module.exports = createMentor;

