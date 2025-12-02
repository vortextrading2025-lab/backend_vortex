const database = require('../../config/database');
const bcrypt = require('bcryptjs');

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Create permissions
    const permissions = [
      { name: 'users.create', description: 'Create users', resource: 'users', action: 'create' },
      { name: 'users.read', description: 'Read users', resource: 'users', action: 'read' },
      { name: 'users.update', description: 'Update users', resource: 'users', action: 'update' },
      { name: 'users.delete', description: 'Delete users', resource: 'users', action: 'delete' },
      { name: 'products.create', description: 'Create products', resource: 'products', action: 'create' },
      { name: 'products.read', description: 'Read products', resource: 'products', action: 'read' },
      { name: 'products.update', description: 'Update products', resource: 'products', action: 'update' },
      { name: 'products.delete', description: 'Delete products', resource: 'products', action: 'delete' },
      { name: 'orders.create', description: 'Create orders', resource: 'orders', action: 'create' },
      { name: 'orders.read', description: 'Read orders', resource: 'orders', action: 'read' },
      { name: 'orders.update', description: 'Update orders', resource: 'orders', action: 'update' },
      { name: 'orders.delete', description: 'Delete orders', resource: 'orders', action: 'delete' },
      { name: 'admin.access', description: 'Admin access', resource: 'admin', action: 'access' },
      { name: 'audit.read', description: 'Read audit logs', resource: 'audit', action: 'read' }
    ];

    console.log('📝 Creating permissions...');
    for (const permission of permissions) {
      await database.getClient().permission.upsert({
        where: { name: permission.name },
        update: permission,
        create: permission
      });
    }

    // Create roles
    console.log('👥 Creating roles...');
    const adminRole = await database.getClient().role.upsert({
      where: { name: 'admin' },
      update: { name: 'admin', description: 'Administrator role' },
      create: { name: 'admin', description: 'Administrator role' }
    });

    const mentorRole = await database.getClient().role.upsert({
      where: { name: 'mentor' },
      update: { name: 'mentor', description: 'Mentor role' },
      create: { name: 'mentor', description: 'Mentor role' }
    });

    const vendorRole = await database.getClient().role.upsert({
      where: { name: 'vendor' },
      update: { name: 'vendor', description: 'Vendor role' },
      create: { name: 'vendor', description: 'Vendor role' }
    });

    const userRole = await database.getClient().role.upsert({
      where: { name: 'user' },
      update: { name: 'user', description: 'Regular user role' },
      create: { name: 'user', description: 'Regular user role' }
    });

    // Assign permissions to roles
    console.log('🔗 Assigning permissions to roles...');
    
    // Admin gets all permissions
    const allPermissions = await database.getClient().permission.findMany();
    for (const permission of allPermissions) {
      await database.getClient().role.update({
        where: { id: adminRole.id },
        data: {
          permissions: {
            connect: { id: permission.id }
          }
        }
      });
    }

    // Create admin user
    console.log('👤 Creating admin user...');
    const hashedPassword = await bcrypt.hash('12345678', 12);
    
    const adminUser = await database.getClient().user.upsert({
      where: { email: 'admin@example.com' },
      update: {
        email: 'admin@example.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerified: true
      },
      create: {
        email: 'admin@example.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerified: true
      }
    });

    // Create test users
    console.log('👥 Creating test users...');
    
    const testUsers = [
      {
        email: 'user@example.com',
        password: 'user123',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER'
      },
      {
        email: 'vendor@example.com',
        password: 'vendor123',
        firstName: 'Test',
        lastName: 'Vendor',
        role: 'VENDOR'
      },
      {
        email: 'mentor@example.com',
        password: 'mentor123',
        firstName: 'Test',
        lastName: 'Mentor',
        role: 'MENTOR'
      }
    ];

    for (const userData of testUsers) {
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      
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

      // Create profiles for vendors and mentors
      if (userData.role === 'VENDOR') {
        await database.getClient().vendorProfile.upsert({
          where: { userId: user.id },
          update: {
            businessName: `${userData.firstName} ${userData.lastName} Business`,
            businessType: 'General',
            description: 'Test vendor business'
          },
          create: {
            userId: user.id,
            businessName: `${userData.firstName} ${userData.lastName} Business`,
            businessType: 'General',
            description: 'Test vendor business'
          }
        });
      } else if (userData.role === 'MENTOR') {
        await database.getClient().mentorProfile.upsert({
          where: { userId: user.id },
          update: {
            expertise: ['JavaScript', 'Node.js', 'React'],
            experience: 5,
            bio: 'Experienced developer and mentor',
            hourlyRate: 50
          },
          create: {
            userId: user.id,
            expertise: ['JavaScript', 'Node.js', 'React'],
            experience: 5,
            bio: 'Experienced developer and mentor',
            hourlyRate: 50
          }
        });
      }
    }

    console.log('✅ Database seeding completed successfully!');
    console.log('\n📋 Test Accounts:');
    console.log('Admin: admin@example.com / 12345678');
    console.log('User: user@example.com / user123');
    console.log('Vendor: vendor@example.com / vendor123');
    console.log('Mentor: mentor@example.com / mentor123');

    // Seed contracts if requested
    if (process.env.SEED_CONTRACTS === 'true') {
      console.log('\n🌱 Seeding contracts...');
      const seedContracts = require('./contractSeeder');
      await seedContracts();
    }

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  } finally {
    await database.disconnect();
  }
};

// Run seeding if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
