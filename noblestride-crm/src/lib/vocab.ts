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
// Neutral palette for category chips (sector/type/geography), assigned deterministically.
const PALETTE = [
  "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  "bg-sky-50 text-sky-700 ring-sky-600/20",
  "bg-violet-50 text-violet-700 ring-violet-600/20",
  "bg-amber-50 text-amber-700 ring-amber-600/20",
  "bg-rose-50 text-rose-700 ring-rose-600/20",
  "bg-cyan-50 text-cyan-700 ring-cyan-600/20",
  "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  "bg-teal-50 text-teal-700 ring-teal-600/20",
  "bg-orange-50 text-orange-700 ring-orange-600/20",
  "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20",
];

export function chipClasses(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

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
