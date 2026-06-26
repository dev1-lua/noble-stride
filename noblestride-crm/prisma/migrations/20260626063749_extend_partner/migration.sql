-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "advisorType" "AdvisorType",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "feeSharingAgreement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "feeSharingTerms" TEXT,
ADD COLUMN     "internalOnly" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "organization" TEXT,
ADD COLUMN     "partnerAgreementStatus" "PartnerAgreementStatus" NOT NULL DEFAULT 'None',
ADD COLUMN     "phone" TEXT;

-- CreateIndex
CREATE INDEX "Partner_advisorType_idx" ON "Partner"("advisorType");
