// deals-table.tsx — read-only table for the unified deals queue (mandates + transactions).
import Link from "next/link";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui";
import { DEAL_COLUMNS, type DealsSortKey } from "@/server/domain/deals-queue";
import type { DealRow } from "@/server/services/deals-queue";

// Task 8: High=rose, Medium=amber, Low=neutral — mirrors deal-summary-panel.tsx's
// priorityTone (kept local; too small a helper to warrant a shared module).
function priorityTone(value: string): "danger" | "warning" | "neutral" {
  if (value === "High") return "danger";
  if (value === "Medium") return "warning";
  return "neutral";
}

const LABEL_BY_KEY = Object.fromEntries(DEAL_COLUMNS.map((c) => [c.key, c.label]));

// Mirrors the SORT_KEYS list in @/server/domain/deals-queue (kept local since
// that array isn't exported) — used to decide which column headers render as
// sort links vs. plain labels.
const SORTABLE_KEYS = new Set<DealsSortKey>([
  "name", "company", "stage", "status", "ticket", "lead", "dateOnboarded", "daysInStage", "priority",
]);

function isSortKey(key: string): key is DealsSortKey {
  return (SORTABLE_KEYS as Set<string>).has(key);
}

// The shared `Chip` component is vocab-driven (`value` + `group` looked up via
// `@/lib/vocab`), and there is no vocab group for deal kind (mandate/transaction).
// Rather than add one, render an inline badge mirroring Chip's "category" tone
// styling directly.
function TypeBadge({ kind }: { kind: DealRow["kind"] }) {
  const isMandate = kind === "mandate";
  return (
    <span
      className={
        "inline-flex items-center whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium " +
        (isMandate
          ? "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]"
          : "bg-[var(--t-tag-bg-gray)] text-[var(--t-tag-text-gray)]")
      }
    >
      {isMandate ? "Mandate" : "Transaction"}
    </span>
  );
}

function cell(r: DealRow, key: string): React.ReactNode {
  switch (key) {
    case "name": return <Link href={r.href} className="font-medium text-[var(--accent)] hover:underline">{r.name}</Link>;
    case "company": return r.company;
    case "type": return <TypeBadge kind={r.kind} />;
    case "stage": return r.stageLabel;
    case "status": return r.statusLabel || "—";
    case "milestone": return r.milestoneLabel || "—";
    case "dealType": return r.dealTypeLabel || "—";
    case "ticket": return r.ticket != null ? `$${r.ticket.toLocaleString()}` : "—";
    case "sector": return r.sectors.length ? r.sectors.join(", ") : "—";
    case "lead": return r.leadName ?? "—";
    case "dateOnboarded": return r.dateOnboarded ? r.dateOnboarded.slice(0, 10) : "—";
    case "nextAction": return r.nextAction ?? "—";
    case "daysInStage": return String(r.daysInStage);
    case "priority": return r.priorityValue ? <Badge tone={priorityTone(r.priorityValue)}>{r.priorityLabel}</Badge> : "—";
    default: return "—";
  }
}

export function DealsTable({
  rows, columns, sort, dir, sortHref,
}: {
  rows: DealRow[];
  columns: string[];
  sort: DealsSortKey;
  dir: "asc" | "desc";
  sortHref: (key: DealsSortKey) => string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
      <Table>
        <THead>
          <Tr>
            {columns.map((k) => {
              const text = LABEL_BY_KEY[k] ?? k;
              if (!isSortKey(k)) return <Th key={k}>{text}</Th>;
              const active = k === sort;
              return (
                <Th key={k}>
                  <Link href={sortHref(k)} className="inline-flex items-center gap-1 hover:text-[var(--text-secondary)]">
                    {text}
                    {active && <span aria-hidden="true">{dir === "asc" ? "▲" : "▼"}</span>}
                  </Link>
                </Th>
              );
            })}
          </Tr>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <Tr><Td colSpan={columns.length}><span className="text-[var(--text-tertiary)]">No deals match these filters.</span></Td></Tr>
          ) : rows.map((r) => (
            <Tr key={`${r.kind}-${r.id}`}>{columns.map((k) => <Td key={k}>{cell(r, k)}</Td>)}</Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
