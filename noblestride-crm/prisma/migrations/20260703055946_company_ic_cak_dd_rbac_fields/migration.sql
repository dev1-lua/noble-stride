-- CreateEnum
CREATE TYPE "RegulatoryStatus" AS ENUM ('NotStarted', 'Filed', 'Approved', 'NotRequired');

-- CreateEnum
CREATE TYPE "DDTrack" AS ENUM ('Financial', 'Tax', 'Commercial', 'ESG', 'Legal');

-- CreateEnum
CREATE TYPE "DDStatus" AS ENUM ('NotStarted', 'InProgress', 'Complete', 'Flagged', 'NotApplicable');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('Admin', 'DealLead', 'TeamMember');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "ebitda" DECIMAL(20,2),
ADD COLUMN     "existingDebt" DECIMAL(20,2),
ADD COLUMN     "projectCodename" TEXT,
ADD COLUMN     "totalAssets" DECIMAL(20,2),
ADD COLUMN     "womenLed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "youthLed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "cakComesaApprovedDate" TIMESTAMP(3),
ADD COLUMN     "cakComesaFiledDate" TIMESTAMP(3),
ADD COLUMN     "cakComesaStatus" "RegulatoryStatus" NOT NULL DEFAULT 'NotStarted',
ADD COLUMN     "icFirstApprovalDate" TIMESTAMP(3),
ADD COLUMN     "icSecondApprovalDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "OrgRole" NOT NULL DEFAULT 'Admin';

-- CreateTable
CREATE TABLE "DueDiligenceTrack" (
    "id" TEXT NOT NULL,
    "track" "DDTrack" NOT NULL,
    "status" "DDStatus" NOT NULL DEFAULT 'NotStarted',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "transactionId" TEXT NOT NULL,
    "ownerId" TEXT,
    "serviceProviderId" TEXT,

    CONSTRAINT "DueDiligenceTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DueDiligenceTrack_transactionId_idx" ON "DueDiligenceTrack"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "DueDiligenceTrack_transactionId_track_key" ON "DueDiligenceTrack"("transactionId", "track");

-- AddForeignKey
ALTER TABLE "DueDiligenceTrack" ADD CONSTRAINT "DueDiligenceTrack_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DueDiligenceTrack" ADD CONSTRAINT "DueDiligenceTrack_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DueDiligenceTrack" ADD CONSTRAINT "DueDiligenceTrack_serviceProviderId_fkey" FOREIGN KEY ("serviceProviderId") REFERENCES "ServiceProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
