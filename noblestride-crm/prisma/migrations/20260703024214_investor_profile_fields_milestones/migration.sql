-- CreateEnum
CREATE TYPE "MilestoneKey" AS ENUM ('TeaserReview', 'NdaExecuted', 'ExpressionOfInterest', 'DataRoomAccess', 'PreliminaryDD', 'ICPaperPrepared', 'FirstICApproval', 'NonBindingTermSheet', 'TermSheetExecuted', 'OnsiteDD', 'SecondICApproval', 'BindingOffer', 'DefinitiveAgreements', 'CompetitionApproval', 'SuccessFeePaid');

-- AlterTable
ALTER TABLE "Investor" ADD COLUMN     "caseStudies" TEXT,
ADD COLUMN     "collaborationTerms" TEXT,
ADD COLUMN     "impactMetrics" TEXT,
ADD COLUMN     "notableInvestments" TEXT,
ADD COLUMN     "portfolioComposition" TEXT,
ADD COLUMN     "reinvestmentPolicy" TEXT,
ADD COLUMN     "reputationalRisks" TEXT,
ADD COLUMN     "teamComposition" TEXT;

-- CreateTable
CREATE TABLE "EngagementMilestone" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "key" "MilestoneKey" NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdSource" "ActorSource" NOT NULL DEFAULT 'HUMAN',

    CONSTRAINT "EngagementMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EngagementMilestone_engagementId_idx" ON "EngagementMilestone"("engagementId");

-- CreateIndex
CREATE UNIQUE INDEX "EngagementMilestone_engagementId_key_key" ON "EngagementMilestone"("engagementId", "key");

-- AddForeignKey
ALTER TABLE "EngagementMilestone" ADD CONSTRAINT "EngagementMilestone_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
