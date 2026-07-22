// src/app/(crm)/deals/page.tsx — unified deals queue (list default, board toggle).
import { Suspense } from "react";
import Link from "next/link";
import { parseDealsQuery, parseColumns, type DealsGroupBy, type DealsSortKey } from "@/server/domain/deals-queue";
import { listDeals, listAllDeals, countsBy, type DealRow } from "@/server/services/deals-queue";
import { DealsTable } from "@/components/crm/deals-table";
import { DealsFilterBar } from "@/components/crm/deals-filter-bar";
import { DealsViewControls } from "@/components/crm/deals-view-controls";
import { getOrgLens } from "@/server/rbac/context";
import { can } from "@/server/rbac/matrix";
import { relationOptions, dealCountryOptions } from "@/server/services/relation-options";
import { listSavedViews } from "@/server/services/saved-views";
import { mandatesByStage } from "@/server/services/mandates";
import { transactionsByStage } from "@/server/services/transactions";
import { advisoryByStage } from "@/server/services/advisory";
import { daysInStage } from "@/server/domain/metrics";
import { label } from "@/lib/vocab";
import { formatMoney } from "@/lib/money";
import { KanbanBoard } from "@/components/crm/kanban-board";
import type { KanbanColumnDTO } from "@/components/crm/kanban-board";
import type { MandateCardDTO, TransactionCardDTO } from "@/components/crm/kanban-card";
import { MandateFormDrawer } from "@/components/crm/mandate-form-drawer";
import { TransactionFormDrawer } from "@/components/crm/transaction-form-drawer";
import { AdvisoryFormDrawer } from "@/components/crm/advisory-form-drawer";

type RawSearchParams = { [k: string]: string | string[] | undefined };
interface PageProps { searchParams: Promise<RawSearchParams>; }

// Rebuilds the current query string with `overrides` applied (an override of
// `undefined`/`""` deletes that param), so header-sort and pager links carry
// forward every other active filter/group/column param untouched.
function withParams(sp: RawSearchParams, overrides: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) p.set(k, val);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v) p.set(k, v);
    else p.delete(k);
  }
  const qs = p.toString();
  return qs ? `?${qs}` : "?";
}

// Mirrors the grouping key used by countsBy() in the service layer, but
// operates on already-fetched DealRow DTOs so we can bucket the current
// page's rows under each group heading without a second query per group.
function groupKeyOf(r: DealRow, dim: DealsGroupBy): string {
  switch (dim) {
    case "stage": return r.stageValue;
    case "lead": return r.leadName ?? "—";
    case "sector": return r.sectors[0] ?? "—";
    case "type": return r.kind;
    case "status": return r.statusValue ?? "—";
    default: return "all";
  }
}

// Plain-DTO mapping lifted from the pre-consolidation `/mandates` and
// `/transactions` board pages (git show ec3c424 of those files) — same
// Decimal→Number, daysInStage and owner/lead resolution, reused verbatim
// for the deals-board branch below. `mandatesByStage`/`transactionsByStage`
// return Prisma rows with relations included but no generated types for the
// joined shape, hence the narrow `any` casts (matching the original).
function mandateBoardColumns(
  rawColumns: Awaited<ReturnType<typeof mandatesByStage>>,
  now: Date
): KanbanColumnDTO<MandateCardDTO>[] {
  return rawColumns.map((col) => ({
    stage: col.stage,
    label: col.label,
    items: col.items.map((m) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mandate = m as any;
      const clientName: string = mandate.client?.name ?? mandate.name;
      const sectors: string[] = mandate.sector ?? [];
      const nextAction: string | null = mandate.nextAction ?? null;
      const stageEnteredAt: Date = mandate.stageEnteredAt ?? now;
      const ownerName: string | null = mandate.lead?.name ?? null;
      const ownerColor: string | null = mandate.lead?.avatarColor ?? null;
      const priorityLabel: string | null = mandate.priority ? label("Priority", mandate.priority) : null;
      return {
        id: mandate.id,
        clientName,
        sectors,
        nextAction,
        daysInStage: daysInStage(stageEnteredAt, now),
        ownerName,
        ownerColor,
        priorityLabel,
      } satisfies MandateCardDTO;
    }),
  }));
}

// Advisory cards reuse the mandate card shape (client, sectors, next action,
// days-in-stage, lead) — see AdvisoryKanbanProps in kanban-board.tsx.
function advisoryBoardColumns(
  rawColumns: Awaited<ReturnType<typeof advisoryByStage>>,
  now: Date
): KanbanColumnDTO<MandateCardDTO>[] {
  return rawColumns.map((col) => ({
    stage: col.stage,
    label: col.label,
    items: col.items.map((a) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adv = a as any;
      return {
        id: adv.id,
        clientName: adv.client?.name ?? adv.name,
        sectors: adv.sector ?? [],
        nextAction: adv.nextAction ?? null,
        daysInStage: daysInStage(adv.stageEnteredAt ?? now, now),
        ownerName: adv.lead?.name ?? null,
        ownerColor: adv.lead?.avatarColor ?? null,
        priorityLabel: adv.priority ? label("Priority", adv.priority) : null,
      } satisfies MandateCardDTO;
    }),
  }));
}

// Transaction owner relation is `owner` (not `lead` — that's the mandate side).
function transactionBoardColumns(
  rawColumns: Awaited<ReturnType<typeof transactionsByStage>>,
  now: Date
): KanbanColumnDTO<TransactionCardDTO>[] {
  return rawColumns.map((col) => ({
    stage: col.stage,
    label: col.label,
    items: col.items.map((t) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txn = t as any;
      const clientName: string = txn.client?.name ?? txn.name;
      const dealTypeName: string | null = txn.dealType ? label("DealType", txn.dealType) : null;
      const sectors: string[] = txn.sector ?? [];
      const instruments: string[] = txn.instrument ?? [];
      // Decimal → number → pre-formatted string
      const targetRaiseNum = txn.targetRaise != null ? Number(txn.targetRaise) : null;
      const targetRaise = targetRaiseNum != null ? formatMoney(targetRaiseNum) : null;
      const stageEnteredAt: Date = txn.stageEnteredAt ?? now;
      const ownerName: string | null = txn.owner?.name ?? null;
      const ownerColor: string | null = txn.owner?.avatarColor ?? null;
      const priorityLabel: string | null = txn.priority ? label("Priority", txn.priority) : null;
      return {
        id: txn.id,
        clientName,
        dealTypeName,
        sectors,
        instruments,
        targetRaise,
        investorsContacted: txn.investorsContacted ?? 0,
        activeConversations: txn.activeConversations ?? 0,
        daysInStage: daysInStage(stageEnteredAt, now),
        ownerName,
        ownerColor,
        priorityLabel,
      } satisfies TransactionCardDTO;
    }),
  }));
}

export default async function DealsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const lens = await getOrgLens();
  const spec = parseDealsQuery(sp);
  const views = await listSavedViews();
  // relationOptions feeds both the header create-drawers (below) and the list
  // filter bar; loaded once here so both board and list branches can offer the
  // gated "New mandate"/"New transaction" affordances the queue consolidated.
  const rel = await relationOptions();

  // Export carries every active filter/sort/group param, but not the
  // pagination/column/view display params — the export always covers the
  // whole filtered set, not a single page (applies to both list and board mode).
  const exportParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "page" || k === "cols" || k === "view") continue;
    const val = Array.isArray(v) ? v[0] : v;
    if (val) exportParams.set(k, val);
  }
  const exportQuery = exportParams.toString();

  const header = (total: number) => (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Deals</h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Mandates, transactions and advisory work in one queue — {total} deal{total === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {can(lens.orgRole, "Mandates", "C") && (
          <MandateFormDrawer
            mode="create"
            triggerLabel="+ New Mandate"
            clients={rel.clients}
            users={rel.users}
            partners={rel.partners}
          />
        )}
        {can(lens.orgRole, "Transactions", "C") && (
          <TransactionFormDrawer
            mode="create"
            triggerLabel="+ New Transaction"
            clients={rel.clients}
            users={rel.users}
            mandates={rel.mandates}
            partners={rel.partners}
            serviceProviders={rel.serviceProviders}
          />
        )}
        {can(lens.orgRole, "Advisory", "C") && (
          <AdvisoryFormDrawer
            mode="create"
            triggerLabel="+ New Advisory"
            clients={rel.clients}
            users={rel.users}
          />
        )}
        <a
          href={`/deals/export${exportQuery ? `?${exportQuery}` : ""}`}
          className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-secondary)] active:bg-[var(--bg-tertiary)]"
        >
          Export CSV
        </a>
      </div>
    </div>
  );

  // ── Board mode ─────────────────────────────────────────────────────────────
  // Stage enums differ per type, so the board shows one type at a time via a
  // Mandates/Transactions sub-toggle bound to `?type=` (defaults to the active
  // `type` filter, else Transactions per design spec §4.6 / Task 10).
  if (spec.view === "board") {
    // Board mode shows one type at a time; defaults to the active type filter
    // when it resolves unambiguously to a single kind, else Transactions.
    const boardType: "mandate" | "transaction" | "advisory" =
      spec.type.length === 1 && (spec.type[0] === "mandate" || spec.type[0] === "advisory") ? spec.type[0] : "transaction";
    const now = new Date();
    const boardTypeHref = (t: "mandate" | "transaction" | "advisory") => withParams(sp, { type: t });

    let boardTotal = 0;
    let board: React.ReactNode;
    if (boardType === "mandate") {
      const rawColumns = await mandatesByStage();
      boardTotal = rawColumns.reduce((n, c) => n + c.items.length, 0);
      board = (
        // key on boardType forces a remount when the type sub-toggle switches
        // via soft navigation — otherwise KanbanBoard's useState(columns)
        // keeps the previous type's stale columns until reload.
        <KanbanBoard
          key={boardType}
          kind="mandate"
          columns={mandateBoardColumns(rawColumns, now)}
          readOnly={!can(lens.orgRole, "Mandates", "U")}
        />
      );
    } else if (boardType === "advisory") {
      const rawColumns = await advisoryByStage();
      boardTotal = rawColumns.reduce((n, c) => n + c.items.length, 0);
      board = (
        // See mandate branch — key on boardType forces remount on sub-toggle.
        <KanbanBoard
          key={boardType}
          kind="advisory"
          columns={advisoryBoardColumns(rawColumns, now)}
          readOnly={!can(lens.orgRole, "Advisory", "U")}
        />
      );
    } else {
      const rawColumns = await transactionsByStage();
      boardTotal = rawColumns.reduce((n, c) => n + c.items.length, 0);
      board = (
        // See mandate branch — key on boardType forces remount on sub-toggle.
        <KanbanBoard
          key={boardType}
          kind="transaction"
          columns={transactionBoardColumns(rawColumns, now)}
          readOnly={!can(lens.orgRole, "Transactions", "U")}
        />
      );
    }

    const boardToggle = (t: "mandate" | "transaction" | "advisory", text: string) => (
      <Link
        href={boardTypeHref(t)}
        className={`rounded px-2.5 py-1 transition-colors ${boardType === t ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"}`}
      >
        {text}
      </Link>
    );

    return (
      <div className="space-y-5">
        {header(boardTotal)}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-0.5 text-xs font-medium">
            {boardToggle("mandate", "Mandates")}
            {boardToggle("transaction", "Transactions")}
            {boardToggle("advisory", "Advisory")}
          </div>
          <Suspense>
            <DealsViewControls views={views} />
          </Suspense>
        </div>
        {board}
      </div>
    );
  }

  // ── List mode (default) ──────────────────────────────────────────────────
  const columns = parseColumns(typeof sp.cols === "string" ? sp.cols : undefined);
  // Grouped mode needs the whole filtered set, not just the current page:
  // group headers come from countsBy() over all matching rows, so paginated
  // rows would under-fill later groups and leave groups on other pages empty.
  const { rows, total } = spec.groupBy ? await listAllDeals(spec) : await listDeals(spec);

  // Distinct lead names for the filter dropdown (filtering matches on name,
  // not id — see DealRow.leadName / matches() in the service). `rel` is the
  // relationOptions() loaded once up top (also feeds the header create-drawers).
  const leadNames = Array.from(new Set(rel.users.map((u) => u.label))).sort((a, b) => a.localeCompare(b));
  const leads = leadNames.map((name) => ({ value: name, label: name }));
  // Assist filter matches on assist names too (DealRow.assistNames) — same
  // distinct-user-name option set as the lead filter.
  const assists = leads;
  const countries = await dealCountryOptions();

  const groups = spec.groupBy ? await countsBy(spec, spec.groupBy) : [];

  // Inline lead/assist editing is offered when the viewer can update any deal
  // kind; the assign mutations still enforce the same ownership-scoped RBAC
  // per row, so a scoped lead can only reassign their own deals.
  const canEditAssignments =
    can(lens.orgRole, "Mandates", "U") ||
    can(lens.orgRole, "Transactions", "U") ||
    can(lens.orgRole, "Advisory", "U");

  // New column click defaults to ascending; clicking the already-active
  // column flips direction. Re-sorting resets to page 1 since the row order
  // (and therefore what page N contains) changes.
  const sortHref = (key: DealsSortKey) => {
    const nextDir: "asc" | "desc" = spec.sort === key ? (spec.dir === "asc" ? "desc" : "asc") : "asc";
    return withParams(sp, { sort: key, dir: nextDir, page: undefined });
  };
  const pageHref = (n: number) => withParams(sp, { page: n > 1 ? String(n) : undefined });
  const pageCount = Math.ceil(total / spec.pageSize);

  return (
    <div className="space-y-5">
      {header(total)}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Suspense>
          <DealsFilterBar leads={leads} assists={assists} countries={countries} />
        </Suspense>
        <Suspense>
          <DealsViewControls views={views} />
        </Suspense>
      </div>
      {spec.groupBy ? (
        groups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-primary)] py-12 text-center text-sm text-[var(--text-tertiary)]">
            No deals match these filters.
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.key} className="space-y-2">
                <h2 className="text-sm font-semibold text-[var(--text-secondary)]">
                  {g.label} <span className="font-normal text-[var(--text-tertiary)]">({g.count})</span>
                </h2>
                <DealsTable
                  rows={rows.filter((r) => groupKeyOf(r, spec.groupBy) === g.key)}
                  columns={columns}
                  sort={spec.sort}
                  dir={spec.dir}
                  sortHref={sortHref}
                  users={rel.users}
                  canEdit={canEditAssignments}
                />
              </div>
            ))}
          </div>
        )
      ) : (
        <DealsTable rows={rows} columns={columns} sort={spec.sort} dir={spec.dir} sortHref={sortHref} users={rel.users} canEdit={canEditAssignments} />
      )}
      {!spec.groupBy && pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-3 text-sm">
          {spec.page > 1 ? (
            <Link href={pageHref(spec.page - 1)} className="font-medium text-[var(--accent)] hover:underline">
              ← Prev
            </Link>
          ) : (
            <span className="text-[var(--text-tertiary)]">← Prev</span>
          )}
          <span className="text-[var(--text-tertiary)]">
            Page {spec.page} of {pageCount}
          </span>
          {spec.page < pageCount ? (
            <Link href={pageHref(spec.page + 1)} className="font-medium text-[var(--accent)] hover:underline">
              Next →
            </Link>
          ) : (
            <span className="text-[var(--text-tertiary)]">Next →</span>
          )}
        </div>
      )}
    </div>
  );
}
