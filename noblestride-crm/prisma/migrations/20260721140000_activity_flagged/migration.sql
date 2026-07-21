-- Agent-raised review flag on Activity. Additive, non-destructive.
ALTER TABLE "Activity" ADD COLUMN "flagged" BOOLEAN NOT NULL DEFAULT false;
