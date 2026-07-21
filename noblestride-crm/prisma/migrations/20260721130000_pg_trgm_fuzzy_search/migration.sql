-- Typo-tolerant global search.
-- Enables PostgreSQL trigram matching so globalSearch (searchForInternal in
-- src/server/search/global-search.ts) can find records even when the query has
-- a typo or the stored name is misspelled (e.g. "Pharmaceuticals" -> stored
-- "Phamaceuticals"). Replaces the previous whole-string ILIKE '%q%' matching,
-- which returned nothing on any single-character mismatch.
--
-- NOTE: these objects (the extension + GIN indexes) are managed by this raw SQL
-- migration and are intentionally not declared in schema.prisma. Apply with
-- `prisma migrate deploy` (prod) or `prisma migrate dev` (local).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes on every column globalSearch matches, so similarity(),
-- word_similarity() and ILIKE '%…%' stay index-backed instead of seq-scanning.
CREATE INDEX IF NOT EXISTS "Investor_name_trgm_idx" ON "Investor" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Client_name_trgm_idx" ON "Client" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Mandate_name_trgm_idx" ON "Mandate" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Transaction_name_trgm_idx" ON "Transaction" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Partner_name_trgm_idx" ON "Partner" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "ServiceProvider_name_trgm_idx" ON "ServiceProvider" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Document_name_trgm_idx" ON "Document" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Task_title_trgm_idx" ON "Task" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Engagement_name_trgm_idx" ON "Engagement" USING gin ("name" gin_trgm_ops);
-- Person matches on the concatenated full name, so index that exact expression.
CREATE INDEX IF NOT EXISTS "Person_fullname_trgm_idx"
  ON "Person" USING gin (("firstName" || ' ' || COALESCE("lastName", '')) gin_trgm_ops);
