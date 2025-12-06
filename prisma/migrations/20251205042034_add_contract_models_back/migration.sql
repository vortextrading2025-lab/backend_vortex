-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "contractNumber" INTEGER NOT NULL,
    "ownerId" TEXT NOT NULL,
    "hostId" TEXT,
    "parentId" TEXT,
    "stage" "ContractStage" NOT NULL DEFAULT 'STAGE_1',
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "level" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "positionInLevel" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isActiveUnit" BOOLEAN NOT NULL DEFAULT false,
    "fulfilledAt" TIMESTAMP(3),
    "movedToStage2At" TIMESTAMP(3),
    "movedToStage3At" TIMESTAMP(3),
    "purchasePrice" DOUBLE PRECISION DEFAULT 0,
    "downPayment" DOUBLE PRECISION DEFAULT 0,
    "payoutAmount" DOUBLE PRECISION DEFAULT 0,
    "paidOut" BOOLEAN NOT NULL DEFAULT false,
    "paidOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_pricing" (
    "id" TEXT NOT NULL,
    "stage" "ContractStage" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contracts_ownerId_idx" ON "contracts"("ownerId");

-- CreateIndex
CREATE INDEX "contracts_hostId_idx" ON "contracts"("hostId");

-- CreateIndex
CREATE INDEX "contracts_parentId_idx" ON "contracts"("parentId");

-- CreateIndex
CREATE INDEX "contracts_status_idx" ON "contracts"("status");

-- CreateIndex
CREATE INDEX "contracts_stage_idx" ON "contracts"("stage");

-- CreateIndex
CREATE INDEX "contracts_ownerId_isActiveUnit_idx" ON "contracts"("ownerId", "isActiveUnit");

-- CreateIndex
CREATE UNIQUE INDEX "contract_pricing_stage_key" ON "contract_pricing"("stage");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
