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
    CR12: "CR12", TermSheet: "Term Sheet", LoanAgreement: "Loan Agreement", SPA: "SPA", SHA: "SHA", BusinessPlan: "Business Plan", Other: "Other",
  },
  DocumentAccessLevel: { Internal: "Internal", ClientShared: "Client-Shared", InvestorShared: "Investor-Shared", VDR: "VDR" },
  DocumentStatus: { Draft: "Draft", UnderReview: "Under Review", Approved: "Approved", Shared: "Shared", Executed: "Executed" },
  PartnerAgreementStatus: { None: "None", Sent: "Sent", Signed: "Signed" },
  MilestoneKey: {
    TeaserReview: "Teaser Review", NdaExecuted: "NDA Executed", ExpressionOfInterest: "EOI / LOI",
    DataRoomAccess: "Data Room Access", PreliminaryDD: "Preliminary DD", ICPaperPrepared: "IC Paper",
    FirstICApproval: "First IC Approval", NonBindingTermSheet: "Non-binding Term Sheet",
    TermSheetExecuted: "Term Sheet Executed", OnsiteDD: "Onsite DD", SecondICApproval: "Second IC Approval",
    BindingOffer: "Binding Offer", DefinitiveAgreements: "Definitive Agreements",
    CompetitionApproval: "Competition Approval (CAK/COMESA)", SuccessFeePaid: "Success Fee Paid",
  },
  RegulatoryStatus: { NotStarted: "Not Started", Filed: "Filed", Approved: "Approved", NotRequired: "Not Required" },
  DDTrack: { Financial: "Financial", Tax: "Tax", Commercial: "Commercial", ESG: "ESG", Legal: "Legal" },
  DDStatus: { NotStarted: "Not Started", InProgress: "In Progress", Complete: "Complete", Flagged: "Flagged", NotApplicable: "N/A" },
  OrgRole: { Admin: "Admin", DealLead: "Deal Lead", TeamMember: "Team Member" },
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
  // EngagementStage (12-stage pipeline)
  Shared: "bg-slate-400",
  TeaserSent: "bg-sky-400",
  NDASigned: "bg-sky-500",
  IMShared: "bg-violet-400",
  VDRAccess: "bg-violet-500",
  Meeting: "bg-amber-400",
  InfoRequest: "bg-amber-500",
  DueDiligence: "bg-orange-500",
  TermSheet: "bg-emerald-400",
  Offer: "bg-emerald-500",
  Invested: "bg-emerald-600",
  Declined: "bg-rose-500",
  // DocumentStatus (+ DocStatus Sent/Signed share keys)
  Draft: "bg-slate-300",
  UnderReview: "bg-amber-500",
  Approved: "bg-emerald-500",
  Executed: "bg-emerald-600",
  Sent: "bg-sky-500",
  Signed: "bg-emerald-500",
  // DisbursementStatus
  Disbursed: "bg-emerald-600",
  Ongoing: "bg-amber-500",
  FellOff: "bg-rose-400",
  Dropped: "bg-rose-500",
  // InvestorNdaStatus / PartnerAgreementStatus
  None: "bg-slate-300",
  OpenNDA: "bg-sky-500",
  ClosedNDA: "bg-emerald-500",
  // RegulatoryStatus / DDStatus (Approved shared above)
  NotStarted: "bg-slate-300",
  Filed: "bg-sky-500",
  NotRequired: "bg-slate-400",
  InProgress: "bg-amber-500",
  Complete: "bg-emerald-600",
  Flagged: "bg-rose-500",
  NotApplicable: "bg-slate-400",
};
