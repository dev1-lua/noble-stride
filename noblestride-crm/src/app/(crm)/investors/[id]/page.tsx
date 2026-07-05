// investors/[id]/page.tsx — Investor detail page.
// Server Component: fetches a single investor with contacts, engagements, activities.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getInvestor } from "@/server/services/investors";
import { Avatar, Chip, Card, CardHeader, CardBody, Badge } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import type { ActivityTimelineItem } from "@/components/crm/activity-timeline";
import { InvestorFormDrawer } from "@/components/crm/investor-form-drawer";
import { DeleteConfirm } from "@/components/crm/delete-confirm";
import { OnboardingActions } from "@/components/crm/onboarding-actions";
import { RecordOpenNdaButton } from "@/components/crm/nda-actions";
import { formatDate } from "@/lib/format";

// Next 16: params is a Promise
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InvestorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const investor = await getInvestor(id);

  if (!investor) notFound();

  const initial = {
    id: investor.id,
    name: investor.name,
    investorType: investor.investorType ?? "",
    website: investor.website ?? "",
    status: investor.status ?? "",
    sectorFocus: (investor.sectorFocus ?? []) as string[],
    geographicFocus: (investor.geographicFocus ?? []) as string[],
    instruments: (investor.instruments ?? []) as string[],
    investmentStages: (investor.investmentStages ?? []) as string[],
    aum: investor.aum == null ? undefined : Number(investor.aum),
    ticketMin: investor.ticketMin == null ? undefined : Number(investor.ticketMin),
    ticketMax: investor.ticketMax == null ? undefined : Number(investor.ticketMax),
    targetIrr: investor.targetIrr == null ? undefined : Number(investor.targetIrr),
    countryRestrictions: investor.countryRestrictions ?? "",
    esgFocus: investor.esgFocus ?? "",
    decisionProcess: investor.decisionProcess ?? "",
    notes: investor.notes ?? "",
    engagementClassification: investor.engagementClassification ?? "",
    ndaStatus: investor.ndaStatus ?? "",
    shareholdingPreference: investor.shareholdingPreference ?? "",
    nextActionDate: investor.nextActionDate ? investor.nextActionDate.toISOString().slice(0, 10) : "",
    feedback: investor.feedback ?? "",
  };
  const DELETE_INVESTOR = `mutation DeleteInvestor($id: ID!) { deleteInvestor(id: $id) { id } }`;

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

  // Onboarding panel: shown prominently as the first card while a registration
  // is not yet approved; a normal card in the flow once approved.
  const primaryContact = investor.contacts.find((c) => c.isPrimaryContact);
  const onboardingProminent = investor.onboardingStatus !== "Approved";
  const onboardingActionable = investor.onboardingStatus === "PendingReview" || investor.onboardingStatus === "Rejected";

  const onboardingPanel = (
    <Card className={onboardingProminent ? "border-amber-300 bg-amber-50/40" : undefined}>
      <CardHeader>
        <h2 className="text-sm font-semibold text-zinc-900">Onboarding</h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <Chip value={investor.onboardingStatus} group="OnboardingStatus" />

        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Registration</dt>
            <dd className="mt-1 text-sm text-zinc-900">
              {investor.registeredAt ? `Self-registered ${formatDate(investor.registeredAt)}` : "Team-created"}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Email Verification</dt>
            <dd className="mt-1 text-sm text-zinc-900">
              {investor.emailVerifiedAt ? `Email verified ✓ ${formatDate(investor.emailVerifiedAt)}` : "Not verified"}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Phone Verification</dt>
            <dd className="mt-1 text-sm text-zinc-900">
              {investor.phoneVerifiedAt ? `Phone verified ✓ ${formatDate(investor.phoneVerifiedAt)}` : "Not verified"}
            </dd>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Primary Contact</dt>
            <dd className="mt-1 text-sm text-zinc-900">
              {primaryContact ? (
                <>
                  {primaryContact.firstName} {primaryContact.lastName ?? ""}
                  {primaryContact.email && (
                    <>
                      {" · "}
                      <a href={`mailto:${primaryContact.email}`} className="text-accent hover:underline">
                        {primaryContact.email}
                      </a>
                    </>
                  )}
                  {primaryContact.phone && (
                    <>
                      {" · "}
                      <a href={`tel:${primaryContact.phone}`} className="text-zinc-500 hover:underline">
                        {primaryContact.phone}
                      </a>
                    </>
                  )}
                </>
              ) : (
                <span className="text-zinc-400">—</span>
              )}
            </dd>
          </div>
        </dl>

        {onboardingActionable && <OnboardingActions investorId={investor.id} />}
      </CardBody>
    </Card>
  );

  // NDA panel: open-NDA status on the investor + closed-NDA engagements list.
  const closedNdaEngagements = investor.engagements.filter((e) => e.ndaType != null);

  const ndaPanel = (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-zinc-900">NDA</h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Chip value={investor.ndaStatus} group="InvestorNdaStatus" />
          {investor.openNdaSignedAt && (
            <span className="text-sm text-zinc-500">Signed {formatDate(investor.openNdaSignedAt)}</span>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">Closed NDAs</p>
          {closedNdaEngagements.length === 0 ? (
            <p className="text-sm text-zinc-400">No closed-NDA engagements on record.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {closedNdaEngagements.map((eng) => (
                <li key={eng.id} className="py-2 flex items-center justify-between gap-4">
                  <Link
                    href={`/engagement/${eng.id}`}
                    className="min-w-0 truncate text-sm font-medium text-zinc-900 hover:text-accent transition-colors"
                  >
                    {eng.name}
                  </Link>
                  <div className="flex shrink-0 items-center gap-3">
                    <Chip value={eng.ndaType as string} group="NdaType" />
                    {eng.ndaSignedAt && <span className="text-xs text-zinc-500">{formatDate(eng.ndaSignedAt)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {investor.ndaStatus !== "OpenNDA" && <RecordOpenNdaButton investorId={investor.id} />}

        <p className="text-xs text-zinc-400">
          Open NDA covers every data room (per-deal access still requires internal approval). Closed NDA covers one
          deal only.
        </p>
      </CardBody>
    </Card>
  );

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
            {investor.engagementClassification && (
              <Chip value={investor.engagementClassification} group="InvestorEngagementClassification" />
            )}
            {investor.ndaStatus && investor.ndaStatus !== "None" && (
              <Chip value={investor.ndaStatus} group="InvestorNdaStatus" />
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
        <div className="flex shrink-0 gap-2">
          <InvestorFormDrawer mode="edit" initial={initial} />
          <DeleteConfirm mutation={DELETE_INVESTOR} recordId={investor.id} entityLabel="investor" redirectTo="/investors" />
        </div>
      </div>

      {/* Onboarding panel — first card while a registration awaits/failed review */}
      {onboardingProminent && onboardingPanel}

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

            {investor.shareholdingPreference && (
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Shareholding Preference</dt>
                <dd className="mt-1 text-sm text-zinc-900">{investor.shareholdingPreference}</dd>
              </div>
            )}

            {investor.nextActionDate && (
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Next Action Date</dt>
                <dd className="mt-1 text-sm text-zinc-900">{formatDate(investor.nextActionDate)}</dd>
              </div>
            )}

            {investor.feedback && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Feedback</dt>
                <dd className="mt-1 text-sm text-zinc-700 whitespace-pre-line">{investor.feedback}</dd>
              </div>
            )}

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

      {/* Onboarding panel — normal card, once the registration is approved */}
      {!onboardingProminent && onboardingPanel}

      {/* NDA panel */}
      {ndaPanel}

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
          channel: a.channel,
          direction: a.direction,
        }))}
      />
    </div>
  );
}
