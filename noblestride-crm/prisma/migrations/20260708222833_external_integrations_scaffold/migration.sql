-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "boxFileId" TEXT,
ADD COLUMN     "boxSharedLinkUrl" TEXT,
ADD COLUMN     "boxWatermarkApplied" BOOLEAN;

-- CreateTable
CREATE TABLE "ESignEnvelope" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'docusign',
    "externalId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "signerEmail" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "investorId" TEXT,
    "engagementId" TEXT,
    "transactionId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdSource" "ActorSource" NOT NULL DEFAULT 'API',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ESignEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'teams',
    "externalId" TEXT NOT NULL,
    "joinUrl" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "organizerUserId" TEXT NOT NULL,
    "engagementId" TEXT,
    "transactionId" TEXT,
    "investorId" TEXT,
    "createdSource" "ActorSource" NOT NULL DEFAULT 'API',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'outlook',
    "externalId" TEXT NOT NULL,
    "conversationId" TEXT,
    "subject" TEXT,
    "fromAddress" TEXT,
    "toAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "direction" TEXT,
    "bodyPreview" TEXT,
    "receivedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "matchedBy" TEXT,
    "investorId" TEXT,
    "transactionId" TEXT,
    "engagementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphSubscription" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "mailbox" TEXT NOT NULL,
    "clientState" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraphSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentShareEvent" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'box',
    "viewerEmail" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentShareEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ESignEnvelope_investorId_idx" ON "ESignEnvelope"("investorId");

-- CreateIndex
CREATE INDEX "ESignEnvelope_engagementId_idx" ON "ESignEnvelope"("engagementId");

-- CreateIndex
CREATE UNIQUE INDEX "ESignEnvelope_provider_externalId_key" ON "ESignEnvelope"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_provider_externalId_key" ON "Meeting"("provider", "externalId");

-- CreateIndex
CREATE INDEX "EmailMessage_conversationId_idx" ON "EmailMessage"("conversationId");

-- CreateIndex
CREATE INDEX "EmailMessage_investorId_idx" ON "EmailMessage"("investorId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_provider_externalId_key" ON "EmailMessage"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "GraphSubscription_subscriptionId_key" ON "GraphSubscription"("subscriptionId");

-- CreateIndex
CREATE INDEX "DocumentShareEvent_documentId_idx" ON "DocumentShareEvent"("documentId");

-- AddForeignKey
ALTER TABLE "ESignEnvelope" ADD CONSTRAINT "ESignEnvelope_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ESignEnvelope" ADD CONSTRAINT "ESignEnvelope_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ESignEnvelope" ADD CONSTRAINT "ESignEnvelope_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentShareEvent" ADD CONSTRAINT "DocumentShareEvent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
