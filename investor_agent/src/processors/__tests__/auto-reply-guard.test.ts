import { describe, it, expect, vi } from "vitest";
import { gateDecision, rateDecision, checkAutoReplyRateLimit } from "../auto-reply-guard";

describe("gateDecision", () => {
  it("blocks RFC-3834 auto-submitted mail", () => {
    expect(gateDecision({ autoSubmitted: "auto-replied" }).block).toBe(true);
  });
  it("blocks bulk precedence and suppress headers", () => {
    expect(gateDecision({ precedence: "bulk" }).block).toBe(true);
    expect(gateDecision({ autoResponseSuppress: "All" }).block).toBe(true);
  });
  it("blocks no-reply / mailer-daemon senders", () => {
    expect(gateDecision({ from: "no-reply@fund.com" }).block).toBe(true);
    expect(gateDecision({ from: "MAILER-DAEMON@mx.example" }).block).toBe(true);
    expect(gateDecision({ from: "postmaster@mx.example" }).block).toBe(true);
  });
  it("blocks obvious OOO subjects", () => {
    expect(gateDecision({ subject: "Automatic reply: Out of Office" }).block).toBe(true);
  });
  it("lets normal mail through", () => {
    expect(gateDecision({ from: "jo@acme.fund", subject: "Updated mandate" }).block).toBe(false);
    expect(gateDecision({ autoSubmitted: "no" }).block).toBe(false);
  });
});

// spec §7 backstop: count auto-replies per sender in a sliding window and block
// once the count exceeds the limit. `rateDecision` is the pure, injectable core;
// `checkAutoReplyRateLimit` is the thin wrapper around lua-cli's Data API.
describe("rateDecision (pure)", () => {
  const WINDOW_MS = 10 * 60_000;
  const NOW = 1_000_000_000;

  it("proceeds (does not block) when under the limit", () => {
    const events = [NOW - 1000, NOW - 2000, NOW - 3000]; // 3 events, limit 20
    expect(rateDecision(events, NOW, 20, WINDOW_MS)).toBe(false);
  });

  it("blocks when more than the limit have occurred inside the window", () => {
    const events = Array.from({ length: 21 }, (_, i) => NOW - i * 1000); // 21 events within window
    expect(rateDecision(events, NOW, 20, WINDOW_MS)).toBe(true);
  });

  it("proceeds on empty history", () => {
    expect(rateDecision([], NOW, 20, WINDOW_MS)).toBe(false);
  });

  it("ignores events outside the trailing window", () => {
    // 25 events, but all but 2 are older than the window, so it should proceed.
    const old = Array.from({ length: 25 }, (_, i) => NOW - WINDOW_MS - 5000 - i * 1000);
    const recent = [NOW - 100, NOW - 200];
    expect(rateDecision([...old, ...recent], NOW, 20, WINDOW_MS)).toBe(false);
  });
});

describe("checkAutoReplyRateLimit (wrapper)", () => {
  it("fails open when the Data API throws", async () => {
    const dataCreate = vi.fn(async () => {
      throw new Error("Data API unavailable");
    });
    const dataGet = vi.fn(async () => {
      throw new Error("should not be reached, but also fail-open if it is");
    });
    const blocked = await checkAutoReplyRateLimit("jo@acme.fund", {
      dataCreate: dataCreate as never,
      dataGet: dataGet as never,
    });
    expect(blocked).toBe(false);
  });

  it("fails open when Data.get throws even if Data.create succeeds", async () => {
    const dataCreate = vi.fn(async () => ({}) as never);
    const dataGet = vi.fn(async () => {
      throw new Error("boom");
    });
    const blocked = await checkAutoReplyRateLimit("jo@acme.fund", {
      dataCreate: dataCreate as never,
      dataGet: dataGet as never,
    });
    expect(blocked).toBe(false);
  });

  it("proceeds under the configured limit and blocks over it", async () => {
    const now = 2_000_000_000;
    const dataCreate = vi.fn(async () => ({}) as never);
    const makeGet = (count: number) =>
      vi.fn(async () => ({
        data: Array.from({ length: count }, (_, i) => ({ createdAt: now - i * 1000 })),
        pagination: { total: count, page: 1, limit: 500 },
      })) as never;

    const under = await checkAutoReplyRateLimit("jo@acme.fund", {
      dataCreate,
      dataGet: makeGet(5),
      now: () => now,
      limit: 20,
      windowMs: 10 * 60_000,
    });
    expect(under).toBe(false);

    const over = await checkAutoReplyRateLimit("jo@acme.fund", {
      dataCreate,
      dataGet: makeGet(21),
      now: () => now,
      limit: 20,
      windowMs: 10 * 60_000,
    });
    expect(over).toBe(true);
  });
});
