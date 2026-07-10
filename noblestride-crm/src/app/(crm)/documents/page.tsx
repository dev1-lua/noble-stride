// documents/page.tsx — Document register.
// Server Component: metadata table over all documents + New Document drawer.
// Binary storage is external; rows carry metadata + fileUrl links.

import { listDocuments } from "@/server/services/documents";
import { listTransactions } from "@/server/services/transactions";
import { listClients } from "@/server/services/clients";
import { listInvestors } from "@/server/services/investors";
import { listUsers } from "@/server/services/users";
import { listMandates } from "@/server/services/mandates";
import { relationOptions } from "@/server/services/relation-options";
import { StatCard, HelpHint } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { DocumentFormDrawer } from "@/components/crm/document-form-drawer";
import { DocumentsTable, type DocumentRowData } from "./documents-table";
import { getOrgLens } from "@/server/rbac/context";
import { can } from "@/server/rbac/matrix";
import { isConfigured } from "@/server/integrations/config";

export default async function DocumentsPage() {
  const lens = await getOrgLens();
  const [documents, transactions, clients, investors, users, mandates, rel] = await Promise.all([
    listDocuments(),
    listTransactions(),
    listClients(),
    listInvestors({}),
    listUsers(),
    listMandates(),
    relationOptions(),
  ]);

  // SelectOption[] for the drawer (plain strings — safe to pass to client component)
  const txnOptions = transactions.map((t) => ({ value: t.id, label: t.name }));
  const clientOptions = clients.map((c) => ({ value: c.id, label: c.name }));
  const invOptions = investors.map((i) => ({ value: i.id, label: i.name }));
  const userOptions = users.map((u) => ({ value: u.id, label: u.name }));
  const mandateOptions = mandates.map((m) => ({ value: m.id, label: m.name }));
  const partnerOptions = rel.partners;

  const underReview = documents.filter((d) => d.status === "UnderReview").length;
  const executed = documents.filter((d) => d.status === "Executed").length;
  const shared = documents.filter(
    (d) => d.accessLevel === "InvestorShared" || d.accessLevel === "VDR"
  ).length;

  // Serialize to primitives only (no Date objects) before crossing into the
  // client <DocumentsTable> — see that file's header comment.
  const documentRows: DocumentRowData[] = documents.map((doc) => {
    const linked = doc.transaction
      ? { href: `/transactions/${doc.transaction.id}`, name: doc.transaction.name }
      : doc.client
      ? { href: `/clients/${doc.client.id}`, name: doc.client.name }
      : doc.investor
      ? { href: `/investors/${doc.investor.id}`, name: doc.investor.name }
      : null;
    return {
      id: doc.id,
      name: doc.name,
      type: doc.type,
      version: doc.version,
      accessLevel: doc.accessLevel,
      status: doc.status,
      storageKey: doc.storageKey,
      originalFilename: doc.originalFilename,
      fileUrl: doc.fileUrl,
      uploadedAtDisplay: formatDate(doc.uploadedAt),
      linked,
      transactionId: doc.transactionId,
      clientId: doc.clientId,
      investorId: doc.investorId,
      mandateId: doc.mandateId,
      partnerId: doc.partnerId,
    };
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)]">
            Documents
            <HelpHint term="VDR" />
          </h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            The register of documents — versions, review status, and who is allowed to see each
          </p>
        </div>
        {can(lens.orgRole, "Documents", "C") && (
          <DocumentFormDrawer
            mode="create"
            transactions={txnOptions}
            clients={clientOptions}
            investors={invOptions}
            users={userOptions}
            mandates={mandateOptions}
            partners={partnerOptions}
          />
        )}
      </div>

      {/* Counters strip — 4 tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Documents" value={String(documents.length)} />
        <StatCard label="Under Review" value={String(underReview)} />
        <StatCard label="Investor-Facing" value={String(shared)} />
        <StatCard label="Executed" value={String(executed)} />
      </div>

      {/* Documents table */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
          Document Register
        </h2>
        <DocumentsTable
          documents={documentRows}
          canCreate={can(lens.orgRole, "Documents", "C")}
          transactions={txnOptions}
          clients={clientOptions}
          investors={invOptions}
          users={userOptions}
          mandates={mandateOptions}
          partners={partnerOptions}
          boxEnabled={isConfigured("box")}
        />
      </div>
    </div>
  );
}
