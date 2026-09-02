-- Retainer payment log — F4.3.1's third clause (Aug-2026 feedback).
-- ADDITIVE ONLY: one new table. No existing row is touched; the ledger starts
-- empty and Mandate.retainerPaidAmount keeps whatever history it already holds.
-- Applied with `npx prisma migrate deploy`.

-- CreateTable
CREATE TABLE "RetainerPayment" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "recordedById" TEXT,
    "createdSource" "ActorSource" NOT NULL DEFAULT 'HUMAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetainerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RetainerPayment_mandateId_idx" ON "RetainerPayment"("mandateId");

-- AddForeignKey
ALTER TABLE "RetainerPayment" ADD CONSTRAINT "RetainerPayment_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetainerPayment" ADD CONSTRAINT "RetainerPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
