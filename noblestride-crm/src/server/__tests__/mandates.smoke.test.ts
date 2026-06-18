// Smoke tests for mandate and transaction services.
// Robust to the database being down: if DATABASE_URL is unset or the DB is
// unreachable, the tests are skipped (never fail the suite).

import { describe, it, expect } from "vitest";
import { mandatesByStage } from "@/server/services/mandates";
import { transactionsByStage } from "@/server/services/transactions";

/** Helper: run `fn`, skip on DB errors, re-throw unexpected errors. */
async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set — skipping smoke test");
    return null;
  }
  try {
    return await fn();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND") ||
      message.includes("connect") ||
      message.includes("Can't reach database") ||
      message.includes("P1001") ||
      message.includes("P1002")
    ) {
      console.log("DB unreachable — skipping smoke test:", message);
      return null;
    }
    throw err;
  }
}

describe("mandates service (smoke)", () => {
  it("mandatesByStage() returns one column per MandateStage (length === 7)", async () => {
    const columns = await withDb(() => mandatesByStage());
    if (columns === null) return; // DB down or unset — skip

    expect(columns).toHaveLength(7);
    for (const col of columns) {
      expect(typeof col.stage).toBe("string");
      expect(typeof col.label).toBe("string");
      expect(Array.isArray(col.items)).toBe(true);
    }
  });
});

describe("transactions service (smoke)", () => {
  it("transactionsByStage() returns one column per TransactionStage (length === 7) with counts", async () => {
    const columns = await withDb(() => transactionsByStage());
    if (columns === null) return; // DB down or unset — skip

    expect(columns).toHaveLength(7);
    for (const col of columns) {
      expect(typeof col.stage).toBe("string");
      expect(typeof col.label).toBe("string");
      expect(Array.isArray(col.items)).toBe(true);
      for (const item of col.items) {
        expect(typeof item.investorsContacted).toBe("number");
        expect(typeof item.activeConversations).toBe("number");
      }
    }
  });
});
