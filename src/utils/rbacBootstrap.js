const database = require('../config/database');

const DEFAULT_PERMISSIONS = [
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
  { name: 'admin.access', description: 'Admin access', resource: 'admin', action: 'access' },
];

const DEFAULT_ROLES = [
  { name: 'ADMIN', description: 'Administrator role' },
  { name: 'MODERATOR', description: 'Moderator role - Can manage users and orders' },
  { name: 'SUPPORT', description: 'Support role - Can view and assist users' },
  { name: 'ANALYST', description: 'Analyst role - Can view analytics and reports' },
  { name: 'USER', description: 'Regular user role' },
  { name: 'VENDOR', description: 'Vendor role' },
  { name: 'MENTOR', description: 'Mentor role' },
];

const ROLE_PERMISSION_NAMES = {
  MODERATOR: [
    'dashboard.view',
    'users.view',
    'users.update',
    'users.block',
    'orders.view',
    'orders.update',
    'vendors.view',
    'vendors.verify',
  ],
  SUPPORT: [
    'dashboard.view',
    'users.view',
    'users.viewDetails',
    'orders.view',
    'contracts.view',
    'audit.view',
  ],
  ANALYST: [
    'dashboard.view',
    'dashboard.stats',
    'orders.view',
    'contracts.view',
    'audit.view',
  ],
};

async function bootstrapRbac() {
  const prisma = database.getClient();

  // Permissions
  for (const permission of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: permission,
      create: permission,
    });
  }

  const allPermissions = await prisma.permission.findMany();
  const permissionByName = new Map(allPermissions.map((p) => [p.name, p]));

  // Roles
  for (const role of DEFAULT_ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: role,
      create: role,
    });
  }

  // Assign role permissions (only for subadmin roles)
  for (const [roleName, permNames] of Object.entries(ROLE_PERMISSION_NAMES)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;

    const permIds = permNames
      .map((n) => permissionByName.get(n)?.id)
      .filter(Boolean);

    await prisma.role.update({
      where: { id: role.id },
      data: {
        permissions: {
          set: [],
          connect: permIds.map((id) => ({ id })),
        },
      },
    });
  }

  const permissionCount = await prisma.permission.count();
  const roleCount = await prisma.role.count();

  return { permissionCount, roleCount };
}

module.exports = {
  bootstrapRbac,
  DEFAULT_PERMISSIONS,
  DEFAULT_ROLES,
};

