#!/usr/bin/env node
const database = require('../../config/database');

// 15 Categories with diverse subcategories
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
  {
    name: 'Automotive',
    slug: 'automotive',
    description: 'Automotive parts and accessories',
    subcategories: [
      { name: 'Car Parts', slug: 'car-parts' },
      { name: 'Accessories', slug: 'automotive-accessories' },
      { name: 'Tools & Equipment', slug: 'automotive-tools' },
      { name: 'Tires & Wheels', slug: 'tires-wheels' },
      { name: 'Interior', slug: 'automotive-interior' },
      { name: 'Exterior', slug: 'automotive-exterior' },
    ],
  },
  {
    name: 'Pet Supplies',
    slug: 'pet-supplies',
    description: 'Products for pets',
    subcategories: [
      { name: 'Dog Supplies', slug: 'dog-supplies' },
      { name: 'Cat Supplies', slug: 'cat-supplies' },
      { name: 'Fish & Aquarium', slug: 'fish-aquarium' },
      { name: 'Bird Supplies', slug: 'bird-supplies' },
      { name: 'Small Pets', slug: 'small-pets' },
      { name: 'Pet Food', slug: 'pet-food' },
    ],
  },
  {
    name: 'Office Supplies',
    slug: 'office-supplies',
    description: 'Office and stationery products',
    subcategories: [
      { name: 'Writing Supplies', slug: 'writing-supplies' },
      { name: 'Paper Products', slug: 'paper-products' },
      { name: 'Organizers', slug: 'organizers' },
      { name: 'Desk Accessories', slug: 'desk-accessories' },
      { name: 'Filing & Storage', slug: 'filing-storage' },
      { name: 'Office Furniture', slug: 'office-furniture' },
    ],
  },
  {
    name: 'Food & Beverages',
    slug: 'food-beverages',
    description: 'Food and drink products',
    subcategories: [
      { name: 'Snacks', slug: 'snacks' },
      { name: 'Beverages', slug: 'beverages' },
      { name: 'Gourmet Foods', slug: 'gourmet-foods' },
      { name: 'Organic Foods', slug: 'organic-foods' },
      { name: 'Coffee & Tea', slug: 'coffee-tea' },
      { name: 'Cooking Ingredients', slug: 'cooking-ingredients' },
    ],
  },
  {
    name: 'Jewelry & Watches',
    slug: 'jewelry-watches',
    description: 'Jewelry and timepieces',
    subcategories: [
      { name: 'Necklaces', slug: 'necklaces' },
      { name: 'Rings', slug: 'rings' },
      { name: 'Earrings', slug: 'earrings' },
      { name: 'Bracelets', slug: 'bracelets' },
      { name: 'Watches', slug: 'watches' },
      { name: 'Men\'s Jewelry', slug: 'mens-jewelry' },
    ],
  },
  {
    name: 'Baby & Kids',
    slug: 'baby-kids',
    description: 'Products for babies and children',
    subcategories: [
      { name: 'Baby Gear', slug: 'baby-gear' },
      { name: 'Diapers & Wipes', slug: 'diapers-wipes' },
      { name: 'Feeding', slug: 'baby-feeding' },
      { name: 'Nursery', slug: 'nursery' },
      { name: 'Safety', slug: 'baby-safety' },
      { name: 'Toys & Activities', slug: 'baby-toys' },
    ],
  },
  {
    name: 'Travel & Luggage',
    slug: 'travel-luggage',
    description: 'Travel accessories and luggage',
    subcategories: [
      { name: 'Luggage', slug: 'luggage' },
      { name: 'Backpacks', slug: 'backpacks' },
      { name: 'Travel Accessories', slug: 'travel-accessories' },
      { name: 'Travel Bags', slug: 'travel-bags' },
      { name: 'Packing Organizers', slug: 'packing-organizers' },
      { name: 'Travel Tech', slug: 'travel-tech' },
    ],
  },
];

async function seed15Categories() {
  try {
    console.log('🌱 Starting 15 categories and subcategories seeding...\n');
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
        categoriesCreated++;
        console.log(`✅ Category: ${catData.name}`);
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
        console.log(`🔄 Updated Category: ${catData.name}`);
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
          subcategoriesCreated++;
          console.log(`   └─ Subcategory: ${subcatData.name}`);
        } else {
          // Update existing subcategory
          await prisma.subcategory.update({
            where: { id: subcategory.id },
            data: {
              name: subcatData.name,
              slug: subcatData.slug,
              isActive: true,
            },
          });
          console.log(`   🔄 Updated Subcategory: ${subcatData.name}`);
        }
      }
    }

    console.log(`\n✅ Seeding complete!`);
    console.log(`   Categories: ${categories.length}`);
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
  seed15Categories();
}

module.exports = seed15Categories;
