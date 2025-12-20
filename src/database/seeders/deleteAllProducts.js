#!/usr/bin/env node
const database = require('../../config/database');

async function deleteAllProducts() {
  try {
    console.log('🗑️  Starting product deletion...\n');
    await database.connect();
    const prisma = database.getClient();

    if (!prisma) {
      throw new Error('Prisma client not available');
    }

    // Count products before deletion
    const productCount = await prisma.product.count();
    console.log(`Found ${productCount} products to delete\n`);

    if (productCount === 0) {
      console.log('✅ No products to delete\n');
      await database.disconnect();
      process.exit(0);
    }

    // Delete all products (cascade will handle related records)
    const result = await prisma.product.deleteMany({});

    console.log(`✅ Deleted ${result.count} products\n`);

    await database.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting products:', error);
    await database.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  deleteAllProducts();
}

module.exports = deleteAllProducts;
