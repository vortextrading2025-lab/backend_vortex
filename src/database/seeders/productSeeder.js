const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Sample data
const categories = [
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
    ],
  },
  {
    name: 'Clothing',
    slug: 'clothing',
    description: 'Apparel and fashion items',
    subcategories: [
      { name: 'Men\'s Clothing', slug: 'mens-clothing' },
      { name: 'Women\'s Clothing', slug: 'womens-clothing' },
      { name: 'Kids\' Clothing', slug: 'kids-clothing' },
      { name: 'Shoes', slug: 'shoes' },
      { name: 'Accessories', slug: 'accessories' },
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
    ],
  },
];

const productTemplates = [
  // Electronics
  { name: 'MacBook Pro 16"', price: 2499.99, stock: 15, category: 'Electronics', subcategory: 'Laptops', description: 'Powerful laptop for professionals' },
  { name: 'iPhone 15 Pro', price: 1299.99, stock: 25, category: 'Electronics', subcategory: 'Smartphones', description: 'Latest iPhone with advanced features' },
  { name: 'Samsung Galaxy Tab S9', price: 899.99, stock: 20, category: 'Electronics', subcategory: 'Tablets', description: 'Premium Android tablet' },
  { name: 'Sony WH-1000XM5 Headphones', price: 399.99, stock: 30, category: 'Electronics', subcategory: 'Headphones', description: 'Noise-cancelling wireless headphones' },
  { name: 'Canon EOS R6 Camera', price: 2499.99, stock: 10, category: 'Electronics', subcategory: 'Cameras', description: 'Professional mirrorless camera' },
  { name: 'Dell XPS 13', price: 1299.99, stock: 18, category: 'Electronics', subcategory: 'Laptops', description: 'Ultrabook for productivity' },
  { name: 'Google Pixel 8', price: 799.99, stock: 22, category: 'Electronics', subcategory: 'Smartphones', description: 'Flagship Android phone' },
  { name: 'iPad Air', price: 699.99, stock: 28, category: 'Electronics', subcategory: 'Tablets', description: 'Versatile tablet for work and play' },
  { name: 'Bose QuietComfort 45', price: 329.99, stock: 35, category: 'Electronics', subcategory: 'Headphones', description: 'Comfortable noise-cancelling headphones' },
  { name: 'Nikon D850 DSLR', price: 3299.99, stock: 8, category: 'Electronics', subcategory: 'Cameras', description: 'Professional DSLR camera' },

  // Clothing
  { name: 'Men\'s Classic Denim Jeans', price: 79.99, stock: 50, category: 'Clothing', subcategory: 'Men\'s Clothing', description: 'Comfortable classic fit jeans' },
  { name: 'Women\'s Summer Dress', price: 59.99, stock: 45, category: 'Clothing', subcategory: 'Women\'s Clothing', description: 'Light and breezy summer dress' },
  { name: 'Kids\' T-Shirt Pack', price: 24.99, stock: 60, category: 'Clothing', subcategory: 'Kids\' Clothing', description: 'Pack of 3 colorful t-shirts' },
  { name: 'Nike Air Max Running Shoes', price: 129.99, stock: 40, category: 'Clothing', subcategory: 'Shoes', description: 'Comfortable running shoes' },
  { name: 'Leather Belt', price: 49.99, stock: 55, category: 'Clothing', subcategory: 'Accessories', description: 'Genuine leather belt' },
  { name: 'Men\'s Polo Shirt', price: 39.99, stock: 48, category: 'Clothing', subcategory: 'Men\'s Clothing', description: 'Classic polo shirt' },
  { name: 'Women\'s Blazer', price: 89.99, stock: 35, category: 'Clothing', subcategory: 'Women\'s Clothing', description: 'Professional blazer' },
  { name: 'Kids\' Winter Jacket', price: 69.99, stock: 42, category: 'Clothing', subcategory: 'Kids\' Clothing', description: 'Warm winter jacket' },
  { name: 'Adidas Sneakers', price: 99.99, stock: 38, category: 'Clothing', subcategory: 'Shoes', description: 'Stylish sneakers' },
  { name: 'Designer Watch', price: 199.99, stock: 25, category: 'Clothing', subcategory: 'Accessories', description: 'Elegant timepiece' },

  // Home & Garden
  { name: 'Modern Sofa Set', price: 1299.99, stock: 12, category: 'Home & Garden', subcategory: 'Furniture', description: 'Comfortable 3-seater sofa' },
  { name: 'Stainless Steel Cookware Set', price: 199.99, stock: 30, category: 'Home & Garden', subcategory: 'Kitchen', description: '10-piece cookware set' },
  { name: 'Queen Size Bedding Set', price: 89.99, stock: 40, category: 'Home & Garden', subcategory: 'Bedding', description: 'Comfortable cotton bedding' },
  { name: 'Garden Tool Set', price: 79.99, stock: 35, category: 'Home & Garden', subcategory: 'Garden Tools', description: 'Essential gardening tools' },
  { name: 'Wall Art Canvas', price: 49.99, stock: 50, category: 'Home & Garden', subcategory: 'Decor', description: 'Modern wall art piece' },
  { name: 'Dining Table Set', price: 599.99, stock: 15, category: 'Home & Garden', subcategory: 'Furniture', description: '6-person dining set' },
  { name: 'Coffee Maker', price: 149.99, stock: 28, category: 'Home & Garden', subcategory: 'Kitchen', description: 'Programmable coffee maker' },
  { name: 'Memory Foam Mattress', price: 399.99, stock: 20, category: 'Home & Garden', subcategory: 'Bedding', description: 'Comfortable memory foam' },
  { name: 'Lawn Mower', price: 299.99, stock: 18, category: 'Home & Garden', subcategory: 'Garden Tools', description: 'Electric lawn mower' },
  { name: 'Decorative Vase Set', price: 34.99, stock: 45, category: 'Home & Garden', subcategory: 'Decor', description: 'Set of 3 decorative vases' },

  // Sports & Outdoors
  { name: 'Yoga Mat Premium', price: 39.99, stock: 50, category: 'Sports & Outdoors', subcategory: 'Fitness', description: 'Non-slip yoga mat' },
  { name: 'Camping Tent 4-Person', price: 199.99, stock: 25, category: 'Sports & Outdoors', subcategory: 'Camping', description: 'Spacious camping tent' },
  { name: 'Mountain Bike', price: 599.99, stock: 15, category: 'Sports & Outdoors', subcategory: 'Cycling', description: 'Durable mountain bike' },
  { name: 'Stand-Up Paddle Board', price: 449.99, stock: 12, category: 'Sports & Outdoors', subcategory: 'Water Sports', description: 'Inflatable SUP board' },
  { name: 'Ski Boots', price: 299.99, stock: 20, category: 'Sports & Outdoors', subcategory: 'Winter Sports', description: 'Professional ski boots' },
  { name: 'Dumbbell Set', price: 149.99, stock: 30, category: 'Sports & Outdoors', subcategory: 'Fitness', description: 'Adjustable dumbbell set' },
  { name: 'Sleeping Bag', price: 79.99, stock: 35, category: 'Sports & Outdoors', subcategory: 'Camping', description: 'Warm sleeping bag' },
  { name: 'Road Bike', price: 799.99, stock: 10, category: 'Sports & Outdoors', subcategory: 'Cycling', description: 'Lightweight road bike' },
  { name: 'Snorkel Set', price: 49.99, stock: 40, category: 'Sports & Outdoors', subcategory: 'Water Sports', description: 'Complete snorkel gear' },
  { name: 'Snowboard', price: 399.99, stock: 18, category: 'Sports & Outdoors', subcategory: 'Winter Sports', description: 'Professional snowboard' },

  // Books & Media
  { name: 'The Great Gatsby', price: 12.99, stock: 100, category: 'Books & Media', subcategory: 'Fiction', description: 'Classic American novel' },
  { name: 'Sapiens: A Brief History', price: 18.99, stock: 80, category: 'Books & Media', subcategory: 'Non-Fiction', description: 'History of humankind' },
  { name: 'Calculus Textbook', price: 89.99, stock: 60, category: 'Books & Media', subcategory: 'Textbooks', description: 'University calculus textbook' },
  { name: 'The Matrix 4K Blu-ray', price: 24.99, stock: 45, category: 'Books & Media', subcategory: 'Movies', description: '4K Ultra HD movie' },
  { name: 'Classical Music Collection', price: 19.99, stock: 55, category: 'Books & Media', subcategory: 'Music', description: 'Best of classical music' },
  { name: '1984 by George Orwell', price: 14.99, stock: 90, category: 'Books & Media', subcategory: 'Fiction', description: 'Dystopian classic' },
  { name: 'Atomic Habits', price: 16.99, stock: 75, category: 'Books & Media', subcategory: 'Non-Fiction', description: 'Self-improvement guide' },
  { name: 'Physics Textbook', price: 94.99, stock: 50, category: 'Books & Media', subcategory: 'Textbooks', description: 'University physics textbook' },
  { name: 'Inception 4K Blu-ray', price: 22.99, stock: 40, category: 'Books & Media', subcategory: 'Movies', description: '4K Ultra HD movie' },
  { name: 'Jazz Essentials Album', price: 17.99, stock: 50, category: 'Books & Media', subcategory: 'Music', description: 'Essential jazz collection' },
];

async function seedProducts() {
  try {
    console.log('🌱 Starting product seeding...');

    // Get all vendors
    const vendors = await prisma.user.findMany({
      where: { role: 'VENDOR' },
      include: { vendorProfile: true },
    });

    if (vendors.length === 0) {
      console.log('⚠️  No vendors found. Please create vendors first.');
      return;
    }

    console.log(`Found ${vendors.length} vendor(s)`);

    // Create categories and subcategories
    const createdCategories = [];
    for (const catData of categories) {
      const category = await prisma.category.upsert({
        where: { slug: catData.slug },
        update: {},
        create: {
          name: catData.name,
          slug: catData.slug,
          description: catData.description,
          isActive: true,
        },
      });

      const createdSubcategories = [];
      for (const subcatData of catData.subcategories) {
        const subcategory = await prisma.subcategory.upsert({
          where: {
            categoryId_slug: {
              categoryId: category.id,
              slug: subcatData.slug,
            },
          },
          update: {},
          create: {
            name: subcatData.name,
            slug: subcatData.slug,
            categoryId: category.id,
            isActive: true,
          },
        });
        createdSubcategories.push({ ...subcategory, categoryName: catData.name });
      }

      createdCategories.push({ ...category, subcategories: createdSubcategories });
    }

    console.log(`Created ${createdCategories.length} categories with subcategories`);

    // Create products
    let productCount = 0;
    for (let i = 0; i < productTemplates.length; i++) {
      const template = productTemplates[i];
      const category = createdCategories.find((c) => c.name === template.category);
      const subcategory = category?.subcategories.find((s) => s.name === template.subcategory);

      if (!category || !subcategory) {
        console.log(`⚠️  Skipping product: ${template.name} - category/subcategory not found`);
        continue;
      }

      // Assign to random vendor
      const vendor = vendors[Math.floor(Math.random() * vendors.length)];

      // Generate SKU
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      const sku = `PRD-${timestamp}-${random}-${i}`;

      // Create placeholder image URLs (in production, these would be real Firebase URLs)
      const images = Array(5).fill(null).map((_, idx) => 
        `https://via.placeholder.com/400x400?text=${encodeURIComponent(template.name)}-${idx + 1}`
      );

      try {
        await prisma.product.create({
          data: {
            name: template.name,
            description: template.description,
            price: template.price,
            currency: 'CAD',
            stock: template.stock,
            sku,
            images,
            isActive: true,
            vendorId: vendor.id,
            categoryId: category.id,
            subcategoryId: subcategory.id,
          },
        });
        productCount++;
      } catch (error) {
        console.error(`Error creating product ${template.name}:`, error.message);
      }
    }

    // Create additional products to reach 50
    const additionalProducts = 50 - productCount;
    if (additionalProducts > 0) {
      console.log(`Creating ${additionalProducts} additional products...`);
      
      for (let i = 0; i < additionalProducts; i++) {
        const randomCategory = createdCategories[Math.floor(Math.random() * createdCategories.length)];
        const randomSubcategory = randomCategory.subcategories[Math.floor(Math.random() * randomCategory.subcategories.length)];
        const vendor = vendors[Math.floor(Math.random() * vendors.length)];

        const productName = `${randomSubcategory.name} Product ${i + 1}`;
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        const sku = `PRD-${timestamp}-${random}-${i + productCount}`;

        const images = Array(5).fill(null).map((_, idx) => 
          `https://via.placeholder.com/400x400?text=${encodeURIComponent(productName)}-${idx + 1}`
        );

        try {
          await prisma.product.create({
            data: {
              name: productName,
              description: `Quality ${randomSubcategory.name.toLowerCase()} product`,
              price: Math.round((Math.random() * 500 + 10) * 100) / 100, // Random price between $10-$510
              currency: 'CAD',
              stock: Math.floor(Math.random() * 100) + 1,
              sku,
              images,
              isActive: true,
              vendorId: vendor.id,
              categoryId: randomCategory.id,
              subcategoryId: randomSubcategory.id,
            },
          });
          productCount++;
        } catch (error) {
          console.error(`Error creating additional product:`, error.message);
        }
      }
    }

    console.log(`✅ Successfully created ${productCount} products`);
    console.log('🎉 Product seeding completed!');
  } catch (error) {
    console.error('❌ Error seeding products:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seeder
if (require.main === module) {
  seedProducts()
    .then(() => {
      console.log('Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedProducts };
