import { describe, it, expect } from "vitest";
import { mergeCommTimeline, contactFreshness } from "./comm-timeline";

const d = (iso: string) => new Date(iso);

describe("mergeCommTimeline", () => {
  it("merges the three sources newest-first with provenance context", () => {
    const out = mergeCommTimeline(
      [{ id: "a1", type: "Call", subject: "Intro call", occurredAt: d("2026-07-10T10:00:00Z"), channel: "Call", direction: "Outbound" }],
      [{ id: "e1", subject: "Re: IM", bodyPreview: "Thanks", fromAddress: "lp@fund.com", direction: "inbound", receivedAt: d("2026-07-12T08:00:00Z"), sentAt: null, createdAt: d("2026-07-12T08:01:00Z"), transactionName: "Busoga Raise" }],
      [{ id: "m1", subject: "DD kickoff", startAt: d("2026-07-11T14:00:00Z"), transactionName: "Busoga Raise" }],
    );
    expect(out.map((i) => i.id)).toEqual(["mail-e1", "meet-m1", "act-a1"]);
    expect(out[0]).toMatchObject({ type: "Email", direction: "Inbound", context: "Synced from Outlook · from lp@fund.com · Busoga Raise" });
    expect(out[1]).toMatchObject({ type: "Meeting", context: "Teams meeting · Busoga Raise" });
  });

  it("falls back to sentAt then createdAt for email timestamps and labels missing subjects", () => {
    const out = mergeCommTimeline(
      [],
      [{ id: "e2", subject: null, bodyPreview: null, fromAddress: null, direction: "outbound", receivedAt: null, sentAt: d("2026-07-01T00:00:00Z"), createdAt: d("2026-07-02T00:00:00Z") }],
      [],
    );
    expect(out[0].occurredAt).toEqual(d("2026-07-01T00:00:00Z"));
    expect(out[0].subject).toBe("(no subject)");
    expect(out[0].direction).toBe("Outbound");
  });
});

describe("contactFreshness", () => {
  const now = d("2026-07-17T00:00:00Z");
  it("classifies never/fresh/warn/stale by threshold days", () => {
    expect(contactFreshness(null, now)).toBe("never");
    expect(contactFreshness(d("2026-07-15T00:00:00Z"), now)).toBe("fresh");
    expect(contactFreshness(d("2026-07-09T00:00:00Z"), now)).toBe("warn");
    expect(contactFreshness(d("2026-07-01T00:00:00Z"), now)).toBe("stale");
  });
});
