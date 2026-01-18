#!/usr/bin/env node

/**
 * Comprehensive Development Data Seeder
 * Creates users, vendors, products, orders, and settlements for admin dashboard
 * Usage: node src/database/seeders/seedDevData.js
 */

require('dotenv').config({ path: '.env.development' });
const database = require('../../config/database');
const bcrypt = require('bcryptjs');

// Categories data (from seed15Categories)
const categoriesData = [
  {
    name: 'Electronics',
    slug: 'electronics',
    description: 'Electronic devices and accessories',
    subcategories: [
      { name: 'Laptops', slug: 'laptops' },
      { name: 'Smartphones', slug: 'smartphones' },
      { name: 'Tablets', slug: 'tablets' },
      { name: 'Headphones', slug: 'headphones' },
      { name: 'Cameras', slug: 'cameras' },
      { name: 'Smart Watches', slug: 'smart-watches' },
    ],
  },
  {
    name: 'Clothing & Apparel',
    slug: 'clothing-apparel',
    description: 'Fashion and clothing items',
    subcategories: [
      { name: 'Men\'s Clothing', slug: 'mens-clothing' },
      { name: 'Women\'s Clothing', slug: 'womens-clothing' },
      { name: 'Kids\' Clothing', slug: 'kids-clothing' },
      { name: 'Shoes', slug: 'shoes' },
      { name: 'Accessories', slug: 'accessories' },
      { name: 'Activewear', slug: 'activewear' },
    ],
  },
  {
    name: 'Home & Garden',
    slug: 'home-garden',
    description: 'Home improvement and garden supplies',
    subcategories: [
      { name: 'Furniture', slug: 'furniture' },
      { name: 'Kitchen', slug: 'kitchen' },
      { name: 'Bedding', slug: 'bedding' },
      { name: 'Garden Tools', slug: 'garden-tools' },
      { name: 'Decor', slug: 'decor' },
      { name: 'Lighting', slug: 'lighting' },
    ],
  },
  {
    name: 'Sports & Outdoors',
    slug: 'sports-outdoors',
    description: 'Sports equipment and outdoor gear',
    subcategories: [
      { name: 'Fitness', slug: 'fitness' },
      { name: 'Camping', slug: 'camping' },
      { name: 'Cycling', slug: 'cycling' },
      { name: 'Water Sports', slug: 'water-sports' },
      { name: 'Winter Sports', slug: 'winter-sports' },
      { name: 'Team Sports', slug: 'team-sports' },
    ],
  },
  {
    name: 'Books & Media',
    slug: 'books-media',
    description: 'Books, movies, and media',
    subcategories: [
      { name: 'Fiction', slug: 'fiction' },
      { name: 'Non-Fiction', slug: 'non-fiction' },
      { name: 'Textbooks', slug: 'textbooks' },
      { name: 'Movies', slug: 'movies' },
      { name: 'Music', slug: 'music' },
      { name: 'E-books', slug: 'e-books' },
    ],
  },
  {
    name: 'Beauty & Personal Care',
    slug: 'beauty-personal-care',
    description: 'Beauty products and personal care items',
    subcategories: [
      { name: 'Skincare', slug: 'skincare' },
      { name: 'Makeup', slug: 'makeup' },
      { name: 'Hair Care', slug: 'hair-care' },
      { name: 'Fragrances', slug: 'fragrances' },
      { name: 'Men\'s Grooming', slug: 'mens-grooming' },
      { name: 'Bath & Body', slug: 'bath-body' },
    ],
  },
  {
    name: 'Health & Wellness',
    slug: 'health-wellness',
    description: 'Health and wellness products',
    subcategories: [
      { name: 'Vitamins & Supplements', slug: 'vitamins-supplements' },
      { name: 'Fitness Equipment', slug: 'fitness-equipment' },
      { name: 'Yoga & Meditation', slug: 'yoga-meditation' },
      { name: 'Massage Tools', slug: 'massage-tools' },
      { name: 'Health Monitors', slug: 'health-monitors' },
      { name: 'First Aid', slug: 'first-aid' },
    ],
  },
  {
    name: 'Toys & Games',
    slug: 'toys-games',
    description: 'Toys, games, and entertainment',
    subcategories: [
      { name: 'Action Figures', slug: 'action-figures' },
      { name: 'Board Games', slug: 'board-games' },
      { name: 'Puzzles', slug: 'puzzles' },
      { name: 'Educational Toys', slug: 'educational-toys' },
      { name: 'Outdoor Toys', slug: 'outdoor-toys' },
      { name: 'Video Games', slug: 'video-games' },
    ],
  },
];

// Sample data
const regularUsers = [
  { email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe', username: 'johndoe' },
  { email: 'jane.smith@example.com', firstName: 'Jane', lastName: 'Smith', username: 'janesmith' },
  { email: 'mike.johnson@example.com', firstName: 'Mike', lastName: 'Johnson', username: 'mikej' },
  { email: 'sarah.williams@example.com', firstName: 'Sarah', lastName: 'Williams', username: 'sarahw' },
  { email: 'david.brown@example.com', firstName: 'David', lastName: 'Brown', username: 'davidb' },
  { email: 'emily.davis@example.com', firstName: 'Emily', lastName: 'Davis', username: 'emilyd' },
  { email: 'chris.miller@example.com', firstName: 'Chris', lastName: 'Miller', username: 'chrism' },
  { email: 'lisa.wilson@example.com', firstName: 'Lisa', lastName: 'Wilson', username: 'lisaw' },
  { email: 'robert.moore@example.com', firstName: 'Robert', lastName: 'Moore', username: 'robertm' },
  { email: 'amanda.taylor@example.com', firstName: 'Amanda', lastName: 'Taylor', username: 'amandat' },
  { email: 'james.anderson@example.com', firstName: 'James', lastName: 'Anderson', username: 'jamesa' },
  { email: 'jennifer.thomas@example.com', firstName: 'Jennifer', lastName: 'Thomas', username: 'jennifert' },
  { email: 'william.jackson@example.com', firstName: 'William', lastName: 'Jackson', username: 'williamj' },
  { email: 'michelle.white@example.com', firstName: 'Michelle', lastName: 'White', username: 'michellew' },
  { email: 'daniel.harris@example.com', firstName: 'Daniel', lastName: 'Harris', username: 'danielh' },
];

const vendors = [
  {
    email: 'techstore@example.com',
    firstName: 'Tech',
    lastName: 'Store',
    username: 'techstore',
    businessName: 'TechStore Electronics',
    businessType: 'Electronics Retail',
    description: 'Leading electronics retailer with the latest gadgets and devices',
    city: 'Toronto',
    state: 'Ontario',
    country: 'Canada',
  },
  {
    email: 'fashionhub@example.com',
    firstName: 'Fashion',
    lastName: 'Hub',
    username: 'fashionhub',
    businessName: 'Fashion Hub',
    businessType: 'Fashion Retail',
    description: 'Trendy fashion and apparel for all ages',
    city: 'Vancouver',
    state: 'British Columbia',
    country: 'Canada',
  },
  {
    email: 'homeplus@example.com',
    firstName: 'Home',
    lastName: 'Plus',
    username: 'homeplus',
    businessName: 'Home Plus Decor',
    businessType: 'Home & Garden',
    description: 'Everything you need for your home and garden',
    city: 'Montreal',
    state: 'Quebec',
    country: 'Canada',
  },
  {
    email: 'sportsworld@example.com',
    firstName: 'Sports',
    lastName: 'World',
    username: 'sportsworld',
    businessName: 'Sports World',
    businessType: 'Sports Equipment',
    description: 'Premium sports and outdoor equipment',
    city: 'Calgary',
    state: 'Alberta',
    country: 'Canada',
  },
  {
    email: 'beautyshop@example.com',
    firstName: 'Beauty',
    lastName: 'Shop',
    username: 'beautyshop',
    businessName: 'Beauty Shop',
    businessType: 'Beauty & Personal Care',
    description: 'Quality beauty and personal care products',
    city: 'Ottawa',
    state: 'Ontario',
    country: 'Canada',
  },
  {
    email: 'bookcorner@example.com',
    firstName: 'Book',
    lastName: 'Corner',
    username: 'bookcorner',
    businessName: 'Book Corner',
    businessType: 'Books & Media',
    description: 'Books, movies, and media for everyone',
    city: 'Edmonton',
    state: 'Alberta',
    country: 'Canada',
  },
  {
    email: 'healthmart@example.com',
    firstName: 'Health',
    lastName: 'Mart',
    username: 'healthmart',
    businessName: 'Health Mart',
    businessType: 'Health & Wellness',
    description: 'Health and wellness products for a better life',
    city: 'Winnipeg',
    state: 'Manitoba',
    country: 'Canada',
  },
  {
    email: 'toystore@example.com',
    firstName: 'Toy',
    lastName: 'Store',
    username: 'toystore',
    businessName: 'Toy Store',
    businessType: 'Toys & Games',
    description: 'Fun toys and games for kids of all ages',
    city: 'Halifax',
    state: 'Nova Scotia',
    country: 'Canada',
  },
];

// Product templates by category
const productTemplates = {
  electronics: [
    { name: 'Wireless Bluetooth Headphones', basePrice: 79.99, costPrice: 45.00, mrp: 99.99 },
    { name: 'Smartphone Case', basePrice: 24.99, costPrice: 8.00, mrp: 34.99 },
    { name: 'USB-C Charging Cable', basePrice: 14.99, costPrice: 3.00, mrp: 19.99 },
    { name: 'Wireless Mouse', basePrice: 29.99, costPrice: 12.00, mrp: 39.99 },
    { name: 'Laptop Stand', basePrice: 49.99, costPrice: 20.00, mrp: 69.99 },
  ],
  'clothing-apparel': [
    { name: 'Cotton T-Shirt', basePrice: 19.99, costPrice: 8.00, mrp: 29.99 },
    { name: 'Denim Jeans', basePrice: 59.99, costPrice: 25.00, mrp: 89.99 },
    { name: 'Running Shoes', basePrice: 89.99, costPrice: 40.00, mrp: 129.99 },
    { name: 'Winter Jacket', basePrice: 129.99, costPrice: 60.00, mrp: 179.99 },
    { name: 'Baseball Cap', basePrice: 24.99, costPrice: 10.00, mrp: 34.99 },
  ],
  'home-garden': [
    { name: 'Coffee Maker', basePrice: 79.99, costPrice: 35.00, mrp: 109.99 },
    { name: 'Throw Pillow Set', basePrice: 34.99, costPrice: 15.00, mrp: 49.99 },
    { name: 'Garden Tool Set', basePrice: 49.99, costPrice: 22.00, mrp: 69.99 },
    { name: 'LED Desk Lamp', basePrice: 39.99, costPrice: 18.00, mrp: 54.99 },
    { name: 'Kitchen Knife Set', basePrice: 89.99, costPrice: 40.00, mrp: 129.99 },
  ],
  'sports-outdoors': [
    { name: 'Yoga Mat', basePrice: 29.99, costPrice: 12.00, mrp: 39.99 },
    { name: 'Dumbbell Set', basePrice: 79.99, costPrice: 35.00, mrp: 109.99 },
    { name: 'Camping Tent', basePrice: 149.99, costPrice: 70.00, mrp: 199.99 },
    { name: 'Water Bottle', basePrice: 19.99, costPrice: 8.00, mrp: 29.99 },
    { name: 'Resistance Bands Set', basePrice: 24.99, costPrice: 10.00, mrp: 34.99 },
  ],
  'beauty-personal-care': [
    { name: 'Face Moisturizer', basePrice: 24.99, costPrice: 10.00, mrp: 34.99 },
    { name: 'Shampoo & Conditioner Set', basePrice: 19.99, costPrice: 8.00, mrp: 29.99 },
    { name: 'Lipstick Set', basePrice: 34.99, costPrice: 15.00, mrp: 49.99 },
    { name: 'Sunscreen SPF 50', basePrice: 16.99, costPrice: 7.00, mrp: 24.99 },
    { name: 'Body Lotion', basePrice: 14.99, costPrice: 6.00, mrp: 21.99 },
  ],
  'books-media': [
    { name: 'Bestseller Novel', basePrice: 16.99, costPrice: 8.00, mrp: 24.99 },
    { name: 'Cookbook', basePrice: 29.99, costPrice: 12.00, mrp: 39.99 },
    { name: 'Children\'s Storybook', basePrice: 12.99, costPrice: 5.00, mrp: 18.99 },
    { name: 'Self-Help Book', basePrice: 19.99, costPrice: 9.00, mrp: 27.99 },
    { name: 'Movie DVD Collection', basePrice: 24.99, costPrice: 10.00, mrp: 34.99 },
  ],
  'health-wellness': [
    { name: 'Multivitamin Supplement', basePrice: 19.99, costPrice: 8.00, mrp: 29.99 },
    { name: 'Protein Powder', basePrice: 39.99, costPrice: 18.00, mrp: 54.99 },
    { name: 'Yoga Block Set', basePrice: 24.99, costPrice: 10.00, mrp: 34.99 },
    { name: 'Massage Roller', basePrice: 16.99, costPrice: 7.00, mrp: 24.99 },
    { name: 'Digital Scale', basePrice: 34.99, costPrice: 15.00, mrp: 49.99 },
  ],
  'toys-games': [
    { name: 'Building Blocks Set', basePrice: 29.99, costPrice: 12.00, mrp: 39.99 },
    { name: 'Board Game', basePrice: 34.99, costPrice: 15.00, mrp: 49.99 },
    { name: 'Action Figure', basePrice: 19.99, costPrice: 8.00, mrp: 29.99 },
    { name: 'Puzzle 1000 Pieces', basePrice: 24.99, costPrice: 10.00, mrp: 34.99 },
    { name: 'Remote Control Car', basePrice: 49.99, costPrice: 22.00, mrp: 69.99 },
  ],
};

const generateOrderNumber = () => {
  return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

const generateSKU = (vendorId, productName) => {
  const prefix = vendorId.substr(0, 4).toUpperCase();
  const nameCode = productName.replace(/\s+/g, '').substr(0, 6).toUpperCase();
  return `${prefix}-${nameCode}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
};

const seedDevData = async () => {
  try {
    console.log('🌱 Starting comprehensive development data seeding...\n');
    
    await database.connect();
    const prisma = database.getClient();

    // Step 1: Seed categories
    console.log('📦 Step 1: Seeding categories and subcategories...');
    let categoriesCreated = 0;
    let subcategoriesCreated = 0;

    for (const catData of categoriesData) {
      let category = await prisma.category.findFirst({
        where: {
          OR: [
            { name: catData.name },
            { slug: catData.slug },
          ],
        },
      });

      if (!category) {
        category = await prisma.category.create({
          data: {
            name: catData.name,
            slug: catData.slug,
            description: catData.description,
            isActive: true,
          },
        });
        categoriesCreated++;
        console.log(`   ✅ Category: ${catData.name}`);
      } else {
        category = await prisma.category.update({
          where: { id: category.id },
          data: {
            name: catData.name,
            slug: catData.slug,
            description: catData.description,
            isActive: true,
          },
        });
        console.log(`   🔄 Updated Category: ${catData.name}`);
      }

      for (const subcatData of catData.subcategories) {
        let subcategory = await prisma.subcategory.findFirst({
          where: {
            categoryId: category.id,
            OR: [
              { name: subcatData.name },
              { slug: subcatData.slug },
            ],
          },
        });

        if (!subcategory) {
          subcategory = await prisma.subcategory.create({
            data: {
              name: subcatData.name,
              slug: subcatData.slug,
              categoryId: category.id,
              isActive: true,
            },
          });
          subcategoriesCreated++;
        } else {
          await prisma.subcategory.update({
            where: { id: subcategory.id },
            data: {
              name: subcatData.name,
              slug: subcatData.slug,
              isActive: true,
            },
          });
        }
      }
    }
    console.log(`✅ Categories seeded (${categoriesCreated} created, ${subcategoriesCreated} subcategories)\n`);

    // Get categories for product creation
    const categories = await prisma.category.findMany({
      include: { subcategories: true },
    });

    // Step 2: Create regular users
    console.log('👥 Step 2: Creating regular users...');
    const hashedPassword = await bcrypt.hash('12345678', 12);
    const createdUsers = [];

    for (const userData of regularUsers) {
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          username: userData.username,
          status: 'ACTIVE',
          emailVerified: true,
        },
        create: {
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          username: userData.username,
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: true,
        },
      });

      // Create wallet if it doesn't exist
      await prisma.wallet.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          balance: Math.random() * 500,
          totalEarned: Math.random() * 1000,
          totalWithdrawn: 0,
        },
      });

      createdUsers.push(user);
      console.log(`   ✅ User: ${userData.email}`);
    }
    console.log(`✅ Created ${createdUsers.length} users\n`);

    // Step 3: Create vendors
    console.log('🏪 Step 3: Creating vendors...');
    const createdVendors = [];

    for (const vendorData of vendors) {
      const vendor = await prisma.user.upsert({
        where: { email: vendorData.email },
        update: {
          firstName: vendorData.firstName,
          lastName: vendorData.lastName,
          username: vendorData.username,
          role: 'VENDOR',
          status: 'ACTIVE',
          emailVerified: true,
        },
        create: {
          email: vendorData.email,
          password: hashedPassword,
          firstName: vendorData.firstName,
          lastName: vendorData.lastName,
          username: vendorData.username,
          role: 'VENDOR',
          status: 'ACTIVE',
          emailVerified: true,
        },
      });

      // Create vendor profile
      await prisma.vendorProfile.upsert({
        where: { userId: vendor.id },
        update: {
          businessName: vendorData.businessName,
          businessType: vendorData.businessType,
          description: vendorData.description,
          city: vendorData.city,
          state: vendorData.state,
          country: vendorData.country,
          isVerified: Math.random() > 0.3, // 70% verified
        },
        create: {
          userId: vendor.id,
          businessName: vendorData.businessName,
          businessType: vendorData.businessType,
          description: vendorData.description,
          city: vendorData.city,
          state: vendorData.state,
          country: vendorData.country,
          isVerified: Math.random() > 0.3,
        },
      });

      // Create wallet
      await prisma.wallet.upsert({
        where: { userId: vendor.id },
        update: {},
        create: {
          userId: vendor.id,
          balance: Math.random() * 2000,
          totalEarned: Math.random() * 5000,
          totalWithdrawn: Math.random() * 2000,
        },
      });

      createdVendors.push(vendor);
      console.log(`   ✅ Vendor: ${vendorData.businessName}`);
    }
    console.log(`✅ Created ${createdVendors.length} vendors\n`);

    // Step 4: Create products for vendors
    console.log('📦 Step 4: Creating products...');
    let productsCreated = 0;

    for (const vendor of createdVendors) {
      // Determine vendor's category based on business type
      let categorySlug = 'electronics';
      if (vendor.email.includes('fashion')) categorySlug = 'clothing-apparel';
      else if (vendor.email.includes('home')) categorySlug = 'home-garden';
      else if (vendor.email.includes('sports')) categorySlug = 'sports-outdoors';
      else if (vendor.email.includes('beauty')) categorySlug = 'beauty-personal-care';
      else if (vendor.email.includes('book')) categorySlug = 'books-media';
      else if (vendor.email.includes('health')) categorySlug = 'health-wellness';
      else if (vendor.email.includes('toy')) categorySlug = 'toys-games';

      const category = categories.find(c => c.slug === categorySlug);
      if (!category || !category.subcategories.length) continue;

      const subcategory = category.subcategories[0];
      const templates = productTemplates[categorySlug] || productTemplates.electronics;

      // Create 5-8 products per vendor
      const numProducts = 5 + Math.floor(Math.random() * 4);
      for (let i = 0; i < numProducts; i++) {
        const template = templates[i % templates.length];
        const variation = 1 + (Math.random() * 0.3 - 0.15); // ±15% variation
        const sellingPrice = template.basePrice * variation;
        const costPrice = template.costPrice * variation;
        const mrp = template.mrp * variation;

        const product = await prisma.product.create({
          data: {
            vendorId: vendor.id,
            categoryId: category.id,
            subcategoryId: subcategory.id,
            name: `${template.name}${i > 0 ? ` ${i + 1}` : ''}`,
            description: `High-quality ${template.name.toLowerCase()} from ${vendor.email.split('@')[0]}`,
            costPrice: costPrice,
            mrp: mrp,
            sellingPrice: sellingPrice,
            currency: 'CAD',
            stock: Math.floor(Math.random() * 100) + 10,
            images: [
              `https://picsum.photos/400/400?random=${productsCreated + i + 1}`,
              `https://picsum.photos/400/400?random=${productsCreated + i + 2}`,
              `https://picsum.photos/400/400?random=${productsCreated + i + 3}`,
            ],
            sku: generateSKU(vendor.id, template.name),
            isActive: true,
          },
        });
        productsCreated++;
      }
      console.log(`   ✅ Created products for ${vendor.email.split('@')[0]}`);
    }
    console.log(`✅ Created ${productsCreated} products\n`);

    // Step 5: Create orders
    console.log('🛒 Step 5: Creating orders...');
    const allProducts = await prisma.product.findMany({
      where: { isActive: true },
      include: { vendor: true },
    });

    const orderStatuses = [
      'PENDING_VENDOR_APPROVAL',
      'PENDING_USER_APPROVAL',
      'ACCEPTED',
      'CONFIRMED',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
    ];

    let ordersCreated = 0;
    const createdOrders = [];

    // Create 30-50 orders
    const numOrders = 30 + Math.floor(Math.random() * 21);
    for (let i = 0; i < numOrders; i++) {
      const user = createdUsers[Math.floor(Math.random() * createdUsers.length)];
      const vendorProducts = allProducts.filter(
        p => p.vendorId !== user.id && Math.random() > 0.5
      );
      
      if (vendorProducts.length === 0) continue;

      // Select 1-3 products for this order
      const numItems = Math.min(1 + Math.floor(Math.random() * 3), vendorProducts.length);
      const selectedProducts = vendorProducts
        .sort(() => Math.random() - 0.5)
        .slice(0, numItems);

      const vendorId = selectedProducts[0].vendorId;
      let totalAmount = 0;
      const orderItems = [];

      for (const product of selectedProducts) {
        const quantity = 1 + Math.floor(Math.random() * 3);
        const price = parseFloat(product.sellingPrice);
        const costPrice = product.costPrice ? parseFloat(product.costPrice) : price * 0.6;
        const subtotal = price * quantity;
        totalAmount += subtotal;

        orderItems.push({
          productId: product.id,
          quantity,
          price,
          costPrice,
          subtotal,
        });
      }

      const status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
      const now = new Date();
      const createdAt = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Random date in last 30 days

      let confirmedAt = null;
      let shippedAt = null;
      let deliveredAt = null;
      let cancelledAt = null;

      if (status === 'CONFIRMED' || status === 'SHIPPED' || status === 'DELIVERED') {
        confirmedAt = new Date(createdAt.getTime() + Math.random() * 2 * 24 * 60 * 60 * 1000);
      }
      if (status === 'SHIPPED' || status === 'DELIVERED') {
        shippedAt = new Date(confirmedAt.getTime() + Math.random() * 3 * 24 * 60 * 60 * 1000);
      }
      if (status === 'DELIVERED') {
        deliveredAt = new Date(shippedAt.getTime() + Math.random() * 5 * 24 * 60 * 60 * 1000);
      }
      if (status === 'CANCELLED') {
        cancelledAt = new Date(createdAt.getTime() + Math.random() * 2 * 24 * 60 * 60 * 1000);
      }

      const order = await prisma.order.create({
        data: {
          userId: user.id,
          vendorId: vendorId,
          orderNumber: generateOrderNumber(),
          totalAmount: totalAmount,
          currency: 'CAD',
          status: status,
          shippingAddress: {
            street: `${Math.floor(Math.random() * 9999)} Main St`,
            city: 'Toronto',
            province: 'Ontario',
            postalCode: `M${Math.floor(Math.random() * 9)}${Math.floor(Math.random() * 9)} ${Math.floor(Math.random() * 9)}${Math.floor(Math.random() * 9)}${Math.floor(Math.random() * 9)}`,
            country: 'Canada',
          },
          shippingName: `${user.firstName} ${user.lastName}`,
          shippingPhone: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
          confirmedAt,
          shippedAt,
          deliveredAt,
          cancelledAt,
          createdAt,
          items: {
            create: orderItems,
          },
        },
      });

      createdOrders.push(order);
      ordersCreated++;
    }
    console.log(`✅ Created ${ordersCreated} orders\n`);

    // Step 6: Create settlements for delivered orders
    console.log('💰 Step 6: Creating settlements...');
    const deliveredOrders = await prisma.order.findMany({
      where: { status: 'DELIVERED' },
      include: { vendor: true },
    });

    let settlementsCreated = 0;
    for (const order of deliveredOrders) {
      // Check if settlement already exists
      const existing = await prisma.settlement.findUnique({
        where: { orderId: order.id },
      });

      if (existing) continue;

      const settlementStatus = Math.random() > 0.3 ? 'COMPLETED' : 'PENDING';
      const settledAt = settlementStatus === 'COMPLETED' 
        ? new Date(order.deliveredAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000)
        : null;

      await prisma.settlement.create({
        data: {
          vendorId: order.vendorId,
          orderId: order.id,
          amount: parseFloat(order.totalAmount) * 0.95, // 95% after platform fee
          currency: 'CAD',
          status: settlementStatus,
          settledAt,
        },
      });
      settlementsCreated++;
    }
    console.log(`✅ Created ${settlementsCreated} settlements\n`);

    // Summary
    console.log('🎉 Development data seeding completed!\n');
    console.log('📊 Summary:');
    console.log(`   Users: ${createdUsers.length}`);
    console.log(`   Vendors: ${createdVendors.length}`);
    console.log(`   Products: ${productsCreated}`);
    console.log(`   Orders: ${ordersCreated}`);
    console.log(`   Settlements: ${settlementsCreated}\n`);

    await database.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding development data:', error);
    console.error(error.stack);
    await database.disconnect();
    process.exit(1);
  }
};

if (require.main === module) {
  seedDevData();
}

module.exports = seedDevData;
