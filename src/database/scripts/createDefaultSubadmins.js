const database = require('../../config/database');
const bcrypt = require('bcryptjs');

async function upsertSubadmin({ email, password, firstName, lastName, role }) {
  const prisma = database.getClient();
  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      firstName,
      lastName,
      role,
      status: 'ACTIVE',
      emailVerified: true,
    },
    create: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  return user;
}

async function main() {
  const password = '12345678';

  const accounts = [
    { email: 'moderator1@gmail.com', firstName: 'Moderator', lastName: 'One', role: 'MODERATOR' },
    { email: 'support1@gmail.com', firstName: 'Support', lastName: 'One', role: 'SUPPORT' },
    { email: 'analyst1@gmail.com', firstName: 'Analyst', lastName: 'One', role: 'ANALYST' },
  ];

  console.log('Creating/updating default subadmin accounts...');

  for (const acc of accounts) {
    const user = await upsertSubadmin({ ...acc, password });
    console.log(`✅ ${user.email} (${user.role})`);
  }

  console.log('\nLogin credentials (admin panel):');
  console.log(`- moderator1@gmail.com / ${password}`);
  console.log(`- support1@gmail.com / ${password}`);
  console.log(`- analyst1@gmail.com / ${password}`);
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await database.disconnect();
  });

