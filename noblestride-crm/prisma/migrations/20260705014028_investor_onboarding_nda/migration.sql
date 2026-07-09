-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('PendingReview', 'Approved', 'Rejected');

-- AlterTable
ALTER TABLE "Engagement" ADD COLUMN     "ndaSignedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Investor" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'Approved',
ADD COLUMN     "openNdaSignedAt" TIMESTAMP(3),
ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "registeredAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Investor_onboardingStatus_idx" ON "Investor"("onboardingStatus");
