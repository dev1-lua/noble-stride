"use client";
// documents-table.tsx — Document Register table extracted from page.tsx so it
// can be wrapped in <TableSearch> (auth-enhancements Task 8, Point 2). Rows
// are pre-serialized to primitives by the server page (dates formatted,
// linked-record href/name precomputed) — this file never imports prisma.

import Link from "next/link";
import { Chip, Table, THead, TBody, Tr, Th, Td } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { options } from "@/lib/vocab";
import { TableSearch, type TableFilter } from "@/components/crm/table-search";
import { DocumentFormDrawer } from "@/components/crm/document-form-drawer";

export interface DocumentRowData {
  id: string;
  name: string;
  type: string;
  version: string | null;
  accessLevel: string;
  status: string | null;
  storageKey: string | null;
  originalFilename: string | null;
  fileUrl: string | null;
  uploadedAtDisplay: string;
  linked: { href: string; name: string } | null;
  transactionId: string | null;
  clientId: string | null;
  investorId: string | null;
  mandateId: string | null;
  partnerId: string | null;
}

const filters: TableFilter<DocumentRowData>[] = [
  { key: "type", label: "Type", options: options("DocumentType"), get: (row) => row.type },
  { key: "status", label: "Status", options: options("DocumentStatus"), get: (row) => row.status ?? "" },
];

export function DocumentsTable({
  documents,
  canCreate,
  transactions,
  clients,
  investors,
  users,
  mandates,
  partners,
}: {
  documents: DocumentRowData[];
  canCreate: boolean;
  transactions: SelectOption[];
  clients: SelectOption[];
  investors: SelectOption[];
  users: SelectOption[];
  mandates: SelectOption[];
  partners: SelectOption[];
}) {
  return (
    <TableSearch
      rows={documents}
      searchText={(row) => [row.name, row.linked?.name ?? ""]}
      filters={filters}
      searchPlaceholder="Search documents…"
      emptyLabel="No documents on record."
    >
      {(filtered) => (
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
              {canCreate && <Th>Actions</Th>}
            </Tr>
          </THead>
          <TBody>
            {filtered.map((doc) => (
              <Tr key={doc.id}>
                <Td>
                  {doc.storageKey ? (
                    <a
                      href={`/api/documents/${doc.id}/download`}
                      className="font-medium text-[var(--text-primary)] hover:text-accent transition-colors"
                      title={doc.originalFilename ?? doc.name}
                    >
                      {doc.name}
                    </a>
                  ) : doc.fileUrl ? (
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--text-primary)] hover:text-accent transition-colors" title={doc.fileUrl}>
                      {doc.name}
                    </a>
                  ) : (
                    <span className="font-medium text-[var(--text-primary)]">{doc.name}</span>
                  )}
                </Td>
                <Td>
                  <Chip value={doc.type} group="DocumentType" />
                </Td>
                <Td>
                  <span className="text-[var(--text-secondary)]">{doc.version ?? "—"}</span>
                </Td>
                <Td>
                  <Chip value={doc.accessLevel} group="DocumentAccessLevel" />
                </Td>
                <Td>
                  {doc.status ? (
                    <Chip value={doc.status} group="DocumentStatus" />
                  ) : (
                    <span className="text-[var(--text-tertiary)]">—</span>
                  )}
                </Td>
                <Td>
                  {doc.linked ? (
                    <Link href={doc.linked.href} className="text-[var(--text-secondary)] hover:text-accent transition-colors">
                      {doc.linked.name}
                    </Link>
                  ) : (
                    <span className="text-[var(--text-tertiary)]">—</span>
                  )}
                </Td>
                <Td>
                  <span className="text-[var(--text-secondary)]">{doc.uploadedAtDisplay}</span>
                </Td>
                {canCreate && (
                  <Td>
                    {doc.storageKey ? (
                      <DocumentFormDrawer
                        mode="create"
                        triggerLabel="New version"
                        triggerVariant="ghost"
                        supersedesId={doc.id}
                        initial={{
                          name: doc.name,
                          type: doc.type,
                          accessLevel: doc.accessLevel,
                          transactionId: doc.transactionId ?? undefined,
                          clientId: doc.clientId ?? undefined,
                          investorId: doc.investorId ?? undefined,
                          mandateId: doc.mandateId ?? undefined,
                          partnerId: doc.partnerId ?? undefined,
                        }}
                        transactions={transactions}
                        clients={clients}
                        investors={investors}
                        users={users}
                        mandates={mandates}
                        partners={partners}
                      />
                    ) : (
                      <span className="text-[var(--text-tertiary)]">—</span>
                    )}
                  </Td>
                )}
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </TableSearch>
  );
}
