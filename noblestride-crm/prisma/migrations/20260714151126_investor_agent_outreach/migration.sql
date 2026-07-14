-- CreateEnum
CREATE TYPE "OutreachDraftStatus" AS ENUM ('Draft', 'Approved', 'Sent', 'Rejected', 'Failed');

-- CreateEnum
CREATE TYPE "ProposedChangeStatus" AS ENUM ('Pending', 'Confirmed', 'Rejected');

-- CreateTable
CREATE TABLE "OutreachDraft" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "matchRationale" TEXT NOT NULL,
    "status" "OutreachDraftStatus" NOT NULL DEFAULT 'Draft',
    "reviewedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdSource" "ActorSource" NOT NULL DEFAULT 'AGENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "transactionId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "personId" TEXT,
    "reviewedById" TEXT,

    CONSTRAINT "OutreachDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorProposedChange" (
    "id" TEXT NOT NULL,
    "proposedFields" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "sourceEmail" TEXT NOT NULL,
    "status" "ProposedChangeStatus" NOT NULL DEFAULT 'Pending',
    "reviewedAt" TIMESTAMP(3),
    "createdSource" "ActorSource" NOT NULL DEFAULT 'AGENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "investorId" TEXT NOT NULL,
    "personId" TEXT,
    "reviewedById" TEXT,

    CONSTRAINT "InvestorProposedChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutreachDraft_status_idx" ON "OutreachDraft"("status");

-- CreateIndex
CREATE INDEX "OutreachDraft_transactionId_idx" ON "OutreachDraft"("transactionId");

-- CreateIndex
CREATE INDEX "OutreachDraft_investorId_idx" ON "OutreachDraft"("investorId");

-- CreateIndex
CREATE INDEX "InvestorProposedChange_status_idx" ON "InvestorProposedChange"("status");

-- CreateIndex
CREATE INDEX "InvestorProposedChange_investorId_idx" ON "InvestorProposedChange"("investorId");

-- AddForeignKey
ALTER TABLE "OutreachDraft" ADD CONSTRAINT "OutreachDraft_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachDraft" ADD CONSTRAINT "OutreachDraft_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachDraft" ADD CONSTRAINT "OutreachDraft_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachDraft" ADD CONSTRAINT "OutreachDraft_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProposedChange" ADD CONSTRAINT "InvestorProposedChange_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProposedChange" ADD CONSTRAINT "InvestorProposedChange_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorProposedChange" ADD CONSTRAINT "InvestorProposedChange_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
