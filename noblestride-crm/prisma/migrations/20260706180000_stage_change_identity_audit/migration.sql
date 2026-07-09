-- AlterTable
ALTER TABLE "StageChange" ADD COLUMN "clientId" TEXT;
ALTER TABLE "StageChange" ADD COLUMN "investorId" TEXT;
ALTER TABLE "StageChange" ADD COLUMN "partnerId" TEXT;

-- CreateIndex
CREATE INDEX "StageChange_clientId_idx" ON "StageChange"("clientId");
CREATE INDEX "StageChange_investorId_idx" ON "StageChange"("investorId");
CREATE INDEX "StageChange_partnerId_idx" ON "StageChange"("partnerId");

-- AddForeignKey
ALTER TABLE "StageChange" ADD CONSTRAINT "StageChange_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StageChange" ADD CONSTRAINT "StageChange_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StageChange" ADD CONSTRAINT "StageChange_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
