// Shared pure fixtures for the visibility-engine tests. No DB, no Prisma runtime.
import type { DealInput } from "@/server/visibility/project";

// Strings that must NEVER appear in any external projection, at any tier.
export const OTHER_INVESTOR_NAME = "Rival Capital Partners";
export const PARTNER_NAME = "Hidden Referral Advisors LLP";
export const SERVICE_PROVIDER_NAME = "Quiet Counsel Law Firm";
export const INTERNAL_NOTE = "INTERNAL-NOTE-do-not-leak";
export const INVESTOR_FEEDBACK = "FEEDBACK-offer-was-too-low";
export const ENGAGEMENT_CONTRACT_DOC = "Engagement Contract v3 SECRET";
export const INTERNAL_DOC = "Internal Valuation Memo SECRET";
export const CLIENT_SHARED_DOC = "Client Board Pack SECRET";
export const TEAM_MEMBER_NAME = "Alice NobleStride";
export const INTERNAL_MESSAGE = "internal-team-thread-about-pricing";

export const FORBIDDEN_STRINGS = [
  OTHER_INVESTOR_NAME,
  PARTNER_NAME,
  SERVICE_PROVIDER_NAME,
  INTERNAL_NOTE,
  INVESTOR_FEEDBACK,
  ENGAGEMENT_CONTRACT_DOC,
  INTERNAL_DOC,
  CLIENT_SHARED_DOC,
  TEAM_MEMBER_NAME,
  INTERNAL_MESSAGE,
] as const;

export const OWN_INVESTOR_ID = "inv-own";
export const OTHER_INVESTOR_ID = "inv-other";

/** A fully loaded transaction, as `loadInvestorPortalData` would fetch it. */
export function makeDealFixture(): DealInput {
  return {
    id: "txn-1",
    name: "Project Baobab",
    stage: "InvestorOutreach",
    dealType: "Growth",
    instrument: ["Equity"],
    targetRaise: 8_000_000,
    currency: "USD",
    sector: ["Agribusiness"],
    client: {
      name: "Acme Agri Ltd",
      sector: ["Agribusiness"],
      description: "Vertically integrated grain processor",
      coreProduct: "Fortified maize flour",
      hqCity: "Nairobi",
      countries: ["EastAfrica"],
      yearFounded: 2012,
      revenueLastYear: 7_200_000,
      revenueForecast: 12_500_000,
      profitable: true,
      contacts: [
        {
          firstName: "Grace",
          lastName: "Mwangi",
          email: "grace@acmeagri.example",
          phone: "+254700000000",
          jobTitle: "CFO",
        },
      ],
    },
    mandate: { stage: "Signed" },
    engagements: [
      {
        id: "eng-own",
        investorId: OWN_INVESTOR_ID,
        engagementStage: "NDASigned",
        investor: { id: OWN_INVESTOR_ID, name: "Own Fund LP" },
        notes: INTERNAL_NOTE,
        feedback: INVESTOR_FEEDBACK,
      },
      {
        id: "eng-other",
        investorId: OTHER_INVESTOR_ID,
        engagementStage: "DueDiligence",
        investor: { id: OTHER_INVESTOR_ID, name: OTHER_INVESTOR_NAME },
        notes: INTERNAL_NOTE,
        feedback: INVESTOR_FEEDBACK,
      },
    ],
    documents: [
      { id: "doc-teaser", name: "Baobab Teaser", type: "Teaser", accessLevel: "InvestorShared" },
      { id: "doc-deck", name: "Baobab Pitch Deck", type: "PitchDeck", accessLevel: "InvestorShared" },
      { id: "doc-im", name: "Baobab Information Memorandum", type: "IM", accessLevel: "InvestorShared" },
      { id: "doc-model", name: "Baobab Financial Model", type: "FinancialModel", accessLevel: "InvestorShared" },
      { id: "doc-vdr", name: "Audited Accounts FY25", type: "AuditedAccounts", accessLevel: "VDR" },
      // Hard-rule documents — must never surface, whatever the access level says:
      { id: "doc-ec", name: ENGAGEMENT_CONTRACT_DOC, type: "EngagementContract", accessLevel: "InvestorShared" },
      { id: "doc-internal", name: INTERNAL_DOC, type: "Valuation", accessLevel: "Internal" },
      { id: "doc-client", name: CLIENT_SHARED_DOC, type: "BusinessPlan", accessLevel: "ClientShared" },
    ],
    serviceProviders: [{ name: SERVICE_PROVIDER_NAME, type: "LawFirm" }],
    activities: [{ body: INTERNAL_MESSAGE, createdBy: { name: TEAM_MEMBER_NAME } }],
    owner: { name: TEAM_MEMBER_NAME },
  };
}
