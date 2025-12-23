#!/usr/bin/env node

/**
 * Setup Vendor and Products
 * - Creates vendor1@gmail.com account
 * - Adds 12 products with images and all details
 * - Tests order flow to verify bonus points
 * 
 * Usage: node src/database/scripts/setupVendorAndProducts.js
 */

require('dotenv').config();
const database = require('../../config/database');
const OrderService = require('../../services/orderService');
const BonusService = require('../../services/bonusService');
const WalletService = require('../../modules/wallet/walletService');

const setupVendorAndProducts = async () => {
  try {
    console.log('🔄 Starting: Setup Vendor and Products\n');
    console.log('='.repeat(70));
    
    await database.connect();
    const prisma = database.getClient();

    // Step 1: Create or get vendor account
    console.log('\n👤 Step 1: Creating vendor account...');
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('12345678', 12);
    
    let vendor = await prisma.user.findUnique({
      where: { email: 'vendor1@gmail.com' }
    });

    if (!vendor) {
      vendor = await prisma.user.create({
        data: {
          email: 'vendor1@gmail.com',
          password: hashedPassword,
          firstName: 'Vendor',
          lastName: 'One',
          role: 'VENDOR',
          status: 'ACTIVE',
          emailVerified: true
        }
      });
      console.log(`   ✅ Created vendor: ${vendor.email} (${vendor.id})`);
    } else {
      console.log(`   ✅ Found existing vendor: ${vendor.email} (${vendor.id})`);
    }

    // Step 2: Create or get vendor profile
    console.log('\n🏢 Step 2: Creating vendor profile...');
    let vendorProfile = await prisma.vendorProfile.findUnique({
      where: { userId: vendor.id }
    });

    if (!vendorProfile) {
      vendorProfile = await prisma.vendorProfile.create({
        data: {
          userId: vendor.id,
          businessName: 'Vendor One Store',
          businessType: 'RETAIL',
          description: 'Quality products for everyone',
          isVerified: true
        }
      });
      console.log(`   ✅ Created vendor profile: ${vendorProfile.businessName}`);
    } else {
      console.log(`   ✅ Found existing vendor profile: ${vendorProfile.businessName}`);
    }

    // Step 3: Get or create category and subcategory
    console.log('\n📁 Step 3: Setting up categories...');
    let category = await prisma.category.findFirst({
      where: { name: 'Electronics' }
    });

    if (!category) {
      category = await prisma.category.create({
        data: {
          name: 'Electronics',
          slug: 'electronics',
          description: 'Electronic products',
          isActive: true
        }
      });
      console.log(`   ✅ Created category: ${category.name}`);
    } else {
      console.log(`   ✅ Found category: ${category.name}`);
    }

    // Get or create subcategory
    let subcategory = await prisma.subcategory.findFirst({
      where: { 
        name: 'Accessories',
        categoryId: category.id
      }
    });

    if (!subcategory) {
      subcategory = await prisma.subcategory.create({
        data: {
          name: 'Accessories',
          slug: 'accessories',
          description: 'Electronic accessories',
          isActive: true,
          categoryId: category.id
        }
      });
      console.log(`   ✅ Created subcategory: ${subcategory.name}`);
    } else {
      console.log(`   ✅ Found subcategory: ${subcategory.name}`);
    }

    // Step 4: Check existing products (skip deletion if they have orders)
    console.log('\n📋 Step 4: Checking existing products...');
    const existingProducts = await prisma.product.count({
      where: { vendorId: vendor.id }
    });
    console.log(`   ℹ️  Found ${existingProducts} existing products (keeping them if they have orders)`);

    // Step 5: Create 12 products with images and pricing
    console.log('\n📦 Step 5: Creating 12 products...');
    
    const products = [
      {
        name: 'Wireless Bluetooth Headphones',
        description: 'Premium wireless headphones with noise cancellation and 30-hour battery life',
        costPrice: 50.00,
        mrp: 150.00,
        sellingPrice: 120.00,
        stock: 50,
        sku: 'WH-001',
        images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500']
      },
      {
        name: 'Smart Watch Pro',
        description: 'Feature-rich smartwatch with health tracking and GPS',
        costPrice: 80.00,
        mrp: 250.00,
        sellingPrice: 200.00,
        stock: 30,
        sku: 'SW-002',
        images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500']
      },
      {
        name: 'Portable Power Bank 20000mAh',
        description: 'High capacity power bank with fast charging support',
        costPrice: 25.00,
        mrp: 80.00,
        sellingPrice: 65.00,
        stock: 100,
        sku: 'PB-003',
        images: ['https://images.unsplash.com/photo-1609091834311-431c6e903e2d?w=500']
      },
      {
        name: 'USB-C Cable Set',
        description: 'Premium USB-C cables with fast data transfer and charging',
        costPrice: 8.00,
        mrp: 25.00,
        sellingPrice: 20.00,
        stock: 200,
        sku: 'UC-004',
        images: ['https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=500']
      },
      {
        name: 'Wireless Mouse',
        description: 'Ergonomic wireless mouse with precision tracking',
        costPrice: 15.00,
        mrp: 45.00,
        sellingPrice: 35.00,
        stock: 75,
        sku: 'WM-005',
        images: ['https://images.unsplash.com/photo-1527814050087-3793815479db?w=500']
      },
      {
        name: 'Mechanical Keyboard',
        description: 'RGB mechanical keyboard with customizable keys',
        costPrice: 60.00,
        mrp: 180.00,
        sellingPrice: 150.00,
        stock: 40,
        sku: 'KB-006',
        images: ['https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=500']
      },
      {
        name: 'Webcam HD 1080p',
        description: 'High-definition webcam perfect for video calls and streaming',
        costPrice: 35.00,
        mrp: 100.00,
        sellingPrice: 80.00,
        stock: 60,
        sku: 'WC-007',
        images: ['https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=500']
      },
      {
        name: 'Laptop Stand Adjustable',
        description: 'Ergonomic laptop stand with adjustable height and angle',
        costPrice: 20.00,
        mrp: 60.00,
        sellingPrice: 50.00,
        stock: 80,
        sku: 'LS-008',
        images: ['https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500']
      },
      {
        name: 'Tablet Stand',
        description: 'Versatile tablet stand for reading and viewing',
        costPrice: 12.00,
        mrp: 35.00,
        sellingPrice: 28.00,
        stock: 90,
        sku: 'TS-009',
        images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500']
      },
      {
        name: 'Phone Case Premium',
        description: 'Protective phone case with shock absorption',
        costPrice: 10.00,
        mrp: 30.00,
        sellingPrice: 25.00,
        stock: 150,
        sku: 'PC-010',
        images: ['https://images.unsplash.com/photo-1601972602237-8c79241e468b?w=500']
      },
      {
        name: 'Screen Protector Pack',
        description: 'Tempered glass screen protectors - 3 pack',
        costPrice: 5.00,
        mrp: 20.00,
        sellingPrice: 15.00,
        stock: 200,
        sku: 'SP-011',
        images: ['https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=500']
      },
      {
        name: 'Desk Organizer',
        description: 'Multi-compartment desk organizer for cables and accessories',
        costPrice: 18.00,
        mrp: 50.00,
        sellingPrice: 40.00,
        stock: 70,
        sku: 'DO-012',
        images: ['https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500']
      }
    ];

    const createdProducts = [];
    for (const productData of products) {
      // Check if product with this SKU already exists
      let product = await prisma.product.findUnique({
        where: { sku: productData.sku }
      });

      if (product) {
        // Update existing product
        product = await prisma.product.update({
          where: { id: product.id },
          data: {
            name: productData.name,
            description: productData.description,
            costPrice: productData.costPrice,
            mrp: productData.mrp,
            sellingPrice: productData.sellingPrice,
            stock: productData.stock,
            images: productData.images,
            isActive: true
          }
        });
        console.log(`   ✅ Updated: ${product.name}`);
      } else {
        // Create new product with unique SKU
        const uniqueSku = `${productData.sku}-${Date.now()}`;
        product = await prisma.product.create({
          data: {
            name: productData.name,
            description: productData.description,
            costPrice: productData.costPrice,
            mrp: productData.mrp,
            sellingPrice: productData.sellingPrice,
            stock: productData.stock,
            sku: uniqueSku,
            images: productData.images,
            currency: 'CAD',
            isActive: true,
            vendorId: vendor.id,
            categoryId: category.id,
            subcategoryId: subcategory.id
          }
        });
        console.log(`   ✅ Created: ${product.name}`);
      }
      
      createdProducts.push(product);
      const bonusPerItem = (Number(product.sellingPrice) - Number(product.costPrice)).toFixed(2);
      console.log(`      Bonus: C$${bonusPerItem} per item`);
    }

    console.log(`\n   ✅ Created ${createdProducts.length} products total`);

    // Step 6: Get or create a test user for ordering
    console.log('\n👤 Step 6: Setting up test user for order...');
    let testUser = await prisma.user.findUnique({
      where: { email: 'test1@gmail.com' }
    });

    if (!testUser) {
      const testPassword = await bcrypt.hash('test123', 12);
      testUser = await prisma.user.create({
        data: {
          email: 'test1@gmail.com',
          password: testPassword,
          firstName: 'Test',
          lastName: 'User',
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: true
        }
      });
      console.log(`   ✅ Created test user: ${testUser.email}`);
    } else {
      console.log(`   ✅ Found test user: ${testUser.email}`);
    }

    // Step 7: Ensure test user has wallet balance
    console.log('\n💰 Step 7: Ensuring test user has wallet balance...');
    let wallet = await WalletService.getWallet(testUser.id);
    if (wallet.balance < 1000) {
      await WalletService.addToWallet(testUser.id, 1000 - wallet.balance, null, 'DEPOSIT', 'Test deposit for order');
      wallet = await WalletService.getWallet(testUser.id);
    }
    console.log(`   ✅ Wallet balance: C$${wallet.balance.toFixed(2)}`);

    // Step 8: Create an order
    console.log('\n🛒 Step 8: Creating test order...');
    const orderService = OrderService;
    
    // Select first 3 products for the order
    const orderProducts = createdProducts.slice(0, 3);
    const orderItems = orderProducts.map(product => ({
      productId: product.id,
      quantity: 2
      // unitPrice and costPrice will be fetched from product in OrderService
    }));

    const totalAmount = orderItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    console.log(`   📦 Order items: ${orderItems.length} products, Total: C$${totalAmount.toFixed(2)}`);

    const order = await orderService.createOrder({
      vendorId: vendor.id,
      items: orderItems,
      shippingAddress: {
        street: '123 Test Street',
        city: 'Test City',
        state: 'TC',
        zipCode: '12345',
        country: 'Canada'
      },
      shippingName: 'Test User',
      shippingPhone: '+1234567890'
    }, testUser.id);

    console.log(`   ✅ Order created: ${order.orderNumber} (${order.id})`);
    console.log(`   Status: ${order.status}`);

    // Step 9: Approve order as vendor (move to PENDING_USER_APPROVAL)
    console.log('\n✅ Step 9: Approving order as vendor...');
    await orderService.updateOrderStatus(order.id, vendor.id, null, { status: 'PENDING_USER_APPROVAL' });
    console.log(`   ✅ Order moved to PENDING_USER_APPROVAL`);

    // Step 9b: User accepts order (move to ACCEPTED)
    console.log('\n✅ Step 9b: User accepting order...');
    await orderService.updateOrderStatus(order.id, null, testUser.id, { status: 'ACCEPTED' });
    console.log(`   ✅ Order accepted by user`);

    // Step 9c: Vendor ships order (move to SHIPPED)
    console.log('\n🚚 Step 9c: Vendor shipping order...');
    await orderService.updateOrderStatus(order.id, vendor.id, null, { status: 'SHIPPED' });
    console.log(`   ✅ Order shipped`);

    // Step 10: Mark order as delivered (this should trigger bonus points)
    console.log('\n🚚 Step 10: Marking order as delivered...');
    await orderService.updateOrderStatus(order.id, vendor.id, null, { status: 'DELIVERED' });
    console.log(`   ✅ Order delivered`);

    // Step 11: Check bonus points
    console.log('\n🎁 Step 11: Checking bonus points...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for bonus processing

    const bonusWallet = await BonusService.getBonusWallet(testUser.id);
    console.log(`   💰 Bonus wallet balance: C$${bonusWallet.balance.toFixed(2)}`);
    console.log(`   📊 Total bonus earned: C$${bonusWallet.totalBonus.toFixed(2)}`);

    // Get bonus records
    const bonuses = await prisma.bonus.findMany({
      where: {
        bonusWalletId: bonusWallet.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    console.log(`\n   📋 Bonus records: ${bonuses.length}`);
    bonuses.forEach((bonus, index) => {
      console.log(`   ${index + 1}. ${bonus.productName} x${bonus.quantity}`);
      console.log(`      Order: ${bonus.orderNumber || bonus.orderId || 'N/A'}`);
      console.log(`      Amount: C$${Number(bonus.bonusAmount).toFixed(2)}`);
      console.log(`      Status: ${bonus.status}`);
    });

    // Step 12: Verify expected bonus
    console.log('\n🔍 Step 12: Verifying expected bonus...');
    let expectedBonus = 0;
    orderItems.forEach(item => {
      const product = orderProducts.find(p => p.id === item.productId);
      if (product) {
        const bonusPerItem = product.sellingPrice - product.costPrice;
        expectedBonus += bonusPerItem * item.quantity;
      }
    });

    console.log(`   Expected bonus: C$${expectedBonus.toFixed(2)}`);
    console.log(`   Actual bonus: C$${bonusWallet.balance.toFixed(2)}`);
    
    if (Math.abs(bonusWallet.balance - expectedBonus) < 0.01) {
      console.log(`   ✅ Bonus points match expected amount!`);
    } else {
      console.log(`   ⚠️  Bonus points don't match. Difference: C$${Math.abs(bonusWallet.balance - expectedBonus).toFixed(2)}`);
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log(`   ✅ Vendor: ${vendor.email}`);
    console.log(`   ✅ Products created: ${createdProducts.length}`);
    console.log(`   ✅ Order created: ${order.orderNumber}`);
    console.log(`   ✅ Order status: DELIVERED`);
    console.log(`   ✅ Bonus points awarded: C$${bonusWallet.balance.toFixed(2)}`);
    console.log(`   ✅ Bonus records: ${bonuses.length}`);

    console.log('\n✅ Setup completed successfully!\n');
  } catch (error) {
    console.error('❌ Error in setup:', error);
    console.error('\n💥 Script failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    throw error;
  } finally {
    await database.disconnect();
  }
};

// Run the script
if (require.main === module) {
  setupVendorAndProducts()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      process.exit(1);
    });
}

module.exports = { setupVendorAndProducts };

