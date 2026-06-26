-- AlterTable
ALTER TABLE "Investor" ADD COLUMN     "ddRequirements" TEXT,
ADD COLUMN     "engagementClassification" "InvestorEngagementClassification" NOT NULL DEFAULT 'Active',
ADD COLUMN     "feedback" TEXT,
ADD COLUMN     "icApprovalProcess" TEXT,
ADD COLUMN     "investmentMandate" TEXT,
ADD COLUMN     "minEbitda" DECIMAL(20,2),
ADD COLUMN     "minLoanBook" DECIMAL(20,2),
ADD COLUMN     "minRevenue" DECIMAL(20,2),
ADD COLUMN     "ndaStatus" "InvestorNdaStatus" NOT NULL DEFAULT 'None',
ADD COLUMN     "nextActionDate" TIMESTAMP(3),
ADD COLUMN     "pricingPreference" TEXT,
ADD COLUMN     "remainingInvestmentPeriod" TEXT,
ADD COLUMN     "shareholdingPreference" TEXT,
ADD COLUMN     "ssaRegionContactId" TEXT,
ADD COLUMN     "trackRecord" TEXT;

-- CreateIndex
CREATE INDEX "Investor_engagementClassification_idx" ON "Investor"("engagementClassification");

-- AddForeignKey
ALTER TABLE "Investor" ADD CONSTRAINT "Investor_ssaRegionContactId_fkey" FOREIGN KEY ("ssaRegionContactId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
