#!/usr/bin/env node
const database = require('../../config/database');

// Expanded product templates with diverse price ranges
const productTemplates = [
  // Electronics - Laptops (High-end: $800-$3500)
  { name: 'MacBook Pro 16" M3 Max', price: 3499.99, stock: 8, category: 'Electronics', subcategory: 'Laptops', description: 'Professional laptop with M3 Max chip, 32GB RAM, 1TB SSD' },
  { name: 'Dell XPS 15 OLED', price: 2199.99, stock: 12, category: 'Electronics', subcategory: 'Laptops', description: '15-inch OLED display, Intel i9, 32GB RAM' },
  { name: 'HP Spectre x360', price: 1499.99, stock: 15, category: 'Electronics', subcategory: 'Laptops', description: '2-in-1 convertible laptop, 13.5" touchscreen' },
  { name: 'Lenovo ThinkPad X1 Carbon', price: 1899.99, stock: 18, category: 'Electronics', subcategory: 'Laptops', description: 'Business laptop, lightweight, durable' },
  { name: 'ASUS ROG Strix G15', price: 1299.99, stock: 20, category: 'Electronics', subcategory: 'Laptops', description: 'Gaming laptop, RTX 4060, 16GB RAM' },
  { name: 'Acer Swift 3', price: 799.99, stock: 25, category: 'Electronics', subcategory: 'Laptops', description: 'Budget-friendly laptop, AMD Ryzen 7' },
  { name: 'Microsoft Surface Laptop 5', price: 1199.99, stock: 22, category: 'Electronics', subcategory: 'Laptops', description: 'Premium laptop, 13.5" PixelSense display' },
  { name: 'Razer Blade 14', price: 2499.99, stock: 10, category: 'Electronics', subcategory: 'Laptops', description: 'Compact gaming laptop, RTX 4070' },

  // Electronics - Smartphones (Mid to High: $300-$1500)
  { name: 'iPhone 15 Pro Max', price: 1499.99, stock: 30, category: 'Electronics', subcategory: 'Smartphones', description: 'Latest iPhone, 256GB, Titanium design' },
  { name: 'Samsung Galaxy S24 Ultra', price: 1399.99, stock: 28, category: 'Electronics', subcategory: 'Smartphones', description: 'Flagship Android, S Pen included' },
  { name: 'Google Pixel 8 Pro', price: 999.99, stock: 35, category: 'Electronics', subcategory: 'Smartphones', description: 'AI-powered camera, 128GB' },
  { name: 'OnePlus 12', price: 899.99, stock: 40, category: 'Electronics', subcategory: 'Smartphones', description: 'Fast charging, 256GB storage' },
  { name: 'Xiaomi 14 Pro', price: 799.99, stock: 32, category: 'Electronics', subcategory: 'Smartphones', description: 'Flagship specs, affordable price' },
  { name: 'Motorola Edge 40', price: 599.99, stock: 45, category: 'Electronics', subcategory: 'Smartphones', description: 'Mid-range phone, great camera' },
  { name: 'Samsung Galaxy A54', price: 449.99, stock: 50, category: 'Electronics', subcategory: 'Smartphones', description: 'Budget-friendly, 128GB' },
  { name: 'iPhone SE (3rd Gen)', price: 529.99, stock: 38, category: 'Electronics', subcategory: 'Smartphones', description: 'Compact iPhone, A15 chip' },

  // Electronics - Tablets ($200-$1200)
  { name: 'iPad Pro 12.9" M2', price: 1199.99, stock: 20, category: 'Electronics', subcategory: 'Tablets', description: 'Professional tablet, 256GB' },
  { name: 'Samsung Galaxy Tab S9 Ultra', price: 1099.99, stock: 18, category: 'Electronics', subcategory: 'Tablets', description: 'Large tablet, S Pen included' },
  { name: 'iPad Air 11"', price: 699.99, stock: 25, category: 'Electronics', subcategory: 'Tablets', description: 'Versatile tablet, M2 chip' },
  { name: 'Microsoft Surface Pro 9', price: 999.99, stock: 15, category: 'Electronics', subcategory: 'Tablets', description: '2-in-1 tablet, detachable keyboard' },
  { name: 'Lenovo Tab P12', price: 399.99, stock: 30, category: 'Electronics', subcategory: 'Tablets', description: 'Budget tablet, 12.6" display' },
  { name: 'Amazon Fire HD 10', price: 199.99, stock: 50, category: 'Electronics', subcategory: 'Tablets', description: 'Affordable tablet, 10.1" screen' },

  // Electronics - Headphones ($50-$500)
  { name: 'Sony WH-1000XM5', price: 449.99, stock: 35, category: 'Electronics', subcategory: 'Headphones', description: 'Premium noise-cancelling headphones' },
  { name: 'Apple AirPods Pro 2', price: 279.99, stock: 60, category: 'Electronics', subcategory: 'Headphones', description: 'Wireless earbuds, active noise cancellation' },
  { name: 'Bose QuietComfort 45', price: 379.99, stock: 40, category: 'Electronics', subcategory: 'Headphones', description: 'Comfortable noise-cancelling' },
  { name: 'Sennheiser Momentum 4', price: 399.99, stock: 28, category: 'Electronics', subcategory: 'Headphones', description: 'Premium sound quality' },
  { name: 'JBL Tune 770NC', price: 129.99, stock: 55, category: 'Electronics', subcategory: 'Headphones', description: 'Budget noise-cancelling headphones' },
  { name: 'Anker Soundcore Q30', price: 79.99, stock: 70, category: 'Electronics', subcategory: 'Headphones', description: 'Affordable ANC headphones' },

  // Electronics - Cameras ($300-$4000)
  { name: 'Canon EOS R6 Mark II', price: 2899.99, stock: 8, category: 'Electronics', subcategory: 'Cameras', description: 'Professional mirrorless camera' },
  { name: 'Sony A7 IV', price: 2499.99, stock: 10, category: 'Electronics', subcategory: 'Cameras', description: 'Full-frame mirrorless, 33MP' },
  { name: 'Nikon Z6 III', price: 2199.99, stock: 12, category: 'Electronics', subcategory: 'Cameras', description: 'Advanced mirrorless camera' },
  { name: 'Fujifilm X-T5', price: 1699.99, stock: 15, category: 'Electronics', subcategory: 'Cameras', description: 'APS-C mirrorless, 40MP' },
  { name: 'Canon EOS Rebel T8i', price: 749.99, stock: 25, category: 'Electronics', subcategory: 'Cameras', description: 'Entry-level DSLR camera' },
  { name: 'GoPro Hero 12', price: 499.99, stock: 30, category: 'Electronics', subcategory: 'Cameras', description: 'Action camera, 5.3K video' },

  // Clothing - Men's ($20-$300)
  { name: 'Men\'s Premium Dress Shirt', price: 89.99, stock: 50, category: 'Clothing', subcategory: 'Men\'s Clothing', description: 'Classic fit, 100% cotton' },
  { name: 'Men\'s Slim Fit Chinos', price: 69.99, stock: 60, category: 'Clothing', subcategory: 'Men\'s Clothing', description: 'Comfortable chino pants' },
  { name: 'Men\'s Wool Blazer', price: 199.99, stock: 35, category: 'Clothing', subcategory: 'Men\'s Clothing', description: 'Professional blazer, navy blue' },
  { name: 'Men\'s Casual T-Shirt Pack', price: 39.99, stock: 80, category: 'Clothing', subcategory: 'Men\'s Clothing', description: 'Pack of 3 basic tees' },
  { name: 'Men\'s Winter Parka', price: 249.99, stock: 30, category: 'Clothing', subcategory: 'Men\'s Clothing', description: 'Warm winter jacket, waterproof' },
  { name: 'Men\'s Athletic Shorts', price: 34.99, stock: 70, category: 'Clothing', subcategory: 'Men\'s Clothing', description: 'Moisture-wicking shorts' },

  // Clothing - Women's ($25-$350)
  { name: 'Women\'s Elegant Evening Dress', price: 149.99, stock: 40, category: 'Clothing', subcategory: 'Women\'s Clothing', description: 'Formal dress, various colors' },
  { name: 'Women\'s Professional Blazer', price: 119.99, stock: 45, category: 'Clothing', subcategory: 'Women\'s Clothing', description: 'Tailored blazer, black' },
  { name: 'Women\'s Summer Maxi Dress', price: 59.99, stock: 55, category: 'Clothing', subcategory: 'Women\'s Clothing', description: 'Lightweight, flowy dress' },
  { name: 'Women\'s Denim Jacket', price: 79.99, stock: 50, category: 'Clothing', subcategory: 'Women\'s Clothing', description: 'Classic denim jacket' },
  { name: 'Women\'s Yoga Leggings', price: 44.99, stock: 65, category: 'Clothing', subcategory: 'Women\'s Clothing', description: 'High-waisted, stretchy' },
  { name: 'Women\'s Cashmere Sweater', price: 179.99, stock: 35, category: 'Clothing', subcategory: 'Women\'s Clothing', description: 'Luxurious cashmere blend' },

  // Clothing - Kids' ($15-$80)
  { name: 'Kids\' Playground Set', price: 34.99, stock: 60, category: 'Clothing', subcategory: 'Kids\' Clothing', description: 'T-shirt and shorts set' },
  { name: 'Kids\' Winter Coat', price: 69.99, stock: 45, category: 'Clothing', subcategory: 'Kids\' Clothing', description: 'Warm, waterproof coat' },
  { name: 'Kids\' School Uniform', price: 49.99, stock: 50, category: 'Clothing', subcategory: 'Kids\' Clothing', description: 'Complete uniform set' },
  { name: 'Kids\' Pajama Set', price: 24.99, stock: 70, category: 'Clothing', subcategory: 'Kids\' Clothing', description: 'Comfortable sleepwear' },
  { name: 'Kids\' Rain Boots', price: 29.99, stock: 55, category: 'Clothing', subcategory: 'Kids\' Clothing', description: 'Colorful rain boots' },

  // Clothing - Shoes ($40-$250)
  { name: 'Nike Air Max 270', price: 149.99, stock: 40, category: 'Clothing', subcategory: 'Shoes', description: 'Comfortable running shoes' },
  { name: 'Adidas Ultraboost 22', price: 189.99, stock: 35, category: 'Clothing', subcategory: 'Shoes', description: 'Premium running shoes' },
  { name: 'Converse Chuck Taylor All Star', price: 64.99, stock: 60, category: 'Clothing', subcategory: 'Shoes', description: 'Classic canvas sneakers' },
  { name: 'Vans Old Skool', price: 69.99, stock: 55, category: 'Clothing', subcategory: 'Shoes', description: 'Iconic skate shoes' },
  { name: 'Dr. Martens 1460 Boots', price: 199.99, stock: 30, category: 'Clothing', subcategory: 'Shoes', description: 'Classic leather boots' },
  { name: 'New Balance 990v5', price: 184.99, stock: 38, category: 'Clothing', subcategory: 'Shoes', description: 'Made in USA running shoes' },

  // Clothing - Accessories ($15-$500)
  { name: 'Leather Wallet', price: 59.99, stock: 50, category: 'Clothing', subcategory: 'Accessories', description: 'Genuine leather, RFID blocking' },
  { name: 'Designer Sunglasses', price: 199.99, stock: 40, category: 'Clothing', subcategory: 'Accessories', description: 'UV protection, polarized' },
  { name: 'Stainless Steel Watch', price: 299.99, stock: 30, category: 'Clothing', subcategory: 'Accessories', description: 'Automatic movement watch' },
  { name: 'Leather Belt', price: 49.99, stock: 60, category: 'Clothing', subcategory: 'Accessories', description: 'Genuine leather, adjustable' },
  { name: 'Canvas Backpack', price: 79.99, stock: 45, category: 'Clothing', subcategory: 'Accessories', description: 'Durable, water-resistant' },
  { name: 'Silk Scarf', price: 89.99, stock: 35, category: 'Clothing', subcategory: 'Accessories', description: 'Luxurious silk, various patterns' },

  // Home & Garden - Furniture ($150-$2500)
  { name: 'Modern Sectional Sofa', price: 1899.99, stock: 8, category: 'Home & Garden', subcategory: 'Furniture', description: '3-piece sectional, fabric' },
  { name: 'Oak Dining Table Set', price: 799.99, stock: 12, category: 'Home & Garden', subcategory: 'Furniture', description: '6-person dining set' },
  { name: 'Ergonomic Office Chair', price: 349.99, stock: 25, category: 'Home & Garden', subcategory: 'Furniture', description: 'Adjustable, lumbar support' },
  { name: 'Platform Bed Frame', price: 449.99, stock: 20, category: 'Home & Garden', subcategory: 'Furniture', description: 'Queen size, modern design' },
  { name: 'Bookshelf Unit', price: 199.99, stock: 30, category: 'Home & Garden', subcategory: 'Furniture', description: '5-shelf storage unit' },
  { name: 'Coffee Table', price: 249.99, stock: 28, category: 'Home & Garden', subcategory: 'Furniture', description: 'Glass top, metal base' },

  // Home & Garden - Kitchen ($30-$600)
  { name: 'Stainless Steel Cookware Set', price: 299.99, stock: 25, category: 'Home & Garden', subcategory: 'Kitchen', description: '10-piece set, non-stick' },
  { name: 'Stand Mixer', price: 449.99, stock: 18, category: 'Home & Garden', subcategory: 'Kitchen', description: '5.5-quart, multiple attachments' },
  { name: 'Air Fryer XL', price: 149.99, stock: 35, category: 'Home & Garden', subcategory: 'Kitchen', description: '6-quart capacity, digital display' },
  { name: 'Coffee Maker Programmable', price: 89.99, stock: 40, category: 'Home & Garden', subcategory: 'Kitchen', description: '12-cup, auto-shutoff' },
  { name: 'Knife Block Set', price: 199.99, stock: 30, category: 'Home & Garden', subcategory: 'Kitchen', description: '8-piece chef knife set' },
  { name: 'Food Processor', price: 129.99, stock: 28, category: 'Home & Garden', subcategory: 'Kitchen', description: '10-cup capacity, multiple blades' },

  // Home & Garden - Bedding ($40-$400)
  { name: 'Queen Size Comforter Set', price: 129.99, stock: 35, category: 'Home & Garden', subcategory: 'Bedding', description: 'Down alternative, includes sheets' },
  { name: 'Memory Foam Pillow', price: 49.99, stock: 50, category: 'Home & Garden', subcategory: 'Bedding', description: 'Cooling gel, adjustable' },
  { name: 'Egyptian Cotton Sheets', price: 89.99, stock: 40, category: 'Home & Garden', subcategory: 'Bedding', description: '1000 thread count, queen' },
  { name: 'Weighted Blanket', price: 79.99, stock: 30, category: 'Home & Garden', subcategory: 'Bedding', description: '15lb, calming effect' },
  { name: 'Duvet Cover Set', price: 69.99, stock: 45, category: 'Home & Garden', subcategory: 'Bedding', description: 'Reversible, includes pillowcases' },

  // Home & Garden - Garden Tools ($25-$300)
  { name: 'Electric Lawn Mower', price: 349.99, stock: 15, category: 'Home & Garden', subcategory: 'Garden Tools', description: 'Cordless, 21-inch deck' },
  { name: 'Garden Tool Set', price: 89.99, stock: 30, category: 'Home & Garden', subcategory: 'Garden Tools', description: '8-piece stainless steel set' },
  { name: 'Hose Reel Cart', price: 79.99, stock: 25, category: 'Home & Garden', subcategory: 'Garden Tools', description: '200ft capacity, wheels' },
  { name: 'Pruning Shears', price: 34.99, stock: 40, category: 'Home & Garden', subcategory: 'Garden Tools', description: 'Professional grade, bypass' },
  { name: 'Garden Gloves Set', price: 24.99, stock: 50, category: 'Home & Garden', subcategory: 'Garden Tools', description: '3 pairs, durable' },

  // Home & Garden - Decor ($20-$200)
  { name: 'Wall Art Canvas Set', price: 79.99, stock: 40, category: 'Home & Garden', subcategory: 'Decor', description: '3-piece abstract art' },
  { name: 'Decorative Throw Pillows', price: 34.99, stock: 55, category: 'Home & Garden', subcategory: 'Decor', description: 'Set of 2, various patterns' },
  { name: 'Table Lamp', price: 59.99, stock: 35, category: 'Home & Garden', subcategory: 'Decor', description: 'Modern design, LED bulb included' },
  { name: 'Area Rug', price: 149.99, stock: 25, category: 'Home & Garden', subcategory: 'Decor', description: '5x7 feet, machine washable' },
  { name: 'Vase Set', price: 44.99, stock: 45, category: 'Home & Garden', subcategory: 'Decor', description: 'Set of 3, ceramic' },

  // Sports & Outdoors - Fitness ($30-$800)
  { name: 'Adjustable Dumbbell Set', price: 299.99, stock: 20, category: 'Sports & Outdoors', subcategory: 'Fitness', description: '5-50lbs per dumbbell' },
  { name: 'Yoga Mat Premium', price: 49.99, stock: 50, category: 'Sports & Outdoors', subcategory: 'Fitness', description: 'Non-slip, extra thick' },
  { name: 'Treadmill', price: 799.99, stock: 8, category: 'Sports & Outdoors', subcategory: 'Fitness', description: 'Folding, 12 programs' },
  { name: 'Resistance Band Set', price: 34.99, stock: 60, category: 'Sports & Outdoors', subcategory: 'Fitness', description: '5 bands, various resistance' },
  { name: 'Pull-Up Bar', price: 39.99, stock: 45, category: 'Sports & Outdoors', subcategory: 'Fitness', description: 'Doorway mount, adjustable' },

  // Sports & Outdoors - Camping ($50-$500)
  { name: '4-Person Camping Tent', price: 249.99, stock: 18, category: 'Sports & Outdoors', subcategory: 'Camping', description: 'Weatherproof, easy setup' },
  { name: 'Sleeping Bag', price: 89.99, stock: 30, category: 'Sports & Outdoors', subcategory: 'Camping', description: '20°F rating, mummy style' },
  { name: 'Camping Stove', price: 79.99, stock: 25, category: 'Sports & Outdoors', subcategory: 'Camping', description: 'Portable, propane' },
  { name: 'Cooler 50QT', price: 129.99, stock: 22, category: 'Sports & Outdoors', subcategory: 'Camping', description: 'Insulated, ice retention' },
  { name: 'Camping Chair', price: 44.99, stock: 40, category: 'Sports & Outdoors', subcategory: 'Camping', description: 'Folding, lightweight' },

  // Sports & Outdoors - Cycling ($200-$2500)
  { name: 'Mountain Bike', price: 699.99, stock: 12, category: 'Sports & Outdoors', subcategory: 'Cycling', description: '27.5" wheels, disc brakes' },
  { name: 'Road Bike', price: 999.99, stock: 10, category: 'Sports & Outdoors', subcategory: 'Cycling', description: 'Lightweight, carbon frame' },
  { name: 'Bike Helmet', price: 59.99, stock: 50, category: 'Sports & Outdoors', subcategory: 'Cycling', description: 'MIPS protection, adjustable' },
  { name: 'Bike Lock', price: 34.99, stock: 60, category: 'Sports & Outdoors', subcategory: 'Cycling', description: 'U-lock, key included' },
  { name: 'Bike Pump', price: 29.99, stock: 55, category: 'Sports & Outdoors', subcategory: 'Cycling', description: 'Floor pump, pressure gauge' },

  // Sports & Outdoors - Water Sports ($80-$600)
  { name: 'Stand-Up Paddle Board', price: 499.99, stock: 15, category: 'Sports & Outdoors', subcategory: 'Water Sports', description: 'Inflatable, 10.6 feet' },
  { name: 'Snorkel Set', price: 59.99, stock: 40, category: 'Sports & Outdoors', subcategory: 'Water Sports', description: 'Complete set, dry top' },
  { name: 'Kayak', price: 599.99, stock: 10, category: 'Sports & Outdoors', subcategory: 'Water Sports', description: 'Sit-on-top, 10 feet' },
  { name: 'Life Jacket', price: 79.99, stock: 35, category: 'Sports & Outdoors', subcategory: 'Water Sports', description: 'USCG approved, adult' },
  { name: 'Waterproof Dry Bag', price: 34.99, stock: 50, category: 'Sports & Outdoors', subcategory: 'Water Sports', description: '20L capacity, roll-top' },

  // Sports & Outdoors - Winter Sports ($150-$800)
  { name: 'Snowboard', price: 449.99, stock: 18, category: 'Sports & Outdoors', subcategory: 'Winter Sports', description: 'All-mountain, 158cm' },
  { name: 'Ski Boots', price: 349.99, stock: 20, category: 'Sports & Outdoors', subcategory: 'Winter Sports', description: 'Heat-moldable, adjustable' },
  { name: 'Ski Goggles', price: 89.99, stock: 35, category: 'Sports & Outdoors', subcategory: 'Winter Sports', description: 'Anti-fog, UV protection' },
  { name: 'Ski Poles', price: 79.99, stock: 30, category: 'Sports & Outdoors', subcategory: 'Winter Sports', description: 'Aluminum, adjustable' },
  { name: 'Winter Gloves', price: 49.99, stock: 45, category: 'Sports & Outdoors', subcategory: 'Winter Sports', description: 'Insulated, waterproof' },

  // Books & Media - Fiction ($10-$30)
  { name: 'The Great Gatsby', price: 14.99, stock: 100, category: 'Books & Media', subcategory: 'Fiction', description: 'Classic American novel, paperback' },
  { name: '1984 by George Orwell', price: 16.99, stock: 90, category: 'Books & Media', subcategory: 'Fiction', description: 'Dystopian classic, hardcover' },
  { name: 'To Kill a Mockingbird', price: 13.99, stock: 95, category: 'Books & Media', subcategory: 'Fiction', description: 'Harper Lee masterpiece' },
  { name: 'The Catcher in the Rye', price: 15.99, stock: 85, category: 'Books & Media', subcategory: 'Fiction', description: 'J.D. Salinger classic' },
  { name: 'Pride and Prejudice', price: 12.99, stock: 100, category: 'Books & Media', subcategory: 'Fiction', description: 'Jane Austen novel' },

  // Books & Media - Non-Fiction ($15-$50)
  { name: 'Sapiens: A Brief History', price: 19.99, stock: 80, category: 'Books & Media', subcategory: 'Non-Fiction', description: 'History of humankind' },
  { name: 'Atomic Habits', price: 17.99, stock: 75, category: 'Books & Media', subcategory: 'Non-Fiction', description: 'Self-improvement guide' },
  { name: 'The 7 Habits of Highly Effective People', price: 18.99, stock: 70, category: 'Books & Media', subcategory: 'Non-Fiction', description: 'Personal development classic' },
  { name: 'Educated', price: 16.99, stock: 65, category: 'Books & Media', subcategory: 'Non-Fiction', description: 'Memoir by Tara Westover' },
  { name: 'Becoming', price: 19.99, stock: 60, category: 'Books & Media', subcategory: 'Non-Fiction', description: 'Michelle Obama memoir' },

  // Books & Media - Textbooks ($50-$150)
  { name: 'Calculus: Early Transcendentals', price: 129.99, stock: 50, category: 'Books & Media', subcategory: 'Textbooks', description: 'University calculus textbook' },
  { name: 'Physics for Scientists and Engineers', price: 149.99, stock: 45, category: 'Books & Media', subcategory: 'Textbooks', description: 'University physics textbook' },
  { name: 'Organic Chemistry', price: 119.99, stock: 40, category: 'Books & Media', subcategory: 'Textbooks', description: 'Chemistry textbook, 8th edition' },
  { name: 'Introduction to Psychology', price: 99.99, stock: 55, category: 'Books & Media', subcategory: 'Textbooks', description: 'Psychology textbook' },
  { name: 'Principles of Economics', price: 109.99, stock: 48, category: 'Books & Media', subcategory: 'Textbooks', description: 'Economics textbook' },

  // Books & Media - Movies ($15-$35)
  { name: 'The Matrix 4K Blu-ray', price: 24.99, stock: 45, category: 'Books & Media', subcategory: 'Movies', description: '4K Ultra HD, includes digital copy' },
  { name: 'Inception 4K Blu-ray', price: 22.99, stock: 40, category: 'Books & Media', subcategory: 'Movies', description: '4K Ultra HD movie' },
  { name: 'The Dark Knight 4K', price: 26.99, stock: 38, category: 'Books & Media', subcategory: 'Movies', description: '4K Ultra HD, Christopher Nolan' },
  { name: 'Interstellar 4K', price: 24.99, stock: 35, category: 'Books & Media', subcategory: 'Movies', description: '4K Ultra HD, sci-fi epic' },
  { name: 'Blade Runner 2049 4K', price: 23.99, stock: 32, category: 'Books & Media', subcategory: 'Movies', description: '4K Ultra HD, director\'s cut' },

  // Books & Media - Music ($12-$25)
  { name: 'Classical Music Collection', price: 19.99, stock: 55, category: 'Books & Media', subcategory: 'Music', description: 'Best of classical music, 2CD set' },
  { name: 'Jazz Essentials Album', price: 17.99, stock: 50, category: 'Books & Media', subcategory: 'Music', description: 'Essential jazz collection' },
  { name: 'Rock Legends Compilation', price: 18.99, stock: 48, category: 'Books & Media', subcategory: 'Music', description: 'Greatest rock hits, 3CD' },
  { name: 'Hip Hop Classics', price: 16.99, stock: 45, category: 'Books & Media', subcategory: 'Music', description: 'Classic hip hop tracks' },
  { name: 'Electronic Dance Music Mix', price: 14.99, stock: 52, category: 'Books & Media', subcategory: 'Music', description: 'EDM compilation, 2CD' },
];

async function seed100Products() {
  try {
    console.log('🌱 Starting 100 products seeding...\n');
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

    // Get or create categories and subcategories
    const categoryMap = new Map();
    const subcategoryMap = new Map();

    // Extract unique categories and subcategories from templates
    const uniqueCategories = [...new Set(productTemplates.map(p => p.category))];
    const uniqueSubcategories = [...new Set(productTemplates.map(p => ({ category: p.category, subcategory: p.subcategory })))];

    // Create categories
    for (const catName of uniqueCategories) {
      const slug = catName.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
      const category = await prisma.category.upsert({
        where: { slug },
        update: {},
        create: {
          name: catName,
          slug,
          description: `${catName} products`,
          isActive: true,
        },
      });
      categoryMap.set(catName, category);
      console.log(`✅ Category: ${catName}`);
    }

    // Create subcategories
    for (const { category, subcategory } of uniqueSubcategories) {
      const parentCategory = categoryMap.get(category);
      if (!parentCategory) continue;

      const slug = subcategory.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '').replace(/&/g, 'and');
      const subcat = await prisma.subcategory.upsert({
        where: {
          categoryId_slug: {
            categoryId: parentCategory.id,
            slug,
          },
        },
        update: {},
        create: {
          name: subcategory,
          slug,
          categoryId: parentCategory.id,
          isActive: true,
        },
      });
      subcategoryMap.set(`${category}::${subcategory}`, subcat);
    }

    console.log(`\n✅ Categories and subcategories ready\n`);

    // Create products
    let createdCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < productTemplates.length && createdCount < 100; i++) {
      const template = productTemplates[i];
      const category = categoryMap.get(template.category);
      const subcategory = subcategoryMap.get(`${template.category}::${template.subcategory}`);

      if (!category || !subcategory) {
        console.log(`⚠️  Skipping: ${template.name} - category/subcategory not found`);
        skippedCount++;
        continue;
      }

      // Generate unique SKU
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      const sku = `PRD-${timestamp}-${random}-${i}`;

      // Create placeholder image URLs (5 images per product)
      const images = Array(5).fill(null).map((_, idx) => 
        `https://via.placeholder.com/400x400/4A90E2/FFFFFF?text=${encodeURIComponent(template.name.replace(/\s+/g, '+'))}+${idx + 1}`
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
        createdCount++;
        if (createdCount % 10 === 0) {
          console.log(`   Created ${createdCount} products...`);
        }
      } catch (error) {
        console.error(`❌ Error creating product ${template.name}:`, error.message);
        skippedCount++;
      }
    }

    // If we need more products to reach 100, duplicate some with variations
    if (createdCount < 100) {
      const needed = 100 - createdCount;
      console.log(`\n📦 Creating ${needed} additional products to reach 100...\n`);
      
      // Get some existing products to create variations
      const existingProducts = await prisma.product.findMany({
        take: Math.min(needed, 20),
        orderBy: { createdAt: 'desc' },
      });

      for (let i = 0; i < needed && i < existingProducts.length; i++) {
        const base = existingProducts[i];
        const variation = Math.floor(Math.random() * 1000);
        const timestamp = Date.now();
        const sku = `PRD-${timestamp}-${variation}-V${i}`;

        const images = Array(5).fill(null).map((_, idx) => 
          `https://via.placeholder.com/400x400/4A90E2/FFFFFF?text=${encodeURIComponent(base.name.replace(/\s+/g, '+'))}+Variant+${idx + 1}`
        );

        try {
          await prisma.product.create({
            data: {
              name: `${base.name} (Variant ${variation})`,
              description: `${base.description} - Special variant edition`,
              price: base.price * (0.9 + Math.random() * 0.2), // 90-110% of original price
              currency: 'CAD',
              stock: Math.floor(Math.random() * 50) + 10,
              sku,
              images,
              isActive: true,
              vendorId: vendor.id,
              categoryId: base.categoryId,
              subcategoryId: base.subcategoryId,
            },
          });
          createdCount++;
        } catch (error) {
          console.error(`❌ Error creating variant:`, error.message);
          skippedCount++;
        }
      }
    }

    console.log(`\n✅ Seeding complete!`);
    console.log(`   Created: ${createdCount} products`);
    console.log(`   Skipped: ${skippedCount} products`);
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
  seed100Products();
}

module.exports = seed100Products;
