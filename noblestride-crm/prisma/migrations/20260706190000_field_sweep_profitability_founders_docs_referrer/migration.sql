-- Profitability picklist replaces Client.profitable boolean (spec §3.1)
CREATE TYPE "Profitability" AS ENUM ('Profitable', 'LossMaking');
ALTER TABLE "Client" ADD COLUMN "profitability" "Profitability";
UPDATE "Client" SET "profitability" =
  CASE WHEN "profitable" IS TRUE  THEN 'Profitable'::"Profitability"
       WHEN "profitable" IS FALSE THEN 'LossMaking'::"Profitability"
  END;
ALTER TABLE "Client" DROP COLUMN "profitable";

-- founderGender -> founderGenders multi-select (spec §3.1: Multi)
ALTER TABLE "Client" ADD COLUMN "founderGenders" "FounderGender"[] NOT NULL DEFAULT ARRAY[]::"FounderGender"[];
UPDATE "Client" SET "founderGenders" = ARRAY["founderGender"]::"FounderGender"[] WHERE "founderGender" IS NOT NULL;
ALTER TABLE "Client" DROP COLUMN "founderGender";

-- Document -> Mandate link (spec §3.9 linked record = Deal)
ALTER TABLE "Document" ADD COLUMN "mandateId" TEXT;
ALTER TABLE "Document" ADD CONSTRAINT "Document_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Document_mandateId_idx" ON "Document"("mandateId");

-- Transaction consultant/referrer (spec §3.2), mirroring Mandate.referredBy
ALTER TABLE "Transaction" ADD COLUMN "referredById" TEXT;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
