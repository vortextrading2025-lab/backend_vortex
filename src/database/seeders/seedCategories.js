#!/usr/bin/env node
const database = require('../../config/database');

// Categories and subcategories definition
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

async function seedCategories() {
  try {
    console.log('🌱 Starting categories and subcategories seeding...\n');
    await database.connect();
    const prisma = database.getClient();

    if (!prisma) {
      throw new Error('Prisma client not available');
    }

    let categoriesCreated = 0;
    let subcategoriesCreated = 0;

    // Create categories and subcategories
    for (const catData of categories) {
      // Check if category exists by name or slug
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
      } else {
        // Update existing category
        category = await prisma.category.update({
          where: { id: category.id },
          data: {
            name: catData.name,
            slug: catData.slug,
            description: catData.description,
            isActive: true,
          },
        });
      }

      if (category) {
        categoriesCreated++;
        console.log(`✅ Category: ${catData.name}`);
      }

      // Create subcategories for this category
      for (const subcatData of catData.subcategories) {
        // Check if subcategory exists
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
        } else {
          // Update existing subcategory
          subcategory = await prisma.subcategory.update({
            where: { id: subcategory.id },
            data: {
              name: subcatData.name,
              slug: subcatData.slug,
              isActive: true,
            },
          });
        }

        if (subcategory) {
          subcategoriesCreated++;
          console.log(`   └─ Subcategory: ${subcatData.name}`);
        }
      }
    }

    console.log(`\n✅ Seeding complete!`);
    console.log(`   Categories created/updated: ${categoriesCreated}`);
    console.log(`   Subcategories created/updated: ${subcategoriesCreated}\n`);

    await database.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    await database.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  seedCategories();
}

module.exports = seedCategories;
