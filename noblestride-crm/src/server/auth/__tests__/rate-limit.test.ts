// The login gate exists to slow password guessing, so it must count FAILED
// attempts. Charging successful sign-ins too locks out any group behind one
// NAT — which is exactly how Noblestride's own office reaches the app.

import { describe, it, expect } from "vitest";
import { rateLimit, refundRateLimit } from "@/server/auth/rate-limit";

const key = () => `test:${Math.random().toString(36).slice(2)}`;

describe("rateLimit", () => {
  it("allows up to max attempts in the window, then refuses", () => {
    const k = key();
    for (let i = 0; i < 3; i += 1) expect(rateLimit(k, { max: 3 })).toBe(true);
    expect(rateLimit(k, { max: 3 })).toBe(false);
  });

  it("a refunded attempt does not count against the budget", () => {
    const k = key();
    // Ten "successful" attempts, each charged then refunded.
    for (let i = 0; i < 10; i += 1) {
      expect(rateLimit(k, { max: 3 })).toBe(true);
      refundRateLimit(k);
    }
    // The budget is untouched: three more attempts still allowed.
    for (let i = 0; i < 3; i += 1) expect(rateLimit(k, { max: 3 })).toBe(true);
    expect(rateLimit(k, { max: 3 })).toBe(false);
  });

  it("refunding never drops the count below zero", () => {
    const k = key();
    refundRateLimit(k);
    refundRateLimit(k);
    expect(rateLimit(k, { max: 1 })).toBe(true);
    expect(rateLimit(k, { max: 1 })).toBe(false);
  });

  it("refunding an unknown key is a no-op, not a crash", () => {
    expect(() => refundRateLimit(key())).not.toThrow();
  });

  it("a fresh window resets the budget", () => {
    const k = key();
    expect(rateLimit(k, { max: 1, windowMs: 1 })).toBe(true);
    expect(rateLimit(k, { max: 1, windowMs: 1 })).toBe(false);
    // The bucket's resetAt is already in the past with a 1 ms window.
    const start = Date.now();
    while (Date.now() === start) {
      /* spin one millisecond, so the window genuinely elapses */
    }
    expect(rateLimit(k, { max: 1, windowMs: 1 })).toBe(true);
  });
});
