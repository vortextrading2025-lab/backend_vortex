/**
 * Category-specific product attribute definitions
 * Each category/subcategory can have different required/optional attributes
 * Updated for 15 categories
 */

const attributeDefinitions = {
  // Electronics category
  'Electronics': {
    'Laptops': {
      brand: { type: 'string', required: true, label: 'Brand', placeholder: 'e.g., Apple, Dell, HP' },
      model: { type: 'string', required: true, label: 'Model', placeholder: 'e.g., MacBook Pro, XPS 13' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., Silver, Space Gray' },
      screenSize: { type: 'string', required: false, label: 'Screen Size', placeholder: 'e.g., 13", 15", 16"' },
      ram: { type: 'string', required: false, label: 'RAM', placeholder: 'e.g., 8GB, 16GB, 32GB' },
      storage: { type: 'string', required: false, label: 'Storage', placeholder: 'e.g., 256GB SSD, 512GB SSD' },
      processor: { type: 'string', required: false, label: 'Processor', placeholder: 'e.g., M3, Intel i7, AMD Ryzen 7' },
    },
    'Smartphones': {
      brand: { type: 'string', required: true, label: 'Brand', placeholder: 'e.g., Apple, Samsung, Google' },
      model: { type: 'string', required: true, label: 'Model', placeholder: 'e.g., iPhone 15, Galaxy S24' },
      color: { type: 'string', required: true, label: 'Color', placeholder: 'e.g., Black, White, Blue' },
      storage: { type: 'string', required: true, label: 'Storage', placeholder: 'e.g., 128GB, 256GB, 512GB' },
      screenSize: { type: 'string', required: false, label: 'Screen Size', placeholder: 'e.g., 6.1", 6.7"' },
      batteryCapacity: { type: 'string', required: false, label: 'Battery Capacity', placeholder: 'e.g., 4000mAh' },
    },
    'Tablets': {
      brand: { type: 'string', required: true, label: 'Brand', placeholder: 'e.g., Apple, Samsung, Microsoft' },
      model: { type: 'string', required: true, label: 'Model', placeholder: 'e.g., iPad Air, Galaxy Tab' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., Silver, Space Gray' },
      screenSize: { type: 'string', required: false, label: 'Screen Size', placeholder: 'e.g., 10.9", 12.9"' },
      storage: { type: 'string', required: false, label: 'Storage', placeholder: 'e.g., 64GB, 128GB, 256GB' },
    },
    'Headphones': {
      brand: { type: 'string', required: true, label: 'Brand', placeholder: 'e.g., Sony, Bose, Apple' },
      model: { type: 'string', required: false, label: 'Model', placeholder: 'e.g., WH-1000XM5, QuietComfort 45' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., Black, White, Blue' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Over-ear, In-ear, On-ear' },
      wireless: { type: 'boolean', required: false, label: 'Wireless', placeholder: 'Yes/No' },
      noiseCancelling: { type: 'boolean', required: false, label: 'Noise Cancelling', placeholder: 'Yes/No' },
    },
    'Cameras': {
      brand: { type: 'string', required: true, label: 'Brand', placeholder: 'e.g., Canon, Nikon, Sony' },
      model: { type: 'string', required: true, label: 'Model', placeholder: 'e.g., EOS R6, A7 IV' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., DSLR, Mirrorless, Point & Shoot' },
      megapixels: { type: 'string', required: false, label: 'Megapixels', placeholder: 'e.g., 24MP, 33MP' },
      lensMount: { type: 'string', required: false, label: 'Lens Mount', placeholder: 'e.g., EF, RF, E-mount' },
    },
    'Smart Watches': {
      brand: { type: 'string', required: true, label: 'Brand', placeholder: 'e.g., Apple, Samsung, Garmin' },
      model: { type: 'string', required: true, label: 'Model', placeholder: 'e.g., Apple Watch Series 9, Galaxy Watch' },
      color: { type: 'string', required: true, label: 'Color', placeholder: 'e.g., Black, Silver, Gold' },
      size: { type: 'string', required: true, label: 'Size', placeholder: 'e.g., 41mm, 45mm, 42mm' },
      connectivity: { type: 'string', required: false, label: 'Connectivity', placeholder: 'e.g., GPS, Cellular, Bluetooth' },
    },
  },

  // Clothing & Apparel category
  'Clothing & Apparel': {
    'Men\'s Clothing': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Nike, Adidas, Levi\'s' },
      color: { type: 'string', required: true, label: 'Color', placeholder: 'e.g., Black, Blue, White' },
      size: { type: 'string', required: true, label: 'Size', placeholder: 'e.g., S, M, L, XL, XXL' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Cotton, Polyester, Blend' },
      fit: { type: 'string', required: false, label: 'Fit', placeholder: 'e.g., Regular, Slim, Relaxed' },
      style: { type: 'string', required: false, label: 'Style', placeholder: 'e.g., Casual, Formal, Athletic' },
    },
    'Women\'s Clothing': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Zara, H&M, Forever 21' },
      color: { type: 'string', required: true, label: 'Color', placeholder: 'e.g., Black, Pink, White' },
      size: { type: 'string', required: true, label: 'Size', placeholder: 'e.g., XS, S, M, L, XL' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Cotton, Silk, Polyester' },
      fit: { type: 'string', required: false, label: 'Fit', placeholder: 'e.g., Regular, Slim, Loose' },
      pattern: { type: 'string', required: false, label: 'Pattern', placeholder: 'e.g., Solid, Striped, Floral' },
    },
    'Kids\' Clothing': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Carter\'s, OshKosh' },
      color: { type: 'string', required: true, label: 'Color', placeholder: 'e.g., Red, Blue, Yellow' },
      size: { type: 'string', required: true, label: 'Size', placeholder: 'e.g., 2T, 4T, 6, 8, 10' },
      ageRange: { type: 'string', required: false, label: 'Age Range', placeholder: 'e.g., 2-4 years, 5-7 years' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Cotton, Polyester' },
    },
    'Shoes': {
      brand: { type: 'string', required: true, label: 'Brand', placeholder: 'e.g., Nike, Adidas, Puma' },
      color: { type: 'string', required: true, label: 'Color', placeholder: 'e.g., Black, White, Red' },
      size: { type: 'string', required: true, label: 'Size', placeholder: 'e.g., 7, 8, 9, 10, 11' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Running, Casual, Formal' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Leather, Canvas, Synthetic' },
    },
    'Accessories': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Fossil, Timex, Generic' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., Black, Brown, Silver' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Leather, Metal, Plastic' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Watch, Belt, Sunglasses' },
    },
    'Activewear': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Nike, Under Armour, Lululemon' },
      color: { type: 'string', required: true, label: 'Color', placeholder: 'e.g., Black, Blue, Pink' },
      size: { type: 'string', required: true, label: 'Size', placeholder: 'e.g., S, M, L, XL' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Polyester, Spandex, Blend' },
      moistureWicking: { type: 'boolean', required: false, label: 'Moisture Wicking', placeholder: 'Yes/No' },
    },
  },

  // Home & Garden category
  'Home & Garden': {
    'Furniture': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., IKEA, Ashley, Generic' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., Brown, Black, White' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Wood, Metal, Fabric' },
      dimensions: { type: 'string', required: false, label: 'Dimensions', placeholder: 'e.g., 60" x 30" x 18"' },
      weight: { type: 'string', required: false, label: 'Weight', placeholder: 'e.g., 50 lbs' },
      assemblyRequired: { type: 'boolean', required: false, label: 'Assembly Required', placeholder: 'Yes/No' },
    },
    'Kitchen': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Cuisinart, KitchenAid' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., Silver, Black, White' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Stainless Steel, Ceramic' },
      capacity: { type: 'string', required: false, label: 'Capacity', placeholder: 'e.g., 5.5 quarts, 10 cups' },
      dishwasherSafe: { type: 'boolean', required: false, label: 'Dishwasher Safe', placeholder: 'Yes/No' },
    },
    'Bedding': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Mellanni, Utopia' },
      color: { type: 'string', required: true, label: 'Color', placeholder: 'e.g., White, Beige, Gray' },
      size: { type: 'string', required: true, label: 'Size', placeholder: 'e.g., Twin, Full, Queen, King' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Cotton, Microfiber, Bamboo' },
      threadCount: { type: 'string', required: false, label: 'Thread Count', placeholder: 'e.g., 300, 600, 1000' },
    },
    'Garden Tools': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Fiskars, Corona' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Steel, Aluminum' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Hand Tool, Power Tool' },
      handleLength: { type: 'string', required: false, label: 'Handle Length', placeholder: 'e.g., 28", 32"' },
    },
    'Decor': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Generic, Brand Name' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., Multi-color, Black, White' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Canvas, Metal, Wood' },
      dimensions: { type: 'string', required: false, label: 'Dimensions', placeholder: 'e.g., 24" x 36"' },
    },
    'Lighting': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Philips, GE, Generic' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., White, Warm White, Cool White' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., LED, Incandescent, Fluorescent' },
      wattage: { type: 'string', required: false, label: 'Wattage', placeholder: 'e.g., 60W, 100W equivalent' },
      dimmable: { type: 'boolean', required: false, label: 'Dimmable', placeholder: 'Yes/No' },
    },
  },

  // Sports & Outdoors category
  'Sports & Outdoors': {
    'Fitness': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Nike, Under Armour' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., Black, Blue, Pink' },
      size: { type: 'string', required: false, label: 'Size', placeholder: 'e.g., Small, Medium, Large' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., PVC, TPE, Rubber' },
      weight: { type: 'string', required: false, label: 'Weight', placeholder: 'e.g., 5 lbs, 10 lbs' },
    },
    'Camping': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Coleman, REI' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., Green, Blue, Gray' },
      capacity: { type: 'string', required: false, label: 'Capacity', placeholder: 'e.g., 2-person, 4-person' },
      weight: { type: 'string', required: false, label: 'Weight', placeholder: 'e.g., 5 lbs, 10 lbs' },
      waterproof: { type: 'boolean', required: false, label: 'Waterproof', placeholder: 'Yes/No' },
    },
    'Cycling': {
      brand: { type: 'string', required: true, label: 'Brand', placeholder: 'e.g., Trek, Specialized, Giant' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., Red, Black, Blue' },
      size: { type: 'string', required: false, label: 'Size', placeholder: 'e.g., Small, Medium, Large' },
      frameMaterial: { type: 'string', required: false, label: 'Frame Material', placeholder: 'e.g., Aluminum, Carbon' },
      wheelSize: { type: 'string', required: false, label: 'Wheel Size', placeholder: 'e.g., 26", 27.5", 29"' },
    },
    'Water Sports': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Body Glove, Cressi' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., Blue, Black, Yellow' },
      size: { type: 'string', required: false, label: 'Size', placeholder: 'e.g., Small, Medium, Large' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Snorkel, Paddle Board, Kayak' },
    },
    'Winter Sports': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Burton, Salomon' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., Black, White, Multi' },
      size: { type: 'string', required: true, label: 'Size', placeholder: 'e.g., S, M, L, XL' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Gore-Tex, Nylon' },
    },
    'Team Sports': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Wilson, Spalding, Nike' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., Orange, Brown, White' },
      size: { type: 'string', required: false, label: 'Size', placeholder: 'e.g., Size 5, Size 7, Official' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Leather, Synthetic, Rubber' },
    },
  },

  // Books & Media category
  'Books & Media': {
    'Fiction': {
      author: { type: 'string', required: false, label: 'Author', placeholder: 'e.g., John Doe' },
      publisher: { type: 'string', required: false, label: 'Publisher', placeholder: 'e.g., Penguin Random House' },
      isbn: { type: 'string', required: false, label: 'ISBN', placeholder: 'e.g., 978-0-123456-78-9' },
      format: { type: 'string', required: false, label: 'Format', placeholder: 'e.g., Hardcover, Paperback, eBook' },
      pages: { type: 'string', required: false, label: 'Pages', placeholder: 'e.g., 300 pages' },
    },
    'Non-Fiction': {
      author: { type: 'string', required: false, label: 'Author', placeholder: 'e.g., Jane Smith' },
      publisher: { type: 'string', required: false, label: 'Publisher', placeholder: 'e.g., HarperCollins' },
      isbn: { type: 'string', required: false, label: 'ISBN', placeholder: 'e.g., 978-0-123456-78-9' },
      format: { type: 'string', required: false, label: 'Format', placeholder: 'e.g., Hardcover, Paperback' },
      pages: { type: 'string', required: false, label: 'Pages', placeholder: 'e.g., 400 pages' },
    },
    'Textbooks': {
      author: { type: 'string', required: false, label: 'Author', placeholder: 'e.g., Dr. Robert Johnson' },
      publisher: { type: 'string', required: false, label: 'Publisher', placeholder: 'e.g., Pearson, McGraw-Hill' },
      isbn: { type: 'string', required: false, label: 'ISBN', placeholder: 'e.g., 978-0-123456-78-9' },
      edition: { type: 'string', required: false, label: 'Edition', placeholder: 'e.g., 5th Edition' },
      subject: { type: 'string', required: false, label: 'Subject', placeholder: 'e.g., Mathematics, Physics' },
    },
    'Movies': {
      director: { type: 'string', required: false, label: 'Director', placeholder: 'e.g., Christopher Nolan' },
      studio: { type: 'string', required: false, label: 'Studio', placeholder: 'e.g., Warner Bros, Disney' },
      format: { type: 'string', required: false, label: 'Format', placeholder: 'e.g., DVD, Blu-ray, 4K UHD' },
      runtime: { type: 'string', required: false, label: 'Runtime', placeholder: 'e.g., 120 minutes' },
      rating: { type: 'string', required: false, label: 'Rating', placeholder: 'e.g., PG, PG-13, R' },
    },
    'Music': {
      artist: { type: 'string', required: false, label: 'Artist', placeholder: 'e.g., The Beatles' },
      label: { type: 'string', required: false, label: 'Label', placeholder: 'e.g., Universal Music' },
      format: { type: 'string', required: false, label: 'Format', placeholder: 'e.g., CD, Vinyl, Digital' },
      genre: { type: 'string', required: false, label: 'Genre', placeholder: 'e.g., Rock, Pop, Jazz' },
      tracks: { type: 'string', required: false, label: 'Number of Tracks', placeholder: 'e.g., 12 tracks' },
    },
    'E-books': {
      author: { type: 'string', required: false, label: 'Author', placeholder: 'e.g., John Doe' },
      publisher: { type: 'string', required: false, label: 'Publisher', placeholder: 'e.g., Digital Publisher' },
      format: { type: 'string', required: false, label: 'Format', placeholder: 'e.g., EPUB, PDF, MOBI' },
      pages: { type: 'string', required: false, label: 'Pages', placeholder: 'e.g., 300 pages' },
      fileSize: { type: 'string', required: false, label: 'File Size', placeholder: 'e.g., 2.5 MB' },
    },
  },

  // Beauty & Personal Care category
  'Beauty & Personal Care': {
    'Skincare': {
      brand: { type: 'string', required: true, label: 'Brand', placeholder: 'e.g., CeraVe, La Roche-Posay' },
      skinType: { type: 'string', required: false, label: 'Skin Type', placeholder: 'e.g., Oily, Dry, Combination' },
      volume: { type: 'string', required: false, label: 'Volume', placeholder: 'e.g., 50ml, 100ml, 1.7oz' },
      spf: { type: 'string', required: false, label: 'SPF', placeholder: 'e.g., SPF 30, SPF 50' },
      ingredients: { type: 'string', required: false, label: 'Key Ingredients', placeholder: 'e.g., Hyaluronic Acid, Retinol' },
    },
    'Makeup': {
      brand: { type: 'string', required: true, label: 'Brand', placeholder: 'e.g., MAC, Maybelline, Fenty' },
      color: { type: 'string', required: true, label: 'Color/Shade', placeholder: 'e.g., Nude, Red, Brown' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Lipstick, Foundation, Mascara' },
      finish: { type: 'string', required: false, label: 'Finish', placeholder: 'e.g., Matte, Glossy, Satin' },
      crueltyFree: { type: 'boolean', required: false, label: 'Cruelty Free', placeholder: 'Yes/No' },
    },
    'Hair Care': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Pantene, Olaplex, Redken' },
      hairType: { type: 'string', required: false, label: 'Hair Type', placeholder: 'e.g., Fine, Thick, Curly' },
      volume: { type: 'string', required: false, label: 'Volume', placeholder: 'e.g., 250ml, 500ml, 16oz' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Shampoo, Conditioner, Treatment' },
    },
    'Fragrances': {
      brand: { type: 'string', required: true, label: 'Brand', placeholder: 'e.g., Chanel, Dior, Versace' },
      scent: { type: 'string', required: false, label: 'Scent', placeholder: 'e.g., Floral, Woody, Fresh' },
      volume: { type: 'string', required: true, label: 'Volume', placeholder: 'e.g., 50ml, 100ml, 3.4oz' },
      gender: { type: 'string', required: false, label: 'Gender', placeholder: 'e.g., Men, Women, Unisex' },
    },
    'Men\'s Grooming': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Gillette, Braun, Philips' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Razor, Trimmer, Shaving Cream' },
      skinType: { type: 'string', required: false, label: 'Skin Type', placeholder: 'e.g., Sensitive, Normal' },
    },
    'Bath & Body': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Dove, Olay, Bath & Body Works' },
      scent: { type: 'string', required: false, label: 'Scent', placeholder: 'e.g., Lavender, Vanilla, Fresh' },
      volume: { type: 'string', required: false, label: 'Volume', placeholder: 'e.g., 250ml, 500ml, 16oz' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Body Wash, Lotion, Soap' },
    },
  },

  // Health & Wellness category
  'Health & Wellness': {
    'Vitamins & Supplements': {
      brand: { type: 'string', required: true, label: 'Brand', placeholder: 'e.g., Nature Made, Centrum' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Multivitamin, Vitamin D, Omega-3' },
      quantity: { type: 'string', required: false, label: 'Quantity', placeholder: 'e.g., 60 tablets, 100 capsules' },
      dosage: { type: 'string', required: false, label: 'Dosage', placeholder: 'e.g., 1000mg, 5000 IU' },
    },
    'Fitness Equipment': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Bowflex, NordicTrack' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Treadmill, Dumbbells, Resistance Bands' },
      weight: { type: 'string', required: false, label: 'Weight', placeholder: 'e.g., 10 lbs, 20 lbs' },
      dimensions: { type: 'string', required: false, label: 'Dimensions', placeholder: 'e.g., 24" x 18" x 6"' },
    },
    'Yoga & Meditation': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Manduka, Lululemon' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Yoga Mat, Meditation Cushion' },
      thickness: { type: 'string', required: false, label: 'Thickness', placeholder: 'e.g., 4mm, 6mm' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., TPE, PVC, Cork' },
    },
    'Massage Tools': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Theragun, Hyperice' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Massage Gun, Foam Roller' },
      power: { type: 'string', required: false, label: 'Power', placeholder: 'e.g., Battery, Electric, Manual' },
    },
    'Health Monitors': {
      brand: { type: 'string', required: true, label: 'Brand', placeholder: 'e.g., Fitbit, Apple, Garmin' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Blood Pressure, Heart Rate, Activity Tracker' },
      connectivity: { type: 'string', required: false, label: 'Connectivity', placeholder: 'e.g., Bluetooth, WiFi' },
    },
    'First Aid': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Johnson & Johnson, Band-Aid' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Bandages, Antiseptic, First Aid Kit' },
      quantity: { type: 'string', required: false, label: 'Quantity', placeholder: 'e.g., 50 pieces, 100 count' },
    },
  },

  // Toys & Games category
  'Toys & Games': {
    'Action Figures': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Hasbro, Mattel, Funko' },
      character: { type: 'string', required: false, label: 'Character', placeholder: 'e.g., Spider-Man, Batman' },
      scale: { type: 'string', required: false, label: 'Scale', placeholder: 'e.g., 6", 12", 1:12' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Plastic, Vinyl' },
      ageRange: { type: 'string', required: true, label: 'Age Range', placeholder: 'e.g., 3+, 8+, 14+' },
    },
    'Board Games': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Hasbro, Ravensburger' },
      players: { type: 'string', required: false, label: 'Number of Players', placeholder: 'e.g., 2-4, 2-6' },
      ageRange: { type: 'string', required: true, label: 'Age Range', placeholder: 'e.g., 8+, 12+, 14+' },
      playTime: { type: 'string', required: false, label: 'Play Time', placeholder: 'e.g., 30 minutes, 60 minutes' },
    },
    'Puzzles': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Ravensburger, Buffalo Games' },
      pieces: { type: 'string', required: true, label: 'Number of Pieces', placeholder: 'e.g., 500, 1000, 2000' },
      ageRange: { type: 'string', required: false, label: 'Age Range', placeholder: 'e.g., 8+, 12+' },
      dimensions: { type: 'string', required: false, label: 'Completed Size', placeholder: 'e.g., 20" x 27"' },
    },
    'Educational Toys': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., LEGO, Melissa & Doug' },
      ageRange: { type: 'string', required: true, label: 'Age Range', placeholder: 'e.g., 3-5, 6-8, 9-12' },
      subject: { type: 'string', required: false, label: 'Subject', placeholder: 'e.g., Science, Math, Language' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Building Blocks, STEM Kit' },
    },
    'Outdoor Toys': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Little Tikes, Step2' },
      ageRange: { type: 'string', required: true, label: 'Age Range', placeholder: 'e.g., 2-5, 5-10' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Swing Set, Slide, Trampoline' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Plastic, Metal, Wood' },
    },
    'Video Games': {
      brand: { type: 'string', required: true, label: 'Platform', placeholder: 'e.g., PlayStation, Xbox, Nintendo Switch' },
      title: { type: 'string', required: true, label: 'Game Title', placeholder: 'e.g., The Last of Us, Mario Kart' },
      rating: { type: 'string', required: false, label: 'ESRB Rating', placeholder: 'e.g., E, T, M' },
      genre: { type: 'string', required: false, label: 'Genre', placeholder: 'e.g., Action, RPG, Sports' },
    },
  },

  // Automotive category
  'Automotive': {
    'Car Parts': {
      brand: { type: 'string', required: true, label: 'Brand', placeholder: 'e.g., Bosch, Denso, Motorcraft' },
      partNumber: { type: 'string', required: false, label: 'Part Number', placeholder: 'e.g., ABC-12345' },
      vehicleCompatibility: { type: 'string', required: false, label: 'Vehicle Compatibility', placeholder: 'e.g., Honda Civic 2015-2020' },
      type: { type: 'string', required: false, label: 'Part Type', placeholder: 'e.g., Brake Pad, Air Filter, Spark Plug' },
    },
    'Accessories': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., WeatherTech, Husky Liners' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Floor Mats, Seat Covers, Phone Mount' },
      vehicleCompatibility: { type: 'string', required: false, label: 'Vehicle Compatibility', placeholder: 'e.g., Universal, Specific Model' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Rubber, Fabric, Plastic' },
    },
    'Tools & Equipment': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Craftsman, DeWalt' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Wrench Set, Jack, Diagnostic Tool' },
      size: { type: 'string', required: false, label: 'Size', placeholder: 'e.g., 10mm, 1/2", 3-ton' },
    },
    'Tires & Wheels': {
      brand: { type: 'string', required: true, label: 'Brand', placeholder: 'e.g., Michelin, Goodyear, Bridgestone' },
      size: { type: 'string', required: true, label: 'Tire Size', placeholder: 'e.g., 205/55R16, 225/60R17' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., All-Season, Winter, Summer' },
      loadIndex: { type: 'string', required: false, label: 'Load Index', placeholder: 'e.g., 91, 95' },
    },
    'Interior': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Covercraft, Dash Designs' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Dash Cover, Steering Wheel Cover' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., Black, Gray, Beige' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Leather, Fabric, Neoprene' },
    },
    'Exterior': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., 3M, WeatherTech' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Car Cover, Bug Deflector, Spoiler' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Polyester, ABS Plastic' },
    },
  },

  // Pet Supplies category
  'Pet Supplies': {
    'Dog Supplies': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Kong, PetSafe' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Toy, Leash, Bed, Bowl' },
      size: { type: 'string', required: false, label: 'Size', placeholder: 'e.g., Small, Medium, Large, X-Large' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Nylon, Rubber, Plush' },
    },
    'Cat Supplies': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Petmate, Trixie' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Litter Box, Scratching Post, Toy' },
      size: { type: 'string', required: false, label: 'Size', placeholder: 'e.g., Small, Medium, Large' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Plastic, Sisal, Fabric' },
    },
    'Fish & Aquarium': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Tetra, API' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Filter, Heater, Decor, Food' },
      tankSize: { type: 'string', required: false, label: 'Tank Size', placeholder: 'e.g., 10 gallon, 20 gallon' },
    },
    'Bird Supplies': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Prevue, Kaytee' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Cage, Perch, Toy, Food' },
      cageSize: { type: 'string', required: false, label: 'Cage Size', placeholder: 'e.g., Small, Medium, Large' },
    },
    'Small Pets': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Kaytee, Oxbow' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Habitat, Bedding, Food, Toy' },
      petType: { type: 'string', required: false, label: 'Pet Type', placeholder: 'e.g., Hamster, Rabbit, Guinea Pig' },
    },
    'Pet Food': {
      brand: { type: 'string', required: true, label: 'Brand', placeholder: 'e.g., Purina, Royal Canin, Hill\'s' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Dry, Wet, Treats' },
      petType: { type: 'string', required: true, label: 'Pet Type', placeholder: 'e.g., Dog, Cat, Bird' },
      weight: { type: 'string', required: false, label: 'Weight', placeholder: 'e.g., 5 lbs, 15 lbs, 30 lbs' },
      lifeStage: { type: 'string', required: false, label: 'Life Stage', placeholder: 'e.g., Puppy, Adult, Senior' },
    },
  },

  // Office Supplies category
  'Office Supplies': {
    'Writing Supplies': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Bic, Pilot, Paper Mate' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Pen, Pencil, Marker' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., Black, Blue, Red' },
      quantity: { type: 'string', required: false, label: 'Quantity', placeholder: 'e.g., 1, 12-pack, 24-pack' },
    },
    'Paper Products': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Hammermill, HP' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Copy Paper, Notebook, Sticky Notes' },
      size: { type: 'string', required: false, label: 'Size', placeholder: 'e.g., Letter (8.5"x11"), A4' },
      quantity: { type: 'string', required: false, label: 'Quantity', placeholder: 'e.g., 500 sheets, 1 ream' },
    },
    'Organizers': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Rubbermaid, Sterilite' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., File Organizer, Desk Tray, Binder' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., Black, White, Gray' },
      capacity: { type: 'string', required: false, label: 'Capacity', placeholder: 'e.g., 1", 2", 3"' },
    },
    'Desk Accessories': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Fellowes, 3M' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Stapler, Paper Clip, Tape Dispenser' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., Black, Silver, White' },
    },
    'Filing & Storage': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Pendaflex, Smead' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., File Folder, Filing Cabinet, Storage Box' },
      size: { type: 'string', required: false, label: 'Size', placeholder: 'e.g., Letter, Legal, A4' },
    },
    'Office Furniture': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., IKEA, Herman Miller' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Desk Chair, Standing Desk, File Cabinet' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., Black, Brown, White' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Mesh, Leather, Wood' },
    },
  },

  // Food & Beverages category
  'Food & Beverages': {
    'Snacks': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Lay\'s, Doritos, Pringles' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Chips, Cookies, Nuts' },
      flavor: { type: 'string', required: false, label: 'Flavor', placeholder: 'e.g., Original, BBQ, Sour Cream' },
      weight: { type: 'string', required: false, label: 'Weight', placeholder: 'e.g., 200g, 1 lb, 12 oz' },
      expirationDate: { type: 'string', required: false, label: 'Expiration Date', placeholder: 'e.g., 2025-12-31' },
    },
    'Beverages': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Coca-Cola, Pepsi, Red Bull' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Soda, Juice, Energy Drink' },
      flavor: { type: 'string', required: false, label: 'Flavor', placeholder: 'e.g., Cola, Orange, Lemon' },
      volume: { type: 'string', required: false, label: 'Volume', placeholder: 'e.g., 355ml, 500ml, 1L' },
    },
    'Gourmet Foods': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Artisan, Specialty Brand' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Cheese, Chocolate, Olive Oil' },
      origin: { type: 'string', required: false, label: 'Origin', placeholder: 'e.g., Italy, France, Local' },
      weight: { type: 'string', required: false, label: 'Weight', placeholder: 'e.g., 250g, 500g, 1 lb' },
    },
    'Organic Foods': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Organic Valley, Nature\'s Path' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Produce, Grains, Dairy' },
      certification: { type: 'string', required: false, label: 'Certification', placeholder: 'e.g., USDA Organic, Non-GMO' },
      weight: { type: 'string', required: false, label: 'Weight', placeholder: 'e.g., 1 lb, 2 lbs, 5 lbs' },
    },
    'Coffee & Tea': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Starbucks, Twinings, Folgers' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Coffee Beans, Ground Coffee, Tea Bags' },
      roast: { type: 'string', required: false, label: 'Roast Level', placeholder: 'e.g., Light, Medium, Dark' },
      weight: { type: 'string', required: false, label: 'Weight', placeholder: 'e.g., 250g, 500g, 1 lb' },
    },
    'Cooking Ingredients': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., McCormick, Spice Islands' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Spices, Herbs, Seasoning' },
      weight: { type: 'string', required: false, label: 'Weight', placeholder: 'e.g., 50g, 100g, 1 oz' },
    },
  },

  // Jewelry & Watches category
  'Jewelry & Watches': {
    'Necklaces': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Pandora, Swarovski' },
      material: { type: 'string', required: true, label: 'Material', placeholder: 'e.g., Gold, Silver, Sterling Silver' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., Yellow Gold, White Gold, Rose Gold' },
      length: { type: 'string', required: false, label: 'Length', placeholder: 'e.g., 16", 18", 20"' },
      gemstone: { type: 'string', required: false, label: 'Gemstone', placeholder: 'e.g., Diamond, Ruby, None' },
    },
    'Rings': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Tiffany & Co., Cartier' },
      material: { type: 'string', required: true, label: 'Material', placeholder: 'e.g., Gold, Silver, Platinum' },
      size: { type: 'string', required: true, label: 'Ring Size', placeholder: 'e.g., 5, 6, 7, 8' },
      gemstone: { type: 'string', required: false, label: 'Gemstone', placeholder: 'e.g., Diamond, Sapphire, None' },
      style: { type: 'string', required: false, label: 'Style', placeholder: 'e.g., Solitaire, Band, Vintage' },
    },
    'Earrings': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Kate Spade, Kendra Scott' },
      material: { type: 'string', required: true, label: 'Material', placeholder: 'e.g., Gold, Silver, Sterling Silver' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Studs, Hoops, Dangles' },
      gemstone: { type: 'string', required: false, label: 'Gemstone', placeholder: 'e.g., Pearl, Diamond, None' },
    },
    'Bracelets': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Alex and Ani, Links of London' },
      material: { type: 'string', required: true, label: 'Material', placeholder: 'e.g., Gold, Silver, Leather' },
      size: { type: 'string', required: false, label: 'Size', placeholder: 'e.g., Small, Medium, Large, Adjustable' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Chain, Cuff, Charm' },
    },
    'Watches': {
      brand: { type: 'string', required: true, label: 'Brand', placeholder: 'e.g., Rolex, Omega, Seiko' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Stainless Steel, Gold, Leather' },
      movement: { type: 'string', required: false, label: 'Movement', placeholder: 'e.g., Automatic, Quartz, Mechanical' },
      waterResistance: { type: 'string', required: false, label: 'Water Resistance', placeholder: 'e.g., 50m, 100m, 200m' },
      gender: { type: 'string', required: false, label: 'Gender', placeholder: 'e.g., Men, Women, Unisex' },
    },
    'Men\'s Jewelry': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., David Yurman, John Hardy' },
      material: { type: 'string', required: true, label: 'Material', placeholder: 'e.g., Silver, Gold, Titanium' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Chain, Ring, Bracelet' },
    },
  },

  // Baby & Kids category
  'Baby & Kids': {
    'Baby Gear': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Graco, Fisher-Price' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Stroller, Car Seat, High Chair' },
      ageRange: { type: 'string', required: true, label: 'Age Range', placeholder: 'e.g., 0-6 months, 6-12 months' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., Gray, Navy, Pink' },
    },
    'Diapers & Wipes': {
      brand: { type: 'string', required: true, label: 'Brand', placeholder: 'e.g., Pampers, Huggies, Luvs' },
      size: { type: 'string', required: true, label: 'Size', placeholder: 'e.g., Newborn, Size 1, Size 2' },
      quantity: { type: 'string', required: false, label: 'Quantity', placeholder: 'e.g., 40 count, 80 count' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Disposable, Cloth, Wipes' },
    },
    'Feeding': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Dr. Brown\'s, Avent' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Bottle, Sippy Cup, Utensils' },
      ageRange: { type: 'string', required: false, label: 'Age Range', placeholder: 'e.g., 0-6 months, 6-12 months' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Glass, BPA-Free Plastic' },
    },
    'Nursery': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Delta, DaVinci' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Crib, Changing Table, Rocker' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., White, Espresso, Natural' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Wood, Metal' },
    },
    'Safety': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Safety 1st, Summer Infant' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Baby Gate, Monitor, Outlet Covers' },
      ageRange: { type: 'string', required: false, label: 'Age Range', placeholder: 'e.g., 0-2 years, 2-5 years' },
    },
    'Toys & Activities': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Fisher-Price, VTech' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Rattle, Teether, Activity Gym' },
      ageRange: { type: 'string', required: true, label: 'Age Range', placeholder: 'e.g., 0-6 months, 6-12 months' },
    },
  },

  // Travel & Luggage category
  'Travel & Luggage': {
    'Luggage': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Samsonite, Travelpro' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Suitcase, Carry-On, Duffel' },
      size: { type: 'string', required: true, label: 'Size', placeholder: 'e.g., 21", 25", 29"' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Polycarbonate, Nylon, Hard Shell' },
      capacity: { type: 'string', required: false, label: 'Capacity', placeholder: 'e.g., 50L, 75L' },
    },
    'Backpacks': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., North Face, Osprey' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Daypack, Hiking, Travel' },
      capacity: { type: 'string', required: false, label: 'Capacity', placeholder: 'e.g., 20L, 30L, 40L' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Nylon, Polyester, Canvas' },
    },
    'Travel Accessories': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Eagle Creek, Travelon' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Packing Cube, Travel Pillow, Adapter' },
      color: { type: 'string', required: false, label: 'Color', placeholder: 'e.g., Black, Gray, Blue' },
    },
    'Travel Bags': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Tumi, Briggs & Riley' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Messenger Bag, Tote, Garment Bag' },
      material: { type: 'string', required: false, label: 'Material', placeholder: 'e.g., Leather, Nylon, Canvas' },
    },
    'Packing Organizers': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Eagle Creek, Amazon Basics' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Packing Cube, Shoe Bag, Toiletry Bag' },
      size: { type: 'string', required: false, label: 'Size', placeholder: 'e.g., Small, Medium, Large' },
    },
    'Travel Tech': {
      brand: { type: 'string', required: false, label: 'Brand', placeholder: 'e.g., Anker, Belkin' },
      type: { type: 'string', required: false, label: 'Type', placeholder: 'e.g., Power Bank, Travel Adapter, Cable Organizer' },
      capacity: { type: 'string', required: false, label: 'Capacity', placeholder: 'e.g., 10000mAh, 20000mAh' },
    },
  },
};

/**
 * Get attribute definitions for a category and subcategory
 * @param {String} categoryName - Category name
 * @param {String} subcategoryName - Subcategory name
 * @returns {Object} Attribute definitions
 */
function getAttributeDefinitions(categoryName, subcategoryName) {
  if (!categoryName || !subcategoryName) {
    return {};
  }

  const category = attributeDefinitions[categoryName];
  if (!category) {
    return {};
  }

  return category[subcategoryName] || {};
}

/**
 * Validate attributes based on category/subcategory requirements
 * @param {Object} attributes - Product attributes
 * @param {String} categoryName - Category name
 * @param {String} subcategoryName - Subcategory name
 * @returns {Object} { valid: boolean, errors: Array }
 */
function validateAttributes(attributes, categoryName, subcategoryName) {
  const definitions = getAttributeDefinitions(categoryName, subcategoryName);
  const errors = [];

  for (const [key, definition] of Object.entries(definitions)) {
    if (definition.required && (!attributes || !attributes[key] || attributes[key].trim() === '')) {
      errors.push(`${definition.label} is required`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  attributeDefinitions,
  getAttributeDefinitions,
  validateAttributes,
};
