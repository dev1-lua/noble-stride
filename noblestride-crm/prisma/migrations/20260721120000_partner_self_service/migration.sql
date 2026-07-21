-- Partner self-service (SOW §7.2): static access-code/PIN fields + lockout on Partner,
-- and a PartnerProposedChange table (verified-partner self-edits queued for staff review).

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "accessCodeHash" TEXT,
ADD COLUMN     "accessCodeSetAt" TIMESTAMP(3),
ADD COLUMN     "accessCodeFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "accessCodeLockedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PartnerProposedChange" (
    "id" TEXT NOT NULL,
    "proposedFields" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "ProposedChangeStatus" NOT NULL DEFAULT 'Pending',
    "reviewedAt" TIMESTAMP(3),
    "createdSource" "ActorSource" NOT NULL DEFAULT 'AGENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partnerId" TEXT NOT NULL,
    "reviewedById" TEXT,

    CONSTRAINT "PartnerProposedChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerProposedChange_status_idx" ON "PartnerProposedChange"("status");

-- CreateIndex
CREATE INDEX "PartnerProposedChange_partnerId_idx" ON "PartnerProposedChange"("partnerId");

-- AddForeignKey
ALTER TABLE "PartnerProposedChange" ADD CONSTRAINT "PartnerProposedChange_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProposedChange" ADD CONSTRAINT "PartnerProposedChange_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
