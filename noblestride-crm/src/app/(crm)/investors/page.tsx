// investors/page.tsx — Investor Database list page.
// Server Component: fetches segments + filtered investor list via service layer.

import { Suspense } from "react";
import { listInvestors, investorSegments } from "@/server/services/investors";
import type { InvestorFilter } from "@/server/domain/types";
import type { InvestorType, Sector, Geography, InvestorStatus } from "@prisma/client";
import { SegmentRow } from "@/components/crm/segment-row";
import { FilterBar } from "@/components/crm/filter-bar";
import { RecordTable } from "@/components/crm/record-table";
import { InvestorFormDrawer } from "@/components/crm/investor-form-drawer";
import { getOrgLens } from "@/server/rbac/context";
import { can } from "@/server/rbac/matrix";

// Next 16: searchParams is a Promise
interface PageProps {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}

export default async function InvestorsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const lens = await getOrgLens();

  // Build filter from URL params — leave undefined when param is absent
  const filter: InvestorFilter = {
    investorType: sp.type ? (sp.type as InvestorType) : undefined,
    sector: sp.sector ? (sp.sector as Sector) : undefined,
    geography: sp.geography ? (sp.geography as Geography) : undefined,
    status: sp.status ? (sp.status as InvestorStatus) : undefined,
    search: typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : undefined,
  };

  // Parallel fetch: segments (for counters) + filtered list
  const [segments, investors] = await Promise.all([
    investorSegments(),
    listInvestors(filter),
  ]);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Investor Database</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {segments.total} investors across all sectors and geographies
          </p>
        </div>
        <div className="flex gap-2">
          {can(lens.orgRole, "Investors", "C") && <InvestorFormDrawer mode="create" />}
        </div>
      </div>

      {/* Segment counters row */}
      <SegmentRow segments={segments} />

      {/* Filter bar — client component; reads its own searchParams from the URL */}
      <Suspense>
        <FilterBar />
      </Suspense>

      {/* Results count */}
      <p className="text-sm text-zinc-500">
        {investors.length === segments.total
          ? `Showing all ${investors.length} investors`
          : `Showing ${investors.length} of ${segments.total} investors`}
      </p>

      {/* Investor table */}
      <RecordTable investors={investors} />
    </div>
  );
}
