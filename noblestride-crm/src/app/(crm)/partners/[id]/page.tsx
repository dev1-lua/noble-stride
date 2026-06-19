// partners/[id]/page.tsx — Partner detail page.
// Server Component: contacts + referred mandates. No activity timeline (no data path).

import { notFound } from "next/navigation";
import Link from "next/link";
import { getPartner } from "@/server/services/partners";
import { Chip, Card, CardHeader, CardBody, Avatar, Badge } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { label } from "@/lib/vocab";

// Next 16: params is a Promise
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PartnerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const partner = await getPartner(id);

  if (!partner) notFound();

  const amount = partner.amount != null ? Number(partner.amount) : null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/partners" className="hover:text-zinc-700 transition-colors">
          Partners
        </Link>
        <span>/</span>
        <span className="text-zinc-900 font-medium">{partner.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar name={partner.name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900 leading-tight">{partner.name}</h1>
            {partner.partnerType && (
              <Chip value={partner.partnerType} group="PartnerType" />
            )}
            <Chip value={partner.status} group="PartnerStatus" />
          </div>
          {partner.location && (
            <p className="mt-1 text-sm text-zinc-500">{partner.location}</p>
          )}
        </div>
      </div>

      {/* Key facts */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">Profile</h2>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {amount != null && (
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Amount</dt>
                <dd className="mt-1 text-sm font-semibold text-zinc-900">{formatMoney(amount)}</dd>
              </div>
            )}

            {partner.profile && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Profile</dt>
                <dd className="mt-1 text-sm text-zinc-700 whitespace-pre-line">{partner.profile}</dd>
              </div>
            )}
          </dl>
        </CardBody>
      </Card>

      {/* Contacts */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">
            Contacts
            {partner.contacts.length > 0 && (
              <Badge tone="neutral" className="ml-2">{partner.contacts.length}</Badge>
            )}
          </h2>
        </CardHeader>
        <CardBody>
          {partner.contacts.length === 0 ? (
            <p className="text-sm text-zinc-400">No contacts on record.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {partner.contacts.map((c) => (
                <li key={c.id} className="py-3 flex items-start gap-4">
                  <Avatar name={`${c.firstName} ${c.lastName ?? ""}`} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900">
                      {c.firstName} {c.lastName ?? ""}
                    </p>
                    {c.jobTitle && (
                      <p className="text-xs text-zinc-500">{c.jobTitle}</p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="text-xs text-accent hover:underline">
                          {c.email}
                        </a>
                      )}
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="text-xs text-zinc-500 hover:underline">
                          {c.phone}
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

      {/* Referred mandates */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">
            Referred Mandates
            {partner.referredMandates.length > 0 && (
              <Badge tone="neutral" className="ml-2">{partner.referredMandates.length}</Badge>
            )}
          </h2>
        </CardHeader>
        <CardBody>
          {partner.referredMandates.length === 0 ? (
            <p className="text-sm text-zinc-400">No mandates referred.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {partner.referredMandates.map((mandate) => (
                <li key={mandate.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/mandates/${mandate.id}`}
                        className="text-sm font-medium text-zinc-900 hover:text-accent transition-colors"
                      >
                        {mandate.client?.name ?? mandate.name}
                      </Link>
                    </div>
                    <Chip value={mandate.stage} group="MandateStage" />
                  </div>
                  {mandate.transactions.length > 0 && (
                    <ul className="mt-2 ml-3 space-y-1">
                      {mandate.transactions.map((txn) => (
                        <li key={txn.id} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 flex-shrink-0" />
                          <Link
                            href={`/transactions/${txn.id}`}
                            className="text-xs text-zinc-600 hover:text-accent transition-colors"
                          >
                            {txn.name}
                          </Link>
                          <span className="text-xs text-zinc-400">
                            {label("TransactionStage", txn.stage)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
