-- CreateEnum
CREATE TYPE "EngagementStage" AS ENUM ('Shared', 'TeaserSent', 'NDASigned', 'IMShared', 'VDRAccess', 'Meeting', 'InfoRequest', 'DueDiligence', 'TermSheet', 'Offer', 'Invested', 'Declined');

-- CreateEnum
CREATE TYPE "InterestLevel" AS ENUM ('Low', 'Medium', 'High');

-- CreateEnum
CREATE TYPE "NdaType" AS ENUM ('Open', 'Closed');

-- CreateEnum
CREATE TYPE "DisbursementStatus" AS ENUM ('Disbursed', 'Ongoing', 'FellOff', 'Dropped');

-- CreateEnum
CREATE TYPE "InvestorEngagementClassification" AS ENUM ('Active', 'Inactive', 'OnHold', 'Excluded', 'Greylisted');

-- CreateEnum
CREATE TYPE "InvestorNdaStatus" AS ENUM ('None', 'OpenNDA', 'ClosedNDA');

-- CreateEnum
CREATE TYPE "AdvisorType" AS ENUM ('Lawyer', 'Investor', 'Consultant', 'TransactionAdvisor', 'AdvisoryFirm', 'Other');

-- CreateEnum
CREATE TYPE "ServiceProviderType" AS ENUM ('LawFirm', 'Audit', 'Tax', 'ESG', 'Technical', 'Other');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('NDA', 'EngagementContract', 'Teaser', 'IM', 'FinancialModel', 'Valuation', 'PitchDeck', 'AuditedAccounts', 'CR12', 'TermSheet', 'LoanAgreement', 'SPA', 'SHA', 'Other');

-- CreateEnum
CREATE TYPE "DocumentAccessLevel" AS ENUM ('Internal', 'ClientShared', 'InvestorShared', 'VDR');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('Draft', 'UnderReview', 'Approved', 'Shared', 'Executed');

-- CreateEnum
CREATE TYPE "PartnerAgreementStatus" AS ENUM ('None', 'Sent', 'Signed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InvestorType" ADD VALUE 'Corporate';
ALTER TYPE "InvestorType" ADD VALUE 'Individual';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Sector" ADD VALUE 'Aviation';
ALTER TYPE "Sector" ADD VALUE 'Construction';
ALTER TYPE "Sector" ADD VALUE 'Hospitality';
ALTER TYPE "Sector" ADD VALUE 'Leasing';
ALTER TYPE "Sector" ADD VALUE 'MediaEntertainment';
ALTER TYPE "Sector" ADD VALUE 'Services';
ALTER TYPE "Sector" ADD VALUE 'TransportLogistics';
ALTER TYPE "Sector" ADD VALUE 'WaterSanitation';

-- AlterTable
ALTER TABLE "Engagement" ADD COLUMN     "amountDisbursed" DECIMAL(20,2),
ADD COLUMN     "amountPending" DECIMAL(20,2),
ADD COLUMN     "dateReceived" TIMESTAMP(3),
ADD COLUMN     "disbursementStatus" "DisbursementStatus",
ADD COLUMN     "engagementStage" "EngagementStage" NOT NULL DEFAULT 'Shared',
ADD COLUMN     "feedback" TEXT,
ADD COLUMN     "interestLevel" "InterestLevel",
ADD COLUMN     "ndaType" "NdaType",
ADD COLUMN     "probability" INTEGER,
ADD COLUMN     "quarter" INTEGER,
ADD COLUMN     "termSheetDate" TIMESTAMP(3),
ADD COLUMN     "termSheetIssued" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totalAmount" DECIMAL(20,2),
ADD COLUMN     "year" INTEGER;

-- CreateIndex
CREATE INDEX "Engagement_engagementStage_idx" ON "Engagement"("engagementStage");
