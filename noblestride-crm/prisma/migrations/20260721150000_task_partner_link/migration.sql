-- Task↔Partner link (spec §3.8 link rule extended): a partner introduction with
-- no deal yet still gets its review task linked — to the Partner itself.

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "partnerId" TEXT;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
