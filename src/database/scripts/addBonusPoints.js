const database = require('../../config/database');
const BonusService = require('../../services/bonusService');

const prisma = database.getClient();

async function addBonusPoints() {
  try {
    console.log('🔍 Finding user test1@gmail.com...');
    
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: 'test1@gmail.com' }
    });

    if (!user) {
      throw new Error('User test1@gmail.com not found');
    }

    console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);

    // Generate some fake order IDs and product data
    const bonusData = [
      {
        orderId: `order-${Date.now()}-1`,
        orderNumber: `ORD-${Date.now()}-1234`,
        orderItemId: `item-${Date.now()}-1`,
        productId: `product-${Date.now()}-1`,
        productName: 'Premium Coffee Table',
        quantity: 2,
        sellingPrice: 450.00,
        costPrice: 300.00,
        bonusAmount: 300.00 // (450 - 300) * 2
      },
      {
        orderId: `order-${Date.now()}-2`,
        orderNumber: `ORD-${Date.now()}-5678`,
        orderItemId: `item-${Date.now()}-2`,
        productId: `product-${Date.now()}-2`,
        productName: 'Designer Sofa Set',
        quantity: 1,
        sellingPrice: 1200.00,
        costPrice: 800.00,
        bonusAmount: 400.00 // (1200 - 800) * 1
      },
      {
        orderId: `order-${Date.now()}-3`,
        orderNumber: `ORD-${Date.now()}-9012`,
        orderItemId: `item-${Date.now()}-3`,
        productId: `product-${Date.now()}-3`,
        productName: 'Modern Dining Table',
        quantity: 1,
        sellingPrice: 850.00,
        costPrice: 550.00,
        bonusAmount: 300.00 // (850 - 550) * 1
      },
      {
        orderId: `order-${Date.now()}-4`,
        orderNumber: `ORD-${Date.now()}-3456`,
        orderItemId: `item-${Date.now()}-4`,
        productId: `product-${Date.now()}-4`,
        productName: 'Luxury Bed Frame',
        quantity: 1,
        sellingPrice: 1500.00,
        costPrice: 1000.00,
        bonusAmount: 500.00 // (1500 - 1000) * 1
      },
      {
        orderId: `order-${Date.now()}-5`,
        orderNumber: `ORD-${Date.now()}-7890`,
        orderItemId: `item-${Date.now()}-5`,
        productId: `product-${Date.now()}-5`,
        productName: 'Executive Office Chair',
        quantity: 3,
        sellingPrice: 350.00,
        costPrice: 200.00,
        bonusAmount: 450.00 // (350 - 200) * 3
      }
    ];

    console.log(`\n📦 Creating ${bonusData.length} bonus records...`);

    let totalBonus = 0;
    for (const bonus of bonusData) {
      try {
        const createdBonus = await BonusService.createBonus({
          userId: user.id,
          orderId: bonus.orderId,
          orderNumber: bonus.orderNumber,
          orderItemId: bonus.orderItemId,
          productId: bonus.productId,
          productName: bonus.productName,
          quantity: bonus.quantity,
          sellingPrice: bonus.sellingPrice,
          costPrice: bonus.costPrice,
          bonusAmount: bonus.bonusAmount
        });

        totalBonus += bonus.bonusAmount;
        console.log(`  ✅ Created bonus: ${bonus.productName} - ${bonus.bonusAmount.toFixed(2)} Points (Order: ${bonus.orderNumber})`);
      } catch (error) {
        console.error(`  ❌ Error creating bonus for ${bonus.productName}:`, error.message);
      }
    }

    // Get updated bonus wallet
    const bonusWallet = await BonusService.getBonusWallet(user.id);
    
    console.log(`\n💰 Bonus Summary:`);
    console.log(`   Total Bonus Points: ${Number(bonusWallet.totalBonus).toFixed(2)} Points`);
    console.log(`   Available Balance: ${Number(bonusWallet.balance).toFixed(2)} Points`);
    console.log(`   Total Redeemed: ${Number(bonusWallet.totalRedeemed).toFixed(2)} Points`);
    
    console.log(`\n✅ Successfully added bonus points for test1@gmail.com!`);
    console.log(`   Total added: ${totalBonus.toFixed(2)} Points`);

  } catch (error) {
    console.error('❌ Error adding bonus points:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  addBonusPoints()
    .then(() => {
      console.log('\n✨ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { addBonusPoints };

