-- Migration: Add delivery date approval feature
-- This migration adds:
-- 1. PENDING_USER_APPROVAL status to OrderStatus enum
-- 2. proposedDeliveryDate field to orders table
-- 3. userApprovedDate field to orders table

-- Step 1: Add PENDING_USER_APPROVAL to OrderStatus enum
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'PENDING_USER_APPROVAL' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'OrderStatus')
    ) THEN
        ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_USER_APPROVAL';
    END IF;
END $$;

-- Step 2: Add proposedDeliveryDate column
ALTER TABLE "orders" 
ADD COLUMN IF NOT EXISTS "proposedDeliveryDate" TIMESTAMP(3);

-- Step 3: Add userApprovedDate column
ALTER TABLE "orders" 
ADD COLUMN IF NOT EXISTS "userApprovedDate" BOOLEAN;

-- Step 4: Add index on proposedDeliveryDate for better query performance
CREATE INDEX IF NOT EXISTS "orders_proposedDeliveryDate_idx" ON "orders"("proposedDeliveryDate");
