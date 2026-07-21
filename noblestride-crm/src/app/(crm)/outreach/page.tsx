// outreach/page.tsx — Investor Outreach review queue. Server Component:
// fetches the queue + org lens via the service/rbac layers; canUpdateRecord
// (not duplicated auth logic) decides whether a row renders as editable. The
// interactive shell (collapse/filter/search/bulk) lives in <OutreachBoard>.
import { getOrgLens } from "@/server/rbac/context";
import { canUpdateRecord } from "@/server/rbac/matrix";
import { listOutreachQueue } from "@/server/services/outreach";
import { OutreachBoard } from "./outreach-board";
import type { DraftRowData } from "./queue-view";

export const dynamic = "force-dynamic";
// Bulk "Approve & send all" loops real email sends server-side; give the route
// headroom so Vercel can't kill a multi-draft send mid-loop (the action also
// caps per invocation as a backstop).
export const maxDuration = 60;

export default async function OutreachPage() {
  const lens = await getOrgLens();
  const drafts = await listOutreachQueue();

  const rows: DraftRowData[] = drafts.map((d) => ({
    id: d.id,
    subject: d.subject,
    body: d.body,
    matchRationale: d.matchRationale,
    status: d.status,
    error: d.error,
    investorName: d.investorName,
    contactLine:
      d.contactName || d.contactEmail ? `${d.contactName ?? ""} <${d.contactEmail ?? "no email"}>` : null,
    mayReview: canUpdateRecord(lens.orgRole, "Transactions", lens.userId, { ownerId: d.transactionOwnerId }),
    transactionId: d.transactionId,
    dealName: d.transactionName,
    ownerId: d.transactionOwnerId,
    ownerName: d.transactionOwnerName,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Investor Outreach</h1>
        <p className="text-sm text-[var(--text-tertiary)]">
          Drafts prepared by the investor agent. The deal owner (or an admin) reviews, edits and releases every
          email — nothing sends automatically.
        </p>
      </div>
      <OutreachBoard rows={rows} currentUserId={lens.userId} />
    </div>
  );
}
