const database = require('../../config/database');
const OrderService = require('../../services/orderService');
const BonusService = require('../../services/bonusService');

async function testOrderBonusFlow() {
  try {
    console.log('🔄 Starting: Test Order Bonus Flow\n');
    console.log('=====================================================================\n');

    // Step 1: Connect to database
    await database.connect();
    console.log('✅ Database connected successfully\n');

    // Step 2: Find a test user
    const user = await database.getClient().user.findUnique({
      where: { email: 'test1@gmail.com' }
    });

    if (!user) {
      console.log('❌ test1@gmail.com not found. Please create this user first.');
      return;
    }

    console.log(`👤 Found user: ${user.email} (${user.id})\n`);

    // Step 3: Find a product with costPrice and sellingPrice
    const product = await database.getClient().product.findFirst({
      where: {
        isActive: true,
        costPrice: { not: null },
        sellingPrice: { not: null }
      },
      include: {
        vendor: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    if (!product) {
      console.log('❌ No active product with pricing found. Please create a product first.');
      return;
    }

    console.log(`📦 Found product: ${product.name}`);
    console.log(`   Selling Price: C$${Number(product.sellingPrice).toFixed(2)}`);
    console.log(`   Cost Price: C$${Number(product.costPrice).toFixed(2)}`);
    console.log(`   Expected Bonus per item: C$${(Number(product.sellingPrice) - Number(product.costPrice)).toFixed(2)}`);
    console.log(`   Vendor: ${product.vendor.email}\n`);

    // Step 4: Check user's wallet balance
    const WalletService = require('../../services/walletService');
    const wallet = await WalletService.getWallet(user.id);
    console.log(`💰 User wallet balance: C$${wallet.balance.toFixed(2)}\n`);

    // Step 5: Check user's bonus wallet before order
    const bonusWalletBefore = await BonusService.getBonusWallet(user.id);
    console.log(`🎁 Bonus wallet before order:`);
    console.log(`   Balance: C$${Number(bonusWalletBefore.balance).toFixed(2)}`);
    console.log(`   Total Bonus: C$${Number(bonusWalletBefore.totalBonus).toFixed(2)}\n`);

    // Step 6: Create an order
    console.log('🛒 Creating order...');
    const orderData = {
      vendorId: product.vendorId,
      items: [
        {
          productId: product.id,
          quantity: 2 // Order 2 items
        }
      ]
    };

    const order = await OrderService.createOrder(orderData, user.id);
    console.log(`✅ Order created: ${order.orderNumber} (${order.id})`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Total Amount: C$${Number(order.totalAmount).toFixed(2)}\n`);

    // Step 7: Simulate order flow: ACCEPTED -> CONFIRMED -> SHIPPED -> DELIVERED
    console.log('📦 Simulating order fulfillment...\n');

    // Accept order (vendor)
    console.log('1️⃣  Vendor accepting order...');
    await OrderService.updateOrderStatus(order.id, product.vendorId, null, {
      status: 'ACCEPTED'
    });
    console.log('   ✅ Order accepted\n');

    // Confirm order
    console.log('2️⃣  Confirming order...');
    await OrderService.updateOrderStatus(order.id, product.vendorId, null, {
      status: 'CONFIRMED'
    });
    console.log('   ✅ Order confirmed\n');

    // Ship order
    console.log('3️⃣  Shipping order...');
    await OrderService.updateOrderStatus(order.id, product.vendorId, null, {
      status: 'SHIPPED'
    });
    console.log('   ✅ Order shipped\n');

    // Deliver order (THIS IS WHERE BONUS SHOULD BE AWARDED)
    console.log('4️⃣  Delivering order (bonus should be awarded here)...');
    await OrderService.updateOrderStatus(order.id, product.vendorId, null, {
      status: 'DELIVERED'
    });
    console.log('   ✅ Order delivered\n');

    // Step 8: Check bonus wallet after delivery
    const bonusWalletAfter = await BonusService.getBonusWallet(user.id);
    console.log(`🎁 Bonus wallet after order delivery:`);
    console.log(`   Balance: C$${Number(bonusWalletAfter.balance).toFixed(2)}`);
    console.log(`   Total Bonus: C$${Number(bonusWalletAfter.totalBonus).toFixed(2)}`);
    
    const bonusReceived = Number(bonusWalletAfter.balance) - Number(bonusWalletBefore.balance);
    console.log(`   Bonus Received: C$${bonusReceived.toFixed(2)}\n`);

    // Step 9: Verify bonus calculation
    const expectedBonus = (Number(product.sellingPrice) - Number(product.costPrice)) * 2; // 2 items
    console.log(`🔍 Verification:`);
    console.log(`   Expected Bonus: C$${expectedBonus.toFixed(2)} (${Number(product.sellingPrice).toFixed(2)} - ${Number(product.costPrice).toFixed(2)}) × 2 items`);
    console.log(`   Actual Bonus: C$${bonusReceived.toFixed(2)}`);
    
    if (Math.abs(bonusReceived - expectedBonus) < 0.01) {
      console.log(`   ✅ SUCCESS: Bonus matches expected amount!\n`);
    } else {
      console.log(`   ❌ ERROR: Bonus mismatch! Expected C$${expectedBonus.toFixed(2)}, got C$${bonusReceived.toFixed(2)}\n`);
    }

    // Step 10: Get bonus records for this order
    const bonuses = await database.getClient().bonus.findMany({
      where: {
        orderId: order.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📋 Bonus Records Created: ${bonuses.length}`);
    bonuses.forEach((bonus, index) => {
      console.log(`   ${index + 1}. ${bonus.productName}`);
      console.log(`      Quantity: ${bonus.quantity}`);
      console.log(`      Selling Price: C$${Number(bonus.sellingPrice).toFixed(2)}`);
      console.log(`      Cost Price: C$${Number(bonus.costPrice).toFixed(2)}`);
      console.log(`      Bonus Amount: C$${Number(bonus.bonusAmount).toFixed(2)}`);
      console.log(`      Status: ${bonus.status}`);
      console.log('');
    });

    console.log('=====================================================================');
    console.log('✅ Test completed successfully\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  } finally {
    await database.disconnect();
  }
}

// Run the test
testOrderBonusFlow();

