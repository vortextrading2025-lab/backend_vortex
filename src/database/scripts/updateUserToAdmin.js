require('dotenv').config({ path: '.env.development' });
const database = require('../../config/database');
const bcrypt = require('bcryptjs');

async function updateUserToAdmin(email) {
  try {
    await database.connect();
    const prisma = database.getClient();

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        vendorProfile: true,
        mentorProfile: true,
      },
    });

    let updatedUser;
    
    if (!user) {
      // User doesn't exist, create new admin user
      console.log(`📧 User not found. Creating new admin user...`);
      
      // Generate a default password (user can change it later)
      const defaultPassword = 'Admin123!';
      const hashedPassword = await bcrypt.hash(defaultPassword, 12);
      
      updatedUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName: 'Admin',
          lastName: 'User',
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerified: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          emailVerified: true,
          createdAt: true,
        },
      });
      
      console.log(`✅ New admin user created!`);
      console.log(`   Default password: ${defaultPassword}`);
    } else {
      console.log(`📧 Found user: ${user.email}`);
      console.log(`   Current role: ${user.role}`);
      console.log(`   Current status: ${user.status}`);

      // Update user to ADMIN
      updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerified: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          emailVerified: true,
          createdAt: true,
        },
      });
    }

    console.log('\n✅ User updated successfully!');
    console.log('Updated user details:');
    console.log(`   ID: ${updatedUser.id}`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Name: ${updatedUser.firstName || ''} ${updatedUser.lastName || ''}`.trim() || 'N/A');
    console.log(`   Role: ${updatedUser.role}`);
    console.log(`   Status: ${updatedUser.status}`);
    console.log(`   Email Verified: ${updatedUser.emailVerified}`);

    // Check if wallet exists, create if not
    const wallet = await prisma.wallet.findUnique({
      where: { userId: updatedUser.id },
    });

    if (!wallet) {
      await prisma.wallet.create({
        data: {
          userId: updatedUser.id,
          balance: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
        },
      });
      console.log('\n✅ Wallet created for user');
    } else {
      console.log('\n✅ Wallet already exists');
    }

    await database.disconnect();
    console.log('\n🎉 Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    await database.disconnect();
    process.exit(1);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide an email address');
  console.log('Usage: node updateUserToAdmin.js <email>');
  console.log('Example: node updateUserToAdmin.js admin11@example.com');
  process.exit(1);
}

updateUserToAdmin(email);
