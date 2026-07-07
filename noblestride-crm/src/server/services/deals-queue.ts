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
  ticket: number | null;
  sectors: string[];
  leadName: string | null;
  leadColor: string | null;
  dateOnboarded: string | null;
  nextAction: string | null;
  daysInStage: number;
  linkedCounterpartId: string | null;
  href: string;
}

async function loadRows(): Promise<DealRow[]> {
  const now = new Date();
  const [mandates, transactions] = await Promise.all([
    prisma.mandate.findMany({
      include: { client: true, lead: true, transactions: { select: { id: true }, take: 1 } },
    }),
    // Deviation (STEP 0): Transaction has no `lead` relation — it has `owner`
    // (User? via the "TransactionOwner" relation). Used here as the row's lead.
    prisma.transaction.findMany({ include: { client: true, owner: true } }),
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
    ticket: m.dealSize != null ? Number(m.dealSize) : null,
    sectors: m.sector ?? [],
    leadName: m.lead?.name ?? null,
    leadColor: m.lead?.avatarColor ?? null,
    dateOnboarded: m.dateOpened ? m.dateOpened.toISOString() : null,
    nextAction: m.nextAction ?? null,
    daysInStage: daysInStage(m.stageEnteredAt ?? now, now),
    linkedCounterpartId: m.transactions[0]?.id ?? null,
    href: `/mandates/${m.id}`,
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
    ticket: t.targetRaise != null ? Number(t.targetRaise) : null,
    sectors: t.client?.sector ?? [],
    leadName: t.owner?.name ?? null,
    leadColor: t.owner?.avatarColor ?? null,
    dateOnboarded: t.dateOpened ? t.dateOpened.toISOString() : null,
    nextAction: null,
    daysInStage: daysInStage(t.stageEnteredAt ?? now, now),
    linkedCounterpartId: t.mandateId ?? null,
    href: `/transactions/${t.id}`,
  }));

  return [...mRows, ...tRows];
}

function matches(r: DealRow, spec: DealsQuerySpec): boolean {
  if (spec.type && r.kind !== spec.type) return false;
  if (spec.stage && r.stageValue !== spec.stage) return false;
  if (spec.status && r.statusValue !== spec.status) return false;
  if (spec.sector && !r.sectors.includes(spec.sector)) return false;
  if (spec.lead && r.leadName !== spec.lead) return false;
  if (spec.ticketBand) {
    const band = TICKET_BANDS.find((b) => b.value === spec.ticketBand);
    if (band) {
      const v = r.ticket ?? -1;
      if (v < band.min || (band.max != null && v >= band.max)) return false;
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
    case "type": return { key: r.kind, label: r.kind === "mandate" ? "Mandate" : "Transaction" };
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

const CSV_HEADERS = ["Project", "Company", "Type", "Stage", "Status", "Milestone", "Deal type", "Ticket (USD)", "Sector", "Lead", "Date onboarded", "Days in stage"];

export async function dealsCsvRows(spec: DealsQuerySpec): Promise<string[][]> {
  const all = applySort((await loadRows()).filter((r) => matches(r, spec)), spec);
  const body = all.map((r) => [
    r.name, r.company, r.kind, r.stageLabel, r.statusLabel, r.milestoneLabel,
    r.dealTypeLabel, r.ticket != null ? String(r.ticket) : "", r.sectors.map((s) => label("Sector", s)).join("; "),
    r.leadName ?? "", r.dateOnboarded ? r.dateOnboarded.slice(0, 10) : "", String(r.daysInStage),
  ]);
  return [CSV_HEADERS, ...body];
}
