#!/usr/bin/env node
const database = require('../../config/database');

// Generic product templates for each subcategory
const genericProducts = {
  // Electronics
  'Laptops': { name: 'Generic Laptop', price: 899.99, stock: 20, description: 'High-performance laptop for work and entertainment' },
  'Smartphones': { name: 'Generic Smartphone', price: 499.99, stock: 30, description: 'Feature-rich smartphone with modern capabilities' },
  'Tablets': { name: 'Generic Tablet', price: 299.99, stock: 25, description: 'Versatile tablet for productivity and entertainment' },
  'Headphones': { name: 'Generic Headphones', price: 79.99, stock: 40, description: 'Comfortable headphones with quality sound' },
  'Cameras': { name: 'Generic Digital Camera', price: 399.99, stock: 15, description: 'Digital camera for capturing memories' },

  // Clothing
  'Men\'s Clothing': { name: 'Men\'s Generic T-Shirt', price: 24.99, stock: 50, description: 'Comfortable cotton t-shirt for men' },
  'Women\'s Clothing': { name: 'Women\'s Generic Blouse', price: 29.99, stock: 45, description: 'Stylish blouse for women' },
  'Kids\' Clothing': { name: 'Kids\' Generic T-Shirt', price: 19.99, stock: 60, description: 'Fun and comfortable t-shirt for kids' },
  'Shoes': { name: 'Generic Running Shoes', price: 69.99, stock: 35, description: 'Comfortable running shoes for daily wear' },
  'Accessories': { name: 'Generic Leather Belt', price: 34.99, stock: 40, description: 'Classic leather belt' },

  // Home & Garden
  'Furniture': { name: 'Generic Coffee Table', price: 199.99, stock: 15, description: 'Modern coffee table for your living room' },
  'Kitchen': { name: 'Generic Kitchen Utensil Set', price: 49.99, stock: 30, description: 'Essential kitchen utensils set' },
  'Bedding': { name: 'Generic Bedding Set', price: 79.99, stock: 25, description: 'Comfortable bedding set for your bedroom' },
  'Garden Tools': { name: 'Generic Garden Tool Set', price: 59.99, stock: 20, description: 'Essential tools for gardening' },
  'Decor': { name: 'Generic Wall Art', price: 39.99, stock: 35, description: 'Decorative wall art piece' },

  // Sports & Outdoors
  'Fitness': { name: 'Generic Yoga Mat', price: 29.99, stock: 40, description: 'Non-slip yoga mat for exercise' },
  'Camping': { name: 'Generic Camping Tent', price: 149.99, stock: 18, description: 'Spacious tent for camping adventures' },
  'Cycling': { name: 'Generic Bicycle', price: 299.99, stock: 12, description: 'Reliable bicycle for commuting and recreation' },
  'Water Sports': { name: 'Generic Snorkel Set', price: 49.99, stock: 25, description: 'Complete snorkel gear for water activities' },
  'Winter Sports': { name: 'Generic Winter Gloves', price: 34.99, stock: 30, description: 'Warm and waterproof winter gloves' },

  // Books & Media
  'Fiction': { name: 'Generic Fiction Novel', price: 14.99, stock: 80, description: 'Engaging fiction novel for reading' },
  'Non-Fiction': { name: 'Generic Non-Fiction Book', price: 16.99, stock: 70, description: 'Informative non-fiction book' },
  'Textbooks': { name: 'Generic Textbook', price: 89.99, stock: 50, description: 'Educational textbook for students' },
  'Movies': { name: 'Generic Movie DVD', price: 19.99, stock: 60, description: 'Entertaining movie on DVD' },
  'Music': { name: 'Generic Music Album', price: 15.99, stock: 65, description: 'Music album collection' },
};

async function seedProductsForAllCategories() {
  try {
    console.log('🌱 Starting product seeding for all categories...\n');
    await database.connect();
    const prisma = database.getClient();

    if (!prisma) {
      throw new Error('Prisma client not available');
    }

    // Get vendor1 user
    const vendor = await prisma.user.findUnique({
      where: { email: 'vendor1@gmail.com' },
      include: { vendorProfile: true },
    });

    if (!vendor || vendor.role !== 'VENDOR') {
      console.log('⚠️  vendor1@gmail.com not found or not a vendor. Please create vendor first.');
      await database.disconnect();
      process.exit(1);
    }

    if (!vendor.vendorProfile) {
      console.log('⚠️  Vendor profile not found for vendor1@gmail.com');
      await database.disconnect();
      process.exit(1);
    }

    console.log(`✅ Found vendor: ${vendor.email} (${vendor.vendorProfile.businessName})\n`);

    // Get all categories with their subcategories
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: {
        subcategories: {
          where: { isActive: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    if (categories.length === 0) {
      console.log('⚠️  No categories found. Please run seedCategories.js first.');
      await database.disconnect();
      process.exit(1);
    }

    console.log(`Found ${categories.length} categories\n`);

    let productsCreated = 0;
    let productsSkipped = 0;

    // Create one product for each subcategory
    for (const category of categories) {
      console.log(`📦 Category: ${category.name}`);
      
      for (const subcategory of category.subcategories) {
        const productTemplate = genericProducts[subcategory.name];
        
        if (!productTemplate) {
          console.log(`   ⚠️  No template for subcategory: ${subcategory.name}`);
          productsSkipped++;
          continue;
        }

        // Check if product already exists for this subcategory
        const existingProduct = await prisma.product.findFirst({
          where: {
            vendorId: vendor.id,
            subcategoryId: subcategory.id,
            name: productTemplate.name,
          },
        });

        if (existingProduct) {
          console.log(`   ✓ Product already exists: ${productTemplate.name}`);
          continue;
        }

        // Generate unique SKU
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        const sku = `PRD-${timestamp}-${random}-${subcategory.id.slice(0, 4)}`;

        // Create placeholder image URLs (5 images per product)
        const images = Array(5).fill(null).map((_, idx) => 
          `https://via.placeholder.com/400x400/4A90E2/FFFFFF?text=${encodeURIComponent(productTemplate.name.replace(/\s+/g, '+'))}+${idx + 1}`
        );

        try {
          await prisma.product.create({
            data: {
              name: productTemplate.name,
              description: productTemplate.description,
              price: productTemplate.price,
              currency: 'CAD',
              stock: productTemplate.stock,
              sku,
              images,
              isActive: true,
              vendorId: vendor.id,
              categoryId: category.id,
              subcategoryId: subcategory.id,
            },
          });
          productsCreated++;
          console.log(`   ✅ Created: ${productTemplate.name} (${subcategory.name})`);
        } catch (error) {
          console.error(`   ❌ Error creating product ${productTemplate.name}:`, error.message);
          productsSkipped++;
        }
      }
      console.log('');
    }

    console.log(`\n✅ Seeding complete!`);
    console.log(`   Products created: ${productsCreated}`);
    console.log(`   Products skipped: ${productsSkipped}`);
    console.log(`   Vendor: ${vendor.email}\n`);

    await database.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding products:', error);
    await database.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  seedProductsForAllCategories();
}

module.exports = seedProductsForAllCategories;
