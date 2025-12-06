/*
  Warnings:

  - You are about to drop the column `contractId` on the `payouts` table. All the data in the column will be lost.
  - You are about to drop the column `processedAt` on the `payouts` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `payouts` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to drop the `contract_pricing` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `contracts` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `unitId` to the `payouts` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `stage` on the `payouts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ContractGameStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PLACED');

-- DropForeignKey
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_hostId_fkey";

-- DropForeignKey
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_parentId_fkey";

-- DropForeignKey
ALTER TABLE "payouts" DROP CONSTRAINT "payouts_contractId_fkey";

-- DropIndex
DROP INDEX "payouts_contractId_idx";

-- AlterTable
ALTER TABLE "payouts" DROP COLUMN "contractId",
DROP COLUMN "processedAt",
ADD COLUMN     "creditedAt" TIMESTAMP(3),
ADD COLUMN     "unitId" TEXT NOT NULL,
ADD COLUMN     "walletId" TEXT,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2),
DROP COLUMN "stage",
ADD COLUMN     "stage" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mentorId" TEXT;

-- DropTable
DROP TABLE "contract_pricing";

-- DropTable
DROP TABLE "contracts";

-- CreateTable
CREATE TABLE "contract_games" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "downPayment" DECIMAL(10,2) NOT NULL,
    "status" "ContractGameStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "payoutStage1" DECIMAL(10,2) NOT NULL,
    "payoutStage2" DECIMAL(10,2) NOT NULL,
    "payoutStage3" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "contractGameId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "unitNumber" INTEGER NOT NULL,
    "unitName" TEXT NOT NULL,
    "stage" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "parentUnitId" TEXT,
    "level" INTEGER NOT NULL,
    "positionInLevel" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3),
    "mentorId" TEXT,
    "hostId" TEXT,
    "isSystemRoot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "contractGameId" TEXT NOT NULL,
    "unitCount" INTEGER NOT NULL DEFAULT 4,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "placedAt" TIMESTAMP(3),

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_games_status_idx" ON "contract_games"("status");

-- CreateIndex
CREATE INDEX "contract_games_createdById_idx" ON "contract_games"("createdById");

-- CreateIndex
CREATE INDEX "units_contractGameId_ownerId_isActive_idx" ON "units"("contractGameId", "ownerId", "isActive");

-- CreateIndex
CREATE INDEX "units_parentUnitId_level_positionInLevel_idx" ON "units"("parentUnitId", "level", "positionInLevel");

-- CreateIndex
CREATE INDEX "units_contractGameId_stage_idx" ON "units"("contractGameId", "stage");

-- CreateIndex
CREATE INDEX "units_ownerId_idx" ON "units"("ownerId");

-- CreateIndex
CREATE INDEX "units_isActive_stage_idx" ON "units"("isActive", "stage");

-- CreateIndex
CREATE INDEX "units_mentorId_idx" ON "units"("mentorId");

-- CreateIndex
CREATE INDEX "units_hostId_idx" ON "units"("hostId");

-- CreateIndex
CREATE INDEX "units_contractGameId_isSystemRoot_stage_idx" ON "units"("contractGameId", "isSystemRoot", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "units_contractGameId_ownerId_unitNumber_key" ON "units"("contractGameId", "ownerId", "unitNumber");

-- CreateIndex
CREATE UNIQUE INDEX "units_contractGameId_unitName_key" ON "units"("contractGameId", "unitName");

-- CreateIndex
CREATE INDEX "purchase_requests_mentorId_status_idx" ON "purchase_requests"("mentorId", "status");

-- CreateIndex
CREATE INDEX "purchase_requests_userId_status_idx" ON "purchase_requests"("userId", "status");

-- CreateIndex
CREATE INDEX "purchase_requests_contractGameId_idx" ON "purchase_requests"("contractGameId");

-- CreateIndex
CREATE INDEX "purchase_requests_status_idx" ON "purchase_requests"("status");

-- CreateIndex
CREATE INDEX "payouts_unitId_idx" ON "payouts"("unitId");

-- CreateIndex
CREATE INDEX "payouts_walletId_idx" ON "payouts"("walletId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_games" ADD CONSTRAINT "contract_games_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_contractGameId_fkey" FOREIGN KEY ("contractGameId") REFERENCES "contract_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_parentUnitId_fkey" FOREIGN KEY ("parentUnitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_contractGameId_fkey" FOREIGN KEY ("contractGameId") REFERENCES "contract_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
