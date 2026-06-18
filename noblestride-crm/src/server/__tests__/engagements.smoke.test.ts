// Smoke tests for engagement, activity, and partner services.
// Robust to the database being down: if DATABASE_URL is unset or the DB is
// unreachable, all tests are skipped (never fail the suite).
//
// NOTE: logEngagement is intentionally NOT exercised here — it mutates the DB
// and requires real ids. Correctness is covered by tsc + review + Task 15
// manual/visual check.

import { describe, it, expect } from "vitest";
import { activityTimeline, engagementCounters } from "@/server/services/activities";
import { partnerReferralStats } from "@/server/services/partners";

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

describe("activities service (smoke)", () => {
  it("activityTimeline() returns an array", async () => {
    const result = await withDb(() => activityTimeline());
    if (result === null) return; // DB down or unset — skip
    expect(Array.isArray(result)).toBe(true);
  });

  it("engagementCounters() returns an object with six numeric fields", async () => {
    const result = await withDb(() => engagementCounters());
    if (result === null) return; // DB down or unset — skip
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
    expect(typeof result!.outreach).toBe("number");
    expect(typeof result!.ndaSigned).toBe("number");
    expect(typeof result!.dataRoom).toBe("number");
    expect(typeof result!.meetings).toBe("number");
    expect(typeof result!.feedback).toBe("number");
    expect(typeof result!.termSheets).toBe("number");
  });
});

describe("partners service (smoke)", () => {
  it("partnerReferralStats() returns an object with correct shape", async () => {
    const result = await withDb(() => partnerReferralStats());
    if (result === null) return; // DB down or unset — skip
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
    expect(typeof result!.totalPartners).toBe("number");
    expect(typeof result!.dealsReferred).toBe("number");
    expect(typeof result!.closedRevenue).toBe("number");
    expect(typeof result!.conversionRate).toBe("number");
    expect(Array.isArray(result!.byPartner)).toBe(true);
  });
});
