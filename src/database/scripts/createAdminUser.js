#!/usr/bin/env node

/**
 * Create Admin User
 * Creates a new admin user or updates existing user to admin
 * Usage: node src/database/scripts/createAdminUser.js <email> <password> [firstName] [lastName]
 */

require('dotenv').config({ path: '.env.development' });
const database = require('../../config/database');
const bcrypt = require('bcryptjs');

const createAdminUser = async () => {
  try {
    // Get arguments
    const email = process.argv[2];
    const password = process.argv[3];
    const firstName = process.argv[4] || 'Admin';
    const lastName = process.argv[5] || 'User';
    
    if (!email || !password) {
      console.error('❌ Error: Email and password are required');
      console.log('Usage: node src/database/scripts/createAdminUser.js <email> <password> [firstName] [lastName]');
      process.exit(1);
    }

    console.log(`🔄 Creating/updating admin user ${email}...\n`);
    
    // Connect to database
    await database.connect();
    const prisma = database.getClient();

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true
      }
    });

    let user;
    if (existingUser) {
      // Update existing user to admin
      console.log('📋 User exists, updating to ADMIN...\n');
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerified: true,
          password: hashedPassword, // Update password
          firstName: firstName,
          lastName: lastName
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          emailVerified: true
        }
      });
      console.log('✅ User updated to ADMIN!\n');
    } else {
      // Create new admin user
      console.log('📋 Creating new admin user...\n');
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerified: true
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          emailVerified: true
        }
      });

      // Create wallet for admin
      await prisma.wallet.create({
        data: {
          userId: user.id,
          balance: 0,
          totalEarned: 0,
          totalWithdrawn: 0
        }
      });

      console.log('✅ Admin user created!\n');
    }

    console.log(`📋 Admin user info:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   Role: ${user.role} ✅`);
    console.log(`   Status: ${user.status}`);
    console.log(`   Email Verified: ${user.emailVerified}\n`);
    console.log('🎉 Admin user is ready!');
    console.log(`   Login with: ${email} / ${password}`);

    await database.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    if (error.code === 'P2002') {
      console.error('   → Email already exists (this should not happen)');
    } else {
      console.error('   Full error:', error);
    }
    process.exit(1);
  }
};

createAdminUser();
