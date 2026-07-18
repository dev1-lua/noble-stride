-- CreateEnum
CREATE TYPE "AdvisoryStage" AS ENUM ('Scoping', 'Proposal', 'Engaged', 'Delivery', 'Completed', 'Lost');

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "advisoryId" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "advisoryId" TEXT;

-- AlterTable
ALTER TABLE "Mandate" ADD COLUMN     "country" TEXT;

-- AlterTable
ALTER TABLE "StageChange" ADD COLUMN     "advisoryId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "advisoryId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "country" TEXT;

-- CreateTable
CREATE TABLE "AdvisoryEngagement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "AdvisoryStage" NOT NULL DEFAULT 'Scoping',
    "stageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dealStatus" "DealStatus" NOT NULL DEFAULT 'Open',
    "feeAmount" DECIMAL(20,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "sector" "Sector"[] DEFAULT ARRAY[]::"Sector"[],
    "country" TEXT,
    "source" "Source",
    "priority" "Priority",
    "dateOpened" TIMESTAMP(3),
    "nextAction" TEXT,
    "notes" TEXT,
    "createdSource" "ActorSource" NOT NULL DEFAULT 'HUMAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientId" TEXT NOT NULL,
    "leadId" TEXT,

    CONSTRAINT "AdvisoryEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MandateAssists" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MandateAssists_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TransactionAssists" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TransactionAssists_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_AdvisoryAssists" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AdvisoryAssists_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "AdvisoryEngagement_stage_idx" ON "AdvisoryEngagement"("stage");

-- CreateIndex
CREATE INDEX "AdvisoryEngagement_clientId_idx" ON "AdvisoryEngagement"("clientId");

-- CreateIndex
CREATE INDEX "AdvisoryEngagement_leadId_idx" ON "AdvisoryEngagement"("leadId");

-- CreateIndex
CREATE INDEX "_MandateAssists_B_index" ON "_MandateAssists"("B");

-- CreateIndex
CREATE INDEX "_TransactionAssists_B_index" ON "_TransactionAssists"("B");

-- CreateIndex
CREATE INDEX "_AdvisoryAssists_B_index" ON "_AdvisoryAssists"("B");

-- CreateIndex
CREATE INDEX "StageChange_advisoryId_idx" ON "StageChange"("advisoryId");

-- AddForeignKey
ALTER TABLE "AdvisoryEngagement" ADD CONSTRAINT "AdvisoryEngagement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisoryEngagement" ADD CONSTRAINT "AdvisoryEngagement_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_advisoryId_fkey" FOREIGN KEY ("advisoryId") REFERENCES "AdvisoryEngagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_advisoryId_fkey" FOREIGN KEY ("advisoryId") REFERENCES "AdvisoryEngagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_advisoryId_fkey" FOREIGN KEY ("advisoryId") REFERENCES "AdvisoryEngagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageChange" ADD CONSTRAINT "StageChange_advisoryId_fkey" FOREIGN KEY ("advisoryId") REFERENCES "AdvisoryEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MandateAssists" ADD CONSTRAINT "_MandateAssists_A_fkey" FOREIGN KEY ("A") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MandateAssists" ADD CONSTRAINT "_MandateAssists_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TransactionAssists" ADD CONSTRAINT "_TransactionAssists_A_fkey" FOREIGN KEY ("A") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TransactionAssists" ADD CONSTRAINT "_TransactionAssists_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AdvisoryAssists" ADD CONSTRAINT "_AdvisoryAssists_A_fkey" FOREIGN KEY ("A") REFERENCES "AdvisoryEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AdvisoryAssists" ADD CONSTRAINT "_AdvisoryAssists_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Backfills (hand-written) ────────────────────────────────────────────────
-- Deal country defaults from the client's HQ country.
UPDATE "Mandate" m SET "country" = c."hqCountry"
FROM "Client" c WHERE m."clientId" = c."id" AND c."hqCountry" IS NOT NULL;

UPDATE "Transaction" t SET "country" = c."hqCountry"
FROM "Client" c WHERE t."clientId" = c."id" AND c."hqCountry" IS NOT NULL;

-- Migrate the legacy single Transaction.assistant into the assists m2m
-- (column kept for now; app code stops writing it).
INSERT INTO "_TransactionAssists" ("A", "B")
SELECT t."id", t."assistantId" FROM "Transaction" t
WHERE t."assistantId" IS NOT NULL
ON CONFLICT DO NOTHING;
