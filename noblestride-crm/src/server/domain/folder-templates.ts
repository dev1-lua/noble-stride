// Default folder taxonomy for deal file rooms (client feedback 2026-07).
// ⚠ Client-confirmable (questionnaire Q4) — safe to rename before launch;
// folders are pure DB organization, never storage paths or access grants.

export const DEAL_FOLDER_TEMPLATE = [
  "01 Corporate",
  "02 Financials",
  "03 Legal",
  "04 Commercial",
  "05 Marketing & IM",
  "06 Data Room",
  // Transcript grouping (action points 2026-07 item 5): deal → potential
  // investors → {investor} → term sheets. Per-investor subfolders are added
  // lazily by ensureInvestorDealFolder when an engagement is created.
  "07 Potential Investors",
] as const;

/** The template child that holds per-investor subfolders. */
export const POTENTIAL_INVESTORS_FOLDER = "07 Potential Investors";

/** Standard subfolder inside each investor's folder (transcript: "term sheet"). */
export const INVESTOR_TERM_SHEETS_FOLDER = "Term Sheets";
