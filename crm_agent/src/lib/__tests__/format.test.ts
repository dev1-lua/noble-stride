import { describe, it, expect } from "vitest";
import {
  computeDigest,
  buildRecordPrompt,
  fallbackDigestMarkdown,
  buildDealHealthPrompt,
  buildPipelinePrompt,
  renderDepthDimensions,
  type StageColumn,
} from "../format";

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

describe("renderDepthDimensions", () => {
  it("returns empty string when no depth", () => {
    expect(renderDepthDimensions([])).toBe("");
  });
  it("lists the available dimension labels when present", () => {
    const out = renderDepthDimensions([{ dimension: "activity", label: "the full activity timeline" }]);
    expect(out).toContain("the full activity timeline");
  });
});

describe("buildDealHealthPrompt", () => {
  const prompt = buildDealHealthPrompt("transaction", "Busoga Raise",
    [{ area: "stage", severity: "risk", detail: "In stage ~60 days." }],
    [{ dimension: "engagements", label: "the investor engagements" }], "risks");
  it("instructs an insight layer and facts-only", () => {
    expect(prompt.toLowerCase()).toContain("insight");
    expect(prompt.toLowerCase()).toContain("only");   // facts-only / only use provided
  });
  it("passes the record name and the focus through", () => {
    expect(prompt).toContain("Busoga Raise");
    expect(prompt.toLowerCase()).toContain("risks");
  });
  it("tells the model to offer depth only because dimensions exist", () => {
    expect(prompt).toContain("the investor engagements");
    expect(prompt.toLowerCase()).toContain("vary");
  });
});

describe("buildDealHealthPrompt — no depth", () => {
  it("instructs NOT to add a deeper offer when depth is empty", () => {
    const prompt = buildDealHealthPrompt("investor", "FundZ",
      [{ area: "criteria", severity: "warn", detail: "Criteria incomplete." }], []);
    expect(prompt.toLowerCase()).toContain("do not add");
  });
});

describe("buildPipelinePrompt", () => {
  it("renders the metrics and asks for insight", () => {
    const prompt = buildPipelinePrompt({
      metrics: [{ stage: "Outreach", count: 2, totalValue: 1_500_000 }],
      aging: [{ name: "A", stage: "Outreach", idleDays: 50 }],
      concentration: [{ sector: "Fintech", count: 2 }],
      depth: [{ dimension: "aging", label: "the full list of stalled deals" }],
    }, "transactions");
    expect(prompt).toContain("Outreach");
    expect(prompt.toLowerCase()).toContain("insight");
  });
});
