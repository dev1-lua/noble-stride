-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "createdSource" "ActorSource" NOT NULL DEFAULT 'HUMAN';

-- AlterTable
ALTER TABLE "Investor" ADD COLUMN     "createdSource" "ActorSource" NOT NULL DEFAULT 'HUMAN';

-- AlterTable
ALTER TABLE "Mandate" ADD COLUMN     "createdSource" "ActorSource" NOT NULL DEFAULT 'HUMAN';

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "createdSource" "ActorSource" NOT NULL DEFAULT 'HUMAN';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "createdSource" "ActorSource" NOT NULL DEFAULT 'HUMAN';
