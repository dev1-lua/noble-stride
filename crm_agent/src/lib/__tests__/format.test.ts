import { describe, it, expect } from "vitest";
import { computeDigest, buildRecordPrompt, fallbackDigestMarkdown, type StageColumn } from "../format";

const NOW = new Date("2026-07-13T09:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const columns: StageColumn[] = [
  {
    stage: "DUE_DILIGENCE",
    label: "Due Diligence",
    items: [
      // moved: entered stage 2 days ago, created 30 days ago
      { id: "a", name: "Deal Moved", stageEnteredAt: daysAgo(2), createdAt: daysAgo(30), updatedAt: daysAgo(2) },
      // new: created 3 days ago
      { id: "b", name: "Deal New", stageEnteredAt: daysAgo(3), createdAt: daysAgo(3), updatedAt: daysAgo(3) },
      // stalled: untouched for 21 days
      { id: "c", name: "Deal Stalled", stageEnteredAt: daysAgo(40), createdAt: daysAgo(60), updatedAt: daysAgo(21) },
    ],
  },
];

describe("computeDigest", () => {
  const digest = computeDigest({ mandateColumns: columns, transactionColumns: [], windowDays: 7, now: NOW });

  it("classifies moved / new / stalled correctly", () => {
    expect(digest.mandates.moved.map((m) => m.name)).toEqual(["Deal Moved"]);
    expect(digest.mandates.newEntries.map((m) => m.name)).toEqual(["Deal New"]);
    expect(digest.mandates.stalled.map((m) => m.name)).toEqual(["Deal Stalled"]);
    expect(digest.mandates.stalled[0].idleDays).toBe(21);
  });

  it("totals per stage", () => {
    expect(digest.mandates.totalsByStage).toEqual([{ label: "Due Diligence", count: 3 }]);
  });

  it("a new record is not also counted as moved", () => {
    expect(digest.mandates.moved.find((m) => m.name === "Deal New")).toBeUndefined();
  });
});

describe("prompts and fallbacks", () => {
  it("record prompt embeds the template sections and the data", () => {
    const p = buildRecordPrompt("client", { name: "Acme" }, "risks");
    for (const section of ["Headline", "Current status", "Recent activity", "Open items", "Risks", "Next steps"]) {
      expect(p).toContain(section);
    }
    expect(p).toContain('"name": "Acme"');
    expect(p).toContain("risks");
    expect(p).toMatch(/never invent|only.*facts/i);
  });

  it("digest fallback renders sections without an LLM", () => {
    const digest = computeDigest({ mandateColumns: columns, transactionColumns: [], windowDays: 7, now: NOW });
    const md = fallbackDigestMarkdown(digest, "mandates");
    expect(md).toContain("Deal Moved");
    expect(md).toContain("Deal Stalled");
    expect(md).toContain("Due Diligence");
  });
});
