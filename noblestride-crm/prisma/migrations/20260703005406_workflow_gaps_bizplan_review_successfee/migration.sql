-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'BusinessPlan';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approverId" TEXT,
ADD COLUMN     "clientReviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewerId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "successFeeAmount" DECIMAL(20,2),
ADD COLUMN     "successFeeInvoicedDate" TIMESTAMP(3),
ADD COLUMN     "successFeePaidDate" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
