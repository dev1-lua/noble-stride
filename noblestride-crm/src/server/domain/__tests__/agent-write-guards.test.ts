import { describe, it, expect } from "vitest";
import type { Actor } from "@/graphql/context";
import {
  isAgentActor,
  engagementChangeBlocked,
  assertAgentEngagementAllowed,
  assertAgentEngagementCreateAllowed,
  feeChangeMarksOwed,
  partnerHasSignedAgreement,
  assertAgentFeeAllowed,
} from "../agent-write-guards";

const HUMAN: Actor = { type: "HUMAN" };
const AGENT: Actor = { type: "AGENT", authenticated: true };

describe("isAgentActor", () => {
  it("classifies AGENT/API as automation, HUMAN as not", () => {
    expect(isAgentActor(AGENT)).toBe(true);
    expect(isAgentActor({ type: "API", authenticated: true })).toBe(true);
    expect(isAgentActor(HUMAN)).toBe(false);
  });
});

describe("engagementChangeBlocked (excluded-investor guard)", () => {
  it("never blocks a non-blocked classification", () => {
    expect(engagementChangeBlocked("Active", { engagementStage: "DueDiligence" })).toBe(false);
    expect(engagementChangeBlocked(null, { engagementStage: "DueDiligence" })).toBe(false);
  });
  it("allows a pure wind-down for Excluded/Greylisted", () => {
    expect(engagementChangeBlocked("Excluded", { engagementStage: "Declined" })).toBe(false);
    expect(engagementChangeBlocked("Greylisted", { disbursementStatus: "FellOff" })).toBe(false);
    expect(engagementChangeBlocked("Excluded", { disbursementStatus: "Dropped" })).toBe(false);
  });
  it("blocks advancement or enrichment for Excluded/Greylisted", () => {
    expect(engagementChangeBlocked("Excluded", { engagementStage: "DueDiligence" })).toBe(true);
    expect(engagementChangeBlocked("Greylisted", { feedback: "note" })).toBe(true);
    // mixed wind-down + enrichment is still blocked
    expect(engagementChangeBlocked("Excluded", { engagementStage: "Declined", feedback: "x" })).toBe(true);
  });

  it("treats a no-op (all-undefined) change as not blocked", () => {
    expect(engagementChangeBlocked("Excluded", {})).toBe(false);
    expect(engagementChangeBlocked("Excluded", { engagementStage: undefined })).toBe(false);
  });
});

describe("assertAgentEngagementCreateAllowed (H1 — create is sharing)", () => {
  const excluded = { name: "Acme Fund", engagementClassification: "Excluded" };
  const active = { name: "Good Fund", engagementClassification: "Active" };
  it("blocks an agent opening ANY engagement for a blocked investor", () => {
    expect(() => assertAgentEngagementCreateAllowed(AGENT, excluded)).toThrow(/Excluded/);
  });
  it("allows an agent to open an engagement for a non-blocked investor", () => {
    expect(() => assertAgentEngagementCreateAllowed(AGENT, active)).not.toThrow();
  });
  it("never blocks a human", () => {
    expect(() => assertAgentEngagementCreateAllowed(HUMAN, excluded)).not.toThrow();
  });
});

describe("assertAgentEngagementAllowed", () => {
  const excluded = { name: "Acme Fund", engagementClassification: "Excluded" };
  it("never throws for a human actor", () => {
    expect(() => assertAgentEngagementAllowed(HUMAN, excluded, { engagementStage: "DueDiligence" })).not.toThrow();
  });
  it("throws for an agent advancing an excluded investor", () => {
    expect(() => assertAgentEngagementAllowed(AGENT, excluded, { engagementStage: "DueDiligence" })).toThrow(/Excluded/);
  });
  it("allows an agent wind-down", () => {
    expect(() => assertAgentEngagementAllowed(AGENT, excluded, { engagementStage: "Declined" })).not.toThrow();
  });
});

describe("feeChangeMarksOwed + partnerHasSignedAgreement", () => {
  it("marks owed only for a non-NotDue status or an amount", () => {
    expect(feeChangeMarksOwed({ partnerFeeStatus: "NotDue" })).toBe(false);
    expect(feeChangeMarksOwed({})).toBe(false);
    expect(feeChangeMarksOwed({ partnerFeeStatus: "Due" })).toBe(true);
    expect(feeChangeMarksOwed({ partnerFeeAmount: 1000 })).toBe(true);
  });
  it("recognises a signed agreement only when both flags hold", () => {
    expect(partnerHasSignedAgreement(null)).toBe(false);
    expect(partnerHasSignedAgreement({ feeSharingAgreement: true, partnerAgreementStatus: "Sent" })).toBe(false);
    expect(partnerHasSignedAgreement({ feeSharingAgreement: false, partnerAgreementStatus: "Signed" })).toBe(false);
    expect(partnerHasSignedAgreement({ feeSharingAgreement: true, partnerAgreementStatus: "Signed" })).toBe(true);
  });
});

describe("assertAgentFeeAllowed", () => {
  const signed = { name: "Jane Advisory", feeSharingAgreement: true, partnerAgreementStatus: "Signed" };
  const unsigned = { name: "Jane Advisory", feeSharingAgreement: false, partnerAgreementStatus: "None" };
  it("never throws for a human actor", () => {
    expect(() => assertAgentFeeAllowed(HUMAN, { partnerFeeStatus: "Due" }, null)).not.toThrow();
  });
  it("no-ops when the change does not mark a fee owed", () => {
    expect(() => assertAgentFeeAllowed(AGENT, { partnerFeeStatus: "NotDue" }, null)).not.toThrow();
  });
  it("throws when an agent marks a fee owed with no partner", () => {
    expect(() => assertAgentFeeAllowed(AGENT, { partnerFeeStatus: "Due" }, null)).toThrow(/no referring partner/);
  });
  it("throws when the partner has no signed agreement", () => {
    expect(() => assertAgentFeeAllowed(AGENT, { partnerFeeAmount: 500 }, unsigned)).toThrow(/no recorded, signed/);
  });
  it("allows an agent fee write when the partner has a signed agreement", () => {
    expect(() => assertAgentFeeAllowed(AGENT, { partnerFeeStatus: "Due" }, signed)).not.toThrow();
  });
});
