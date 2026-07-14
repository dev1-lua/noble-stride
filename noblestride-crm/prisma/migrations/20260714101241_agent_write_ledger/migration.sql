-- CreateEnum
CREATE TYPE "AgentWriteStatus" AS ENUM ('Pending', 'Committing', 'Committed', 'Failed', 'Cancelled');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "createdSource" "ActorSource" NOT NULL DEFAULT 'HUMAN';

-- CreateTable
CREATE TABLE "AgentPendingWrite" (
    "id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "targetId" TEXT,
    "payload" JSONB NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "preview" TEXT NOT NULL,
    "status" "AgentWriteStatus" NOT NULL DEFAULT 'Pending',
    "error" TEXT,
    "resultId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "committedAt" TIMESTAMP(3),

    CONSTRAINT "AgentPendingWrite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentPendingWrite_status_expiresAt_idx" ON "AgentPendingWrite"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "AgentPendingWrite_actorUserId_createdAt_idx" ON "AgentPendingWrite"("actorUserId", "createdAt");
