// F5.3 (image20): "what is the main function of this CRM" and "how many
// opportunities are in the pipeline" had no tool behind them. summarize_record
// answers about ONE record; analyze_pipeline returns a narrative. Neither gives
// the org-level number, and neither says what an "opportunity" even is — which
// is the ambiguity behind the client's question.

import { describe, it, expect } from "vitest";
import { shapeOverview, renderOverview, type OverviewRaw } from "../overview";

const RAW: OverviewRaw = {
  dashboardStats: {
    activeMandates: { value: 96, delta: 3 },
    activeTransactions: { value: 11, delta: 1 },
    investorsEngagedQtr: { value: 7, delta: 2 },
    capitalRaisedYtd: { value: 12_500_000, delta: 0 },
  },
  pipelineOverview: {
    mandatesByStage: [
      { stage: "NewLead", label: "New Lead", count: 40 },
      { stage: "Signed", label: "Signed", count: 30 },
      { stage: "Closed", label: "Closed", count: 38 },
    ],
    transactionsByStage: [
      { stage: "Open", label: "Open", count: 8 },
      { stage: "TermSheet", label: "Term Sheet", count: 3 },
      { stage: "ClosedWon", label: "Closed Won", count: 2 },
    ],
  },
  investorsCount: 214,
};

describe("shapeOverview", () => {
  it("counts opportunities as mandates plus transactions across every stage", () => {
    const s = shapeOverview(RAW);
    expect(s.opportunities.mandates).toBe(108);
    expect(s.opportunities.transactions).toBe(13);
    expect(s.opportunities.total).toBe(121);
    // The active subset comes from dashboardStats: PipelineOverview's GraphQL
    // type exposes only the stage arrays, not the service's active totals.
    expect(s.opportunities.activeMandates).toBe(96);
    expect(s.opportunities.activeTransactions).toBe(11);
  });

  it("carries investors and capital raised, and spells out what an opportunity is", () => {
    const s = shapeOverview(RAW);
    expect(s.investors).toEqual({ total: 214, engagedThisQuarter: 7 });
    expect(s.capitalRaisedYtd).toBe(12_500_000);
    const d = s.definition.toLowerCase();
    expect(d).toContain("mandate");
    expect(d).toContain("transaction");
    // Advisory assignments must be named as NOT counted, or the total invites
    // exactly the "how many opportunities?" confusion it is meant to settle.
    expect(d).toContain("advisory");
  });

  it("returns at most five non-empty stages, biggest first, tagged with their pipeline", () => {
    const top = shapeOverview(RAW).topStages;
    expect(top.length).toBeLessThanOrEqual(5);
    expect(top.every((t) => t.count > 0)).toBe(true);
    expect(top[0]).toEqual({ label: "New Lead", count: 40, pipeline: "mandates" });
    expect([...top].sort((a, b) => b.count - a.count)).toEqual(top);
  });

  it("survives empty and missing arrays", () => {
    const empty = shapeOverview({
      ...RAW,
      pipelineOverview: { mandatesByStage: [], transactionsByStage: [] },
    });
    expect(empty.opportunities.total).toBe(0);
    expect(empty.topStages).toEqual([]);

    // A CRM that answers with nulls must not crash the tool.
    const nulls = shapeOverview({
      dashboardStats: {} as OverviewRaw["dashboardStats"],
      pipelineOverview: {} as OverviewRaw["pipelineOverview"],
      investorsCount: 0,
    });
    expect(nulls.opportunities.total).toBe(0);
    expect(nulls.investors.total).toBe(0);
    expect(nulls.capitalRaisedYtd).toBe(0);
  });

  it("drops zero-count stages rather than listing them", () => {
    const withZeros = shapeOverview({
      ...RAW,
      pipelineOverview: {
        mandatesByStage: [{ stage: "NewLead", label: "New Lead", count: 0 }],
        transactionsByStage: [{ stage: "Open", label: "Open", count: 4 }],
      },
    });
    expect(withZeros.topStages).toEqual([{ label: "Open", count: 4, pipeline: "transactions" }]);
  });
});

describe("renderOverview", () => {
  it("is 3 to 6 lines, states the definition, and ends with the deep link", () => {
    const out = renderOverview(shapeOverview(RAW), "https://crm.example/dashboard");
    const lines = out.split("\n").filter((l) => l.trim());
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.length).toBeLessThanOrEqual(6);
    expect(out).toContain("121");
    expect(out).toContain("https://crm.example/dashboard");
    expect(out.toLowerCase()).toContain("opportunity");
  });

  it("uses no typographic dashes (the persona and normalizer both forbid them)", () => {
    expect(renderOverview(shapeOverview(RAW), "https://crm.example/dashboard")).not.toMatch(/[‒–—―]/);
  });

  it("reads sensibly on an empty CRM instead of printing bare zeroes", () => {
    const out = renderOverview(
      shapeOverview({ ...RAW, pipelineOverview: { mandatesByStage: [], transactionsByStage: [] } }),
      "https://crm.example/dashboard",
    );
    expect(out).toContain("0 opportunities");
    expect(out).not.toContain("undefined");
    expect(out).not.toContain("NaN");
  });
});
