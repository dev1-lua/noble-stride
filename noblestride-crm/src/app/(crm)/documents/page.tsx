// documents/page.tsx — hierarchical file room (default view) + flat document
// register (?view=flat). Folders organize documents only — access levels and
// storage keys are untouched by any folder operation.
// Server Component: binary storage is external; rows carry metadata + fileUrl.

import Link from "next/link";
import { prisma } from "@/lib/db";
import { listDocuments } from "@/server/services/documents";
import { listTransactions } from "@/server/services/transactions";
import { listClients } from "@/server/services/clients";
import { listInvestors } from "@/server/services/investors";
import { listUsers } from "@/server/services/users";
import { listMandates } from "@/server/services/mandates";
import { relationOptions } from "@/server/services/relation-options";
import { folderTree, folderPath, type FolderNode } from "@/server/services/folders";
import { StatCard, HelpHint } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { DocumentFormDrawer } from "@/components/crm/document-form-drawer";
import { FolderBrowser, type FolderCardData, type FileRowData, type FolderOption } from "@/components/crm/folder-browser";
import { DocumentsTable, type DocumentRowData } from "./documents-table";
import { getOrgLens } from "@/server/rbac/context";
import { can } from "@/server/rbac/matrix";
import { isConfigured } from "@/server/integrations/config";

// Flatten the folder forest into indented select options (depth-first).
function flattenFolders(nodes: FolderNode[], depth = 0, out: FolderOption[] = []): FolderOption[] {
  for (const n of nodes) {
    out.push({ value: n.id, label: `${"  ".repeat(depth)}${n.name}` });
    flattenFolders(n.children, depth + 1, out);
  }
  return out;
}

interface PageProps {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}

export default async function DocumentsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const view = sp.view === "flat" ? "flat" : "room";
  const rawFolder = Array.isArray(sp.folder) ? sp.folder[0] : sp.folder;
  const currentFolderId = rawFolder && rawFolder.trim() ? rawFolder : null;

  const lens = await getOrgLens();
  const [documents, transactions, clients, investors, users, mandates, rel, tree] = await Promise.all([
    listDocuments(),
    listTransactions(),
    listClients(),
    listInvestors({}),
    listUsers(),
    listMandates(),
    relationOptions(),
    folderTree(),
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

  // ── File-room data (folder view) ─────────────────────────────────────────
  const folderOptions = flattenFolders(tree);
  const breadcrumbs = currentFolderId ? await folderPath(currentFolderId) : [];
  // Children of the current folder (or roots at top level).
  const findNode = (nodes: FolderNode[], id: string): FolderNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const hit = findNode(n.children, id);
      if (hit) return hit;
    }
    return null;
  };
  const currentNode = currentFolderId ? findNode(tree, currentFolderId) : null;
  const childFolders: FolderCardData[] = (currentFolderId ? (currentNode?.children ?? []) : tree).map((n) => ({
    id: n.id,
    name: n.name,
    documentCount: n.documentCount,
    childCount: n.children.length,
  }));
  // Files: docs in the current folder; at top level show unfiled docs.
  const filesHere = await prisma.document.findMany({
    where: { folderId: currentFolderId, isCurrent: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, type: true, accessLevel: true, status: true, fileUrl: true, uploadedAt: true },
  });
  const fileRows: FileRowData[] = filesHere.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    accessLevel: d.accessLevel,
    status: d.status,
    fileUrl: d.fileUrl,
    uploadedAtDisplay: formatDate(d.uploadedAt),
  }));

  const viewToggle = (
    <div className="flex items-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-0.5 text-xs font-medium">
      <Link
        href="/documents"
        className={`rounded px-2.5 py-1 transition-colors ${view === "room" ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"}`}
      >
        File Room
      </Link>
      <Link
        href="/documents?view=flat"
        className={`rounded px-2.5 py-1 transition-colors ${view === "flat" ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"}`}
      >
        Register
      </Link>
    </div>
  );

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
            {view === "room"
              ? "The file room — organize documents into folders; access levels stay on each document"
              : "The register of documents — versions, review status, and who is allowed to see each"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {viewToggle}
          {can(lens.orgRole, "Documents", "C") && (
            <DocumentFormDrawer
              mode="create"
              folders={folderOptions}
              initial={currentFolderId ? { folderId: currentFolderId } : undefined}
              transactions={txnOptions}
              clients={clientOptions}
              investors={invOptions}
              users={userOptions}
              mandates={mandateOptions}
              partners={partnerOptions}
            />
          )}
        </div>
      </div>

      {/* Counters strip — 4 tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Documents" value={String(documents.length)} />
        <StatCard label="Under Review" value={String(underReview)} />
        <StatCard label="Investor-Facing" value={String(shared)} />
        <StatCard label="Executed" value={String(executed)} />
      </div>

      {view === "room" ? (
        <FolderBrowser
          currentFolderId={currentFolderId}
          breadcrumbs={breadcrumbs}
          folders={childFolders}
          files={fileRows}
          folderOptions={folderOptions}
          canEdit={can(lens.orgRole, "Documents", "U")}
        />
      ) : (
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
      )}
    </div>
  );
}
