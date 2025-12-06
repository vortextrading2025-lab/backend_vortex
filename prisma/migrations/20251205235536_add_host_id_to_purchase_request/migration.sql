-- AlterTable
ALTER TABLE "purchase_requests" ADD COLUMN     "hostId" TEXT;

-- CreateIndex
CREATE INDEX "purchase_requests_hostId_idx" ON "purchase_requests"("hostId");

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
