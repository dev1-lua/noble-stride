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
] as const;
