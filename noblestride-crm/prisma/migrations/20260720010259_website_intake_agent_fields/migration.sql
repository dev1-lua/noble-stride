-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "raisedToDateTotal" DECIMAL(20,2);

-- AlterTable
ALTER TABLE "Mandate" ADD COLUMN     "instrument" "Instrument"[] DEFAULT ARRAY[]::"Instrument"[],
ADD COLUMN     "intakeNdaAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "intakeNdaAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "postMoneyValuation" DECIMAL(20,2),
ADD COLUMN     "raisedToDateRound" DECIMAL(20,2);
