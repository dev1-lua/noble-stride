// src/server/integrations/esign/__tests__/webhook.test.ts
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyDocusignHmac, parseConnectEvent } from "../webhook";

describe("verifyDocusignHmac", () => {
  it("accepts a correct HMAC-SHA256 base64 signature and rejects a bad one", () => {
    const key = "secret";
    const body = '{"event":"envelope-completed"}';
    const sig = createHmac("sha256", key).update(body, "utf8").digest("base64");
    expect(verifyDocusignHmac(body, sig, key)).toBe(true);
    expect(verifyDocusignHmac(body, "wrong", key)).toBe(false);
  });
});

describe("parseConnectEvent", () => {
  it("extracts event + envelopeId + completed time", () => {
    const out = parseConnectEvent({
      event: "envelope-completed",
      data: { envelopeId: "e1", envelopeSummary: { completedDateTime: "2026-07-09T10:00:00Z" } },
    });
    expect(out).toEqual({ event: "envelope-completed", envelopeId: "e1", completedAt: new Date("2026-07-09T10:00:00Z") });
  });
  it("returns null for an unrecognized payload", () => {
    expect(parseConnectEvent({ nope: true })).toBeNull();
  });
});
