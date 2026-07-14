// outreach/page.tsx — Investor Outreach review queue. Server Component:
// fetches the queue + org lens via the service/rbac layers; canUpdateRecord
// (not duplicated auth logic) decides whether a card renders as editable.
import { getOrgLens } from "@/server/rbac/context";
import { canUpdateRecord } from "@/server/rbac/matrix";
import { listOutreachQueue } from "@/server/services/outreach";
import { DraftCard, type DraftCardData } from "./draft-card";

export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  const lens = await getOrgLens();
  const drafts = await listOutreachQueue();

  const byDeal = new Map<string, { dealName: string; ownerName: string | null; items: DraftCardData[] }>();
  for (const d of drafts) {
    const g = byDeal.get(d.transactionId) ?? {
      dealName: d.transactionName,
      ownerName: d.transactionOwnerName,
      items: [],
    };
    g.items.push({
      id: d.id,
      subject: d.subject,
      body: d.body,
      matchRationale: d.matchRationale,
      status: d.status,
      error: d.error,
      investorName: d.investorName,
      contactLine: d.contactName || d.contactEmail ? `${d.contactName ?? ""} <${d.contactEmail ?? "no email"}>` : null,
      mayReview: canUpdateRecord(lens.orgRole, "Transactions", lens.userId, { ownerId: d.transactionOwnerId }),
    });
    byDeal.set(d.transactionId, g);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Investor Outreach</h1>
        <p className="text-sm text-[var(--text-tertiary)]">
          Drafts prepared by the investor agent. The deal owner (or an admin) reviews, edits and releases every
          email — nothing sends automatically.
        </p>
      </div>
      {byDeal.size === 0 && (
        <p className="text-sm text-[var(--text-tertiary)]">
          No drafts waiting. Use “Generate investor outreach” on a deal page to create some.
        </p>
      )}
      {[...byDeal.entries()].map(([txnId, group]) => (
        <section key={txnId} className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {group.dealName}
            {group.ownerName && <span className="ml-2 text-xs text-[var(--text-tertiary)]">owner: {group.ownerName}</span>}
          </h2>
          {group.items.map((d) => (
            <DraftCard key={d.id} draft={d} />
          ))}
        </section>
      ))}
    </div>
  );
}
