-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSSAContact" BOOLEAN NOT NULL DEFAULT false;
