-- CreateEnum
CREATE TYPE "DealFinancingType" AS ENUM ('Debt', 'Equity', 'EquityAndDebt');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('Open', 'OnHold', 'Closed', 'ClosedReopened', 'ClosedOnHold', 'Dropped');

-- CreateEnum
CREATE TYPE "DealMilestone" AS ENUM ('TermSheet', 'NonBindingOffer', 'LoanAgreement', 'SpaSha', 'DueDiligence', 'IC', 'TA', 'Closed');

-- CreateEnum
CREATE TYPE "MaxSellingStake" AS ENUM ('Minority', 'Majority', 'FullSale', 'NA');

-- CreateEnum
CREATE TYPE "TaskSource" AS ENUM ('MondayMeeting', 'WhatsApp', 'Email', 'Verbal', 'Other');

-- CreateEnum
CREATE TYPE "CommChannel" AS ENUM ('WhatsApp', 'Email', 'Slack', 'WebChat', 'Call', 'Meeting');

-- CreateEnum
CREATE TYPE "CommDirection" AS ENUM ('Inbound', 'Outbound');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('Active', 'Prospect', 'Archived');

-- CreateEnum
CREATE TYPE "ImpactFlag" AS ENUM ('WomenLed', 'YouthLed');

-- AlterEnum
ALTER TYPE "Instrument" ADD VALUE 'Hybrid';

-- AlterEnum
ALTER TYPE "Sector" ADD VALUE 'Energy';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Source" ADD VALUE 'DirectEnquiry';
ALTER TYPE "Source" ADD VALUE 'Consultant';
ALTER TYPE "Source" ADD VALUE 'Investor';
ALTER TYPE "Source" ADD VALUE 'Partner';
ALTER TYPE "Source" ADD VALUE 'SocialMedia';
ALTER TYPE "Source" ADD VALUE 'InternalBusinessDev';
ALTER TYPE "Source" ADD VALUE 'Other';

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'Dropped';

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "channel" "CommChannel",
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "direction" "CommDirection";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "branchCount" INTEGER,
ADD COLUMN     "businessModel" TEXT,
ADD COLUMN     "codename" TEXT,
ADD COLUMN     "directorsManagement" TEXT,
ADD COLUMN     "ebitda" DECIMAL(20,2),
ADD COLUMN     "existingDebt" DECIMAL(20,2),
ADD COLUMN     "foundersNationality" TEXT,
ADD COLUMN     "hqCountry" TEXT,
ADD COLUMN     "impactFlags" "ImpactFlag"[] DEFAULT ARRAY[]::"ImpactFlag"[],
ADD COLUMN     "loanBook" DECIMAL(20,2),
ADD COLUMN     "netProfit" DECIMAL(20,2),
ADD COLUMN     "ownershipStructure" TEXT,
ADD COLUMN     "registrationNo" TEXT,
ADD COLUMN     "staffCount" INTEGER,
ADD COLUMN     "status" "ClientStatus" NOT NULL DEFAULT 'Prospect',
ADD COLUMN     "targetClients" TEXT,
ADD COLUMN     "totalAssets" DECIMAL(20,2);

-- AlterTable
ALTER TABLE "Mandate" ADD COLUMN     "dealStatus" "DealStatus" NOT NULL DEFAULT 'Open';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "activityId" TEXT,
ADD COLUMN     "assistantId" TEXT,
ADD COLUMN     "escalated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source" "TaskSource";

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "assistantId" TEXT,
ADD COLUMN     "dealMilestone" "DealMilestone",
ADD COLUMN     "dealStatus" "DealStatus" NOT NULL DEFAULT 'Open',
ADD COLUMN     "financingType" "DealFinancingType",
ADD COLUMN     "maxSellingStake" "MaxSellingStake",
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "probability" INTEGER,
ADD COLUMN     "targetProfile" TEXT,
ADD COLUMN     "useOfFunds" TEXT,
ADD COLUMN     "vdrLink" TEXT;

-- CreateTable
CREATE TABLE "StageChange" (
    "id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT,
    "createdSource" "ActorSource" NOT NULL DEFAULT 'HUMAN',
    "mandateId" TEXT,
    "transactionId" TEXT,
    "engagementId" TEXT,

    CONSTRAINT "StageChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StageChange_mandateId_idx" ON "StageChange"("mandateId");

-- CreateIndex
CREATE INDEX "StageChange_transactionId_idx" ON "StageChange"("transactionId");

-- CreateIndex
CREATE INDEX "StageChange_engagementId_idx" ON "StageChange"("engagementId");

-- CreateIndex
CREATE INDEX "Client_status_idx" ON "Client"("status");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageChange" ADD CONSTRAINT "StageChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageChange" ADD CONSTRAINT "StageChange_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageChange" ADD CONSTRAINT "StageChange_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageChange" ADD CONSTRAINT "StageChange_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

