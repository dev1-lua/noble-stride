-- CreateEnum
CREATE TYPE "BlockedRegistrationKind" AS ENUM ('Domain', 'Email');

-- CreateTable
CREATE TABLE "BlockedRegistration" (
    "id" TEXT NOT NULL,
    "kind" "BlockedRegistrationKind" NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT,
    "investorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlockedRegistration_investorId_idx" ON "BlockedRegistration"("investorId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedRegistration_kind_value_key" ON "BlockedRegistration"("kind", "value");

-- AddForeignKey
ALTER TABLE "BlockedRegistration" ADD CONSTRAINT "BlockedRegistration_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
