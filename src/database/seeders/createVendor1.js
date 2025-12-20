#!/usr/bin/env node

/**
 * Create Vendor1 User Script
 * Creates a vendor user with email vendor1@gmail.com and password 12345678
 * Usage: node src/database/seeders/createVendor1.js
 */

const database = require('../../config/database');
const bcrypt = require('bcryptjs');

const createVendor1 = async () => {
  try {
    console.log('🔄 Creating vendor1@gmail.com user...\n');
    
    // Connect to database
    await database.connect();
    const prisma = database.getClient();

    // Hash password
    const hashedPassword = await bcrypt.hash('12345678', 12);
    
    // Create or update vendor user
    const vendor = await prisma.user.upsert({
      where: { email: 'vendor1@gmail.com' },
      update: {
        email: 'vendor1@gmail.com',
        password: hashedPassword,
        firstName: 'Vendor',
        lastName: 'One',
        role: 'VENDOR',
        status: 'ACTIVE',
        emailVerified: true
      },
      create: {
        email: 'vendor1@gmail.com',
        password: hashedPassword,
        firstName: 'Vendor',
        lastName: 'One',
        role: 'VENDOR',
        status: 'ACTIVE',
        emailVerified: true
      }
    });

    console.log('✅ Vendor user created/updated:', vendor.email);

    // Create or update vendor profile
    const vendorProfile = await prisma.vendorProfile.upsert({
      where: { userId: vendor.id },
      update: {
        businessName: 'Vendor One Business',
        businessType: 'General',
        description: 'Test vendor business for e-commerce'
      },
      create: {
        userId: vendor.id,
        businessName: 'Vendor One Business',
        businessType: 'General',
        description: 'Test vendor business for e-commerce'
      }
    });

    console.log('✅ Vendor profile created/updated:', vendorProfile.businessName);

    // Create wallet if it doesn't exist
    const wallet = await prisma.wallet.upsert({
      where: { userId: vendor.id },
      update: {},
      create: {
        userId: vendor.id,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0
      }
    });

    console.log('✅ Wallet created/updated for vendor');
    console.log('\n✅ Vendor1 user setup complete!');
    console.log('   Email: vendor1@gmail.com');
    console.log('   Password: 12345678');
    console.log('   Role: VENDOR');
    console.log('   Status: ACTIVE\n');

    await database.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating vendor user:', error);
    await database.disconnect();
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  createVendor1();
}

module.exports = createVendor1;
