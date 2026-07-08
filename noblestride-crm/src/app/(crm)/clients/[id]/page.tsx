// clients/[id]/page.tsx — Client detail page.
// Server Component: client profile + contacts (likely empty) + mandates +
// transactions + activity timeline (spec §3.10 — Activity.clientId).

import { notFound } from "next/navigation";
import Link from "next/link";
import { getClient } from "@/server/services/clients";
import { journeyForMandate } from "@/server/services/journey";
import { relationOptions } from "@/server/services/relation-options";
import { Chip, Card, CardHeader, CardBody, Avatar, Badge } from "@/components/ui";
import { DealJourney } from "@/components/crm/deal-journey";
import type { JourneyStep } from "@/server/domain/journey";
import { formatMoney } from "@/lib/money";
import { label } from "@/lib/vocab";
import { ClientFormDrawer } from "@/components/crm/client-form-drawer";
import { DeleteConfirm } from "@/components/crm/delete-confirm";
import { ContactsCard } from "@/components/crm/contacts-card";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import type { ActivityTimelineItem } from "@/components/crm/activity-timeline";
import { LogEngagementDialog } from "@/components/crm/log-engagement-dialog";
import { StageHistory } from "@/components/crm/stage-history";
import type { StageHistoryItem } from "@/components/crm/stage-history";
import { getOrgLens } from "@/server/rbac/context";
import { canDeleteRecord, canUpdateRecord } from "@/server/rbac/matrix";
import { RESTRICTED_SECTORS } from "@/server/domain/qualification";

// Next 16: params is a Promise
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params;
  const lens = await getOrgLens();
  const client = await getClient(id);

  if (!client) notFound();

  const rel = await relationOptions();

  // Deal journey (Task 16) — one spine per mandate, most recent first.
  const sortedMandates = [...client.mandates].sort(
    (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0)
  );
  const journeyEntries = await Promise.all(
    sortedMandates.map(async (m) => [m.id, await journeyForMandate(m.id)] as const)
  );
  const journeysByMandate = new Map<string, JourneyStep[] | null>(journeyEntries);

  // Decimal → number conversions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = client as any;
  const revenueLastYear = c.revenueLastYear != null ? Number(c.revenueLastYear) : null;
  const revenueForecast = c.revenueForecast != null ? Number(c.revenueForecast) : null;
  const ebitda = c.ebitda != null ? Number(c.ebitda) : null;
  const netProfit = c.netProfit != null ? Number(c.netProfit) : null;
  const existingDebt = c.existingDebt != null ? Number(c.existingDebt) : null;
  const loanBook = c.loanBook != null ? Number(c.loanBook) : null;
  const totalAssets = c.totalAssets != null ? Number(c.totalAssets) : null;

  const sectors: string[] = c.sector ?? [];
  const countries: string[] = c.countries ?? [];

  const impactFlags: string[] = c.impactFlags ?? [];

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
    founderGenders: (c.founderGenders ?? []) as string[],
    revenueLastYear: c.revenueLastYear == null ? undefined : Number(c.revenueLastYear),
    revenueForecast: c.revenueForecast == null ? undefined : Number(c.revenueForecast),
    profitability: c.profitability ?? "",
    existingInvestors: c.existingInvestors ?? "",
    source: c.source ?? "",
    pitchDeckUrl: c.pitchDeckUrl ?? "",
    // Spec-gap: company profile fields (spec §3.1/§3.2)
    codename: c.codename ?? "",
    status: c.status ?? "",
    registrationNo: c.registrationNo ?? "",
    hqCountry: c.hqCountry ?? "",
    businessModel: c.businessModel ?? "",
    foundersNationality: c.foundersNationality ?? "",
    ownershipStructure: c.ownershipStructure ?? "",
    directorsManagement: c.directorsManagement ?? "",
    targetClients: c.targetClients ?? "",
    staffCount: c.staffCount == null ? undefined : Number(c.staffCount),
    branchCount: c.branchCount == null ? undefined : Number(c.branchCount),
    ebitda: c.ebitda == null ? undefined : Number(c.ebitda),
    netProfit: c.netProfit == null ? undefined : Number(c.netProfit),
    existingDebt: c.existingDebt == null ? undefined : Number(c.existingDebt),
    loanBook: c.loanBook == null ? undefined : Number(c.loanBook),
    totalAssets: c.totalAssets == null ? undefined : Number(c.totalAssets),
    impactFlags: impactFlags,
    // Task 7: compliance & operations fields (Task 6 migration)
    pepExposure: !!c.pepExposure,
    governmentOwned: !!c.governmentOwned,
    complianceNotes: c.complianceNotes ?? "",
    auditedFinancialsYears: c.auditedFinancialsYears == null ? undefined : Number(c.auditedFinancialsYears),
    groupStructure: c.groupStructure ?? "",
    suppliers: c.suppliers ?? "",
    competitors: c.competitors ?? "",
    capacityUtilization: c.capacityUtilization ?? "",
    repaymentAbilityNotes: c.repaymentAbilityNotes ?? "",
    pricingExpectations: c.pricingExpectations ?? "",
    proposedTimeline: c.proposedTimeline ?? "",
  };
  const DELETE_CLIENT = `mutation DeleteClient($id: ID!) { deleteClient(id: $id) { id } }`;

  // Restricted-sector banner (Task 6/7 qualification gap): flag when any of
  // this client's declared sectors fall in RESTRICTED_SECTORS.
  const restrictedSectors = sectors.filter((s) => (RESTRICTED_SECTORS as readonly string[]).includes(s));
  const restrictedSectorNames = restrictedSectors.map((s) => label("Sector", s)).join(", ");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activities = (c.activities ?? []) as any[];
  const timelineItems: ActivityTimelineItem[] = activities.map((a) => ({
    id: a.id,
    type: a.type,
    subject: a.subject,
    body: a.body,
    occurredAt: a.occurredAt,
    channel: a.channel,
    direction: a.direction,
    links: { clientId: client.id, mandateId: a.mandateId, transactionId: a.transactionId, investorId: a.investorId },
    tasks: (a.tasks ?? []).map((t: { id: string; title: string; status: string }) => ({ id: t.id, title: t.title, status: t.status })),
  }));

  const changeHistoryItems: StageHistoryItem[] = (client.stageChanges ?? []).map((s) => ({
    id: s.id,
    field: s.field,
    fromValue: s.fromValue,
    toValue: s.toValue,
    changedAt: s.changedAt,
    changedByName: s.changedBy?.name,
    createdSource: s.createdSource,
  }));

  return (
    <div className="space-y-6">
      {restrictedSectors.length > 0 && (
        <div className="rounded-lg border border-[var(--t-tag-bg-rose)] bg-[var(--t-tag-bg-rose)] p-4 text-sm text-[var(--t-tag-text-rose)]">
          Restricted sector — this company operates in a sector NobleStride does not take to investors ({restrictedSectorNames}).
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar name={client.name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] leading-tight">{client.name}</h1>
            {c.status && <Chip value={c.status} group="ClientStatus" />}
            {c.codename && <span className="text-sm text-[var(--text-tertiary)]">&ldquo;{c.codename}&rdquo;</span>}
            {sectors.map((s: string) => (
              <Chip key={s} value={s} group="Sector" />
            ))}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--text-tertiary)]">
            {c.hqCity && <span>{c.hqCity}</span>}
            {c.hqCountry && <span>{c.hqCountry}</span>}
            {c.yearFounded && <span>Est. {c.yearFounded}</span>}
            {c.website && (
              <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                {c.website}
              </a>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <LogEngagementDialog clientId={client.id} triggerLabel="Log Communication" dialogTitle="Log Communication" />
          {canUpdateRecord(lens.orgRole, "Clients", lens.userId, {}) && (
            <ClientFormDrawer mode="edit" initial={initial} />
          )}
          {canDeleteRecord(lens.orgRole, "Clients") && (
            <DeleteConfirm mutation={DELETE_CLIENT} recordId={client.id} entityLabel="client" redirectTo="/clients" />
          )}
        </div>
      </div>

      {/* Key facts */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Company Profile</h2>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {countries.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Geographies</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {countries.map((g: string) => (
                    <Chip key={g} value={g} group="Geography" />
                  ))}
                </dd>
              </div>
            )}

            {c.coreProduct && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Core Product</dt>
                <dd className="mt-1 text-sm text-[var(--text-secondary)]">{c.coreProduct}</dd>
              </div>
            )}

            {c.founders && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Founders</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">{c.founders}</dd>
              </div>
            )}

            {(c.founderGenders ?? []).length > 0 && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Founders&apos; Gender</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">{(c.founderGenders ?? []).map((g: string) => label("FounderGender", g)).join(", ")}</dd>
              </div>
            )}

            {c.foundersNationality && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Founders&apos; Nationality</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">{c.foundersNationality}</dd>
              </div>
            )}

            {c.registrationNo && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Registration No.</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">{c.registrationNo}</dd>
              </div>
            )}

            {c.yearFounded && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Years of Operation</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">{new Date().getFullYear() - c.yearFounded}</dd>
              </div>
            )}

            {impactFlags.length > 0 && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Impact Flags</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {impactFlags.map((flag) => (
                    <Chip key={flag} value={flag} group="ImpactFlag" />
                  ))}
                </dd>
              </div>
            )}

            {revenueLastYear != null && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Revenue (Last Year)</dt>
                <dd className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{formatMoney(revenueLastYear)}</dd>
              </div>
            )}

            {revenueForecast != null && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Revenue Forecast</dt>
                <dd className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{formatMoney(revenueForecast)}</dd>
              </div>
            )}

            {c.profitability && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Profitability</dt>
                <dd className="mt-1 text-sm text-[var(--text-primary)]">{label("Profitability", c.profitability)}</dd>
              </div>
            )}

            {c.ebitda != null && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">EBITDA</dt>
                <dd className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{formatMoney(Number(c.ebitda))}</dd>
              </div>
            )}

            {c.existingDebt != null && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Existing Debt</dt>
                <dd className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{formatMoney(Number(c.existingDebt))}</dd>
              </div>
            )}

            {c.totalAssets != null && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Total Assets</dt>
                <dd className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{formatMoney(Number(c.totalAssets))}</dd>
              </div>
            )}

            {c.existingInvestors && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Existing Investors</dt>
                <dd className="mt-1 text-sm text-[var(--text-secondary)]">{c.existingInvestors}</dd>
              </div>
            )}

            {c.description && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Description</dt>
                <dd className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-line">{c.description}</dd>
              </div>
            )}
          </dl>
        </CardBody>
      </Card>

      {/* Financials */}
      {(ebitda != null || netProfit != null || existingDebt != null || loanBook != null || totalAssets != null || c.staffCount != null || c.branchCount != null || c.repaymentAbilityNotes || c.pricingExpectations || c.proposedTimeline) && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Financials</h2>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {c.staffCount != null && (
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Staff Count</dt>
                  <dd className="mt-1 text-sm text-[var(--text-primary)]">{c.staffCount}</dd>
                </div>
              )}
              {c.branchCount != null && (
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Branch Count</dt>
                  <dd className="mt-1 text-sm text-[var(--text-primary)]">{c.branchCount}</dd>
                </div>
              )}
              {ebitda != null && (
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">EBITDA</dt>
                  <dd className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{formatMoney(ebitda)}</dd>
                </div>
              )}
              {netProfit != null && (
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Net Profit</dt>
                  <dd className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{formatMoney(netProfit)}</dd>
                </div>
              )}
              {existingDebt != null && (
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Existing Debt</dt>
                  <dd className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{formatMoney(existingDebt)}</dd>
                </div>
              )}
              {loanBook != null && (
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Loan Book</dt>
                  <dd className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{formatMoney(loanBook)}</dd>
                </div>
              )}
              {totalAssets != null && (
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Total Assets</dt>
                  <dd className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{formatMoney(totalAssets)}</dd>
                </div>
              )}
              {c.repaymentAbilityNotes && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Repayment Ability</dt>
                  <dd className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-line">{c.repaymentAbilityNotes}</dd>
                </div>
              )}
              {c.pricingExpectations && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Pricing Expectations</dt>
                  <dd className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-line">{c.pricingExpectations}</dd>
                </div>
              )}
              {c.proposedTimeline && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Proposed Timeline</dt>
                  <dd className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-line">{c.proposedTimeline}</dd>
                </div>
              )}
            </dl>
          </CardBody>
        </Card>
      )}

      {/* Governance */}
      {(c.businessModel || c.ownershipStructure || c.directorsManagement || c.targetClients) && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Governance</h2>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {c.businessModel && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Business Model</dt>
                  <dd className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-line">{c.businessModel}</dd>
                </div>
              )}
              {c.ownershipStructure && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Ownership Structure</dt>
                  <dd className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-line">{c.ownershipStructure}</dd>
                </div>
              )}
              {c.directorsManagement && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Directors / Management</dt>
                  <dd className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-line">{c.directorsManagement}</dd>
                </div>
              )}
              {c.targetClients && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Target Clients</dt>
                  <dd className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-line">{c.targetClients}</dd>
                </div>
              )}
            </dl>
          </CardBody>
        </Card>
      )}

      {/* Compliance */}
      {(c.pepExposure || c.governmentOwned || c.complianceNotes || c.auditedFinancialsYears != null) && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Compliance</h2>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {(c.pepExposure || c.governmentOwned) && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Flags</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {c.pepExposure && <Badge tone="danger">PEP involvement</Badge>}
                    {c.governmentOwned && <Badge tone="danger">Government-owned</Badge>}
                  </dd>
                </div>
              )}
              {c.auditedFinancialsYears != null && (
                <div>
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Audited Financial Years</dt>
                  <dd className="mt-1 text-sm text-[var(--text-primary)]">{c.auditedFinancialsYears}</dd>
                </div>
              )}
              {c.complianceNotes && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Compliance Notes</dt>
                  <dd className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-line">{c.complianceNotes}</dd>
                </div>
              )}
            </dl>
          </CardBody>
        </Card>
      )}

      {/* Operations */}
      {(c.groupStructure || c.suppliers || c.competitors || c.capacityUtilization) && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Operations</h2>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {c.groupStructure && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Group Structure</dt>
                  <dd className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-line">{c.groupStructure}</dd>
                </div>
              )}
              {c.suppliers && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Suppliers</dt>
                  <dd className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-line">{c.suppliers}</dd>
                </div>
              )}
              {c.competitors && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Competitors</dt>
                  <dd className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-line">{c.competitors}</dd>
                </div>
              )}
              {c.capacityUtilization && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Capacity Utilization</dt>
                  <dd className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-line">{c.capacityUtilization}</dd>
                </div>
              )}
            </dl>
          </CardBody>
        </Card>
      )}

      <ContactsCard
        contacts={client.contacts.map((p) => ({
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
        parent={{ clientId: client.id }}
      />

      {/* Deal journey (Task 16) — one spine per mandate; the most recent
          mandate expanded, the rest behind a <details> collapse. Renders
          nothing when the client has no mandates. */}
      {sortedMandates.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Deal Journey</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <Link
                href={`/mandates/${sortedMandates[0].id}`}
                className="text-sm font-medium text-[var(--text-primary)] hover:text-accent transition-colors"
              >
                {sortedMandates[0].name}
              </Link>
              <div className="mt-3">
                <DealJourney steps={journeysByMandate.get(sortedMandates[0].id)} />
              </div>
            </div>

            {sortedMandates.length > 1 && (
              <details className="pt-2">
                <summary className="cursor-pointer text-sm font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
                  {sortedMandates.length - 1} earlier mandate{sortedMandates.length - 1 === 1 ? "" : "s"}
                </summary>
                <div className="mt-4 space-y-4 border-t border-[var(--border-subtle)] pt-4">
                  {sortedMandates.slice(1).map((m) => (
                    <div key={m.id}>
                      <Link
                        href={`/mandates/${m.id}`}
                        className="text-sm font-medium text-[var(--text-primary)] hover:text-accent transition-colors"
                      >
                        {m.name}
                      </Link>
                      <div className="mt-3">
                        <DealJourney steps={journeysByMandate.get(m.id)} />
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </CardBody>
        </Card>
      )}

      {/* Mandates */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Mandates
            {client.mandates.length > 0 && (
              <Badge tone="neutral" className="ml-2">{client.mandates.length}</Badge>
            )}
          </h2>
        </CardHeader>
        <CardBody>
          {client.mandates.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No mandates linked.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {client.mandates.map((m) => (
                <li key={m.id} className="py-3 flex items-center justify-between gap-4">
                  <Link
                    href={`/mandates/${m.id}`}
                    className="text-sm font-medium text-[var(--text-primary)] hover:text-accent transition-colors"
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
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Transactions
            {client.transactions.length > 0 && (
              <Badge tone="neutral" className="ml-2">{client.transactions.length}</Badge>
            )}
          </h2>
        </CardHeader>
        <CardBody>
          {client.transactions.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No transactions linked.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {client.transactions.map((txn) => (
                <li key={txn.id} className="py-3 flex items-center justify-between gap-4">
                  <Link
                    href={`/transactions/${txn.id}`}
                    className="text-sm font-medium text-[var(--text-primary)] hover:text-accent transition-colors"
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

      <ActivityTimeline
        activities={timelineItems}
        title="Communications"
        emptyText="No communications logged."
        taskOptions={{ mandates: rel.mandates, transactions: rel.transactions, investors: rel.investors, clients: rel.clients, users: rel.users }}
      />

      <StageHistory title="Change History" items={changeHistoryItems} />
    </div>
  );
}
