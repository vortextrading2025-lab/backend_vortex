const database = require('../../config/database');

async function migratePriceData() {
  const prisma = database.getClient();
  
  try {
    console.log('Starting price data migration...');
    
    // Get all products that have price but missing new price fields
    const products = await prisma.$queryRaw`
      SELECT id, price 
      FROM products 
      WHERE price IS NOT NULL 
      AND ("sellingPrice" IS NULL OR "costPrice" IS NULL OR "mrp" IS NULL)
    `;
    
    console.log(`Found ${products.length} products to migrate`);
    
    for (const product of products) {
      const oldPrice = Number(product.price);
      const sellingPrice = oldPrice;
      const costPrice = oldPrice * 0.7; // 70% of selling price as default cost
      const mrp = oldPrice * 1.2; // 120% of selling price as default MRP
      
      await prisma.product.update({
        where: { id: product.id },
        data: {
          sellingPrice: sellingPrice,
          costPrice: costPrice,
          mrp: mrp
        }
      });
      
      console.log(`Migrated product ${product.id}: price ${oldPrice} -> sellingPrice ${sellingPrice}, costPrice ${costPrice}, mrp ${mrp}`);
    }
    
    // Update order_items costPrice
    const orderItems = await prisma.$queryRaw`
      SELECT id, price 
      FROM order_items 
      WHERE "costPrice" IS NULL AND price IS NOT NULL
    `;
    
    console.log(`Found ${orderItems.length} order items to migrate`);
    
    for (const item of orderItems) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          costPrice: Number(item.price) * 0.7 // Default to 70% of selling price
        }
      });
    }
    
    console.log('Price data migration completed successfully!');
  } catch (error) {
    console.error('Error migrating price data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  migratePriceData()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = migratePriceData;

