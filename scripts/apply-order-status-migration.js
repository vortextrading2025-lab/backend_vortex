const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🚀 Starting OrderStatus enum migration...\n');

    // Step 1: Add enum values (each ALTER TYPE commits automatically in PostgreSQL)
    console.log('Step 1: Adding enum values...');
    
    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_VENDOR_APPROVAL'`);
      console.log('✅ Added PENDING_VENDOR_APPROVAL');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️  PENDING_VENDOR_APPROVAL already exists');
      } else {
        throw error;
      }
    }

    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "OrderStatus" ADD VALUE 'ACCEPTED'`);
      console.log('✅ Added ACCEPTED');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️  ACCEPTED already exists');
      } else {
        throw error;
      }
    }

    try {
      await prisma.$executeRawUnsafe(`ALTER TYPE "OrderStatus" ADD VALUE 'REJECTED'`);
      console.log('✅ Added REJECTED');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️  REJECTED already exists');
      } else {
        throw error;
      }
    }

    // Small delay to ensure enum values are committed
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 2: Update existing orders
    console.log('\nStep 2: Updating existing orders...');
    const updateResult = await prisma.$executeRawUnsafe(
      `UPDATE "orders" SET "status" = 'PENDING_VENDOR_APPROVAL' WHERE "status" = 'PENDING'`
    );
    console.log(`✅ Updated ${updateResult} order(s)`);

    // Step 3: Update default value
    console.log('\nStep 3: Updating default value...');
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING_VENDOR_APPROVAL'`
    );
    console.log('✅ Updated default value');

    console.log('\n✨ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run: npx prisma generate');
    console.log('2. Restart your backend server');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
