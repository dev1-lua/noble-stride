import { prisma } from "@/lib/db";
import { label } from "@/lib/vocab";
import { daysInStage } from "@/server/domain/metrics";
import {
  type DealsQuerySpec, type DealKind, type DealsGroupBy, TICKET_BANDS,
} from "@/server/domain/deals-queue";

export interface DealRow {
  id: string;
  kind: DealKind;
  name: string;
  company: string;
  stageValue: string;
  stageLabel: string;
  statusValue: string | null;
  statusLabel: string;
  milestoneLabel: string;
  dealTypeLabel: string;
  // Raw DealFinancingType value (transactions only) — filterable, unlike the label.
  financingValue: string | null;
  ticket: number | null;
  sectors: string[];
  country: string | null;
  leadName: string | null;
  leadColor: string | null;
  // Ids that drive the inline lead/assist editors (mandate.leadId /
  // transaction.ownerId / advisory.leadId; assists m2m user ids).
  leadId: string | null;
  assistIds: string[];
  assistNames: string[];
  dateOnboarded: string | null;
  // Drilldown date bounds (dashboard trend chart). openedAt = dateOpened ??
  // createdAt (ISO); closedAt = ISO for closed transactions, null otherwise.
  openedAt: string | null;
  closedAt: string | null;
  nextAction: string | null;
  daysInStage: number;
  linkedCounterpartId: string | null;
  href: string;
  // Task 8: Mandate.priority / Transaction.priority
  priorityValue: string | null;
  priorityLabel: string;
  // Task 12: originating source (e.g. "Website" for public-intake mandates)
  sourceValue: string | null;
}

// Rank for priority sort — unset sorts lowest ("asc" surfaces it first).
const PRIORITY_RANK: Record<string, number> = { High: 3, Medium: 2, Low: 1 };

async function loadRows(): Promise<DealRow[]> {
  const now = new Date();
  const [mandates, transactions, advisory] = await Promise.all([
    prisma.mandate.findMany({
      include: { client: true, lead: true, assists: { select: { id: true, name: true } }, transactions: { select: { id: true }, take: 1 } },
    }),
    // Deviation (STEP 0): Transaction has no `lead` relation — it has `owner`
    // (User? via the "TransactionOwner" relation). Used here as the row's lead.
    prisma.transaction.findMany({ include: { client: true, owner: true, assists: { select: { id: true, name: true } } } }),
    prisma.advisoryEngagement.findMany({ include: { client: true, lead: true, assists: { select: { id: true, name: true } } } }),
  ]);

  const mRows: DealRow[] = mandates.map((m) => ({
    id: m.id,
    kind: "mandate",
    name: m.name,
    company: m.client?.name ?? m.name,
    stageValue: m.stage,
    stageLabel: label("MandateStage", m.stage),
    statusValue: m.dealStatus,
    statusLabel: label("DealStatus", m.dealStatus),
    milestoneLabel: "",
    dealTypeLabel: "",
    financingValue: null,
    ticket: m.dealSize != null ? Number(m.dealSize) : null,
    sectors: m.sector ?? [],
    country: m.country ?? m.client?.hqCountry ?? null,
    leadName: m.lead?.name ?? null,
    leadColor: m.lead?.avatarColor ?? null,
    leadId: m.leadId ?? null,
    assistIds: m.assists.map((a) => a.id),
    assistNames: m.assists.map((a) => a.name),
    dateOnboarded: m.dateOpened ? m.dateOpened.toISOString() : null,
    openedAt: (m.dateOpened ?? m.createdAt).toISOString(),
    closedAt: null,
    nextAction: m.nextAction ?? null,
    daysInStage: daysInStage(m.stageEnteredAt ?? now, now),
    linkedCounterpartId: m.transactions[0]?.id ?? null,
    href: `/mandates/${m.id}`,
    priorityValue: m.priority ?? null,
    priorityLabel: m.priority ? label("Priority", m.priority) : "",
    sourceValue: m.source ?? null,
  }));

  const tRows: DealRow[] = transactions.map((t) => ({
    id: t.id,
    kind: "transaction",
    name: t.name,
    company: t.client?.name ?? t.name,
    stageValue: t.stage,
    stageLabel: label("TransactionStage", t.stage),
    statusValue: t.dealStatus ?? null,
    statusLabel: t.dealStatus ? label("DealStatus", t.dealStatus) : "",
    milestoneLabel: t.dealMilestone ? label("DealMilestone", t.dealMilestone) : "",
    dealTypeLabel: t.financingType ? label("DealFinancingType", t.financingType) : "",
    financingValue: t.financingType ?? null,
    ticket: t.targetRaise != null ? Number(t.targetRaise) : null,
    // Own sector first; legacy rows without one fall back to the client's
    // (the dashboard's By Sector breakdown buckets with the same rule so
    // drilldown counts agree — see pipelineBreakdowns).
    sectors: t.sector?.length ? t.sector : (t.client?.sector ?? []),
    country: t.country ?? t.client?.hqCountry ?? null,
    leadName: t.owner?.name ?? null,
    leadColor: t.owner?.avatarColor ?? null,
    leadId: t.ownerId ?? null,
    assistIds: t.assists.map((a) => a.id),
    assistNames: t.assists.map((a) => a.name),
    dateOnboarded: t.dateOpened ? t.dateOpened.toISOString() : null,
    openedAt: (t.dateOpened ?? t.createdAt).toISOString(),
    closedAt: t.closedAt ? t.closedAt.toISOString() : null,
    nextAction: null,
    daysInStage: daysInStage(t.stageEnteredAt ?? now, now),
    linkedCounterpartId: t.mandateId ?? null,
    href: `/transactions/${t.id}`,
    priorityValue: t.priority ?? null,
    priorityLabel: t.priority ? label("Priority", t.priority) : "",
    // Transaction has no `source` field (only Client/Mandate do) — never matches a source filter.
    sourceValue: null,
  }));

  const aRows: DealRow[] = advisory.map((a) => ({
    id: a.id,
    kind: "advisory",
    name: a.name,
    company: a.client?.name ?? a.name,
    stageValue: a.stage,
    stageLabel: label("AdvisoryStage", a.stage),
    statusValue: a.dealStatus,
    statusLabel: label("DealStatus", a.dealStatus),
    milestoneLabel: "",
    dealTypeLabel: "",
    financingValue: null,
    ticket: a.feeAmount != null ? Number(a.feeAmount) : null,
    sectors: a.sector ?? [],
    country: a.country ?? a.client?.hqCountry ?? null,
    leadName: a.lead?.name ?? null,
    leadColor: a.lead?.avatarColor ?? null,
    leadId: a.leadId ?? null,
    assistIds: a.assists.map((u) => u.id),
    assistNames: a.assists.map((u) => u.name),
    dateOnboarded: a.dateOpened ? a.dateOpened.toISOString() : null,
    openedAt: (a.dateOpened ?? a.createdAt).toISOString(),
    closedAt: null,
    nextAction: a.nextAction ?? null,
    daysInStage: daysInStage(a.stageEnteredAt ?? now, now),
    linkedCounterpartId: null,
    href: `/advisory/${a.id}`,
    priorityValue: a.priority ?? null,
    priorityLabel: a.priority ? label("Priority", a.priority) : "",
    sourceValue: a.source ?? null,
  }));

  return [...mRows, ...tRows, ...aRows];
}

function matches(r: DealRow, spec: DealsQuerySpec): boolean {
  if (spec.type.length > 0 && !spec.type.includes(r.kind)) return false;
  if (spec.stage.length > 0 && !spec.stage.includes(r.stageValue)) return false;
  if (spec.status.length > 0 && (r.statusValue == null || !spec.status.includes(r.statusValue))) return false;
  if (spec.sector.length > 0 && !r.sectors.some((s) => spec.sector.includes(s))) return false;
  if (spec.country.length > 0 && (r.country == null || !spec.country.includes(r.country))) return false;
  if (spec.lead.length > 0 && (r.leadName == null || !spec.lead.includes(r.leadName))) return false;
  if (spec.assist.length > 0 && !r.assistNames.some((n) => spec.assist.includes(n))) return false;
  if (spec.priority.length > 0 && (r.priorityValue == null || !spec.priority.includes(r.priorityValue))) return false;
  if (spec.source.length > 0 && (r.sourceValue == null || !spec.source.includes(r.sourceValue))) return false;
  if (spec.financing.length > 0 && (r.financingValue == null || !spec.financing.includes(r.financingValue))) return false;
  // Active-as-of drilldown: open by `activeAsOf` and not yet closed by then.
  // (ISO strings compare chronologically since all are UTC toISOString().)
  if (spec.activeAsOf) {
    if (r.openedAt == null || r.openedAt > spec.activeAsOf) return false;
    if (r.closedAt != null && r.closedAt <= spec.activeAsOf) return false;
  }
  // Closed-in-range drilldown: closedAt within [closedFrom, closedTo].
  if (spec.closedFrom || spec.closedTo) {
    if (r.closedAt == null) return false;
    if (spec.closedFrom && r.closedAt < spec.closedFrom) return false;
    if (spec.closedTo && r.closedAt > spec.closedTo) return false;
  }
  if (spec.ticketBand.length > 0) {
    const bands = TICKET_BANDS.filter((b) => spec.ticketBand.includes(b.value));
    if (bands.length > 0) {
      const v = r.ticket ?? -1;
      const inAnyBand = bands.some((band) => v >= band.min && (band.max == null || v < band.max));
      if (!inAnyBand) return false;
    }
  }
  if (spec.search) {
    const q = spec.search.toLowerCase();
    const hay = `${r.name} ${r.company} ${r.nextAction ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function sortValue(r: DealRow, key: DealsQuerySpec["sort"]): string | number {
  switch (key) {
    case "name": return r.name.toLowerCase();
    case "company": return r.company.toLowerCase();
    case "stage": return r.stageLabel.toLowerCase();
    case "status": return r.statusLabel.toLowerCase();
    case "ticket": return r.ticket ?? -1;
    case "lead": return (r.leadName ?? "").toLowerCase();
    case "daysInStage": return r.daysInStage;
    case "dateOnboarded": return r.dateOnboarded ?? "";
    case "priority": return r.priorityValue ? (PRIORITY_RANK[r.priorityValue] ?? 0) : 0;
  }
}

function applySort(rows: DealRow[], spec: DealsQuerySpec): DealRow[] {
  const factor = spec.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = sortValue(a, spec.sort);
    const bv = sortValue(b, spec.sort);
    if (av < bv) return -1 * factor;
    if (av > bv) return 1 * factor;
    return 0;
  });
}

export async function listDeals(spec: DealsQuerySpec): Promise<{ rows: DealRow[]; total: number }> {
  const all = (await loadRows()).filter((r) => matches(r, spec));
  const sorted = applySort(all, spec);
  const start = (spec.page - 1) * spec.pageSize;
  return { rows: sorted.slice(start, start + spec.pageSize), total: sorted.length };
}

// Same filter/sort as listDeals but unpaginated — used for grouped list views,
// where group headers (from countsBy, over the whole filtered set) must agree
// with the rows rendered under them. A 50-row page would under-fill later
// groups and leave groups on other pages empty.
export async function listAllDeals(spec: DealsQuerySpec): Promise<{ rows: DealRow[]; total: number }> {
  const all = (await loadRows()).filter((r) => matches(r, spec));
  const sorted = applySort(all, spec);
  return { rows: sorted, total: sorted.length };
}

function groupKey(r: DealRow, dim: DealsGroupBy): { key: string; label: string } {
  switch (dim) {
    case "stage": return { key: r.stageValue, label: r.stageLabel };
    case "lead": return { key: r.leadName ?? "—", label: r.leadName ?? "Unassigned" };
    case "sector": return { key: r.sectors[0] ?? "—", label: r.sectors[0] ? label("Sector", r.sectors[0]) : "No sector" };
    case "type": return { key: r.kind, label: r.kind === "mandate" ? "Mandate" : r.kind === "advisory" ? "Advisory" : "Transaction" };
    case "status": return { key: r.statusValue ?? "—", label: r.statusLabel || "No status" };
    default: return { key: "all", label: "All" };
  }
}

export async function countsBy(spec: DealsQuerySpec, dimension: DealsGroupBy) {
  const all = (await loadRows()).filter((r) => matches(r, spec));
  const map = new Map<string, { key: string; label: string; count: number }>();
  for (const r of all) {
    const g = groupKey(r, dimension);
    const cur = map.get(g.key) ?? { key: g.key, label: g.label, count: 0 };
    cur.count += 1;
    map.set(g.key, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

const CSV_HEADERS = ["Project", "Company", "Type", "Stage", "Status", "Milestone", "Deal type", "Ticket (USD)", "Sector", "Country", "Lead", "Assists", "Date onboarded", "Days in stage", "Priority"];

export async function dealsCsvRows(spec: DealsQuerySpec): Promise<string[][]> {
  const all = applySort((await loadRows()).filter((r) => matches(r, spec)), spec);
  const body = all.map((r) => [
    r.name, r.company, r.kind, r.stageLabel, r.statusLabel, r.milestoneLabel,
    r.dealTypeLabel, r.ticket != null ? String(r.ticket) : "", r.sectors.map((s) => label("Sector", s)).join("; "),
    r.country ?? "", r.leadName ?? "", r.assistNames.join("; "), r.dateOnboarded ? r.dateOnboarded.slice(0, 10) : "", String(r.daysInStage),
    r.priorityLabel,
  ]);
  return [CSV_HEADERS, ...body];
}
