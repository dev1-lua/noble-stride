// Pure preview/diff builder for the agent-write two-phase surface (prepare →
// confirm). No DB, no Prisma import — only string/value normalization so this
// module can be unit-tested (and re-used at prepare-time) without a database.
//
// Normalization rules:
//   - `undefined` payload values are always skipped (never rendered).
//   - Date / Decimal-like values render via `String(value)`.
//   - Arrays render via `.join(", ")`.
//   - Dates (real Date objects OR yyyy-mm-dd-prefixed strings) are compared at
//     calendar-date granularity (mirrors `sameCalendarDate` in ./crud) so a
//     resend at the UI's date granularity is never reported as a change.

import { sameCalendarDate } from "./crud";

// Friendly noun for each operation name, used to build the preview header
// ("Create client", "Update mandate stage", ...). Falls back to the raw
// operation name for anything not listed (defensive — every registry
// operation has an entry here as of this writing).
const OPERATION_NOUN: Record<string, string> = {
  createClient: "client",
  updateClient: "client",
  createMandate: "mandate",
  updateMandate: "mandate",
  setMandateStage: "mandate stage",
  createTransaction: "transaction",
  updateTransaction: "transaction",
  setTransactionStage: "transaction stage",
  createEngagement: "engagement",
  updateEngagement: "engagement",
  logActivity: "activity",
  createInvestor: "investor",
  updateInvestor: "investor",
  createPerson: "contact",
  updatePerson: "contact",
  createPartner: "partner",
  updatePartner: "partner",
  createTask: "task",
  updateTask: "task",
  createDocument: "document",
  updateDocument: "document",
  recordMilestone: "milestone",
  unrecordMilestone: "milestone",
  recordOpenNda: "open NDA",
  recordClosedNda: "closed NDA",
};

function operationNoun(operation: string): string {
  return OPERATION_NOUN[operation] ?? operation;
}

/** Date/Decimal → String(); arrays → join(", "); everything else → String(). */
function formatForDisplay(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => formatForDisplay(v)).join(", ");
  return String(value);
}

/** A real Date, or a string that looks like an ISO date (yyyy-mm-dd...). */
function toDateIfDateLike(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/** Two values are "the same" for diffing purposes. Date-aware, else string-normalized. */
function valuesEqual(before: unknown, incoming: unknown): boolean {
  const beforeDate = toDateIfDateLike(before);
  const incomingDate = toDateIfDateLike(incoming);
  if (beforeDate && incomingDate) return sameCalendarDate(beforeDate, incomingDate);
  return formatForDisplay(before) === formatForDisplay(incoming);
}

/** Preview lines for a create: one `- key: value` per defined payload field. */
export function buildCreatePreview(operation: string, payload: Record<string, unknown>): string {
  const lines: string[] = [`Create ${operationNoun(operation)}`];
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    lines.push(`- ${key}: ${formatForDisplay(value)}`);
  }
  return lines.join("\n");
}

/**
 * Preview lines for an update: only fields that ACTUALLY change (payload
 * value defined AND different from `current`, date-aware) get a
 * `- key: old → new` line. `changedKeys` mirrors those lines 1:1.
 */
export function buildUpdatePreview(
  operation: string,
  current: Record<string, unknown>,
  payload: Record<string, unknown>,
): { preview: string; changedKeys: string[] } {
  const changedKeys: string[] = [];
  const lines: string[] = [];
  for (const [key, incoming] of Object.entries(payload)) {
    if (incoming === undefined) continue;
    const before = current[key];
    if (valuesEqual(before, incoming)) continue;
    changedKeys.push(key);
    lines.push(`- ${key}: ${formatForDisplay(before)} → ${formatForDisplay(incoming)}`);
  }
  const preview = [`Update ${operationNoun(operation)}`, ...lines].join("\n");
  return { preview, changedKeys };
}
