// Display labels + chip colors for the controlled vocabularies (SPEC §4).
// Enum identifiers are PascalCase in Prisma; humans see these labels.

export const LABELS: Record<string, Record<string, string>> = {
  Sector: {
    Agribusiness: "Agribusiness",
    FinancialServices: "Financial Services",
    FMCG: "FMCG",
    Manufacturing: "Manufacturing",
    RenewableEnergy: "Renewable Energy",
    Technology: "Technology",
    Healthcare: "Healthcare",
    Banking: "Banking",
    RealEstate: "Real Estate",
    Education: "Education",
    Infrastructure: "Infrastructure",
    Aviation: "Aviation",
    Construction: "Construction",
    Hospitality: "Hospitality",
    Leasing: "Leasing",
    MediaEntertainment: "Media & Entertainment",
    Services: "Services",
    TransportLogistics: "Transport & Logistics",
    WaterSanitation: "Water & Sanitation",
  },
  InvestorType: {
    PrivateEquity: "Private Equity",
    VentureCapital: "Venture Capital",
    DFI: "DFI",
    DebtProvider: "Debt Provider",
    FamilyOffice: "Family Office",
    Angel: "Angel",
    CorporateVC: "Corporate VC",
    GrantDonor: "Grant / Donor",
    Corporate: "Corporate",
    Individual: "Individual",
  },
  InvestorStatus: {
    ActivelyDeploying: "Actively Deploying",
    Fundraising: "Fundraising",
    FinalClose: "Final Close",
    FullyDeployed: "Fully Deployed",
    Dormant: "Dormant",
  },
  Instrument: {
    Equity: "Equity",
    Debt: "Debt",
    Mezzanine: "Mezzanine",
    Grant: "Grant",
    Convertible: "Convertible",
  },
  InvestmentStage: {
    PreSeed: "Pre-Seed",
    Seed: "Seed",
    SeriesA: "Series A",
    SeriesB: "Series B",
    Growth: "Growth",
    MatureBuyout: "Mature / Buyout",
  },
  Geography: {
    EastAfrica: "East Africa",
    WestAfrica: "West Africa",
    SouthernAfrica: "Southern Africa",
    SubSaharanAfrica: "Sub-Saharan Africa",
    PanAfrica: "Pan-Africa",
    NorthAfrica: "North Africa",
    FrancophoneAfrica: "Francophone Africa",
    MENA: "MENA",
    Europe: "Europe",
    USA: "USA",
    Global: "Global",
  },
  MandateStage: {
    NewLead: "New Lead",
    Qualification: "Qualification",
    PitchPresentation: "Pitch / Presentation",
    Proposal: "Proposal",
    Negotiation: "Negotiation",
    Signed: "Signed",
    Lost: "Lost",
  },
  TransactionStage: {
    DealPreparation: "Deal Preparation",
    InvestorOutreach: "Investor Outreach",
    DueDiligence: "Due Diligence",
    TermSheet: "Term Sheet",
    Closing: "Closing",
    ClosedWon: "Closed-Won",
    ClosedLost: "Closed-Lost",
  },
  EngagementStatus: {
    NotContacted: "Not Contacted",
    Contacted: "Contacted",
    InConversation: "In Conversation",
    Interested: "Interested",
    Passed: "Passed",
    Committed: "Committed",
  },
  Source: {
    MondayMeeting: "Monday Meeting",
    WhatsApp: "WhatsApp",
    Email: "Email",
    Verbal: "Verbal",
    Referral: "Referral",
    Inbound: "Inbound",
    Outreach: "Outreach",
    Event: "Event",
    Website: "Website",
  },
  DocStatus: {
    NotSent: "Not Sent",
    Sent: "Sent",
    Signed: "Signed",
  },
  DealType: {
    SeriesA: "Series A",
    SeriesB: "Series B",
    Growth: "Growth",
    Expansion: "Expansion",
    AcquisitionFinance: "Acquisition Finance",
  },
  PartnerType: {
    LawFirm: "Law Firm",
    Auditor: "Auditor",
    Advisor: "Advisor",
    Bank: "Bank",
    InvestmentBank: "Investment Bank",
    Consulting: "Consulting",
    Other: "Other",
  },
  PartnerStatus: {
    Active: "Active",
    Preferred: "Preferred",
    Inactive: "Inactive",
  },
  FounderGender: { Male: "Male", Female: "Female", Mixed: "Mixed" },
  TaskStatus: {
    NotStarted: "Not Started",
    Pending: "Pending",
    Ongoing: "Ongoing",
    Done: "Done",
  },
  InteractionType: {
    Outreach: "Outreach",
    NDASent: "NDA Sent",
    NDASigned: "NDA Signed",
    DataRoomAccess: "Data Room Access",
    Meeting: "Meeting",
    Call: "Call",
    Email: "Email",
    Feedback: "Feedback",
    TermSheet: "Term Sheet",
    Note: "Note",
    Other: "Other",
  },
  EngagementStage: {
    Shared: "Shared", TeaserSent: "Teaser Sent", NDASigned: "NDA Signed",
    IMShared: "IM Shared", VDRAccess: "VDR Access", Meeting: "Meeting",
    InfoRequest: "Info Request", DueDiligence: "Due Diligence",
    TermSheet: "Term Sheet", Offer: "Offer", Invested: "Invested", Declined: "Declined",
  },
  InterestLevel: { Low: "Low", Medium: "Medium", High: "High" },
  NdaType: { Open: "Open", Closed: "Closed" },
  DisbursementStatus: { Disbursed: "Disbursed", Ongoing: "Ongoing", FellOff: "Fell Off", Dropped: "Dropped" },
  InvestorEngagementClassification: { Active: "Active", Inactive: "Inactive", OnHold: "On Hold", Excluded: "Excluded", Greylisted: "Greylisted" },
  InvestorNdaStatus: { None: "None", OpenNDA: "Open NDA", ClosedNDA: "Closed NDA" },
  AdvisorType: { Lawyer: "Lawyer", Investor: "Investor", Consultant: "Consultant", TransactionAdvisor: "Transaction Advisor", AdvisoryFirm: "Advisory Firm", Other: "Other" },
  ServiceProviderType: { LawFirm: "Law Firm", Audit: "Audit (Big 4)", Tax: "Tax", ESG: "ESG", Technical: "Technical", Other: "Other" },
  DocumentType: {
    NDA: "NDA", EngagementContract: "Engagement Contract", Teaser: "Teaser", IM: "Information Memorandum",
    FinancialModel: "Financial Model", Valuation: "Valuation", PitchDeck: "Pitch Deck", AuditedAccounts: "Audited Accounts",
    CR12: "CR12", TermSheet: "Term Sheet", LoanAgreement: "Loan Agreement", SPA: "SPA", SHA: "SHA", Other: "Other",
  },
  DocumentAccessLevel: { Internal: "Internal", ClientShared: "Client-Shared", InvestorShared: "Investor-Shared", VDR: "VDR" },
  DocumentStatus: { Draft: "Draft", UnderReview: "Under Review", Approved: "Approved", Shared: "Shared", Executed: "Executed" },
  PartnerAgreementStatus: { None: "None", Sent: "Sent", Signed: "Signed" },
};

/** Human label for an enum value; falls back to the raw value. */
export function label(group: keyof typeof LABELS | string, value?: string | null): string {
  if (!value) return "";
  return LABELS[group]?.[value] ?? value;
}

/** All option values for a vocabulary (e.g. to render a filter dropdown). */
export function options(group: keyof typeof LABELS): { value: string; label: string }[] {
  return Object.entries(LABELS[group] ?? {}).map(([value, label]) => ({ value, label }));
}

// ── Chip colors ──────────────────────────────────────────────────────────────
// Category chips are styled in chip.tsx with a restrained, group-aware palette
// (a quiet brand tint for the entity type; calm neutral for sectors/geos).
// No more hash-assigned rainbow.

// Semantic colors for statuses & pipeline stages (dot + text).
export const STATUS_DOT: Record<string, string> = {
  // InvestorStatus
  ActivelyDeploying: "bg-emerald-500",
  Fundraising: "bg-sky-500",
  FinalClose: "bg-violet-500",
  FullyDeployed: "bg-slate-400",
  Dormant: "bg-slate-300",
  // EngagementStatus
  NotContacted: "bg-slate-300",
  Contacted: "bg-sky-500",
  InConversation: "bg-amber-500",
  Interested: "bg-emerald-500",
  Passed: "bg-rose-500",
  Committed: "bg-emerald-600",
  // PartnerStatus
  Active: "bg-emerald-500",
  Preferred: "bg-violet-500",
  Inactive: "bg-slate-300",
};
