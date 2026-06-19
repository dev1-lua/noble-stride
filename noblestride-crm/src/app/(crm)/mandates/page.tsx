// mandates/page.tsx — Mandates Pipeline Kanban board.
// Server Component: fetches data, shapes plain DTOs, renders StatRow + KanbanBoard (client).
// RSC → client serialization boundary: NO Prisma types or Decimal instances cross to client.

import { mandatesByStage } from "@/server/services/mandates";
import { daysInStage } from "@/server/domain/metrics";
import { StatRow } from "@/components/crm/stat-row";
import { KanbanBoard } from "@/components/crm/kanban-board";
import { Button } from "@/components/ui";
import type { KanbanColumnDTO } from "@/components/crm/kanban-board";
import type { MandateCardDTO } from "@/components/crm/kanban-card";

// Stages that count as "active leads"
const ACTIVE_LEAD_STAGES = new Set([
  "NewLead",
  "Qualification",
  "PitchPresentation",
  "Proposal",
  "Negotiation",
]);

export default async function MandatesPage() {
  const rawColumns = await mandatesByStage();
  const now = new Date();

  // ── Derive stat tile values on the server ─────────────────────────────────
  let activeLeads = 0;
  let inProposal = 0;
  let signedMandates = 0;
  let lostMandates = 0;

  for (const col of rawColumns) {
    if (ACTIVE_LEAD_STAGES.has(col.stage)) activeLeads += col.items.length;
    if (col.stage === "Proposal") inProposal = col.items.length;
    if (col.stage === "Signed") signedMandates = col.items.length;
    if (col.stage === "Lost") lostMandates = col.items.length;
  }

  const conversionDenom = signedMandates + lostMandates;
  const conversionRate =
    conversionDenom === 0
      ? "—"
      : `${Math.round((signedMandates / conversionDenom) * 100)}%`;

  // ── Map Prisma rows → plain client-safe DTOs ──────────────────────────────
  // Critically: convert Decimal → Number, compute daysInStage, resolve names.
  const columns: KanbanColumnDTO<MandateCardDTO>[] = rawColumns.map((col) => ({
    stage: col.stage,
    label: col.label,
    items: col.items.map((m) => {
      // m is a Mandate with client, lead, referredBy relations (include in findMany)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mandate = m as any;
      const clientName: string = mandate.client?.name ?? mandate.name;
      const sectors: string[] = mandate.sector ?? [];
      const nextAction: string | null = mandate.nextAction ?? null;
      const stageEnteredAt: Date = mandate.stageEnteredAt ?? now;
      const ownerName: string | null = mandate.lead?.name ?? null;
      const ownerColor: string | null = mandate.lead?.avatarColor ?? null;

      return {
        id: mandate.id,
        clientName,
        sectors,
        nextAction,
        daysInStage: daysInStage(stageEnteredAt, now),
        ownerName,
        ownerColor,
      } satisfies MandateCardDTO;
    }),
  }));

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Mandates Pipeline</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Track your client mandates from first lead to signed agreement
          </p>
        </div>
        {/* Action buttons — seams for Task 16 AI panels */}
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="sm" disabled>
            Find Prospects
          </Button>
          <Button variant="secondary" size="sm" disabled>
            Export
          </Button>
          <Button variant="primary" size="sm" disabled>
            + New Lead
          </Button>
        </div>
      </div>

      {/* Stat tiles */}
      <StatRow
        tiles={[
          { label: "Active Leads", value: String(activeLeads), sub: "Across active stages" },
          { label: "In Proposal", value: String(inProposal), sub: "This week" },
          { label: "Signed Mandates", value: String(signedMandates), sub: "This quarter" },
          { label: "Conversion Rate", value: conversionRate, sub: "Last quarter" },
        ]}
      />

      {/* Filter bar — presentational */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <select className="h-8 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-600 focus:outline-none">
            <option>All Sectors</option>
          </select>
          <select className="h-8 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-600 focus:outline-none">
            <option>All Territories</option>
          </select>
          <select className="h-8 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-600 focus:outline-none">
            <option>All Assignees</option>
          </select>
          <button
            type="button"
            className="h-8 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            More Filters
          </button>
        </div>
      </div>

      {/* Kanban board (client component — handles DnD + mutation) */}
      <KanbanBoard kind="mandate" columns={columns} />
    </div>
  );
}
