const database = require('../../config/database');
const bcrypt = require('bcryptjs');

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Create comprehensive permissions
    const permissions = [
      // User permissions
      { name: 'users.view', description: 'View users', resource: 'users', action: 'view' },
      { name: 'users.create', description: 'Create users', resource: 'users', action: 'create' },
      { name: 'users.update', description: 'Update users', resource: 'users', action: 'update' },
      { name: 'users.delete', description: 'Delete users', resource: 'users', action: 'delete' },
      { name: 'users.block', description: 'Block/unblock users', resource: 'users', action: 'block' },
      { name: 'users.viewDetails', description: 'View user details', resource: 'users', action: 'viewDetails' },
      
      // Vendor permissions
      { name: 'vendors.view', description: 'View vendors', resource: 'vendors', action: 'view' },
      { name: 'vendors.create', description: 'Create vendors', resource: 'vendors', action: 'create' },
      { name: 'vendors.update', description: 'Update vendors', resource: 'vendors', action: 'update' },
      { name: 'vendors.delete', description: 'Delete vendors', resource: 'vendors', action: 'delete' },
      { name: 'vendors.verify', description: 'Verify vendors', resource: 'vendors', action: 'verify' },
      
      // Order permissions
      { name: 'orders.view', description: 'View orders', resource: 'orders', action: 'view' },
      { name: 'orders.update', description: 'Update orders', resource: 'orders', action: 'update' },
      { name: 'orders.cancel', description: 'Cancel orders', resource: 'orders', action: 'cancel' },
      { name: 'orders.refund', description: 'Refund orders', resource: 'orders', action: 'refund' },
      
      // Contract permissions
      { name: 'contracts.view', description: 'View contracts', resource: 'contracts', action: 'view' },
      { name: 'contracts.manage', description: 'Manage contracts', resource: 'contracts', action: 'manage' },
      { name: 'contracts.approve', description: 'Approve contracts', resource: 'contracts', action: 'approve' },
      
      // Product permissions
      { name: 'products.view', description: 'View products', resource: 'products', action: 'view' },
      { name: 'products.create', description: 'Create products', resource: 'products', action: 'create' },
      { name: 'products.update', description: 'Update products', resource: 'products', action: 'update' },
      { name: 'products.delete', description: 'Delete products', resource: 'products', action: 'delete' },
      
      // Settlement permissions
      { name: 'settlements.view', description: 'View settlements', resource: 'settlements', action: 'view' },
      { name: 'settlements.approve', description: 'Approve settlements', resource: 'settlements', action: 'approve' },
      { name: 'settlements.reject', description: 'Reject settlements', resource: 'settlements', action: 'reject' },
      
      // Dashboard permissions
      { name: 'dashboard.view', description: 'View dashboard', resource: 'dashboard', action: 'view' },
      { name: 'dashboard.stats', description: 'View dashboard statistics', resource: 'dashboard', action: 'stats' },
      
      // Audit log permissions
      { name: 'audit.view', description: 'View audit logs', resource: 'audit', action: 'view' },
      
      // Role permissions
      { name: 'roles.view', description: 'View roles', resource: 'roles', action: 'view' },
      { name: 'roles.create', description: 'Create roles', resource: 'roles', action: 'create' },
      { name: 'roles.update', description: 'Update roles', resource: 'roles', action: 'update' },
      { name: 'roles.delete', description: 'Delete roles', resource: 'roles', action: 'delete' },
      
      // Permission permissions
      { name: 'permissions.view', description: 'View permissions', resource: 'permissions', action: 'view' },
      { name: 'permissions.assign', description: 'Assign permissions', resource: 'permissions', action: 'assign' },
      
      // Admin access
      { name: 'admin.access', description: 'Admin access', resource: 'admin', action: 'access' }
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

    // Create subadmin roles
    const moderatorRole = await database.getClient().role.upsert({
      where: { name: 'MODERATOR' },
      update: { name: 'MODERATOR', description: 'Moderator role - Can manage users and orders' },
      create: { name: 'MODERATOR', description: 'Moderator role - Can manage users and orders' }
    });

    const supportRole = await database.getClient().role.upsert({
      where: { name: 'SUPPORT' },
      update: { name: 'SUPPORT', description: 'Support role - Can view and assist users' },
      create: { name: 'SUPPORT', description: 'Support role - Can view and assist users' }
    });

    const analystRole = await database.getClient().role.upsert({
      where: { name: 'ANALYST' },
      update: { name: 'ANALYST', description: 'Analyst role - Can view analytics and reports' },
      create: { name: 'ANALYST', description: 'Analyst role - Can view analytics and reports' }
    });

    // Assign permissions to roles
    console.log('🔗 Assigning permissions to roles...');
    
    // Get all permissions
    const allPermissions = await database.getClient().permission.findMany();
    const permissionMap = {};
    allPermissions.forEach(p => {
      permissionMap[p.name] = p;
    });
    
    // Admin gets all permissions
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

    // MODERATOR permissions: Users (view, update, block), Orders (view, update), Vendors (view, verify)
    const moderatorPermissions = [
      permissionMap['users.view'],
      permissionMap['users.update'],
      permissionMap['users.block'],
      permissionMap['orders.view'],
      permissionMap['orders.update'],
      permissionMap['vendors.view'],
      permissionMap['vendors.verify'],
      permissionMap['dashboard.view']
    ].filter(Boolean);

    for (const permission of moderatorPermissions) {
      await database.getClient().role.update({
        where: { id: moderatorRole.id },
        data: {
          permissions: {
            connect: { id: permission.id }
          }
        }
      });
    }

    // SUPPORT permissions: Users (view, viewDetails), Orders (view), Contracts (view), Audit Logs (view)
    const supportPermissions = [
      permissionMap['users.view'],
      permissionMap['users.viewDetails'],
      permissionMap['orders.view'],
      permissionMap['contracts.view'],
      permissionMap['audit.view'],
      permissionMap['dashboard.view']
    ].filter(Boolean);

    for (const permission of supportPermissions) {
      await database.getClient().role.update({
        where: { id: supportRole.id },
        data: {
          permissions: {
            connect: { id: permission.id }
          }
        }
      });
    }

    // ANALYST permissions: Dashboard (view, stats), Orders (view), Contracts (view), Audit Logs (view)
    const analystPermissions = [
      permissionMap['dashboard.view'],
      permissionMap['dashboard.stats'],
      permissionMap['orders.view'],
      permissionMap['contracts.view'],
      permissionMap['audit.view']
    ].filter(Boolean);

    for (const permission of analystPermissions) {
      await database.getClient().role.update({
        where: { id: analystRole.id },
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
