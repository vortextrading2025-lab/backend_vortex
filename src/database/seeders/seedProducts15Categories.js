#!/usr/bin/env node
const database = require('../../config/database');
const { getAttributeDefinitions } = require('../../utils/productAttributes');

// Comprehensive product templates for all 15 categories with attributes
const productTemplates = [
  // ========== ELECTRONICS ==========
  // Laptops
  { name: 'MacBook Pro 16" M3 Max', price: 3499.99, stock: 8, category: 'Electronics', subcategory: 'Laptops', 
    attributes: { brand: 'Apple', model: 'MacBook Pro 16"', color: 'Space Gray', screenSize: '16"', ram: '32GB', storage: '1TB SSD', processor: 'M3 Max' } },
  { name: 'Dell XPS 15 OLED', price: 2199.99, stock: 12, category: 'Electronics', subcategory: 'Laptops',
    attributes: { brand: 'Dell', model: 'XPS 15', color: 'Platinum Silver', screenSize: '15.6"', ram: '32GB', storage: '1TB SSD', processor: 'Intel i9' } },
  { name: 'HP Spectre x360', price: 1499.99, stock: 15, category: 'Electronics', subcategory: 'Laptops',
    attributes: { brand: 'HP', model: 'Spectre x360', color: 'Nightfall Black', screenSize: '13.5"', ram: '16GB', storage: '512GB SSD', processor: 'Intel i7' } },
  { name: 'ASUS ROG Strix G15', price: 1299.99, stock: 20, category: 'Electronics', subcategory: 'Laptops',
    attributes: { brand: 'ASUS', model: 'ROG Strix G15', color: 'Black', screenSize: '15.6"', ram: '16GB', storage: '512GB SSD', processor: 'AMD Ryzen 7' } },
  
  // Smartphones
  { name: 'iPhone 15 Pro Max', price: 1499.99, stock: 30, category: 'Electronics', subcategory: 'Smartphones',
    attributes: { brand: 'Apple', model: 'iPhone 15 Pro Max', color: 'Titanium Blue', storage: '256GB', screenSize: '6.7"', batteryCapacity: '4441mAh' } },
  { name: 'Samsung Galaxy S24 Ultra', price: 1399.99, stock: 28, category: 'Electronics', subcategory: 'Smartphones',
    attributes: { brand: 'Samsung', model: 'Galaxy S24 Ultra', color: 'Titanium Black', storage: '256GB', screenSize: '6.8"', batteryCapacity: '5000mAh' } },
  { name: 'Google Pixel 8 Pro', price: 999.99, stock: 35, category: 'Electronics', subcategory: 'Smartphones',
    attributes: { brand: 'Google', model: 'Pixel 8 Pro', color: 'Obsidian', storage: '128GB', screenSize: '6.7"', batteryCapacity: '5050mAh' } },
  { name: 'OnePlus 12', price: 899.99, stock: 40, category: 'Electronics', subcategory: 'Smartphones',
    attributes: { brand: 'OnePlus', model: 'OnePlus 12', color: 'Silky Black', storage: '256GB', screenSize: '6.82"', batteryCapacity: '5400mAh' } },
  
  // Tablets
  { name: 'iPad Pro 12.9" M2', price: 1199.99, stock: 20, category: 'Electronics', subcategory: 'Tablets',
    attributes: { brand: 'Apple', model: 'iPad Pro 12.9"', color: 'Space Gray', screenSize: '12.9"', storage: '256GB' } },
  { name: 'Samsung Galaxy Tab S9 Ultra', price: 1099.99, stock: 18, category: 'Electronics', subcategory: 'Tablets',
    attributes: { brand: 'Samsung', model: 'Galaxy Tab S9 Ultra', color: 'Graphite', screenSize: '14.6"', storage: '256GB' } },
  
  // Headphones
  { name: 'Sony WH-1000XM5', price: 449.99, stock: 35, category: 'Electronics', subcategory: 'Headphones',
    attributes: { brand: 'Sony', model: 'WH-1000XM5', color: 'Black', type: 'Over-ear', wireless: true, noiseCancelling: true } },
  { name: 'Apple AirPods Pro 2', price: 279.99, stock: 60, category: 'Electronics', subcategory: 'Headphones',
    attributes: { brand: 'Apple', model: 'AirPods Pro 2', color: 'White', type: 'In-ear', wireless: true, noiseCancelling: true } },
  
  // Cameras
  { name: 'Canon EOS R6 Mark II', price: 2899.99, stock: 8, category: 'Electronics', subcategory: 'Cameras',
    attributes: { brand: 'Canon', model: 'EOS R6 Mark II', type: 'Mirrorless', megapixels: '24MP', lensMount: 'RF' } },
  { name: 'Sony A7 IV', price: 2499.99, stock: 10, category: 'Electronics', subcategory: 'Cameras',
    attributes: { brand: 'Sony', model: 'A7 IV', type: 'Mirrorless', megapixels: '33MP', lensMount: 'E-mount' } },
  
  // Smart Watches
  { name: 'Apple Watch Series 9', price: 449.99, stock: 25, category: 'Electronics', subcategory: 'Smart Watches',
    attributes: { brand: 'Apple', model: 'Apple Watch Series 9', color: 'Midnight', size: '45mm', connectivity: 'GPS + Cellular' } },
  { name: 'Samsung Galaxy Watch 6', price: 399.99, stock: 30, category: 'Electronics', subcategory: 'Smart Watches',
    attributes: { brand: 'Samsung', model: 'Galaxy Watch 6', color: 'Graphite', size: '44mm', connectivity: 'Bluetooth' } },

  // ========== CLOTHING & APPAREL ==========
  // Men's Clothing
  { name: 'Men\'s Premium Dress Shirt', price: 89.99, stock: 50, category: 'Clothing & Apparel', subcategory: 'Men\'s Clothing',
    attributes: { brand: 'Van Heusen', color: 'White', size: 'L', material: 'Cotton', fit: 'Regular', style: 'Formal' } },
  { name: 'Men\'s Slim Fit Chinos', price: 69.99, stock: 60, category: 'Clothing & Apparel', subcategory: 'Men\'s Clothing',
    attributes: { brand: 'Dockers', color: 'Navy', size: '32x32', material: 'Cotton', fit: 'Slim', style: 'Casual' } },
  
  // Women's Clothing
  { name: 'Women\'s Elegant Evening Dress', price: 149.99, stock: 40, category: 'Clothing & Apparel', subcategory: 'Women\'s Clothing',
    attributes: { brand: 'Calvin Klein', color: 'Black', size: 'M', material: 'Polyester', fit: 'Regular', pattern: 'Solid' } },
  { name: 'Women\'s Summer Maxi Dress', price: 59.99, stock: 55, category: 'Clothing & Apparel', subcategory: 'Women\'s Clothing',
    attributes: { brand: 'Free People', color: 'Floral', size: 'S', material: 'Cotton', fit: 'Loose', pattern: 'Floral' } },
  
  // Kids' Clothing
  { name: 'Kids\' Playground Set', price: 34.99, stock: 60, category: 'Clothing & Apparel', subcategory: 'Kids\' Clothing',
    attributes: { brand: 'Carter\'s', color: 'Blue', size: '4T', ageRange: '3-4 years', material: 'Cotton' } },
  
  // Shoes
  { name: 'Nike Air Max 270', price: 149.99, stock: 40, category: 'Clothing & Apparel', subcategory: 'Shoes',
    attributes: { brand: 'Nike', color: 'Black/White', size: '10', type: 'Running', material: 'Synthetic' } },
  { name: 'Adidas Ultraboost 22', price: 189.99, stock: 35, category: 'Clothing & Apparel', subcategory: 'Shoes',
    attributes: { brand: 'Adidas', color: 'Core Black', size: '9', type: 'Running', material: 'Primeknit' } },
  
  // Activewear
  { name: 'Men\'s Athletic Shorts', price: 34.99, stock: 70, category: 'Clothing & Apparel', subcategory: 'Activewear',
    attributes: { brand: 'Nike', color: 'Black', size: 'L', material: 'Polyester', moistureWicking: true } },

  // ========== HOME & GARDEN ==========
  // Furniture
  { name: 'Modern Sectional Sofa', price: 1899.99, stock: 8, category: 'Home & Garden', subcategory: 'Furniture',
    attributes: { brand: 'Ashley', color: 'Gray', material: 'Fabric', dimensions: '120" x 84" x 36"', weight: '180 lbs', assemblyRequired: true } },
  { name: 'Oak Dining Table Set', price: 799.99, stock: 12, category: 'Home & Garden', subcategory: 'Furniture',
    attributes: { brand: 'IKEA', color: 'Oak', material: 'Wood', dimensions: '72" x 36" x 30"', weight: '120 lbs', assemblyRequired: true } },
  
  // Kitchen
  { name: 'Stainless Steel Cookware Set', price: 299.99, stock: 25, category: 'Home & Garden', subcategory: 'Kitchen',
    attributes: { brand: 'Cuisinart', color: 'Silver', material: 'Stainless Steel', capacity: '10-piece set', dishwasherSafe: true } },
  { name: 'Stand Mixer', price: 449.99, stock: 18, category: 'Home & Garden', subcategory: 'Kitchen',
    attributes: { brand: 'KitchenAid', color: 'Empire Red', material: 'Metal', capacity: '5.5 quarts', dishwasherSafe: false } },
  
  // Bedding
  { name: 'Queen Size Sheet Set', price: 89.99, stock: 40, category: 'Home & Garden', subcategory: 'Bedding',
    attributes: { brand: 'Mellanni', color: 'White', size: 'Queen', material: 'Microfiber', threadCount: '1800' } },
  
  // Lighting
  { name: 'LED Smart Bulb Pack', price: 29.99, stock: 50, category: 'Home & Garden', subcategory: 'Lighting',
    attributes: { brand: 'Philips', color: 'Warm White', type: 'LED', wattage: '60W equivalent', dimmable: true } },

  // ========== SPORTS & OUTDOORS ==========
  // Fitness
  { name: 'Adjustable Dumbbells Set', price: 299.99, stock: 20, category: 'Sports & Outdoors', subcategory: 'Fitness',
    attributes: { brand: 'Bowflex', color: 'Black', size: '5-52.5 lbs', material: 'Steel', weight: '52.5 lbs' } },
  
  // Camping
  { name: '4-Person Camping Tent', price: 149.99, stock: 25, category: 'Sports & Outdoors', subcategory: 'Camping',
    attributes: { brand: 'Coleman', color: 'Green', capacity: '4-person', weight: '12 lbs', waterproof: true } },
  
  // Cycling
  { name: 'Mountain Bike', price: 899.99, stock: 15, category: 'Sports & Outdoors', subcategory: 'Cycling',
    attributes: { brand: 'Trek', color: 'Red', size: 'Medium', frameMaterial: 'Aluminum', wheelSize: '27.5"' } },
  
  // Winter Sports
  { name: 'Men\'s Ski Jacket', price: 199.99, stock: 30, category: 'Sports & Outdoors', subcategory: 'Winter Sports',
    attributes: { brand: 'Burton', color: 'Black', size: 'L', material: 'Gore-Tex' } },

  // ========== BOOKS & MEDIA ==========
  // Fiction
  { name: 'The Great Gatsby', price: 14.99, stock: 100, category: 'Books & Media', subcategory: 'Fiction',
    attributes: { author: 'F. Scott Fitzgerald', publisher: 'Scribner', isbn: '978-0-7432-7356-5', format: 'Paperback', pages: '180 pages' } },
  
  // Movies
  { name: 'The Dark Knight (Blu-ray)', price: 19.99, stock: 50, category: 'Books & Media', subcategory: 'Movies',
    attributes: { director: 'Christopher Nolan', studio: 'Warner Bros', format: 'Blu-ray', runtime: '152 minutes', rating: 'PG-13' } },
  
  // Music
  { name: 'Abbey Road (Vinyl)', price: 24.99, stock: 40, category: 'Books & Media', subcategory: 'Music',
    attributes: { artist: 'The Beatles', label: 'Apple Records', format: 'Vinyl', genre: 'Rock', tracks: '17 tracks' } },

  // ========== BEAUTY & PERSONAL CARE ==========
  // Skincare
  { name: 'CeraVe Daily Moisturizing Lotion', price: 18.99, stock: 80, category: 'Beauty & Personal Care', subcategory: 'Skincare',
    attributes: { brand: 'CeraVe', skinType: 'All Skin Types', volume: '12oz', spf: 'None', ingredients: 'Hyaluronic Acid, Ceramides' } },
  
  // Makeup
  { name: 'MAC Lipstick - Ruby Woo', price: 24.99, stock: 60, category: 'Beauty & Personal Care', subcategory: 'Makeup',
    attributes: { brand: 'MAC', color: 'Ruby Woo', type: 'Lipstick', finish: 'Matte', crueltyFree: false } },
  
  // Fragrances
  { name: 'Chanel No. 5 Eau de Parfum', price: 149.99, stock: 30, category: 'Beauty & Personal Care', subcategory: 'Fragrances',
    attributes: { brand: 'Chanel', scent: 'Floral', volume: '100ml', gender: 'Women' } },

  // ========== HEALTH & WELLNESS ==========
  // Vitamins & Supplements
  { name: 'Multivitamin Daily', price: 24.99, stock: 100, category: 'Health & Wellness', subcategory: 'Vitamins & Supplements',
    attributes: { brand: 'Nature Made', type: 'Multivitamin', quantity: '90 tablets', dosage: '1 tablet daily' } },
  
  // Fitness Equipment
  { name: 'Yoga Mat Premium', price: 39.99, stock: 50, category: 'Health & Wellness', subcategory: 'Yoga & Meditation',
    attributes: { brand: 'Manduka', type: 'Yoga Mat', thickness: '6mm', material: 'TPE' } },
  
  // Health Monitors
  { name: 'Fitbit Charge 6', price: 199.99, stock: 40, category: 'Health & Wellness', subcategory: 'Health Monitors',
    attributes: { brand: 'Fitbit', type: 'Activity Tracker', connectivity: 'Bluetooth' } },

  // ========== TOYS & GAMES ==========
  // Action Figures
  { name: 'Spider-Man Action Figure', price: 24.99, stock: 60, category: 'Toys & Games', subcategory: 'Action Figures',
    attributes: { brand: 'Hasbro', character: 'Spider-Man', scale: '6"', material: 'Plastic', ageRange: '4+' } },
  
  // Board Games
  { name: 'Settlers of Catan', price: 49.99, stock: 45, category: 'Toys & Games', subcategory: 'Board Games',
    attributes: { brand: 'Catan Studio', players: '3-4', ageRange: '10+', playTime: '60 minutes' } },
  
  // Puzzles
  { name: '1000 Piece Landscape Puzzle', price: 19.99, stock: 50, category: 'Toys & Games', subcategory: 'Puzzles',
    attributes: { brand: 'Ravensburger', pieces: '1000', ageRange: '12+', dimensions: '27" x 20"' } },

  // ========== AUTOMOTIVE ==========
  // Car Parts
  { name: 'Brake Pad Set - Front', price: 89.99, stock: 40, category: 'Automotive', subcategory: 'Car Parts',
    attributes: { brand: 'Bosch', partNumber: 'BC905', vehicleCompatibility: 'Honda Civic 2015-2020', type: 'Brake Pad' } },
  
  // Tires & Wheels
  { name: 'All-Season Tire Set', price: 599.99, stock: 20, category: 'Automotive', subcategory: 'Tires & Wheels',
    attributes: { brand: 'Michelin', size: '205/55R16', type: 'All-Season', loadIndex: '91' } },

  // ========== PET SUPPLIES ==========
  // Dog Supplies
  { name: 'Dog Toy Rope', price: 12.99, stock: 80, category: 'Pet Supplies', subcategory: 'Dog Supplies',
    attributes: { brand: 'Kong', type: 'Toy', size: 'Medium', material: 'Cotton Rope' } },
  
  // Pet Food
  { name: 'Premium Dog Food', price: 59.99, stock: 50, category: 'Pet Supplies', subcategory: 'Pet Food',
    attributes: { brand: 'Royal Canin', type: 'Dry', petType: 'Dog', weight: '30 lbs', lifeStage: 'Adult' } },

  // ========== OFFICE SUPPLIES ==========
  // Writing Supplies
  { name: 'Ballpoint Pen Pack', price: 8.99, stock: 100, category: 'Office Supplies', subcategory: 'Writing Supplies',
    attributes: { brand: 'Bic', type: 'Pen', color: 'Black', quantity: '12-pack' } },
  
  // Paper Products
  { name: 'Copy Paper Ream', price: 12.99, stock: 80, category: 'Office Supplies', subcategory: 'Paper Products',
    attributes: { brand: 'Hammermill', type: 'Copy Paper', size: 'Letter (8.5"x11")', quantity: '500 sheets' } },

  // ========== FOOD & BEVERAGES ==========
  // Snacks
  { name: 'Lay\'s Classic Chips', price: 4.99, stock: 150, category: 'Food & Beverages', subcategory: 'Snacks',
    attributes: { brand: 'Lay\'s', type: 'Chips', flavor: 'Original', weight: '200g' } },
  
  // Beverages
  { name: 'Coca-Cola 12-Pack', price: 7.99, stock: 100, category: 'Food & Beverages', subcategory: 'Beverages',
    attributes: { brand: 'Coca-Cola', type: 'Soda', flavor: 'Cola', volume: '355ml x 12' } },
  
  // Coffee & Tea
  { name: 'Starbucks Ground Coffee', price: 14.99, stock: 60, category: 'Food & Beverages', subcategory: 'Coffee & Tea',
    attributes: { brand: 'Starbucks', type: 'Ground Coffee', roast: 'Medium', weight: '340g' } },

  // ========== JEWELRY & WATCHES ==========
  // Necklaces
  { name: 'Sterling Silver Necklace', price: 149.99, stock: 30, category: 'Jewelry & Watches', subcategory: 'Necklaces',
    attributes: { brand: 'Pandora', material: 'Sterling Silver', color: 'Silver', length: '18"', gemstone: 'None' } },
  
  // Watches
  { name: 'Seiko Automatic Watch', price: 299.99, stock: 25, category: 'Jewelry & Watches', subcategory: 'Watches',
    attributes: { brand: 'Seiko', material: 'Stainless Steel', movement: 'Automatic', waterResistance: '100m', gender: 'Men' } },

  // ========== BABY & KIDS ==========
  // Baby Gear
  { name: 'Graco Stroller', price: 199.99, stock: 20, category: 'Baby & Kids', subcategory: 'Baby Gear',
    attributes: { brand: 'Graco', type: 'Stroller', ageRange: '0-36 months', color: 'Gray' } },
  
  // Diapers & Wipes
  { name: 'Pampers Diapers Size 2', price: 34.99, stock: 80, category: 'Baby & Kids', subcategory: 'Diapers & Wipes',
    attributes: { brand: 'Pampers', size: 'Size 2', quantity: '80 count', type: 'Disposable' } },

  // ========== TRAVEL & LUGGAGE ==========
  // Luggage
  { name: 'Samsonite Carry-On', price: 249.99, stock: 35, category: 'Travel & Luggage', subcategory: 'Luggage',
    attributes: { brand: 'Samsonite', type: 'Carry-On', size: '21"', material: 'Polycarbonate', capacity: '40L' } },
  
  // Backpacks
  { name: 'North Face Daypack', price: 89.99, stock: 40, category: 'Travel & Luggage', subcategory: 'Backpacks',
    attributes: { brand: 'North Face', type: 'Daypack', capacity: '30L', material: 'Nylon' } },
];

async function seedProducts15Categories() {
  try {
    console.log('🌱 Starting product seeding for 15 categories...\n');
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

    // Get all categories and subcategories
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: {
        subcategories: {
          where: { isActive: true },
        },
      },
    });

    const categoryMap = new Map();
    const subcategoryMap = new Map();

    for (const cat of categories) {
      categoryMap.set(cat.name, cat);
      for (const subcat of cat.subcategories) {
        subcategoryMap.set(`${cat.name}|${subcat.name}`, subcat);
      }
    }

    let productsCreated = 0;
    let productsSkipped = 0;

    // Create products
    for (const template of productTemplates) {
      const category = categoryMap.get(template.category);
      if (!category) {
        console.log(`⚠️  Category not found: ${template.category}`);
        productsSkipped++;
        continue;
      }

      const subcategory = subcategoryMap.get(`${template.category}|${template.subcategory}`);
      if (!subcategory) {
        console.log(`⚠️  Subcategory not found: ${template.subcategory} in ${template.category}`);
        productsSkipped++;
        continue;
      }

      // Generate SKU
      const sku = `PRD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Generate placeholder images (5 images)
      const images = Array.from({ length: 5 }, (_, i) => 
        `https://via.placeholder.com/800x600?text=${encodeURIComponent(template.name)}-${i + 1}`
      );

      try {
        await prisma.product.create({
          data: {
            name: template.name,
            description: template.description || `${template.name} - High quality product`,
            price: template.price,
            currency: 'CAD',
            stock: template.stock,
            sku,
            images,
            categoryId: category.id,
            subcategoryId: subcategory.id,
            vendorId: vendor.id,
            attributes: template.attributes || null,
            isActive: true,
          },
        });

        productsCreated++;
        console.log(`✅ Created: ${template.name} (${template.category} > ${template.subcategory}) - $${template.price} CAD`);
      } catch (error) {
        console.error(`❌ Error creating ${template.name}:`, error.message);
        productsSkipped++;
      }
    }

    console.log(`\n✅ Seeding complete!`);
    console.log(`   Products created: ${productsCreated}`);
    console.log(`   Products skipped: ${productsSkipped}\n`);

    await database.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding products:', error);
    await database.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  seedProducts15Categories();
}

module.exports = seedProducts15Categories;
