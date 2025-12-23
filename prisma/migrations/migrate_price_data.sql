-- Migration script to preserve existing price data
-- Run this BEFORE running prisma db push

-- Update existing products: set sellingPrice = price, and set defaults for costPrice and mrp
UPDATE products 
SET 
  "sellingPrice" = price,
  "costPrice" = price * 0.7,  -- Default to 70% of selling price as cost
  "mrp" = price * 1.2  -- Default to 120% of selling price as MRP
WHERE price IS NOT NULL;

-- Update existing order_items: set costPrice = price (as a default, will be updated when orders are delivered)
UPDATE order_items 
SET "costPrice" = price
WHERE "costPrice" IS NULL;

