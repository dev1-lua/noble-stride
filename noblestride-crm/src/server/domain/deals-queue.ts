// Pure parsing/registry for the unified deals queue. No DB.

export type DealKind = "mandate" | "transaction";
export type DealsSortKey =
  | "name" | "company" | "stage" | "status" | "ticket" | "lead" | "dateOnboarded" | "daysInStage";
export type DealsGroupBy = "" | "stage" | "lead" | "sector" | "type" | "status";
export type DealsView = "list" | "board";

const SORT_KEYS: DealsSortKey[] = ["name", "company", "stage", "status", "ticket", "lead", "dateOnboarded", "daysInStage"];
const GROUP_KEYS: DealsGroupBy[] = ["", "stage", "lead", "sector", "type", "status"];

export interface DealsQuerySpec {
  type?: DealKind;
  stage?: string;
  status?: string;
  sector?: string;
  lead?: string;
  ticketBand?: string;
  search?: string;
  sort: DealsSortKey;
  dir: "asc" | "desc";
  groupBy: DealsGroupBy;
  page: number;
  pageSize: number;
  view: DealsView;
}

export const DEAL_COLUMNS: { key: string; label: string; default: boolean }[] = [
  { key: "name", label: "Project", default: true },
  { key: "company", label: "Company", default: true },
  { key: "type", label: "Type", default: true },
  { key: "stage", label: "Stage", default: true },
  { key: "status", label: "Status", default: true },
  { key: "milestone", label: "Milestone", default: true },
  { key: "dealType", label: "Deal type", default: true },
  { key: "ticket", label: "Ticket size", default: true },
  { key: "sector", label: "Sector", default: true },
  { key: "lead", label: "Lead", default: true },
  { key: "dateOnboarded", label: "Date onboarded", default: true },
  { key: "nextAction", label: "Next action", default: true },
  { key: "daysInStage", label: "Days in stage", default: true },
];

const KNOWN_COLUMNS = new Set(DEAL_COLUMNS.map((c) => c.key));

export const TICKET_BANDS: { value: string; label: string; min: number; max: number | null }[] = [
  { value: "0-1m", label: "< $1M", min: 0, max: 1_000_000 },
  { value: "1-5m", label: "$1M–$5M", min: 1_000_000, max: 5_000_000 },
  { value: "5-20m", label: "$5M–$20M", min: 5_000_000, max: 20_000_000 },
  { value: "20m+", label: "$20M+", min: 20_000_000, max: null },
];

function str(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  const t = s?.trim();
  return t ? t : undefined;
}

export function parseDealsQuery(sp: Record<string, string | string[] | undefined>): DealsQuerySpec {
  const type = str(sp.type);
  const sortRaw = str(sp.sort) as DealsSortKey | undefined;
  const groupRaw = str(sp.group) as DealsGroupBy | undefined;
  const pageNum = Number.parseInt(str(sp.page) ?? "1", 10);
  return {
    type: type === "mandate" || type === "transaction" ? type : undefined,
    stage: str(sp.stage),
    status: str(sp.status),
    sector: str(sp.sector),
    lead: str(sp.lead),
    ticketBand: str(sp.ticket),
    search: str(sp.q),
    sort: sortRaw && SORT_KEYS.includes(sortRaw) ? sortRaw : "dateOnboarded",
    dir: str(sp.dir) === "asc" ? "asc" : "desc",
    groupBy: groupRaw && GROUP_KEYS.includes(groupRaw) ? groupRaw : "",
    page: Number.isFinite(pageNum) && pageNum >= 1 ? pageNum : 1,
    pageSize: 50,
    view: str(sp.view) === "board" ? "board" : "list",
  };
}

export function parseColumns(csv: string | undefined): string[] {
  if (!csv) return DEAL_COLUMNS.filter((c) => c.default).map((c) => c.key);
  const picked = csv.split(",").map((s) => s.trim()).filter((k) => KNOWN_COLUMNS.has(k));
  return picked.length ? picked : DEAL_COLUMNS.filter((c) => c.default).map((c) => c.key);
}
