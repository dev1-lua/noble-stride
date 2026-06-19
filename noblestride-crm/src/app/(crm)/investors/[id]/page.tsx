// investors/[id]/page.tsx — Investor detail page.
// Server Component: fetches a single investor with contacts, engagements, activities.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getInvestor } from "@/server/services/investors";
import { Avatar, Chip, Card, CardHeader, CardBody, Badge } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import type { ActivityTimelineItem } from "@/components/crm/activity-timeline";

// Next 16: params is a Promise
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InvestorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const investor = await getInvestor(id);

  if (!investor) notFound();

  // Decimal → number conversions (guard nulls)
  const ticketMin = investor.ticketMin == null ? null : Number(investor.ticketMin);
  const ticketMax = investor.ticketMax == null ? null : Number(investor.ticketMax);
  const aum = investor.aum == null ? null : Number(investor.aum);

  const ticketRange =
    ticketMin != null && ticketMax != null
      ? `${formatMoney(ticketMin)} – ${formatMoney(ticketMax)}`
      : ticketMin != null
      ? formatMoney(ticketMin)
      : ticketMax != null
      ? formatMoney(ticketMax)
      : "—";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/investors" className="hover:text-zinc-700 transition-colors">
          Investors
        </Link>
        <span>/</span>
        <span className="text-zinc-900 font-medium">{investor.name}</span>
      </nav>

      {/* Header: avatar + name + type chip + status */}
      <div className="flex items-start gap-4">
        <Avatar name={investor.name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900 leading-tight">{investor.name}</h1>
            <Chip value={investor.investorType} group="InvestorType" />
            {investor.status && (
              <Chip value={investor.status} group="InvestorStatus" />
            )}
          </div>
          {investor.website && (
            <a
              href={investor.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-sm text-accent hover:underline truncate"
            >
              {investor.website}
            </a>
          )}
        </div>
      </div>

      {/* Key facts grid */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">Key Facts</h2>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Ticket Range</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">{ticketRange}</dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">AUM</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {aum != null ? formatMoney(aum) : "—"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Instruments</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {investor.instruments.length > 0
                  ? investor.instruments.map((inst) => (
                      <Chip key={inst} value={inst} group="Instrument" />
                    ))
                  : <span className="text-sm text-zinc-400">—</span>}
              </dd>
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Sector Focus</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {investor.sectorFocus.length > 0
                  ? investor.sectorFocus.map((s) => (
                      <Chip key={s} value={s} group="Sector" />
                    ))
                  : <span className="text-sm text-zinc-400">—</span>}
              </dd>
            </div>

            <div className="sm:col-span-2 lg:col-span-2">
              <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Geographic Focus</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {investor.geographicFocus.length > 0
                  ? investor.geographicFocus.map((g) => (
                      <Chip key={g} value={g} group="Geography" />
                    ))
                  : <span className="text-sm text-zinc-400">—</span>}
              </dd>
            </div>

            {investor.notes && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Notes</dt>
                <dd className="mt-1 text-sm text-zinc-700 whitespace-pre-line">{investor.notes}</dd>
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
            {investor.contacts.length > 0 && (
              <Badge tone="neutral" className="ml-2">{investor.contacts.length}</Badge>
            )}
          </h2>
        </CardHeader>
        <CardBody>
          {investor.contacts.length === 0 ? (
            <p className="text-sm text-zinc-400">No contacts on record.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {investor.contacts.map((c) => (
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
                        <a
                          href={`mailto:${c.email}`}
                          className="text-xs text-accent hover:underline"
                        >
                          {c.email}
                        </a>
                      )}
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          className="text-xs text-zinc-500 hover:underline"
                        >
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

      {/* Engagements */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">
            Engagements
            {investor.engagements.length > 0 && (
              <Badge tone="neutral" className="ml-2">{investor.engagements.length}</Badge>
            )}
          </h2>
        </CardHeader>
        <CardBody>
          {investor.engagements.length === 0 ? (
            <p className="text-sm text-zinc-400">No engagements recorded.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {investor.engagements.map((eng) => (
                <li key={eng.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">
                      {eng.transaction.name}
                    </p>
                    {eng.notes && (
                      <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">{eng.notes}</p>
                    )}
                  </div>
                  <Chip value={eng.status} group="EngagementStatus" />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <ActivityTimeline
        activities={investor.activities.map((a): ActivityTimelineItem => ({
          id: a.id,
          type: a.type,
          subject: a.subject,
          occurredAt: a.occurredAt,
        }))}
      />
    </div>
  );
}
