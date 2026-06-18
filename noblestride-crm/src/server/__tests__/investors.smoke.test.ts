// Smoke test for the investor service.
// Robust to the database being down: if DATABASE_URL is unset or the DB is
// unreachable, the test is skipped (never fails the suite).

import { describe, it, expect } from "vitest";
import { listInvestors } from "@/server/services/investors";

describe("investors service (smoke)", () => {
  it("listInvestors({}) returns an array when DB is available", async () => {
    if (!process.env.DATABASE_URL) {
      console.log("DATABASE_URL not set — skipping smoke test");
      return;
    }

    try {
      const result = await listInvestors({});
      expect(Array.isArray(result)).toBe(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Connection refused, timeout, or any DB-unreachable error → skip
      if (
        message.includes("ECONNREFUSED") ||
        message.includes("ENOTFOUND") ||
        message.includes("connect") ||
        message.includes("Can't reach database") ||
        message.includes("P1001") ||
        message.includes("P1002")
      ) {
        console.log("DB unreachable — skipping smoke test:", message);
        return;
      }
      // Unexpected error: re-throw so the test fails with useful information
      throw err;
    }
  });
});
