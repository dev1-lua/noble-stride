-- WS-B migration 7 — auth / onboarding / applications / investor portal.
-- ADDITIVE ONLY: new nullable columns, two new enum values, one new table.
-- Applied with `npx prisma migrate deploy` against the restored dump.

-- AlterEnum (G4: diagram step-1 sources)
ALTER TYPE "Source" ADD VALUE 'DeskResearch';
ALTER TYPE "Source" ADD VALUE 'ExistingNetwork';

-- AlterTable (F3.3: approval timestamp)
ALTER TABLE "Investor" ADD COLUMN     "approvedAt" TIMESTAMP(3);

-- AlterTable (F3.6: self-service email change)
ALTER TABLE "AuthAccount" ADD COLUMN     "pendingEmail" TEXT,
                          ADD COLUMN     "pendingEmailRequestedAt" TIMESTAMP(3);

-- AlterTable (F3.2: click-wrap NDA evidence)
ALTER TABLE "ESignEnvelope" ADD COLUMN     "templateVersion" TEXT,
                            ADD COLUMN     "signedIp" TEXT,
                            ADD COLUMN     "signatureImage" TEXT;

-- AlterTable (F6b.2: deal-access grant audit)
ALTER TABLE "Engagement" ADD COLUMN     "accessGrantedAt" TIMESTAMP(3),
                         ADD COLUMN     "accessGrantedById" TEXT;

-- AlterTable (F3.1/F2.4: uploads made by an external Person, not a staff User)
ALTER TABLE "Document" ADD COLUMN     "uploadedByPersonId" TEXT;

-- CreateTable (G1: public /apply/status OTP; mirrors ClientOtpChallenge but
-- keyed to a raw email because no Client/Person match is required to start)
CREATE TABLE "ApplicantOtpChallenge" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicantOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Investor_approvedAt_idx" ON "Investor"("approvedAt");
CREATE INDEX "Engagement_accessGrantedById_idx" ON "Engagement"("accessGrantedById");
CREATE INDEX "Document_uploadedByPersonId_idx" ON "Document"("uploadedByPersonId");
CREATE INDEX "ApplicantOtpChallenge_email_idx" ON "ApplicantOtpChallenge"("email");
CREATE INDEX "ApplicantOtpChallenge_email_createdAt_idx" ON "ApplicantOtpChallenge"("email", "createdAt");

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_accessGrantedById_fkey" FOREIGN KEY ("accessGrantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedByPersonId_fkey" FOREIGN KEY ("uploadedByPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
