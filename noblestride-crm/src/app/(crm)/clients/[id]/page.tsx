// clients/[id]/page.tsx — Client detail page.
// Server Component: client profile + contacts (likely empty) + mandates + transactions.
// No activity timeline (no data path: Activity has no client relation).

import { notFound } from "next/navigation";
import Link from "next/link";
import { getClient } from "@/server/services/clients";
import { Chip, Card, CardHeader, CardBody, Avatar, Badge } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { label } from "@/lib/vocab";

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar name={client.name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900 leading-tight">{client.name}</h1>
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
