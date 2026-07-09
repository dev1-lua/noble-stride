import { describe, it, expect } from "vitest";
import { dealJourney } from "@/server/domain/journey";
import type { JourneyInput } from "@/server/domain/journey";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const JOURNEY_TITLES = [
  "Sourcing & origination",
  "Introductory engagement",
  "NDA",
  "Data collection & screening",
  "Internal review & approval",
  "Engagement contract & retainer",
  "VDR setup",
  "Financial analysis",
  "Investor documentation",
  "Investor shortlisting",
  "Outreach & engagement",
  "Offers & negotiation",
  "Due diligence",
  "Structuring & documentation",
  "Financial close & disbursement",
  "Success fee & closure",
  "Post-transaction monitoring",
] as const;

const baseTxn = {
  id: "t1",
  stage: "DealPreparation",
  vdrLink: null,
  successFeeInvoicedDate: null,
  successFeePaidDate: null,
  hasDisbursements: false,
};

/** A fresh mandate: nothing has happened yet beyond mandate creation. */
const minimalInput: JourneyInput = {
  mandate: {
    id: "m1",
    source: null,
    ndaSignedDate: null,
    eaSignedDate: null,
    stage: "NewLead",
    retainerPaidDate: null,
    qualificationVerdict: null,
    referredByName: null,
  },
  transactions: [],
  engagementStages: [],
  documentTypes: [],
  firstMeetingAt: null,
};

/** Everything triggered — a mandate that has closed and been paid out. */
const closedWonInput: JourneyInput = {
  mandate: {
    id: "m2",
    source: "Referral",
    ndaSignedDate: new Date("2026-01-05"),
    eaSignedDate: new Date("2026-01-10"),
    stage: "Signed",
    retainerPaidDate: new Date("2026-01-11"),
    qualificationVerdict: "Qualified",
    referredByName: "Jane Doe",
  },
  transactions: [
    {
      id: "t1",
      stage: "ClosedWon",
      vdrLink: "https://vdr.example.com/deal",
      successFeeInvoicedDate: new Date("2026-06-01"),
      successFeePaidDate: new Date("2026-06-15"),
      hasDisbursements: true,
    },
  ],
  engagementStages: ["Shared", "TeaserSent", "DueDiligence", "TermSheet", "Offer", "Invested"],
  documentTypes: ["FinancialModel", "Valuation", "Teaser", "IM", "SPA", "SHA", "LoanAgreement"],
  firstMeetingAt: new Date("2026-01-02"),
};

// ─── Shape ────────────────────────────────────────────────────────────────────

describe("dealJourney — shape", () => {
  it("always returns exactly 17 steps with sequential indices 1..17", () => {
    const steps = dealJourney(minimalInput);
    expect(steps).toHaveLength(17);
    steps.forEach((step, i) => {
      expect(step.index).toBe(i + 1);
    });
  });

  it("titles match the verbatim spec list, in order", () => {
    const steps = dealJourney(minimalInput);
    expect(steps.map((s) => s.title)).toEqual([...JOURNEY_TITLES]);
  });

  it("step 17 is always 'manual', even on a fresh mandate", () => {
    const steps = dealJourney(minimalInput);
    expect(steps[16].state).toBe("manual");
  });
});

// ─── Fresh mandate ────────────────────────────────────────────────────────────

describe("dealJourney — fresh mandate", () => {
  it("step 1 is done and step 2 is current; the rest are pending", () => {
    const steps = dealJourney(minimalInput);
    expect(steps[0].state).toBe("done");
    expect(steps[1].state).toBe("current");
    for (let i = 2; i < 16; i++) {
      expect(steps[i].state).toBe("pending");
    }
    expect(steps[16].state).toBe("manual");
  });

  it("step 1 always carries source-derived evidence pointing at the mandate", () => {
    const steps = dealJourney(minimalInput);
    expect(steps[0].evidence).toBeDefined();
    expect(steps[0].evidence?.href).toBe("/mandates/m1");
    expect(steps[0].evidence?.label.length).toBeGreaterThan(0);
  });

  it("step 1 evidence label reflects source and referredByName when present", () => {
    const steps = dealJourney(closedWonInput);
    expect(steps[0].evidence?.label).toContain("Referral");
    expect(steps[0].evidence?.label).toContain("Jane Doe");
    expect(steps[0].evidence?.href).toBe("/mandates/m2");
  });

  it("null source never crashes and still yields a non-empty evidence label", () => {
    const steps = dealJourney(minimalInput);
    expect(() => dealJourney(minimalInput)).not.toThrow();
    expect(steps[0].evidence?.label).toBeTruthy();
  });
});

// ─── Out-of-order evidence (core semantics) ──────────────────────────────────

describe("dealJourney — out-of-order evidence", () => {
  it("NDA (3) and engagement contract (6) can be done while stage/review (4, 5) are still pending", () => {
    const input: JourneyInput = {
      ...minimalInput,
      mandate: {
        ...minimalInput.mandate,
        ndaSignedDate: new Date("2026-01-05"),
        eaSignedDate: new Date("2026-01-10"),
        stage: "NewLead", // still before Qualification — steps 4 & 5 not triggered by stage
      },
    };
    const steps = dealJourney(input);
    expect(steps[2].state).toBe("done"); // step 3: NDA
    expect(steps[5].state).toBe("done"); // step 6: engagement contract & retainer
    expect(steps[3].state).not.toBe("done"); // step 4: data collection & screening
    expect(steps[4].state).not.toBe("done"); // step 5: internal review & approval
  });
});

// ─── Full ClosedWon fixture ───────────────────────────────────────────────────

describe("dealJourney — full ClosedWon fixture", () => {
  it("marks steps 1-16 done, step 17 manual, and reports no current step", () => {
    const steps = dealJourney(closedWonInput);
    for (let i = 0; i < 16; i++) {
      expect(steps[i].state).toBe("done");
    }
    expect(steps[16].state).toBe("manual");
    expect(steps.some((s) => s.state === "current")).toBe(false);
  });
});

// ─── Per-step trigger cases ───────────────────────────────────────────────────

describe("dealJourney — per-step triggers", () => {
  it("step 1: always done regardless of input", () => {
    expect(dealJourney(minimalInput)[0].state).toBe("done");
  });

  it("step 2: done when firstMeetingAt is set", () => {
    const steps = dealJourney({ ...minimalInput, firstMeetingAt: new Date("2026-02-01") });
    expect(steps[1].state).toBe("done");
  });

  it("step 3: done when ndaSignedDate is set", () => {
    const steps = dealJourney({
      ...minimalInput,
      mandate: { ...minimalInput.mandate, ndaSignedDate: new Date("2026-02-01") },
    });
    expect(steps[2].state).toBe("done");
  });

  it("step 4: done when stage is past Qualification in MandateStage order", () => {
    const steps = dealJourney({
      ...minimalInput,
      mandate: { ...minimalInput.mandate, stage: "PitchPresentation" },
    });
    expect(steps[3].state).toBe("done");
  });

  it("step 4: done when qualificationVerdict is present, even if stage is still NewLead", () => {
    const steps = dealJourney({
      ...minimalInput,
      mandate: { ...minimalInput.mandate, qualificationVerdict: "NeedsReview" },
    });
    expect(steps[3].state).toBe("done");
  });

  it("step 4: NOT done when stage is exactly Qualification (needs to be past it) and no verdict", () => {
    const steps = dealJourney({
      ...minimalInput,
      mandate: { ...minimalInput.mandate, stage: "Qualification" },
    });
    expect(steps[3].state).not.toBe("done");
  });

  it("step 5: done when stage is Proposal, Negotiation, or Signed", () => {
    for (const stage of ["Proposal", "Negotiation", "Signed"]) {
      const steps = dealJourney({ ...minimalInput, mandate: { ...minimalInput.mandate, stage } });
      expect(steps[4].state).toBe("done");
    }
  });

  it("step 6: done when eaSignedDate is set", () => {
    const steps = dealJourney({
      ...minimalInput,
      mandate: { ...minimalInput.mandate, eaSignedDate: new Date("2026-02-01") },
    });
    expect(steps[5].state).toBe("done");
  });

  it("step 7: done when any transaction has a vdrLink", () => {
    const steps = dealJourney({
      ...minimalInput,
      transactions: [{ ...baseTxn, vdrLink: "https://vdr.example.com" }],
    });
    expect(steps[6].state).toBe("done");
  });

  it("step 8: done when documentTypes includes FinancialModel or Valuation", () => {
    expect(dealJourney({ ...minimalInput, documentTypes: ["FinancialModel"] })[7].state).toBe("done");
    expect(dealJourney({ ...minimalInput, documentTypes: ["Valuation"] })[7].state).toBe("done");
  });

  it("step 9: done only when documentTypes has BOTH Teaser and IM", () => {
    expect(dealJourney({ ...minimalInput, documentTypes: ["Teaser"] })[8].state).not.toBe("done");
    expect(dealJourney({ ...minimalInput, documentTypes: ["Teaser", "IM"] })[8].state).toBe("done");
  });

  it("step 10: done when at least one engagement (outreach) row exists", () => {
    const steps = dealJourney({ ...minimalInput, engagementStages: ["Shared"] });
    expect(steps[9].state).toBe("done");
  });

  it("step 11: done when any engagementStage is not 'Shared'", () => {
    expect(dealJourney({ ...minimalInput, engagementStages: ["Shared"] })[10].state).not.toBe("done");
    expect(dealJourney({ ...minimalInput, engagementStages: ["TeaserSent"] })[10].state).toBe("done");
  });

  it("step 12: done when any engagementStage is TermSheet or Offer", () => {
    expect(dealJourney({ ...minimalInput, engagementStages: ["TermSheet"] })[11].state).toBe("done");
    expect(dealJourney({ ...minimalInput, engagementStages: ["Offer"] })[11].state).toBe("done");
  });

  it("step 13: done when a transaction is at DueDiligence stage or beyond", () => {
    const steps = dealJourney({
      ...minimalInput,
      transactions: [{ ...baseTxn, stage: "DueDiligence" }],
    });
    expect(steps[12].state).toBe("done");
  });

  it("step 13: also done when any engagementStage is DueDiligence, without a matching transaction stage", () => {
    const steps = dealJourney({ ...minimalInput, engagementStages: ["DueDiligence"] });
    expect(steps[12].state).toBe("done");
  });

  it("step 14: done when documentTypes has SPA, SHA, or LoanAgreement", () => {
    expect(dealJourney({ ...minimalInput, documentTypes: ["SPA"] })[13].state).toBe("done");
    expect(dealJourney({ ...minimalInput, documentTypes: ["SHA"] })[13].state).toBe("done");
    expect(dealJourney({ ...minimalInput, documentTypes: ["LoanAgreement"] })[13].state).toBe("done");
  });

  it("step 15: done when a transaction is ClosedWon", () => {
    const steps = dealJourney({ ...minimalInput, transactions: [{ ...baseTxn, stage: "ClosedWon" }] });
    expect(steps[14].state).toBe("done");
  });

  it("step 15: also done when a transaction has disbursements, regardless of stage", () => {
    const steps = dealJourney({
      ...minimalInput,
      transactions: [{ ...baseTxn, stage: "DealPreparation", hasDisbursements: true }],
    });
    expect(steps[14].state).toBe("done");
  });

  it("step 16: done when a transaction has a success fee invoiced or paid date", () => {
    expect(
      dealJourney({
        ...minimalInput,
        transactions: [{ ...baseTxn, successFeeInvoicedDate: new Date("2026-06-01") }],
      })[15].state,
    ).toBe("done");
    expect(
      dealJourney({
        ...minimalInput,
        transactions: [{ ...baseTxn, successFeePaidDate: new Date("2026-06-01") }],
      })[15].state,
    ).toBe("done");
  });

  it("step 17: always manual, never done/current/pending", () => {
    expect(dealJourney(minimalInput)[16].state).toBe("manual");
    expect(dealJourney(closedWonInput)[16].state).toBe("manual");
  });
});

// ─── Current-step selection ───────────────────────────────────────────────────

describe("dealJourney — current-step selection", () => {
  it("current is the first non-done step among 1-16", () => {
    const input: JourneyInput = {
      ...minimalInput,
      mandate: { ...minimalInput.mandate, ndaSignedDate: new Date("2026-01-05") }, // step 3 done
      firstMeetingAt: new Date("2026-01-02"), // step 2 done
    };
    const steps = dealJourney(input);
    // steps 1,2,3 done; step 4 is the first non-done -> current
    expect(steps[0].state).toBe("done");
    expect(steps[1].state).toBe("done");
    expect(steps[2].state).toBe("done");
    expect(steps[3].state).toBe("current");
  });

  it("later done steps do not become 'current' even if earlier steps are pending", () => {
    const input: JourneyInput = {
      ...minimalInput,
      transactions: [{ ...baseTxn, stage: "ClosedWon" }], // step 15 done, but 2-14 pending
    };
    const steps = dealJourney(input);
    expect(steps[1].state).toBe("current"); // step 2 is first non-done
    expect(steps[14].state).toBe("done"); // step 15 done out of order
    expect(steps[14].state).not.toBe("current");
  });

  it("there is exactly one current step when not all of 1-16 are done", () => {
    const steps = dealJourney(minimalInput);
    expect(steps.filter((s) => s.state === "current")).toHaveLength(1);
  });

  it("there is no current step when steps 1-16 are all done", () => {
    const steps = dealJourney(closedWonInput);
    expect(steps.filter((s) => s.state === "current")).toHaveLength(0);
  });
});

// ─── Null-safety ──────────────────────────────────────────────────────────────

describe("dealJourney — null-safety", () => {
  it("handles a mandate with every optional field null/undefined without crashing", () => {
    expect(() =>
      dealJourney({
        mandate: {
          id: "m3",
          source: null,
          ndaSignedDate: null,
          eaSignedDate: null,
          stage: "NewLead",
          retainerPaidDate: undefined,
          qualificationVerdict: undefined,
          referredByName: undefined,
        },
        transactions: [],
        engagementStages: [],
        documentTypes: [],
        firstMeetingAt: null,
      }),
    ).not.toThrow();
  });

  it("handles an unrecognized mandate/transaction stage string without crashing or forcing done", () => {
    const steps = dealJourney({
      ...minimalInput,
      mandate: { ...minimalInput.mandate, stage: "SomeUnknownStage" },
      transactions: [{ ...baseTxn, stage: "SomeUnknownStage" }],
    });
    expect(steps[3].state).not.toBe("done"); // step 4
    expect(steps[4].state).not.toBe("done"); // step 5
    expect(steps[12].state).not.toBe("done"); // step 13
  });
});
