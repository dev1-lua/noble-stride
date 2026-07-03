import { describe, it, expect } from "vitest";
import {
  FIELD_MATRIX,
  FIELD_GROUPS,
  HARD_RULE_NEVER_VISIBLE,
  NEVER_VISIBLE_GROUPS,
  fieldAccess,
  isFieldVisible,
  type FieldAccess,
  type FieldGroup,
  type VisibleTier,
} from "@/server/visibility/matrix";

// §5.2 matrix, verbatim from the design spec — the source module must match this table.
const EXPECTED: Record<FieldGroup, Record<VisibleTier, FieldAccess>> = {
  companyProfile: { PRE_INTEREST: "full", AFTER_NDA: "full", DD: "full" },
  dealTypeTicket: { PRE_INTEREST: "full", AFTER_NDA: "full", DD: "full" },
  financialsSummary: { PRE_INTEREST: "limited", AFTER_NDA: "full", DD: "full" },
  matchingMandateStatus: { PRE_INTEREST: "full", AFTER_NDA: "full", DD: "full" },
  fullFinancials: { PRE_INTEREST: "none", AFTER_NDA: "full", DD: "full" },
  vdrFiles: { PRE_INTEREST: "none", AFTER_NDA: "onRequest", DD: "full" },
  advisorClientContacts: { PRE_INTEREST: "none", AFTER_NDA: "none", DD: "full" },
  otherInvestors: { PRE_INTEREST: "none", AFTER_NDA: "none", DD: "none" },
  engagementContracts: { PRE_INTEREST: "none", AFTER_NDA: "none", DD: "none" },
  investorFeedbackOffers: { PRE_INTEREST: "none", AFTER_NDA: "none", DD: "none" },
  internalMessages: { PRE_INTEREST: "none", AFTER_NDA: "none", DD: "none" },
};

const TIERS: VisibleTier[] = ["PRE_INTEREST", "AFTER_NDA", "DD"];

describe("FIELD_MATRIX — §5.2 encoded as data", () => {
  for (const group of FIELD_GROUPS) {
    for (const tier of TIERS) {
      it(`${group} @ ${tier} = ${EXPECTED[group][tier]}`, () => {
        expect(FIELD_MATRIX[group][tier]).toBe(EXPECTED[group][tier]);
      });
    }
  }

  it("covers exactly the spec field groups", () => {
    expect([...FIELD_GROUPS].sort()).toEqual(Object.keys(EXPECTED).sort());
  });
});

describe("hard rules (§5.2, never overridable)", () => {
  it("names the four never-visible categories", () => {
    expect([...HARD_RULE_NEVER_VISIBLE].sort()).toEqual(
      [
        "engagementContracts",
        "internalNotes",
        "otherInvestorIdentities",
        "partnerConsultantIdentities",
      ].sort(),
    );
  });

  it("never-visible field groups are none at every tier", () => {
    for (const group of NEVER_VISIBLE_GROUPS) {
      for (const tier of TIERS) {
        expect(FIELD_MATRIX[group][tier]).toBe("none");
      }
    }
  });
});

describe("fieldAccess / isFieldVisible helpers", () => {
  it("NONE tier gets no access to anything", () => {
    for (const group of FIELD_GROUPS) {
      expect(fieldAccess(group, "NONE")).toBe("none");
      expect(isFieldVisible(group, "NONE")).toBe(false);
    }
  });

  it("treats onRequest as hidden (spec §10: hidden until VDRAccess)", () => {
    expect(fieldAccess("vdrFiles", "AFTER_NDA")).toBe("onRequest");
    expect(isFieldVisible("vdrFiles", "AFTER_NDA")).toBe(false);
    expect(isFieldVisible("vdrFiles", "DD")).toBe(true);
  });

  it("limited counts as visible", () => {
    expect(isFieldVisible("financialsSummary", "PRE_INTEREST")).toBe(true);
  });
});
