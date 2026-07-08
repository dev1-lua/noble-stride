// partners/[id]/page.tsx — Partner detail page.
// Server Component: contacts + referred mandates. No activity timeline (no data path).

import { notFound } from "next/navigation";
import Link from "next/link";
import { getPartner } from "@/server/services/partners";
import { Chip, Card, CardHeader, CardBody, Avatar, Badge } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { label } from "@/lib/vocab";
import { PartnerFormDrawer } from "@/components/crm/partner-form-drawer";
import { DeleteConfirm } from "@/components/crm/delete-confirm";
import { ContactsCard } from "@/components/crm/contacts-card";
import { StageHistory } from "@/components/crm/stage-history";
import type { StageHistoryItem } from "@/components/crm/stage-history";
import { getOrgLens } from "@/server/rbac/context";
import { canDeleteRecord, canUpdateRecord } from "@/server/rbac/matrix";

// Next 16: params is a Promise
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PartnerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const lens = await getOrgLens();
  const partner = await getPartner(id);

  if (!partner) notFound();

  const initial = {
    id: partner.id,
    name: partner.name,
    partnerType: partner.partnerType ?? "",
    profile: partner.profile ?? "",
    status: partner.status ?? "",
    location: partner.location ?? "",
    amount: partner.amount == null ? undefined : Number(partner.amount),
    advisorType: partner.advisorType ?? "",
    organization: partner.organization ?? "",
    email: partner.email ?? "",
    phone: partner.phone ?? "",
    feeSharingAgreement: partner.feeSharingAgreement,
    feeSharingTerms: partner.feeSharingTerms ?? "",
    partnerAgreementStatus: partner.partnerAgreementStatus ?? "",
    internalOnly: partner.internalOnly,
    // Task 8: internal feedback notes (Task 6 migration) — CRM-only, edited via this drawer
    feedbackNotes: partner.feedbackNotes ?? "",
  };
  const DELETE_PARTNER = `mutation DeletePartner($id: ID!) { deletePartner(id: $id) { id } }`;

  const amount = partner.amount != null ? Number(partner.amount) : null;

  const changeHistoryItems: StageHistoryItem[] = (partner.stageChanges ?? []).map((s) => ({
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
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <Link href="/partners" className="hover:text-[var(--text-secondary)] transition-colors">
          Partners
        </Link>
        <span>/</span>
        <span className="text-[var(--text-primary)] font-medium">{partner.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar name={partner.name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] leading-tight">{partner.name}</h1>
            {partner.partnerType && (
              <Chip value={partner.partnerType} group="PartnerType" />
            )}
            {partner.advisorType && (
              <Chip value={partner.advisorType} group="AdvisorType" />
            )}
            <Chip value={partner.status} group="PartnerStatus" />
            {partner.internalOnly && <Badge tone="neutral">Internal Only</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--text-tertiary)]">
            {partner.organization && <span>{partner.organization}</span>}
            {partner.location && <span>{partner.location}</span>}
            {partner.email && (
              <a href={`mailto:${partner.email}`} className="text-accent hover:underline">{partner.email}</a>
            )}
            {partner.phone && (
              <a href={`tel:${partner.phone}`} className="hover:underline">{partner.phone}</a>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {canUpdateRecord(lens.orgRole, "Partners", lens.userId, {}) && (
            <PartnerFormDrawer mode="edit" initial={initial} />
          )}
          {canDeleteRecord(lens.orgRole, "Partners") && (
            <DeleteConfirm mutation={DELETE_PARTNER} recordId={partner.id} entityLabel="partner" redirectTo="/partners" />
          )}
        </div>
      </div>

      {/* Key facts */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Profile</h2>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {amount != null && (
              <div>
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Amount</dt>
                <dd className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{formatMoney(amount)}</dd>
              </div>
            )}

            {/* Fee sharing */}
            <div>
              <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Fee Sharing</dt>
              <dd className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                {partner.feeSharingAgreement ? "Yes" : "No"}
              </dd>
              {partner.feeSharingAgreement && partner.feeSharingTerms && (
                <p className="mt-0.5 text-xs text-[var(--text-tertiary)] whitespace-pre-line">{partner.feeSharingTerms}</p>
              )}
            </div>

            {/* Partner agreement status */}
            <div>
              <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Partner Agreement</dt>
              <dd className="mt-1">
                <Chip value={partner.partnerAgreementStatus} group="PartnerAgreementStatus" />
              </dd>
            </div>

            {partner.profile && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Profile</dt>
                <dd className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-line">{partner.profile}</dd>
              </div>
            )}
          </dl>
        </CardBody>
      </Card>

      <ContactsCard
        contacts={partner.contacts.map((p) => ({
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
        parent={{ partnerId: partner.id }}
      />

      {/* Referred mandates */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Referred Mandates
            {partner.referredMandates.length > 0 && (
              <Badge tone="neutral" className="ml-2">{partner.referredMandates.length}</Badge>
            )}
          </h2>
        </CardHeader>
        <CardBody>
          {partner.referredMandates.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No mandates referred.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {partner.referredMandates.map((mandate) => (
                <li key={mandate.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/mandates/${mandate.id}`}
                        className="text-sm font-medium text-[var(--text-primary)] hover:text-accent transition-colors"
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
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--border-strong)] flex-shrink-0" />
                          <Link
                            href={`/transactions/${txn.id}`}
                            className="text-xs text-[var(--text-secondary)] hover:text-accent transition-colors"
                          >
                            {txn.name}
                          </Link>
                          <span className="text-xs text-[var(--text-tertiary)]">
                            {label("TransactionStage", txn.stage)}
                          </span>
                          {/* Fee status (Task 8) — only meaningful when this transaction has a fee-earning referrer */}
                          {txn.referredById && (
                            <span className="text-xs">
                              {txn.partnerFeeStatus ? (
                                <Chip value={txn.partnerFeeStatus} group="PartnerFeeStatus" />
                              ) : (
                                <span className="text-[var(--text-tertiary)]">Fee status: —</span>
                              )}
                            </span>
                          )}
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

      <StageHistory title="Change History" items={changeHistoryItems} />
    </div>
  );
}
