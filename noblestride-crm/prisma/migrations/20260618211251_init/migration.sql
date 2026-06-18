-- CreateEnum
CREATE TYPE "Sector" AS ENUM ('Agribusiness', 'FinancialServices', 'FMCG', 'Manufacturing', 'RenewableEnergy', 'Technology', 'Healthcare', 'Banking', 'RealEstate', 'Education', 'Infrastructure');

-- CreateEnum
CREATE TYPE "InvestorType" AS ENUM ('PrivateEquity', 'VentureCapital', 'DFI', 'DebtProvider', 'FamilyOffice', 'Angel', 'CorporateVC', 'GrantDonor');

-- CreateEnum
CREATE TYPE "InvestorStatus" AS ENUM ('ActivelyDeploying', 'Fundraising', 'FinalClose', 'FullyDeployed', 'Dormant');

-- CreateEnum
CREATE TYPE "Instrument" AS ENUM ('Equity', 'Debt', 'Mezzanine', 'Grant', 'Convertible');

-- CreateEnum
CREATE TYPE "InvestmentStage" AS ENUM ('PreSeed', 'Seed', 'SeriesA', 'SeriesB', 'Growth', 'MatureBuyout');

-- CreateEnum
CREATE TYPE "Geography" AS ENUM ('EastAfrica', 'WestAfrica', 'SouthernAfrica', 'SubSaharanAfrica', 'PanAfrica', 'NorthAfrica', 'FrancophoneAfrica', 'MENA', 'Europe', 'USA', 'Global');

-- CreateEnum
CREATE TYPE "MandateStage" AS ENUM ('NewLead', 'Qualification', 'PitchPresentation', 'Proposal', 'Negotiation', 'Signed', 'Lost');

-- CreateEnum
CREATE TYPE "TransactionStage" AS ENUM ('DealPreparation', 'InvestorOutreach', 'DueDiligence', 'TermSheet', 'Closing', 'ClosedWon', 'ClosedLost');

-- CreateEnum
CREATE TYPE "EngagementStatus" AS ENUM ('NotContacted', 'Contacted', 'InConversation', 'Interested', 'Passed', 'Committed');

-- CreateEnum
CREATE TYPE "Source" AS ENUM ('MondayMeeting', 'WhatsApp', 'Email', 'Verbal', 'Referral', 'Inbound', 'Outreach', 'Event', 'Website');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('NotSent', 'Sent', 'Signed');

-- CreateEnum
CREATE TYPE "DealType" AS ENUM ('SeriesA', 'SeriesB', 'Growth', 'Expansion', 'AcquisitionFinance');

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('LawFirm', 'Auditor', 'Advisor', 'Bank', 'InvestmentBank', 'Consulting', 'Other');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('Active', 'Preferred', 'Inactive');

-- CreateEnum
CREATE TYPE "FounderGender" AS ENUM ('Male', 'Female', 'Mixed');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NotStarted', 'Pending', 'Ongoing', 'Done');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('Outreach', 'NDASent', 'NDASigned', 'DataRoomAccess', 'Meeting', 'Call', 'Email', 'Feedback', 'TermSheet', 'Note', 'Other');

-- CreateEnum
CREATE TYPE "ActorSource" AS ENUM ('HUMAN', 'AGENT', 'API', 'IMPORT', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "jobTitle" TEXT,
    "avatarColor" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "jobTitle" TEXT,
    "linkedinUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "investorId" TEXT,
    "clientId" TEXT,
    "partnerId" TEXT,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "investorType" "InvestorType" NOT NULL,
    "website" TEXT,
    "status" "InvestorStatus",
    "sectorFocus" "Sector"[] DEFAULT ARRAY[]::"Sector"[],
    "geographicFocus" "Geography"[] DEFAULT ARRAY[]::"Geography"[],
    "instruments" "Instrument"[] DEFAULT ARRAY[]::"Instrument"[],
    "investmentStages" "InvestmentStage"[] DEFAULT ARRAY[]::"InvestmentStage"[],
    "aum" DECIMAL(20,2),
    "ticketMin" DECIMAL(20,2),
    "ticketMax" DECIMAL(20,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "targetIrr" DOUBLE PRECISION,
    "countryRestrictions" TEXT,
    "esgFocus" TEXT,
    "decisionProcess" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "yearFounded" INTEGER,
    "hqCity" TEXT,
    "countries" "Geography"[] DEFAULT ARRAY[]::"Geography"[],
    "website" TEXT,
    "sector" "Sector"[] DEFAULT ARRAY[]::"Sector"[],
    "coreProduct" TEXT,
    "description" TEXT,
    "founders" TEXT,
    "founderGender" "FounderGender",
    "revenueLastYear" DECIMAL(20,2),
    "revenueForecast" DECIMAL(20,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "profitable" BOOLEAN,
    "existingInvestors" TEXT,
    "source" "Source",
    "pitchDeckUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mandate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "MandateStage" NOT NULL DEFAULT 'NewLead',
    "stageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dealSize" DECIMAL(20,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "sector" "Sector"[] DEFAULT ARRAY[]::"Sector"[],
    "source" "Source",
    "dateOpened" TIMESTAMP(3),
    "ndaStatus" "DocStatus" NOT NULL DEFAULT 'NotSent',
    "ndaSentDate" TIMESTAMP(3),
    "ndaSignedDate" TIMESTAMP(3),
    "eaStatus" "DocStatus" NOT NULL DEFAULT 'NotSent',
    "eaSentDate" TIMESTAMP(3),
    "eaSignedDate" TIMESTAMP(3),
    "nextAction" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientId" TEXT NOT NULL,
    "leadId" TEXT,
    "referredById" TEXT,

    CONSTRAINT "Mandate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "TransactionStage" NOT NULL DEFAULT 'DealPreparation',
    "stageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dealType" "DealType",
    "instrument" "Instrument"[] DEFAULT ARRAY[]::"Instrument"[],
    "targetRaise" DECIMAL(20,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "sector" "Sector"[] DEFAULT ARRAY[]::"Sector"[],
    "dateOpened" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientId" TEXT NOT NULL,
    "mandateId" TEXT,
    "ownerId" TEXT,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Engagement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EngagementStatus" NOT NULL DEFAULT 'NotContacted',
    "lastContact" TIMESTAMP(3),
    "notes" TEXT,
    "createdSource" "ActorSource" NOT NULL DEFAULT 'HUMAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "transactionId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "ownerId" TEXT,

    CONSTRAINT "Engagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partnerType" "PartnerType",
    "profile" TEXT,
    "status" "PartnerStatus" NOT NULL DEFAULT 'Active',
    "location" TEXT,
    "amount" DECIMAL(20,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "type" "InteractionType" NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdSource" "ActorSource" NOT NULL DEFAULT 'HUMAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "engagementId" TEXT,
    "transactionId" TEXT,
    "investorId" TEXT,
    "mandateId" TEXT,
    "createdById" TEXT,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'NotStarted',
    "dueAt" TIMESTAMP(3),
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assigneeId" TEXT,
    "mandateId" TEXT,
    "transactionId" TEXT,
    "investorId" TEXT,
    "clientId" TEXT,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Person_investorId_idx" ON "Person"("investorId");

-- CreateIndex
CREATE INDEX "Person_clientId_idx" ON "Person"("clientId");

-- CreateIndex
CREATE INDEX "Person_partnerId_idx" ON "Person"("partnerId");

-- CreateIndex
CREATE INDEX "Investor_investorType_idx" ON "Investor"("investorType");

-- CreateIndex
CREATE INDEX "Investor_status_idx" ON "Investor"("status");

-- CreateIndex
CREATE INDEX "Mandate_stage_idx" ON "Mandate"("stage");

-- CreateIndex
CREATE INDEX "Mandate_clientId_idx" ON "Mandate"("clientId");

-- CreateIndex
CREATE INDEX "Mandate_leadId_idx" ON "Mandate"("leadId");

-- CreateIndex
CREATE INDEX "Transaction_stage_idx" ON "Transaction"("stage");

-- CreateIndex
CREATE INDEX "Transaction_clientId_idx" ON "Transaction"("clientId");

-- CreateIndex
CREATE INDEX "Transaction_ownerId_idx" ON "Transaction"("ownerId");

-- CreateIndex
CREATE INDEX "Engagement_status_idx" ON "Engagement"("status");

-- CreateIndex
CREATE INDEX "Engagement_investorId_idx" ON "Engagement"("investorId");

-- CreateIndex
CREATE UNIQUE INDEX "Engagement_transactionId_investorId_key" ON "Engagement"("transactionId", "investorId");

-- CreateIndex
CREATE INDEX "Partner_partnerType_idx" ON "Partner"("partnerType");

-- CreateIndex
CREATE INDEX "Partner_status_idx" ON "Partner"("status");

-- CreateIndex
CREATE INDEX "Activity_type_idx" ON "Activity"("type");

-- CreateIndex
CREATE INDEX "Activity_engagementId_idx" ON "Activity"("engagementId");

-- CreateIndex
CREATE INDEX "Activity_occurredAt_idx" ON "Activity"("occurredAt");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
