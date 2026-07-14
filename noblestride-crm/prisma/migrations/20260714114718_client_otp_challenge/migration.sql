-- CreateTable
CREATE TABLE "ClientOtpChallenge" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientOtpChallenge_personId_idx" ON "ClientOtpChallenge"("personId");

-- CreateIndex
CREATE INDEX "ClientOtpChallenge_destination_createdAt_idx" ON "ClientOtpChallenge"("destination", "createdAt");

-- AddForeignKey
ALTER TABLE "ClientOtpChallenge" ADD CONSTRAINT "ClientOtpChallenge_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientOtpChallenge" ADD CONSTRAINT "ClientOtpChallenge_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
