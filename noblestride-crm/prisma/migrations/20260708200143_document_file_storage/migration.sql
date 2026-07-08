-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "isCurrent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "originalFilename" TEXT,
ADD COLUMN     "previousVersionId" TEXT,
ADD COLUMN     "sizeBytes" INTEGER,
ADD COLUMN     "storageKey" TEXT,
ADD COLUMN     "storageProvider" TEXT DEFAULT 'local';

-- CreateTable
CREATE TABLE "DocumentAccessLog" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentAccessLog_documentId_idx" ON "DocumentAccessLog"("documentId");

-- CreateIndex
CREATE INDEX "DocumentAccessLog_userId_idx" ON "DocumentAccessLog"("userId");

-- CreateIndex
CREATE INDEX "Document_isCurrent_idx" ON "Document"("isCurrent");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessLog" ADD CONSTRAINT "DocumentAccessLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
