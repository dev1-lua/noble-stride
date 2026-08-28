import { describe, it, expect } from "vitest";
import {
  projectForPartner,
  type ReferredMandateInput,
  type ReferredTransactionInput,
} from "@/server/visibility/project";
import { INTERNAL_NOTE, OTHER_INVESTOR_NAME, TEAM_MEMBER_NAME } from "./fixtures";

const partner = {
  id: "pt-1",
  name: "Savannah Deal Advisors",
  advisorType: "TransactionAdvisor" as const,
  organization: "Savannah Group",
  feeSharingAgreement: true,
  feeSharingTerms: "20% of success fee",
  partnerAgreementStatus: "Signed" as const,
};

// Loaded mandates carry internal fields (notes, lead, investor chatter) that the
// projector must drop. Assigned to a variable first so extra props are allowed.
const referredMandates = [
  {
    id: "m-1",
    name: "Mandate Alpha",
    stage: "Signed",
    dealSize: 6_000_000,
    currency: "USD",
    client: { name: "Acme Agri Ltd" },
    notes: INTERNAL_NOTE,
    lead: { name: TEAM_MEMBER_NAME },
    interestedInvestors: [OTHER_INVESTOR_NAME],
  },
  {
    id: "m-2",
    name: "Mandate Beta",
    stage: "Proposal",
    dealSize: null,
    currency: "USD",
    client: { name: "Beta Clinics" },
    notes: INTERNAL_NOTE,
  },
] satisfies (ReferredMandateInput & Record<string, unknown>)[];

describe("projectForPartner (§5.4)", () => {
  it("returns own profile fields", () => {
    const view = projectForPartner(partner, referredMandates);
    expect(view.profile).toEqual({
      name: "Savannah Deal Advisors",
      advisorType: "TransactionAdvisor",
      organization: "Savannah Group",
      feeSharingAgreement: true,
      feeSharingTerms: "20% of success fee",
      partnerAgreementStatus: "Signed",
    });
  });

  it("returns own referred deals with stage, conversion, fee-sharing status", () => {
    const view = projectForPartner(partner, referredMandates);
    expect(view.referredDeals).toEqual([
      {
        mandateName: "Mandate Alpha",
        clientName: "Acme Agri Ltd",
        stage: "Signed",
        dealSize: 6_000_000,
        currency: "USD",
        converted: true,
        feeSharingStatus: "20% of success fee",
        partnerFeeStatusValue: null,
      },
      {
        mandateName: "Mandate Beta",
        clientName: "Beta Clinics",
        stage: "Proposal",
        dealSize: null,
        currency: "USD",
        converted: false,
        feeSharingStatus: "20% of success fee",
        partnerFeeStatusValue: null,
      },
    ]);
  });

  // Task 8: fee status is read from the mandate's linked transaction, not the
  // mandate itself — a mandate with no transaction yet reports null (no fee
  // status to show), one with a transaction reports its partnerFeeStatus.
  it("reads partnerFeeStatusValue from the mandate's first linked transaction", () => {
    const withTxn = [
      { ...referredMandates[0], transactions: [{ partnerFeeStatus: "Invoiced" as const }] },
      referredMandates[1],
    ];
    const view = projectForPartner(partner, withTxn);
    expect(view.referredDeals[0]?.partnerFeeStatusValue).toBe("Invoiced");
    expect(view.referredDeals[1]?.partnerFeeStatusValue).toBeNull();
  });

  it("reports fee-sharing status None when there is no agreement", () => {
    const view = projectForPartner(
      { ...partner, feeSharingAgreement: false, feeSharingTerms: null },
      referredMandates,
    );
    expect(view.referredDeals[0]?.feeSharingStatus).toBe("None");
  });

  it("never leaks investor identities, internal notes, or team identities", () => {
    const json = JSON.stringify(projectForPartner(partner, referredMandates));
    expect(json).not.toContain(OTHER_INVESTOR_NAME);
    expect(json).not.toContain(INTERNAL_NOTE);
    expect(json).not.toContain(TEAM_MEMBER_NAME);
  });
});

// F5.6: a partner can be credited on a Transaction directly
// (Transaction.referredById), not only through a Mandate. Those referrals used
// to be invisible in the portal because loadPartnerPortalData only ever loaded
// referredMandates.
describe("projectForPartner — transaction-level referrals (F5.6)", () => {
  const referredTransactions = [
    {
      id: "t-1",
      name: "Transaction Gamma",
      stage: "ClosedWon",
      dealSize: 2_500_000,
      currency: "USD",
      client: { name: "Gamma Foods" },
      mandateId: null,
      partnerFeeStatus: "Paid",
      notes: INTERNAL_NOTE,
      owner: { name: TEAM_MEMBER_NAME },
      engagements: [{ investor: { name: OTHER_INVESTOR_NAME } }],
    },
  ] satisfies (ReferredTransactionInput & Record<string, unknown>)[];

  it("projects a directly-referred transaction with the same masking as a mandate", () => {
    const view = projectForPartner(partner, referredMandates, referredTransactions);
    expect(view.referredTransactions).toEqual([
      {
        transactionName: "Transaction Gamma",
        clientName: "Gamma Foods",
        stage: "ClosedWon",
        dealSize: 2_500_000,
        currency: "USD",
        converted: true,
        feeSharingStatus: "20% of success fee",
        partnerFeeStatusValue: "Paid",
      },
    ]);
    const json = JSON.stringify(view);
    expect(json).not.toContain(OTHER_INVESTOR_NAME);
    expect(json).not.toContain(INTERNAL_NOTE);
    expect(json).not.toContain(TEAM_MEMBER_NAME);
  });

  it("drops a transaction whose mandate is already reported, so nothing is counted twice", () => {
    const underReferredMandate = [{ ...referredTransactions[0], mandateId: "m-1" }];
    const view = projectForPartner(partner, referredMandates, underReferredMandate);
    expect(view.referredTransactions).toEqual([]);
  });

  it("keeps a transaction whose mandate was NOT referred by this partner", () => {
    const otherMandate = [{ ...referredTransactions[0], mandateId: "m-999" }];
    const view = projectForPartner(partner, referredMandates, otherMandate);
    expect(view.referredTransactions).toHaveLength(1);
  });

  it("defaults to no transaction referrals when none are loaded", () => {
    expect(projectForPartner(partner, referredMandates).referredTransactions).toEqual([]);
  });

  it("only ClosedWon counts as converted", () => {
    const open = [{ ...referredTransactions[0], stage: "DueDiligence" as const }];
    expect(projectForPartner(partner, [], open).referredTransactions[0]?.converted).toBe(false);
  });
});
