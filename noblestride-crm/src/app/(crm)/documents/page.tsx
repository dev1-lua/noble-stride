// documents/page.tsx — Document register.
// Server Component: metadata table over all documents + New Document drawer.
// Binary storage is external; rows carry metadata + fileUrl links.

import Link from "next/link";
import { listDocuments } from "@/server/services/documents";
import { listTransactions } from "@/server/services/transactions";
import { listClients } from "@/server/services/clients";
import { listInvestors } from "@/server/services/investors";
import { listUsers } from "@/server/services/users";
import { StatCard, Chip, Table, THead, TBody, Tr, Th, Td } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { DocumentFormDrawer } from "@/components/crm/document-form-drawer";
import { getOrgLens } from "@/server/rbac/context";
import { can } from "@/server/rbac/matrix";

export default async function DocumentsPage() {
  const lens = await getOrgLens();
  const [documents, transactions, clients, investors, users] = await Promise.all([
    listDocuments(),
    listTransactions(),
    listClients(),
    listInvestors({}),
    listUsers(),
  ]);

  // SelectOption[] for the drawer (plain strings — safe to pass to client component)
  const txnOptions = transactions.map((t) => ({ value: t.id, label: t.name }));
  const clientOptions = clients.map((c) => ({ value: c.id, label: c.name }));
  const invOptions = investors.map((i) => ({ value: i.id, label: i.name }));
  const userOptions = users.map((u) => ({ value: u.id, label: u.name }));

  const underReview = documents.filter((d) => d.status === "UnderReview").length;
  const executed = documents.filter((d) => d.status === "Executed").length;
  const shared = documents.filter(
    (d) => d.accessLevel === "InvestorShared" || d.accessLevel === "VDR"
  ).length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Documents</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Deal documents, versions, and review status
          </p>
        </div>
        {can(lens.orgRole, "Documents", "C") && (
          <DocumentFormDrawer
            mode="create"
            transactions={txnOptions}
            clients={clientOptions}
            investors={invOptions}
            users={userOptions}
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
        <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide mb-3">
          Document Register
        </h2>
        <Table>
          <THead>
            <Tr>
              <Th>Document</Th>
              <Th>Type</Th>
              <Th>Version</Th>
              <Th>Access</Th>
              <Th>Status</Th>
              <Th>Linked Record</Th>
              <Th>Uploaded</Th>
            </Tr>
          </THead>
          <TBody>
            {documents.map((doc) => {
              // Linked record: transaction takes precedence, then client, then investor
              const linked = doc.transaction
                ? { href: `/transactions/${doc.transaction.id}`, name: doc.transaction.name }
                : doc.client
                ? { href: `/clients/${doc.client.id}`, name: doc.client.name }
                : doc.investor
                ? { href: `/investors/${doc.investor.id}`, name: doc.investor.name }
                : null;

              return (
                <Tr key={doc.id}>
                  <Td>
                    {doc.fileUrl ? (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-zinc-900 hover:text-accent transition-colors"
                        title={doc.fileUrl}
                      >
                        {doc.name}
                      </a>
                    ) : (
                      <span className="font-medium text-zinc-900">{doc.name}</span>
                    )}
                  </Td>
                  <Td>
                    <Chip value={doc.type} group="DocumentType" />
                  </Td>
                  <Td>
                    <span className="text-zinc-600">{doc.version ?? "—"}</span>
                  </Td>
                  <Td>
                    <Chip value={doc.accessLevel} group="DocumentAccessLevel" />
                  </Td>
                  <Td>
                    {doc.status ? (
                      <Chip value={doc.status} group="DocumentStatus" />
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </Td>
                  <Td>
                    {linked ? (
                      <Link
                        href={linked.href}
                        className="text-zinc-600 hover:text-accent transition-colors"
                      >
                        {linked.name}
                      </Link>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </Td>
                  <Td>
                    <span className="text-zinc-600">{formatDate(doc.uploadedAt)}</span>
                  </Td>
                </Tr>
              );
            })}
            {documents.length === 0 && (
              <Tr>
                <Td colSpan={7}>
                  <span className="text-zinc-400">No documents on record.</span>
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
