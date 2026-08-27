import type { RecordType } from "./resolve";

export const STALE_DAYS = 30;
const DAY_MS = 86_400_000;

export type Severity = "info" | "warn" | "risk";
export interface HealthFinding { area: string; severity: Severity; detail: string }
export interface DepthDimension { dimension: string; label: string }
export interface DealHealthResult { findings: HealthFinding[]; depth: DepthDimension[] }

export interface AnalysisPipelineItem {
  id: string; name: string;
  stageEnteredAt?: string | null; createdAt: string; updatedAt: string;
  dealSize?: number | null; targetRaise?: number | null; sector?: string[] | null;
}
export interface PipelineMetric { stage: string; count: number; totalValue: number | null }
export interface PipelineAnalysis {
  metrics: PipelineMetric[];
  aging: Array<{ name: string; stage: string; idleDays: number }>;
  concentration: Array<{ sector: string; count: number }>;
  depth: DepthDimension[];
}

function idleDays(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / DAY_MS);
}

function hasItems(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0;
}

/**
 * The CRM `activities` relation has no orderBy (server `t.relation("activities")`),
 * so the server may return activities in any order (commonly oldest-first, insertion
 * order). We must not assume `activities[0]` is the most recent — scan every entry
 * and take the MAX parseable `occurredAt`. Entries with missing/unparseable dates are
 * ignored; if none are parseable, there is no dated activity (returns null).
 */
function latestActivityIso(activities: unknown): string | null {
  if (!Array.isArray(activities)) return null;
  let bestIso: string | null = null;
  let bestT = -Infinity;
  for (const a of activities) {
    const iso = (a as Record<string, unknown> | null | undefined)?.occurredAt;
    if (typeof iso !== "string") continue;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) continue;
    if (t > bestT) { bestT = t; bestIso = iso; }
  }
  return bestIso;
}

const STAGED_RECORD_TYPES: ReadonlySet<RecordType> = new Set(["mandate", "transaction", "engagement"]);

/** Deal-health checklist. Facts drive findings; "likely stalled" style items are severity warn/risk but phrased as signals, not verdicts, downstream. */
export function assessDealHealth(recordType: RecordType, record: Record<string, unknown>, now: Date = new Date()): DealHealthResult {
  const findings: HealthFinding[] = [];
  const depth: DepthDimension[] = [];

  const activities = record.activities;

  // Stalled stage: no stage movement for > STALE_DAYS. Only record types with an
  // actual pipeline stage are eligible — investors/partners/clients have no
  // `stage`, and falling back to `updatedAt` for them would mislabel a plain
  // "hasn't been edited recently" as a stage-stall signal.
  if (STAGED_RECORD_TYPES.has(recordType)) {
    const stageIdle = idleDays(String(record.stageEnteredAt ?? record.updatedAt ?? ""), now);
    if (stageIdle !== null && stageIdle > STALE_DAYS) {
      findings.push({ area: "stage", severity: stageIdle > STALE_DAYS * 2 ? "risk" : "warn",
        detail: `In its current stage for ~${stageIdle} days (signal of a stall).` });
    }
  }

  // No recent activity
  const actIdle = idleDays(latestActivityIso(activities), now);
  if (!hasItems(activities) || (actIdle !== null && actIdle > STALE_DAYS)) {
    findings.push({ area: "activity", severity: "warn",
      detail: hasItems(activities) ? `No logged activity for ~${actIdle} days.` : "No activity has been logged." });
  }
  if (hasItems(activities)) depth.push({ dimension: "activity", label: "the full activity timeline" });

  // Type-specific checks
  if (recordType === "transaction") {
    if (!hasItems(record.engagements)) findings.push({ area: "engagements", severity: "risk", detail: "No investor engagements yet." });
    else depth.push({ dimension: "engagements", label: "the investor engagements and their stages" });
    if (record.targetRaise == null) findings.push({ area: "target", severity: "warn", detail: "No target raise set." });
  }
  if (recordType === "mandate") {
    if (!hasItems(record.transactions)) findings.push({ area: "transactions", severity: "warn", detail: "No transactions opened under this mandate." });
    else depth.push({ dimension: "transactions", label: "the transactions under this mandate" });
    const nda = String(record.ndaStatus ?? "").toLowerCase();
    if (nda && nda !== "signed" && nda !== "closed") findings.push({ area: "nda", severity: "warn", detail: `NDA status is "${record.ndaStatus}".` });
  }
  if (recordType === "engagement") {
    if (record.termSheetIssued === true && !record.ndaSignedAt) findings.push({ area: "nda", severity: "risk", detail: "Term sheet issued but no NDA signed date recorded." });
    if (hasItems(record.milestones)) depth.push({ dimension: "milestones", label: "the milestone checklist" });
  }
  if (recordType === "investor") {
    const noCriteria = !hasItems(record.sectorFocus) || (record.ticketMin == null && record.ticketMax == null);
    if (noCriteria) findings.push({ area: "criteria", severity: "warn", detail: "Investment criteria are incomplete (sector focus and/or ticket range missing)." });
    if (hasItems(record.engagements)) depth.push({ dimension: "engagements", label: "this investor's engagements" });
  }

  // Missing primary contact (client-bearing records)
  const client = record.client as Record<string, unknown> | undefined;
  const contacts = (record.contacts ?? client?.contacts) as unknown;
  if (Array.isArray(contacts) && !contacts.some((c) => (c as Record<string, unknown>).isPrimaryContact === true)) {
    findings.push({ area: "contact", severity: "info", detail: "No primary contact marked." });
  }

  // Documents present → offer, never expose bytes
  if (hasItems(record.documents)) depth.push({ dimension: "documents", label: "the document checklist (metadata)" });

  if (findings.length === 0) findings.push({ area: "overall", severity: "info", detail: "No health issues detected on the checked dimensions." });
  return { findings, depth };
}

// ── Deal roster by stage ───────────────────────────────────────────────────
// A full name-by-name listing of every deal in every stage — distinct from
// analyzePipeline (which collapses items into counts/value/aging). Reuses the
// same PIPELINE_SNAPSHOT column shape but preserves each deal's name + lead.

export interface RosterDeal { name: string; lead: string | null; value: number | null; currency: string | null }
export interface RosterStage { stage: string; label: string; count: number; deals: RosterDeal[] }

/**
 * Group deals by stage, preserving each deal's name and resolved lead.
 * `kind` selects where the lead name and headline value live:
 *  - transaction → owner.name / targetRaise
 *  - mandate     → lead.name  / dealSize
 */
export function rosterByStage(
  columns: Array<{ stage: string; label: string; items: Array<Record<string, unknown>> }>,
  kind: "mandate" | "transaction",
): RosterStage[] {
  return columns.map((col) => ({
    stage: col.stage,
    label: col.label,
    count: col.items.length,
    deals: col.items.map((it) => {
      const person = (kind === "transaction" ? it.owner : it.lead) as { name?: string | null } | null | undefined;
      const value = (kind === "transaction" ? it.targetRaise : it.dealSize) as number | null | undefined;
      return {
        name: String(it.name ?? "(unnamed)"),
        lead: person?.name ?? null,
        value: value ?? null,
        currency: (it.currency as string | null | undefined) ?? null,
      };
    }),
  }));
}

// ── Engagement freshness (Task 2: list_deal_interest) ──────────────────────
// Mirrors the CRM's own thresholds for "is this engagement going cold"
// (noblestride-crm src/server/domain/comm-timeline.ts:56-69 `contactFreshness`,
// STALE_CONTACT_WARN_DAYS=7 / STALE_CONTACT_ALERT_DAYS=14) — same day boundaries.
// NOTE: this only measures recency of a touch on EITHER side (a staff outbound
// bump counts same as an investor reply) — it is a contact-recency signal, not
// proof the investor themselves is engaging. Callers should not overclaim it.

export const ENGAGEMENT_ACTIVE_DAYS = 7;
export const ENGAGEMENT_COOLING_DAYS = 14;

export type EngagementActivity = "active" | "cooling" | "dormant" | "never_contacted";

export function engagementActivity(lastTouch: string | null, now: Date = new Date()): EngagementActivity {
  if (!lastTouch) return "never_contacted";
  const t = new Date(lastTouch).getTime();
  if (Number.isNaN(t)) return "never_contacted";
  const days = Math.floor((now.getTime() - t) / DAY_MS);
  if (days < ENGAGEMENT_ACTIVE_DAYS) return "active";
  if (days < ENGAGEMENT_COOLING_DAYS) return "cooling";
  return "dormant";
}

/**
 * The more recent of two ISO timestamps, either of which may be missing or
 * unparseable. Used to combine `engagement.lastContact` with
 * `engagement.conversation.lastMessageAt` into a single "last touch" signal.
 */
export function mostRecentTouch(a: string | null | undefined, b: string | null | undefined): string | null {
  const ta = a ? new Date(a).getTime() : NaN;
  const tb = b ? new Date(b).getTime() : NaN;
  if (Number.isNaN(ta) && Number.isNaN(tb)) return null;
  if (Number.isNaN(ta)) return b as string;
  if (Number.isNaN(tb)) return a as string;
  return ta >= tb ? (a as string) : (b as string);
}

// Port of noblestride-crm src/lib/milestones.ts STAGE_MILESTONES (lines 49-77),
// narrowed to the one fact list_deal_interest needs: which EngagementStage
// values, on their own, imply ExpressionOfInterest is already effectively done
// (mirrors effectiveMilestones(stage, recorded), lines 80-85). "Declined" is
// deliberately excluded: the CRM's own table gives it `[]` ("whatever was
// individually recorded stands; stage implies nothing further").
//
// This matters because the CRM's own interest-recording flows (portal
// `expressInterest`, the investor email agent) only ever bump engagement
// STATUS — neither ever writes an EngagementMilestone row for
// ExpressionOfInterest, and both refuse to bump status once it is already past
// Contacted. So an investor already at, say, DueDiligence who re-affirms
// interest will never get an explicit EOI milestone row; gating on the
// milestone alone would wrongly show them as not-yet-interested.
const EOI_IMPLIED_STAGES: ReadonlySet<string> = new Set([
  "Meeting", "InfoRequest", "IMShared", "VDRAccess", "DueDiligence", "TermSheet", "Offer", "Invested",
]);

/**
 * Mirrors the CRM's effectiveMilestones(stage, recorded), narrowed to asking
 * one question: has ExpressionOfInterest effectively happened? True if an EOI
 * milestone was individually recorded (any stage, including Declined — a
 * recorded milestone always stands), OR the engagement's stage alone implies
 * it (see EOI_IMPLIED_STAGES).
 */
export function hasExpressedInterestViaStage(engagementStage: string | null | undefined, milestoneKeys: string[]): boolean {
  if (milestoneKeys.includes("ExpressionOfInterest")) return true;
  return !!engagementStage && EOI_IMPLIED_STAGES.has(engagementStage);
}

export function analyzePipeline(columns: Array<{ stage: string; label: string; items: AnalysisPipelineItem[] }>, now: Date = new Date()): PipelineAnalysis {
  const metrics: PipelineMetric[] = [];
  const aging: PipelineAnalysis["aging"] = [];
  const sectorCounts = new Map<string, number>();

  for (const col of columns) {
    let value = 0; let hasValue = false;
    for (const it of col.items) {
      const v = it.dealSize ?? it.targetRaise;
      if (v != null) { value += v; hasValue = true; }
      const idle = idleDays(it.updatedAt, now);
      if (idle !== null && idle > STALE_DAYS) aging.push({ name: it.name, stage: col.label, idleDays: idle });
      for (const s of it.sector ?? []) sectorCounts.set(s, (sectorCounts.get(s) ?? 0) + 1);
    }
    metrics.push({ stage: col.stage, count: col.items.length, totalValue: hasValue ? value : null });
  }

  aging.sort((a, b) => b.idleDays - a.idleDays);
  const concentration = [...sectorCounts.entries()].map(([sector, count]) => ({ sector, count })).sort((a, b) => b.count - a.count);

  const depth: DepthDimension[] = [];
  if (aging.length) depth.push({ dimension: "aging", label: "the full list of stalled deals" });
  if (concentration.length) depth.push({ dimension: "concentration", label: "the sector/value concentration breakdown" });

  return { metrics, aging, concentration, depth };
}
