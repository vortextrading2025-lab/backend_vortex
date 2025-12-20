-- AlterTable
ALTER TABLE "payouts" ADD COLUMN     "heldUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "purchase_requests" ADD COLUMN     "cooldownEndsAt" TIMESTAMP(3),
ADD COLUMN     "refundedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "payouts_heldUntil_idx" ON "payouts"("heldUntil");

-- CreateIndex
CREATE INDEX "purchase_requests_cooldownEndsAt_idx" ON "purchase_requests"("cooldownEndsAt");
