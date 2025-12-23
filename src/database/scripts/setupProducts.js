#!/usr/bin/env node

/**
 * Setup Products
 * - Deletes all products
 * - Adds 12 products with images, MRP, cost price, and selling price
 * 
 * Usage: node src/database/scripts/setupProducts.js
 */

require('dotenv').config();
const database = require('../../config/database');
const productService = require('../../services/productService');

const prisma = database.getClient();

// Placeholder image URLs (using Unsplash for random product images)
const getRandomImageUrl = (index) => {
  const imageIds = [
    '400x400?random=1',
    '400x400?random=2',
    '400x400?random=3',
    '400x400?random=4',
    '400x400?random=5',
    '400x400?random=6',
    '400x400?random=7',
    '400x400?random=8',
    '400x400?random=9',
    '400x400?random=10',
    '400x400?random=11',
    '400x400?random=12'
  ];
  // Using placeholder.com for reliable placeholder images
  return `https://via.placeholder.com/${imageIds[index % imageIds.length]}`;
};

// Product data with MRP, Cost Price, and Selling Price
const productsData = [
  {
    name: 'Premium Coffee Table',
    description: 'Elegant wooden coffee table with modern design, perfect for your living room.',
    costPrice: 300.00,
    mrp: 600.00,
    sellingPrice: 450.00,
    stock: 25,
    imageUrl: 'https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=400&h=400&fit=crop'
  },
  {
    name: 'Designer Sofa Set',
    description: 'Comfortable 3-seater sofa set with premium fabric and elegant design.',
    costPrice: 800.00,
    mrp: 1500.00,
    sellingPrice: 1200.00,
    stock: 15,
    imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=400&fit=crop'
  },
  {
    name: 'Modern Dining Table',
    description: 'Stylish dining table with glass top and metal legs, seats 6 people.',
    costPrice: 550.00,
    mrp: 1000.00,
    sellingPrice: 850.00,
    stock: 20,
    imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=400&fit=crop'
  },
  {
    name: 'Luxury Bed Frame',
    description: 'King-size bed frame with upholstered headboard and premium materials.',
    costPrice: 1000.00,
    mrp: 2000.00,
    sellingPrice: 1500.00,
    stock: 12,
    imageUrl: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&h=400&fit=crop'
  },
  {
    name: 'Executive Office Chair',
    description: 'Ergonomic office chair with lumbar support and adjustable height.',
    costPrice: 200.00,
    mrp: 450.00,
    sellingPrice: 350.00,
    stock: 30,
    imageUrl: 'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400&h=400&fit=crop'
  },
  {
    name: 'Smart TV Stand',
    description: 'Modern TV stand with cable management and storage compartments.',
    costPrice: 250.00,
    mrp: 500.00,
    sellingPrice: 400.00,
    stock: 18,
    imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=400&fit=crop'
  },
  {
    name: 'Wardrobe Closet',
    description: 'Spacious wardrobe with sliding doors and multiple compartments.',
    costPrice: 700.00,
    mrp: 1400.00,
    sellingPrice: 1100.00,
    stock: 10,
    imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=400&fit=crop'
  },
  {
    name: 'Study Desk',
    description: 'Compact study desk with drawers and built-in storage.',
    costPrice: 180.00,
    mrp: 380.00,
    sellingPrice: 300.00,
    stock: 22,
    imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=400&fit=crop'
  },
  {
    name: 'Bookshelf Unit',
    description: '5-tier bookshelf with adjustable shelves and modern design.',
    costPrice: 150.00,
    mrp: 320.00,
    sellingPrice: 250.00,
    stock: 28,
    imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=400&fit=crop'
  },
  {
    name: 'Dining Chair Set',
    description: 'Set of 4 elegant dining chairs with comfortable padding.',
    costPrice: 120.00,
    mrp: 280.00,
    sellingPrice: 220.00,
    stock: 35,
    imageUrl: 'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400&h=400&fit=crop'
  },
  {
    name: 'Console Table',
    description: 'Sleek console table perfect for entryway or hallway decoration.',
    costPrice: 200.00,
    mrp: 420.00,
    sellingPrice: 330.00,
    stock: 16,
    imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=400&fit=crop'
  },
  {
    name: 'Accent Chair',
    description: 'Stylish accent chair with velvet upholstery and gold legs.',
    costPrice: 280.00,
    mrp: 580.00,
    sellingPrice: 450.00,
    stock: 20,
    imageUrl: 'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400&h=400&fit=crop'
  }
];

async function setupProducts() {
  try {
    console.log('🔄 Starting: Setup Products\n');
    console.log('='.repeat(70));

    await database.connect();

    // Step 1: Find or get a vendor
    console.log('\n👤 Step 1: Finding vendor...');
    let vendor = await prisma.user.findFirst({
      where: { role: 'VENDOR' },
      include: { vendorProfile: true }
    });

    if (!vendor) {
      console.log('   ⚠️  No vendor found. Creating a test vendor...');
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('12345678', 12);
      
      vendor = await prisma.user.create({
        data: {
          email: 'vendor@example.com',
          password: hashedPassword,
          firstName: 'Test',
          lastName: 'Vendor',
          role: 'VENDOR',
          status: 'ACTIVE',
          emailVerified: true,
          vendorProfile: {
            create: {
              businessName: 'Test Vendor Business',
              description: 'Test vendor for product setup'
            }
          }
        },
        include: { vendorProfile: true }
      });
      console.log(`   ✅ Created vendor: ${vendor.email}`);
    } else {
      console.log(`   ✅ Found vendor: ${vendor.email}`);
    }

    // Step 2: Get categories and subcategories
    console.log('\n📁 Step 2: Getting categories and subcategories...');
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: {
        subcategories: {
          where: { isActive: true }
        }
      }
    });

    if (categories.length === 0) {
      throw new Error('No active categories found. Please create categories first.');
    }

    // Find a category with subcategories
    let selectedCategory = categories.find(cat => cat.subcategories.length > 0);
    if (!selectedCategory) {
      selectedCategory = categories[0];
      // Create a default subcategory if none exists
      const subcategory = await prisma.subcategory.create({
        data: {
          name: 'General',
          slug: 'general',
          categoryId: selectedCategory.id,
          isActive: true
        }
      });
      selectedCategory.subcategories = [subcategory];
    }

    const selectedSubcategory = selectedCategory.subcategories[0];
    console.log(`   ✅ Using category: ${selectedCategory.name}`);
    console.log(`   ✅ Using subcategory: ${selectedSubcategory.name}`);

    // Step 3: Delete all existing products (first delete order items that reference them)
    console.log('\n🗑️  Step 3: Deleting all existing products...');
    
    // First, delete order items that reference products
    const deleteOrderItems = await prisma.orderItem.deleteMany({});
    console.log(`   ✅ Deleted ${deleteOrderItems.count} order items`);
    
    // Then delete products
    const deleteResult = await prisma.product.deleteMany({});
    console.log(`   ✅ Deleted ${deleteResult.count} products`);

    // Step 4: Create 12 products
    console.log(`\n📦 Step 4: Creating ${productsData.length} products...`);
    
    for (let i = 0; i < productsData.length; i++) {
      const productData = productsData[i];
      
      try {
        // Create product data
        const productPayload = {
          name: productData.name,
          description: productData.description,
          costPrice: productData.costPrice,
          mrp: productData.mrp,
          sellingPrice: productData.sellingPrice,
          stock: productData.stock,
          categoryId: selectedCategory.id,
          subcategoryId: selectedSubcategory.id,
          currency: 'CAD'
        };

        // Create product directly in database with image URL
        // Note: In production, images should be uploaded via Firebase Storage
        // For this script, we'll store the image URL directly
        const product = await prisma.product.create({
          data: {
            ...productPayload,
            vendorId: vendor.id,
            images: [productData.imageUrl], // Store image URL directly
            sku: `PRD-${Date.now()}-${i + 1}`,
            isActive: true
          }
        });

        console.log(`   ✅ Created: ${product.name}`);
        console.log(`      Cost Price: $${productData.costPrice.toFixed(2)}`);
        console.log(`      MRP: $${productData.mrp.toFixed(2)}`);
        console.log(`      Selling Price: $${productData.sellingPrice.toFixed(2)}`);
        console.log(`      Stock: ${productData.stock}`);
        console.log(`      Image: ${productData.imageUrl}`);
        console.log('');
      } catch (error) {
        console.error(`   ❌ Error creating product "${productData.name}":`, error.message);
      }
    }

    // Step 5: Summary
    const totalProducts = await prisma.product.count();
    console.log('\n📊 Summary:');
    console.log(`   Total Products: ${totalProducts}`);
    console.log(`   Vendor: ${vendor.email}`);
    console.log(`   Category: ${selectedCategory.name}`);
    console.log(`   Subcategory: ${selectedSubcategory.name}`);

    console.log('\n✅ Successfully setup products!');

  } catch (error) {
    console.error('\n❌ Error setting up products:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  setupProducts()
    .then(() => {
      console.log('\n✨ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { setupProducts };

