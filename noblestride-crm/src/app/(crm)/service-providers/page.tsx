// service-providers/page.tsx — Service Providers list page (SPEC §3.7).
// Server Component: type stat tiles + service provider table. Create/edit via drawer.

import { listServiceProviders } from "@/server/services/service-providers";
import { StatCard } from "@/components/ui";
import { ServiceProviderFormDrawer } from "@/components/crm/service-provider-form-drawer";
import { ServiceProvidersTable } from "@/components/crm/service-providers-table";
import type { ServiceProviderRowData } from "@/components/crm/service-providers-table";
import { label, options } from "@/lib/vocab";

export default async function ServiceProvidersPage() {
  const providers = await listServiceProviders();

  const rows: ServiceProviderRowData[] = providers.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    contactPerson: p.contactPerson,
    email: p.email,
    phone: p.phone,
    fee: p.fee == null ? null : Number(p.fee),
    currency: p.currency,
    status: p.status,
    profile: p.profile,
    engagedCount: p._count.engagedOn,
  }));

  const typeOptions = options("ServiceProviderType");
  const byType = new Map<string, number>();
  for (const p of rows) byType.set(p.type, (byType.get(p.type) ?? 0) + 1);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Service Providers</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            Law firms, auditors, tax advisors, and other transaction-level service providers
          </p>
        </div>
        <div className="flex gap-2">
          <ServiceProviderFormDrawer mode="create" />
        </div>
      </div>

      {/* Counters strip — total + one tile per type */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Providers" value={String(rows.length)} />
        {typeOptions.map((t) => (
          <StatCard key={t.value} label={label("ServiceProviderType", t.value)} value={String(byType.get(t.value) ?? 0)} />
        ))}
      </div>

      {/* Service provider directory */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
          Provider Directory
        </h2>
        <ServiceProvidersTable providers={rows} />
      </div>
    </div>
  );
}
