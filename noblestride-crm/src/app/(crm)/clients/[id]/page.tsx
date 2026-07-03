// clients/[id]/page.tsx — Client detail page.
// Server Component: client profile + contacts (likely empty) + mandates + transactions.
// No activity timeline (no data path: Activity has no client relation).

import { notFound } from "next/navigation";
import Link from "next/link";
import { getClient } from "@/server/services/clients";
import { Chip, Card, CardHeader, CardBody, Avatar, Badge } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { label } from "@/lib/vocab";
import { ClientFormDrawer } from "@/components/crm/client-form-drawer";
import { DeleteConfirm } from "@/components/crm/delete-confirm";

// Next 16: params is a Promise
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params;
  const client = await getClient(id);

  if (!client) notFound();

  // Decimal → number conversions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = client as any;
  const revenueLastYear = c.revenueLastYear != null ? Number(c.revenueLastYear) : null;
  const revenueForecast = c.revenueForecast != null ? Number(c.revenueForecast) : null;

  const sectors: string[] = c.sector ?? [];
  const countries: string[] = c.countries ?? [];

  const initial = {
    id: client.id,
    name: client.name,
    yearFounded: c.yearFounded == null ? undefined : Number(c.yearFounded),
    hqCity: c.hqCity ?? "",
    countries: countries,
    website: c.website ?? "",
    sector: sectors,
    coreProduct: c.coreProduct ?? "",
    description: c.description ?? "",
    founders: c.founders ?? "",
    founderGender: c.founderGender ?? "",
    revenueLastYear: c.revenueLastYear == null ? undefined : Number(c.revenueLastYear),
    revenueForecast: c.revenueForecast == null ? undefined : Number(c.revenueForecast),
    profitable: c.profitable ?? false,
    existingInvestors: c.existingInvestors ?? "",
    source: c.source ?? "",
    pitchDeckUrl: c.pitchDeckUrl ?? "",
    projectCodename: c.projectCodename ?? "",
    ebitda: c.ebitda == null ? undefined : Number(c.ebitda),
    existingDebt: c.existingDebt == null ? undefined : Number(c.existingDebt),
    totalAssets: c.totalAssets == null ? undefined : Number(c.totalAssets),
    womenLed: c.womenLed ?? false,
    youthLed: c.youthLed ?? false,
  };
  const DELETE_CLIENT = `mutation DeleteClient($id: ID!) { deleteClient(id: $id) { id } }`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar name={client.name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900 leading-tight">{client.name}</h1>
            {c.projectCodename && (
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                {c.projectCodename}
              </span>
            )}
            {c.womenLed && (
              <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                Women-led
              </span>
            )}
            {c.youthLed && (
              <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                Youth-led
              </span>
            )}
            {sectors.map((s: string) => (
              <Chip key={s} value={s} group="Sector" />
            ))}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
            {c.hqCity && <span>{c.hqCity}</span>}
            {c.yearFounded && <span>Est. {c.yearFounded}</span>}
            {c.website && (
              <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                {c.website}
              </a>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <ClientFormDrawer mode="edit" initial={initial} />
          <DeleteConfirm mutation={DELETE_CLIENT} recordId={client.id} entityLabel="client" redirectTo="/clients" />
        </div>
      </div>

      {/* Key facts */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">Company Profile</h2>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {countries.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Geographies</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {countries.map((g: string) => (
                    <Chip key={g} value={g} group="Geography" />
                  ))}
                </dd>
              </div>
            )}

            {c.coreProduct && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Core Product</dt>
                <dd className="mt-1 text-sm text-zinc-700">{c.coreProduct}</dd>
              </div>
            )}

            {c.founders && (
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Founders</dt>
                <dd className="mt-1 text-sm text-zinc-900">{c.founders}</dd>
              </div>
            )}

            {c.founderGender && (
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Founder Gender</dt>
                <dd className="mt-1 text-sm text-zinc-900">{label("FounderGender", c.founderGender)}</dd>
              </div>
            )}

            {revenueLastYear != null && (
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Revenue (Last Year)</dt>
                <dd className="mt-1 text-sm font-semibold text-zinc-900">{formatMoney(revenueLastYear)}</dd>
              </div>
            )}

            {revenueForecast != null && (
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Revenue Forecast</dt>
                <dd className="mt-1 text-sm font-semibold text-zinc-900">{formatMoney(revenueForecast)}</dd>
              </div>
            )}

            {c.profitable != null && (
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Profitable</dt>
                <dd className="mt-1 text-sm text-zinc-900">{c.profitable ? "Yes" : "No"}</dd>
              </div>
            )}

            {c.ebitda != null && (
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">EBITDA</dt>
                <dd className="mt-1 text-sm font-semibold text-zinc-900">{formatMoney(Number(c.ebitda))}</dd>
              </div>
            )}

            {c.existingDebt != null && (
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Existing Debt</dt>
                <dd className="mt-1 text-sm font-semibold text-zinc-900">{formatMoney(Number(c.existingDebt))}</dd>
              </div>
            )}

            {c.totalAssets != null && (
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Total Assets</dt>
                <dd className="mt-1 text-sm font-semibold text-zinc-900">{formatMoney(Number(c.totalAssets))}</dd>
              </div>
            )}

            {c.existingInvestors && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Existing Investors</dt>
                <dd className="mt-1 text-sm text-zinc-700">{c.existingInvestors}</dd>
              </div>
            )}

            {c.description && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Description</dt>
                <dd className="mt-1 text-sm text-zinc-700 whitespace-pre-line">{c.description}</dd>
              </div>
            )}
          </dl>
        </CardBody>
      </Card>

      {/* Contacts — will be empty for most seed clients; show empty state */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">
            Contacts
            {client.contacts.length > 0 && (
              <Badge tone="neutral" className="ml-2">{client.contacts.length}</Badge>
            )}
          </h2>
        </CardHeader>
        <CardBody>
          {client.contacts.length === 0 ? (
            <p className="text-sm text-zinc-400">No contacts on record.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {client.contacts.map((contact) => (
                <li key={contact.id} className="py-3 flex items-start gap-4">
                  <Avatar name={`${contact.firstName} ${contact.lastName ?? ""}`} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900">
                      {contact.firstName} {contact.lastName ?? ""}
                    </p>
                    {contact.jobTitle && (
                      <p className="text-xs text-zinc-500">{contact.jobTitle}</p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="text-xs text-accent hover:underline">
                          {contact.email}
                        </a>
                      )}
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="text-xs text-zinc-500 hover:underline">
                          {contact.phone}
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Mandates */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">
            Mandates
            {client.mandates.length > 0 && (
              <Badge tone="neutral" className="ml-2">{client.mandates.length}</Badge>
            )}
          </h2>
        </CardHeader>
        <CardBody>
          {client.mandates.length === 0 ? (
            <p className="text-sm text-zinc-400">No mandates linked.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {client.mandates.map((m) => (
                <li key={m.id} className="py-3 flex items-center justify-between gap-4">
                  <Link
                    href={`/mandates/${m.id}`}
                    className="text-sm font-medium text-zinc-900 hover:text-accent transition-colors"
                  >
                    {m.name}
                  </Link>
                  <Chip value={m.stage} group="MandateStage" />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">
            Transactions
            {client.transactions.length > 0 && (
              <Badge tone="neutral" className="ml-2">{client.transactions.length}</Badge>
            )}
          </h2>
        </CardHeader>
        <CardBody>
          {client.transactions.length === 0 ? (
            <p className="text-sm text-zinc-400">No transactions linked.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {client.transactions.map((txn) => (
                <li key={txn.id} className="py-3 flex items-center justify-between gap-4">
                  <Link
                    href={`/transactions/${txn.id}`}
                    className="text-sm font-medium text-zinc-900 hover:text-accent transition-colors"
                  >
                    {txn.name}
                  </Link>
                  <Chip value={txn.stage} group="TransactionStage" />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
