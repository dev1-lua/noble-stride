// clients/page.tsx — Clients list page (RSC).
import { prisma } from "@/lib/db";
import { ClientsTable } from "@/components/crm/clients-table";
import { ClientFormDrawer } from "@/components/crm/client-form-drawer";

export default async function ClientsPage() {
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
          <h1 className="text-2xl font-bold text-zinc-900">Clients</h1>
          <p className="mt-1 text-sm text-zinc-500">{clients.length} portfolio companies</p>
        </div>
        <ClientFormDrawer mode="create" />
      </div>
      <ClientsTable clients={clients} />
    </div>
  );
}
