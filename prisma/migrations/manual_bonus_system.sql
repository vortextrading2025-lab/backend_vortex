-- Migration: Add Bonus System
-- This migration creates the BonusWallet and Bonus tables for tracking bonus points separately from earnings

-- Create BonusStatus enum
CREATE TYPE "BonusStatus" AS ENUM ('ACTIVE', 'REDEEMED', 'EXPIRED', 'CANCELLED');

-- Create BonusWallet table
CREATE TABLE "bonus_wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRedeemed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonus_wallets_pkey" PRIMARY KEY ("id")
);

-- Create Bonus table
CREATE TABLE "bonuses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bonusWalletId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sellingPrice" DECIMAL(10,2) NOT NULL,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "bonusAmount" DECIMAL(10,2) NOT NULL,
    "status" "BonusStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),

    CONSTRAINT "bonuses_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on bonus_wallets.userId
CREATE UNIQUE INDEX "bonus_wallets_userId_key" ON "bonus_wallets"("userId");

-- Create indexes on bonuses table
CREATE INDEX "bonuses_userId_idx" ON "bonuses"("userId");
CREATE INDEX "bonuses_orderId_idx" ON "bonuses"("orderId");
CREATE INDEX "bonuses_productId_idx" ON "bonuses"("productId");
CREATE INDEX "bonuses_status_idx" ON "bonuses"("status");
CREATE INDEX "bonuses_createdAt_idx" ON "bonuses"("createdAt");

-- Add foreign key constraints
ALTER TABLE "bonus_wallets" ADD CONSTRAINT "bonus_wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bonuses" ADD CONSTRAINT "bonuses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bonuses" ADD CONSTRAINT "bonuses_bonusWalletId_fkey" FOREIGN KEY ("bonusWalletId") REFERENCES "bonus_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

