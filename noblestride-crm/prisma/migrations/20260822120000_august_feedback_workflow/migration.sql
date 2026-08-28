-- CreateEnum
CREATE TYPE "WorkflowPhase" AS ENUM ('Qualify', 'Prepare', 'Execute');
CREATE TYPE "DealKind" AS ENUM ('Mandate', 'Transaction', 'Advisory');
CREATE TYPE "AdvisoryClassification" AS ENUM ('Valuation', 'DueDiligence', 'BusinessPlanPitchDeck', 'FinancialModel', 'AdvisorySupport', 'Other');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "projectCodename" TEXT,
                     ADD COLUMN "womenLed" BOOLEAN NOT NULL DEFAULT false,
                     ADD COLUMN "youthLed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Mandate" ADD COLUMN "retainerPaidAmount" DECIMAL(20,2),
                      ADD COLUMN "workflowTemplateId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "workflowTemplateId" TEXT;
ALTER TABLE "AdvisoryEngagement" ADD COLUMN "classification" "AdvisoryClassification",
                                 ADD COLUMN "feePaidAmount" DECIMAL(20,2),
                                 ADD COLUMN "workflowTemplateId" TEXT;

-- CreateTable
CREATE TABLE "WorkflowTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "phase" "WorkflowPhase" NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "appliesTo" "DealKind"[] DEFAULT ARRAY[]::"DealKind"[],
    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DealStageState" (
    "id" TEXT NOT NULL,
    "dealKind" "DealKind" NOT NULL,
    "dealId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "manualStatus" TEXT NOT NULL,
    "note" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DealStageState_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EngagementParticipant" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EngagementParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowTemplate_isDefault_idx" ON "WorkflowTemplate"("isDefault");
CREATE INDEX "WorkflowStep_templateId_idx" ON "WorkflowStep"("templateId");
CREATE UNIQUE INDEX "WorkflowStep_templateId_key_key" ON "WorkflowStep"("templateId", "key");
CREATE INDEX "DealStageState_dealKind_dealId_idx" ON "DealStageState"("dealKind", "dealId");
CREATE UNIQUE INDEX "DealStageState_dealKind_dealId_stepKey_key" ON "DealStageState"("dealKind", "dealId", "stepKey");
CREATE UNIQUE INDEX "EngagementParticipant_engagementId_personId_key" ON "EngagementParticipant"("engagementId", "personId");

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_workflowTemplateId_fkey" FOREIGN KEY ("workflowTemplateId") REFERENCES "WorkflowTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_workflowTemplateId_fkey" FOREIGN KEY ("workflowTemplateId") REFERENCES "WorkflowTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdvisoryEngagement" ADD CONSTRAINT "AdvisoryEngagement_workflowTemplateId_fkey" FOREIGN KEY ("workflowTemplateId") REFERENCES "WorkflowTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealStageState" ADD CONSTRAINT "DealStageState_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EngagementParticipant" ADD CONSTRAINT "EngagementParticipant_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EngagementParticipant" ADD CONSTRAINT "EngagementParticipant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EngagementParticipant" ADD CONSTRAINT "EngagementParticipant_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
