-- Raw-SQL-only partial unique index (same convention as OutreachDraft_active_pair_key):
-- Prisma cannot express a partial index, so it is NOT in schema.prisma and `migrate diff`
-- will not report it. App code also clears other defaults in the same $transaction.
CREATE UNIQUE INDEX "WorkflowTemplate_single_default" ON "WorkflowTemplate" ("isDefault") WHERE "isDefault";
