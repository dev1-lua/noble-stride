-- DB-level dedup for active OutreachDraft rows per (transactionId, investorId) pair.
-- A partial unique index can't be expressed in the Prisma schema (Prisma has no
-- native support for partial/filtered unique indexes), so it's hand-written here.
-- Kept in sync with ACTIVE_DRAFT_STATUSES in src/server/services/outreach.ts.
CREATE UNIQUE INDEX "OutreachDraft_active_pair_key" ON "OutreachDraft"("transactionId", "investorId") WHERE "status" IN ('Draft', 'Approved', 'Sent', 'Failed');
