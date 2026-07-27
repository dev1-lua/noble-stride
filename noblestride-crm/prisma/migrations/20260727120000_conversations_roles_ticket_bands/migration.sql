-- Action points 2026-07 (remaining items): two-way conversation threads,
-- portal member roles + thread opt-in, multiple investor ticket bands,
-- and a Portal value for the comms channel enum.

-- AlterEnum
ALTER TYPE "CommChannel" ADD VALUE 'Portal';

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('Pending', 'Open', 'InProgress', 'Closed');

-- CreateEnum
CREATE TYPE "MessageSenderKind" AS ENUM ('INVESTOR', 'STAFF');

-- CreateEnum
CREATE TYPE "PortalMemberRole" AS ENUM ('Editor', 'Viewer');

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "portalRole" "PortalMemberRole" NOT NULL DEFAULT 'Editor',
ADD COLUMN     "canPostInThreads" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'Pending',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderKind" "MessageSenderKind" NOT NULL,
    "senderUserId" TEXT,
    "senderPersonId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorTicketBand" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "min" DECIMAL(20,2) NOT NULL,
    "max" DECIMAL(20,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestorTicketBand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_engagementId_key" ON "Conversation"("engagementId");

-- CreateIndex
CREATE INDEX "Conversation_status_idx" ON "Conversation"("status");

-- CreateIndex
CREATE INDEX "ConversationMessage_conversationId_createdAt_idx" ON "ConversationMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "InvestorTicketBand_investorId_idx" ON "InvestorTicketBand"("investorId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_senderPersonId_fkey" FOREIGN KEY ("senderPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorTicketBand" ADD CONSTRAINT "InvestorTicketBand_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
