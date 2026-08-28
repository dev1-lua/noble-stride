// clients/page.tsx — Clients list page (RSC).
import { prisma } from "@/lib/db";
import { revenueBandOf } from "@/server/domain/revenue-bands";
import { label } from "@/lib/vocab";
import { ClientsTableSearch } from "./clients-table-search";
import { ClientFormDrawer } from "@/components/crm/client-form-drawer";
import { getOrgLens } from "@/server/rbac/context";
import { can } from "@/server/rbac/matrix";

export default async function ClientsPage() {
  const lens = await getOrgLens();
  // F2.2/image3: newest opportunities first, with the created date on the row.
  const rows = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, hqCity: true, sector: true, revenueLastYear: true, status: true,
      createdAt: true, hqCountry: true, countries: true, projectCodename: true, codename: true,
      _count: { select: { mandates: true } },
    },
  });

  const clients = rows.map((c) => {
    const revenueLastYear = c.revenueLastYear == null ? null : Number(c.revenueLastYear);
    return {
      id: c.id,
      name: c.name,
      hqCity: c.hqCity,
      sector: c.sector as string[],
      revenueLastYear,
      status: c.status as string,
      mandateCount: c._count.mandates,
      // F6.1/image26: country + sector + revenue filters.
      createdAt: c.createdAt.toISOString(),
      hqCountry: c.hqCountry,
      countries: c.countries as string[],
      countryLabels: (c.countries as string[]).map((g) => label("Geography", g)),
      revenueBand: revenueBandOf(revenueLastYear),
      codename: c.projectCodename ?? c.codename ?? null,
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Clients</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            {clients.length} portfolio companies · newest first
          </p>
        </div>
        {can(lens.orgRole, "Clients", "C") && <ClientFormDrawer mode="create" />}
      </div>
      <ClientsTableSearch clients={clients} />
    </div>
  );
}
