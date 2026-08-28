-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'InvestmentCriteria';
-- CreateIndex
CREATE INDEX "Document_investorId_idx" ON "Document"("investorId");
