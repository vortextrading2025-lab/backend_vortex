-- CreateTable
CREATE TABLE "invite_links" (
    "id" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "inviteUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxUses" INTEGER,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "invitedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "invite_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invite_links_inviteCode_key" ON "invite_links"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "invite_links_inviteUrl_key" ON "invite_links"("inviteUrl");

-- CreateIndex
CREATE UNIQUE INDEX "invite_links_invitedUserId_key" ON "invite_links"("invitedUserId");

-- CreateIndex
CREATE INDEX "invite_links_inviterId_idx" ON "invite_links"("inviterId");

-- CreateIndex
CREATE INDEX "invite_links_inviteCode_idx" ON "invite_links"("inviteCode");

-- CreateIndex
CREATE INDEX "invite_links_isActive_idx" ON "invite_links"("isActive");

-- AddForeignKey
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
