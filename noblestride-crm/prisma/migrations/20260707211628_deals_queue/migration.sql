-- Deals queue rework: FeeShareAgreement document type, Document.partnerId, SavedView.
-- Additive / data-preserving. Applied surgically to a shared dev DB that carried
-- pre-existing (unrelated) drift on the Client table; that drift is intentionally
-- left untouched here.

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'FeeShareAgreement' AFTER 'EngagementContract';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "partnerId" TEXT;

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entity" TEXT NOT NULL DEFAULT 'deals',
    "config" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedView_entity_idx" ON "SavedView"("entity");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
