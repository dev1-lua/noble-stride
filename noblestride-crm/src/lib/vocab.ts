// Display labels + chip colors for the controlled vocabularies (SPEC §4).
// Enum identifiers are PascalCase in Prisma; humans see these labels.

export const LABELS: Record<string, Record<string, string>> = {
  Sector: {
    Agribusiness: "Agribusiness",
    FinancialServices: "Financial Services",
    FMCG: "Retail & FMCG",
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
    Energy: "Energy",
    OilAndGas: "Oil & Gas",
    Mining: "Mining",
    Gambling: "Gambling",
    Alcohol: "Alcohol",
    Tobacco: "Tobacco",
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
    Hybrid: "Hybrid",
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
  AdvisoryStage: {
    Scoping: "Scoping",
    Proposal: "Proposal",
    Engaged: "Engaged",
    Delivery: "Delivery",
    Completed: "Completed",
    Lost: "Lost",
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
    Event: "Networking event",
    Website: "Website",
    DirectEnquiry: "Direct enquiry",
    Consultant: "Consultant",
    Investor: "Investor",
    Partner: "Partner",
    SocialMedia: "Social media (LinkedIn / WhatsApp)",
    InternalBusinessDev: "Internal business development",
    Other: "Other",
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
    Dropped: "Dropped",
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
  OnboardingStatus: { PendingReview: "Pending Review", Approved: "Approved", Rejected: "Rejected" },
  AdvisorType: { Lawyer: "Lawyer", Investor: "Investor", Consultant: "Consultant", TransactionAdvisor: "Transaction Advisor", AdvisoryFirm: "Advisory Firm", Other: "Other" },
  ServiceProviderType: { LawFirm: "Law Firm", Audit: "Audit (Big 4)", Tax: "Tax", ESG: "ESG", Technical: "Technical", Other: "Other" },
  DocumentType: {
    NDA: "NDA", EngagementContract: "Engagement Contract", FeeShareAgreement: "Fee-Share Agreement", Teaser: "Teaser", IM: "Information Memorandum",
    FinancialModel: "Financial Model", Valuation: "Valuation", PitchDeck: "Pitch Deck", AuditedAccounts: "Audited Accounts",
    CR12: "CR12", TermSheet: "Term Sheet", LoanAgreement: "Loan Agreement", SPA: "SPA", SHA: "SHA", BusinessPlan: "Business Plan", Other: "Other",
  },
  DocumentAccessLevel: { Internal: "Internal", ClientShared: "Client-Shared", InvestorShared: "Investor-Shared", VDR: "VDR" },
  DocumentStatus: { Draft: "Draft", UnderReview: "Under Review", Approved: "Approved", Shared: "Shared", Executed: "Executed" },
  PartnerAgreementStatus: { None: "None", Sent: "Sent", Signed: "Signed" },
  // Spec-gap enums (SPEC §3.1/§3.10/§4.x)
  DealFinancingType: { Debt: "Debt", Equity: "Equity", EquityAndDebt: "Equity & Debt" },
  DealStatus: {
    Open: "Open", OnHold: "On Hold", Closed: "Closed",
    ClosedReopened: "Closed & Reopened", ClosedOnHold: "Closed & On Hold", Dropped: "Dropped",
  },
  DealMilestone: {
    TermSheet: "Term Sheet", NonBindingOffer: "Non-binding Offer", LoanAgreement: "Loan Agreement",
    SpaSha: "SPA / SHA", DueDiligence: "Due Diligence", IC: "IC", TA: "TA", Closed: "Closed",
  },
  MaxSellingStake: { Minority: "Minority", Majority: "Majority", FullSale: "Full Sale", NA: "N/A" },
  TaskSource: {
    MondayMeeting: "Monday Meeting", WhatsApp: "WhatsApp", Email: "Email", Verbal: "Verbal", Other: "Other",
  },
  CommChannel: {
    WhatsApp: "WhatsApp", Email: "Email", Slack: "Slack", WebChat: "Web chat", Call: "Call", Meeting: "Meeting",
  },
  CommDirection: { Inbound: "Inbound", Outbound: "Outbound" },
  ClientStatus: { Active: "Active", Prospect: "Prospect", Archived: "Archived" },
  ImpactFlag: { WomenLed: "Women-led", YouthLed: "Youth-led" },
  Profitability: { Profitable: "Profitable", LossMaking: "Loss-making" },
  ActorSource: { HUMAN: "Team", AGENT: "Agent", API: "API" },
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
  DealQueueGroupBy: { stage: "Stage", lead: "Lead", sector: "Sector", type: "Type", status: "Status" },
  // Task 6: qualification/scoping gap fields
  Priority: { High: "High", Medium: "Medium", Low: "Low" },
  PartnerFeeStatus: { NotDue: "Not Due", Due: "Due", Invoiced: "Invoiced", Paid: "Paid" },
};

// ── Stage tooltips (Wave 1 teaching layer) ──────────────────────────────────
// One-liner, plain-language explanation for every value of the three pipeline
// stage enums (MandateStage ×7, TransactionStage ×7, EngagementStage ×12 = 26).
// Nested per-enum (rather than a single flat Record<string,string>) because
// TransactionStage and EngagementStage both define TermSheet and DueDiligence
// — a flat map would force one enum's tooltip to silently win. Consumers that
// know their group is a stage enum can do STAGE_HELP[group]?.[value].
export const STAGE_HELP: Record<"MandateStage" | "TransactionStage" | "AdvisoryStage" | "EngagementStage", Record<string, string>> = {
  MandateStage: {
    NewLead: "A prospective client we haven't yet qualified",
    Qualification: "We're assessing whether this is a fit for Noblestride",
    PitchPresentation: "We've pitched our services to the prospective client",
    Proposal: "Our engagement proposal is with the client",
    Negotiation: "Terms of the engagement are being negotiated",
    Signed: "The engagement contract is signed — the mandate is live",
    Lost: "The prospective client did not proceed with Noblestride",
  },
  TransactionStage: {
    DealPreparation: "Analysis and investor documents are being prepared",
    InvestorOutreach: "Investors are being approached and worked through the pipeline",
    DueDiligence: "One or more investors are carrying out due diligence on this deal",
    TermSheet: "The deal has reached term sheet stage with at least one investor",
    Closing: "Final agreements and closing conditions are being completed",
    ClosedWon: "The transaction closed successfully",
    ClosedLost: "The transaction did not close",
  },
  AdvisoryStage: {
    Scoping: "We're defining the scope of the advisory engagement with the client",
    Proposal: "Our advisory proposal and fee terms are with the client",
    Engaged: "The advisory engagement is signed and about to start",
    Delivery: "Advisory work is underway and being delivered",
    Completed: "The advisory engagement has been delivered and closed out",
    Lost: "The client did not proceed with the advisory engagement",
  },
  EngagementStage: {
    Shared: "The deal has been shared with this investor",
    TeaserSent: "The teaser has been sent to this investor",
    NDASigned: "The investor has signed the NDA for this deal",
    IMShared: "The investor has received the Information Memorandum",
    VDRAccess: "The investor has been granted access to the data room",
    Meeting: "A meeting is scheduled or has taken place with the investor",
    InfoRequest: "The investor has requested more information",
    DueDiligence: "The investor is carrying out due diligence on the deal",
    TermSheet: "The investor has issued a term sheet",
    Offer: "The investor has made a binding offer",
    Invested: "The investor has committed and invested",
    Declined: "The investor has passed on this deal",
  },
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
  // OnboardingStatus
  PendingReview: "bg-amber-500",
  Rejected: "bg-rose-500",
  // ClientStatus
  Prospect: "bg-sky-500",
  Archived: "bg-slate-300",
  // DealStatus (Dropped/Active already covered above)
  Open: "bg-sky-500",
  OnHold: "bg-amber-500",
  Closed: "bg-emerald-500",
  ClosedReopened: "bg-violet-500",
  ClosedOnHold: "bg-amber-400",
  // RegulatoryStatus / DDStatus (Approved shared above)
  NotStarted: "bg-slate-300",
  Filed: "bg-sky-500",
  NotRequired: "bg-slate-400",
  InProgress: "bg-amber-500",
  Complete: "bg-emerald-600",
  Flagged: "bg-rose-500",
  NotApplicable: "bg-slate-400",
  // PartnerFeeStatus (Task 8)
  NotDue: "bg-slate-300",
  Due: "bg-amber-500",
  Invoiced: "bg-sky-500",
  Paid: "bg-emerald-600",
};
