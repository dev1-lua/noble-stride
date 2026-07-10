import { describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Skip when no DATABASE_URL is available (e.g. CI without a DB) — this is a
// schema/client smoke test, not a full integration test.
const d = process.env.DATABASE_URL ? describe : describe.skip;

d("integration schema", () => {
  it("exposes the new models on the client", () => {
    expect(prisma.eSignEnvelope).toBeDefined();
    expect(prisma.meeting).toBeDefined();
    expect(prisma.emailMessage).toBeDefined();
    expect(prisma.graphSubscription).toBeDefined();
    expect(prisma.documentShareEvent).toBeDefined();
  });
});
