-- AlterEnum
-- This migration adds new OrderStatus enum values
-- IMPORTANT: PostgreSQL requires enum values to be committed before use
-- Each ALTER TYPE statement commits automatically

-- Add new enum values (each statement commits separately)
ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_VENDOR_APPROVAL';
ALTER TYPE "OrderStatus" ADD VALUE 'ACCEPTED';
ALTER TYPE "OrderStatus" ADD VALUE 'REJECTED';

-- Note: The UPDATE and ALTER TABLE statements below will run in Prisma's transaction
-- but the enum values are already committed, so they can be used
-- However, if this causes issues, you may need to run the UPDATE/ALTER separately

-- Update existing orders (only if PENDING exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'PENDING' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'OrderStatus')
    ) THEN
        -- Check if PENDING_VENDOR_APPROVAL exists before using it
        IF EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'PENDING_VENDOR_APPROVAL' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'OrderStatus')
        ) THEN
            UPDATE "orders" SET "status" = 'PENDING_VENDOR_APPROVAL' WHERE "status" = 'PENDING';
        END IF;
    END IF;
END $$;

-- Update the default value for new orders
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING_VENDOR_APPROVAL';
