// investors/[id]/page.tsx — Investor detail page.
// Server Component: fetches a single investor with contacts, engagements, activities.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getInvestor } from "@/server/services/investors";
import { Avatar, Chip, Card, CardHeader, CardBody, Badge, HelpHint } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import type { ActivityTimelineItem } from "@/components/crm/activity-timeline";
import { InvestorFormDrawer } from "@/components/crm/investor-form-drawer";
import { DeleteConfirm } from "@/components/crm/delete-confirm";
import { ContactsCard } from "@/components/crm/contacts-card";
import { OnboardingActions } from "@/components/crm/onboarding-actions";
import { RecordOpenNdaButton } from "@/components/crm/nda-actions";
import { MarkCriteriaVerifiedButton } from "@/components/crm/mark-criteria-verified-button";
import { formatDate } from "@/lib/format";
import { StageHistory } from "@/components/crm/stage-history";
import type { StageHistoryItem } from "@/components/crm/stage-history";
import { getOrgLens } from "@/server/rbac/context";
import { canDeleteRecord, canUpdateRecord } from "@/server/rbac/matrix";
import { prisma } from "@/lib/db";
import { getCurrentAuth } from "@/server/auth/current";
import { AccountPanel, type InvestorAccountSummary } from "./account-panel";

function displayNameForPerson(person: { firstName: string; lastName: string | null } | null): string | null {
  if (!person) return null;
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || null;
}

function formatAccountDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

// Next 16: params is a Promise
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InvestorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const lens = await getOrgLens();
  const investor = await getInvestor(id);

  if (!investor) notFound();

  // Account access panel (auth-enhancements plan, Task 9): investor login
  // accounts are managed here rather than /settings/users. Re-check the REAL
  // role server-side (never the impersonation lens) before allowing management.
  const auth = await getCurrentAuth();
  const isRealAdmin = !!auth && auth.account.kind === "INTERNAL" && auth.user?.role === "Admin" && !!auth.user?.isActive;

  // Only fetched for real admins — this is PII (login email, last-login) that
  // non-admins must never see (FIX 13), so don't even query it for them.
  const linkedAccounts = isRealAdmin
    ? await prisma.authAccount.findMany({
        where: { kind: "INVESTOR", person: { investorId: investor.id } },
        include: { person: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const accountSummaries: InvestorAccountSummary[] = linkedAccounts.map((a) => ({
    id: a.id,
    email: a.email,
    status: a.status,
    lastLogin: formatAccountDate(a.lastLoginAt),
    contactName: displayNameForPerson(a.person),
  }));

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
    ssaRegionContactId: investor.ssaRegionContactId ?? "",
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

  const changeHistoryItems: StageHistoryItem[] = (investor.stageChanges ?? []).map((s) => ({
    id: s.id,
    field: s.field,
    fromValue: s.fromValue,
    toValue: s.toValue,
    changedAt: s.changedAt,
    changedByName: s.changedBy?.name,
    createdSource: s.createdSource,
  }));

  const onboardingPanel = (
    <Card className={onboardingProminent ? "border-amber-300 bg-[var(--t-tag-bg-amber)]/40" : undefined}>
      <CardHeader>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Onboarding</h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip value={investor.onboardingStatus} group="OnboardingStatus" />
          {investor.engagementClassification === "Greylisted" && (
            <>
              <Chip value={investor.engagementClassification} group="InvestorEngagementClassification" />
              <span className="text-xs text-[var(--text-tertiary)]">
                Portal access blocked — approving alone will not restore it; change the
                classification via Edit.
              </span>
            </>
          )}
        </div>

        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Registration</dt>
            <dd className="mt-1 text-sm text-[var(--text-primary)]">
              {investor.registeredAt ? `Self-registered ${formatDate(investor.registeredAt)}` : "Team-created"}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Email Verification</dt>
            <dd className="mt-1 text-sm text-[var(--text-primary)]">
              {investor.emailVerifiedAt ? `Email verified ✓ ${formatDate(investor.emailVerifiedAt)}` : "Not verified"}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Phone Verification</dt>
            <dd className="mt-1 text-sm text-[var(--text-primary)]">
              {investor.phoneVerifiedAt ? `Phone verified ✓ ${formatDate(investor.phoneVerifiedAt)}` : "Not verified"}
            </dd>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Primary Contact</dt>
            <dd className="mt-1 text-sm text-[var(--text-primary)]">
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
                      <a href={`tel:${primaryContact.phone}`} className="text-[var(--text-tertiary)] hover:underline">
                        {primaryContact.phone}
                      </a>
                    </>
                  )}
                </>
              ) : (
                <span className="text-[var(--text-tertiary)]">—</span>
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
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          NDA
          <HelpHint term="Open NDA" />
        </h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Chip value={investor.ndaStatus} group="InvestorNdaStatus" />
          {investor.openNdaSignedAt && (
            <span className="text-sm text-[var(--text-tertiary)]">Signed {formatDate(investor.openNdaSignedAt)}</span>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Closed NDAs</p>
          {closedNdaEngagements.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">
              No closed-NDA deals on record. Closed NDAs are recorded per deal from an
              engagement page — link this investor to a deal first (Engagement → Log Engagement).
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {closedNdaEngagements.map((eng) => (
                <li key={eng.id} className="py-2 flex items-center justify-between gap-4">
                  <Link
                    href={`/engagement/${eng.id}`}
                    className="min-w-0 truncate text-sm font-medium text-[var(--text-primary)] hover:text-accent transition-colors"
                  >
                    {eng.name}
                  </Link>
                  <div className="flex shrink-0 items-center gap-3">
                    <Chip value={eng.ndaType as string} group="NdaType" />
                    {eng.ndaSignedAt && <span className="text-xs text-[var(--text-tertiary)]">{formatDate(eng.ndaSignedAt)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {investor.ndaStatus !== "OpenNDA" && <RecordOpenNdaButton investorId={investor.id} />}

        <p className="text-xs text-[var(--text-tertiary)]">
          Open NDA covers every data room (per-deal access still requires internal approval). Closed NDA covers one
          deal only.
        </p>
      </CardBody>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <Link href="/investors" className="hover:text-[var(--text-secondary)] transition-colors">
          Investors
        </Link>
        <span>/</span>
        <span className="text-[var(--text-primary)] font-medium">{investor.name}</span>
      </nav>

      {/* Header: avatar + name + type chip + status */}
      <div className="flex items-start gap-4">
        <Avatar name={investor.name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] leading-tight">{investor.name}</h1>
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
          {canUpdateRecord(lens.orgRole, "Investors", lens.userId, {}) && (
            <InvestorFormDrawer
              mode="edit"
              initial={initial}
              contacts={investor.contacts.map((p) => ({ value: p.id, label: [p.firstName, p.lastName].filter(Boolean).join(" ") }))}
            />
          )}
          {canDeleteRecord(lens.orgRole, "Investors") && (
            <DeleteConfirm mutation={DELETE_INVESTOR} recordId={investor.id} entityLabel="investor" redirectTo="/investors" />
          )}
        </div>
      </div>

      {/* Account access — investor login accounts. Admin-only: never rendered
          for non-admins, since it exposes login email + last-login (FIX 13). */}
      {isRealAdmin && <AccountPanel investorId={investor.id} accounts={accountSummaries} />}

      {/* Onboarding panel — first card while a registration awaits/failed review */}
      {onboardingProminent && onboardingPanel}

      {/* Key facts grid */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Key Facts</h2>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Ticket Range</dt>
              <dd className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{ticketRange}</dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">AUM</dt>
              <dd className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                {aum != null ? formatMoney(aum) : "—"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Instruments</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {investor.instruments.length > 0
                  ? investor.instruments.map((inst) => (
                      <Chip key={inst} value={inst} group="Instrument" />
                    ))
                  : <span className="text-sm text-[var(--text-tertiary)]">—</span>}
              </dd>
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Sector Focus</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {investor.sectorFocus.length > 0
                  ? investor.sectorFocus.map((s) => (
                      <Chip key={s} value={s} group="Sector" />
                    ))
                  : <span className="text-sm text-[var(--text-tertiary)]">—</span>}
              </dd>
            </div>

            <div className="sm:col-span-2 lg:col-span-2">
              <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Geographic Focus</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {investor.geographicFocus.length > 0
                  ? investor.geographicFocus.map((g) => (
                      <Chip key={g} value={g} group="Geography" />
                    ))
                  : <span className="text-sm text-[var(--text-tertiary)]">—</span>}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Criteria Verified</dt>
              <dd className="mt-1 flex items-center gap-2 text-sm text-[var(--text-primary)]">
                <span>{investor.criteriaVerifiedAt ? formatDate(investor.criteriaVerifiedAt) : "Never"}</span>
                {canUpdateRecord(lens.orgRole, "Investors", lens.userId, {}) && (
                  <MarkCriteriaVerifiedButton investorId={investor.id} />
                )}
              </dd>
            </div>

            {investor.shareholdingPreference && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Shareholding Preference</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">{investor.shareholdingPreference}</dd>
              </div>
            )}

            {investor.nextActionDate && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Next Action Date</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">{formatDate(investor.nextActionDate)}</dd>
              </div>
            )}

            {investor.ssaRegionContact && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">SSA Region Contact</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">
                  {[investor.ssaRegionContact.firstName, investor.ssaRegionContact.lastName].filter(Boolean).join(" ")}
                </dd>
              </div>
            )}

            {investor.feedback && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Feedback</dt>
                <dd className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-line">{investor.feedback}</dd>
              </div>
            )}

            {investor.notes && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Notes</dt>
                <dd className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-line">{investor.notes}</dd>
              </div>
            )}
          </dl>
        </CardBody>
      </Card>

      <ContactsCard
        contacts={investor.contacts.map((p) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          phone: p.phone,
          jobTitle: p.jobTitle,
          linkedinUrl: p.linkedinUrl,
          isPrimaryContact: p.isPrimaryContact,
          isSSAContact: p.isSSAContact,
        }))}
        parent={{ investorId: investor.id }}
        showSSAFlag
      />

      {/* Onboarding panel — normal card, once the registration is approved */}
      {!onboardingProminent && onboardingPanel}

      {/* NDA panel */}
      {ndaPanel}

      {/* Engagements */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Investor Engagements
            {investor.engagements.length > 0 && (
              <Badge tone="neutral" className="ml-2">{investor.engagements.length}</Badge>
            )}
          </h2>
        </CardHeader>
        <CardBody>
          {investor.engagements.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No engagements recorded.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {investor.engagements.map((eng) => (
                <li key={eng.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/engagement/${eng.id}`}
                      className="block text-sm font-medium text-[var(--text-primary)] truncate hover:text-accent transition-colors"
                    >
                      {eng.transaction.name}
                    </Link>
                    {eng.notes && (
                      <p className="mt-0.5 text-xs text-[var(--text-tertiary)] line-clamp-2">{eng.notes}</p>
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
          body: a.body,
          occurredAt: a.occurredAt,
          channel: a.channel,
          direction: a.direction,
        }))}
      />

      <StageHistory title="Change History" items={changeHistoryItems} />
    </div>
  );
}
