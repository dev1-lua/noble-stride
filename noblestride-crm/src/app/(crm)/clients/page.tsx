// clients/page.tsx — Clients list page (RSC).
import { prisma } from "@/lib/db";
import { ClientsTableSearch } from "./clients-table-search";
import { ClientFormDrawer } from "@/components/crm/client-form-drawer";
import { getOrgLens } from "@/server/rbac/context";
import { can } from "@/server/rbac/matrix";

export default async function ClientsPage() {
  const lens = await getOrgLens();
  const rows = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, hqCity: true, sector: true, revenueLastYear: true, status: true,
      _count: { select: { mandates: true } },
    },
  });

  const clients = rows.map((c) => ({
    id: c.id,
    name: c.name,
    hqCity: c.hqCity,
    sector: c.sector as string[],
    revenueLastYear: c.revenueLastYear == null ? null : Number(c.revenueLastYear),
    status: c.status as string,
    mandateCount: c._count.mandates,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Clients</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">{clients.length} portfolio companies</p>
        </div>
        {can(lens.orgRole, "Clients", "C") && <ClientFormDrawer mode="create" />}
      </div>
      <ClientsTableSearch clients={clients} />
    </div>
  );
}
