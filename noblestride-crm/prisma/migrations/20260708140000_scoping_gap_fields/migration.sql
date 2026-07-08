-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('High', 'Medium', 'Low');

-- CreateEnum
CREATE TYPE "PartnerFeeStatus" AS ENUM ('NotDue', 'Due', 'Invoiced', 'Paid');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Sector" ADD VALUE 'OilAndGas';
ALTER TYPE "Sector" ADD VALUE 'Mining';
ALTER TYPE "Sector" ADD VALUE 'Gambling';
ALTER TYPE "Sector" ADD VALUE 'Alcohol';
ALTER TYPE "Sector" ADD VALUE 'Tobacco';

-- AlterTable
ALTER TABLE "Investor" ADD COLUMN     "criteriaVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "auditedFinancialsYears" INTEGER,
ADD COLUMN     "capacityUtilization" TEXT,
ADD COLUMN     "competitors" TEXT,
ADD COLUMN     "complianceNotes" TEXT,
ADD COLUMN     "governmentOwned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "groupStructure" TEXT,
ADD COLUMN     "pepExposure" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pricingExpectations" TEXT,
ADD COLUMN     "proposedTimeline" TEXT,
ADD COLUMN     "repaymentAbilityNotes" TEXT,
ADD COLUMN     "suppliers" TEXT;

-- AlterTable
ALTER TABLE "Mandate" ADD COLUMN     "priority" "Priority",
ADD COLUMN     "qualificationReasons" TEXT[],
ADD COLUMN     "qualificationVerdict" TEXT,
ADD COLUMN     "qualifiedAt" TIMESTAMP(3),
ADD COLUMN     "referralQualified" BOOLEAN,
ADD COLUMN     "retainerAmount" DECIMAL(20,2),
ADD COLUMN     "retainerInvoicedDate" TIMESTAMP(3),
ADD COLUMN     "retainerPaidDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "partnerFeeAmount" DECIMAL(20,2),
ADD COLUMN     "partnerFeeStatus" "PartnerFeeStatus",
ADD COLUMN     "priority" "Priority";

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "feedbackNotes" TEXT;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

