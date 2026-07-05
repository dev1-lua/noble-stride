"use client";

// service-providers-table.tsx — client-interactive service provider list:
// row click opens the edit drawer, each row has an inline delete.

import { useState } from "react";
import { Chip, Table, THead, TBody, Tr, Th, Td } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { ServiceProviderFormDrawer } from "./service-provider-form-drawer";
import { DeleteConfirm } from "./delete-confirm";

const DELETE_SERVICE_PROVIDER = `mutation DeleteServiceProvider($id: ID!) { deleteServiceProvider(id: $id) { id } }`;

export interface ServiceProviderRowData {
  id: string;
  name: string;
  type: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  fee: number | null;
  currency: string;
  status: string | null;
  profile: string | null;
  engagedCount: number;
}

export function ServiceProvidersTable({ providers }: { providers: ServiceProviderRowData[] }) {
  const [editing, setEditing] = useState<ServiceProviderRowData | null>(null);

  return (
    <>
      <Table>
        <THead>
          <Tr>
            <Th>Name</Th>
            <Th>Type</Th>
            <Th>Contact Person</Th>
            <Th>Email / Phone</Th>
            <Th>Fee</Th>
            <Th>Engaged On</Th>
            <Th>Status</Th>
            <Th>{null}</Th>
          </Tr>
        </THead>
        <TBody>
          {providers.map((p) => (
            <Tr key={p.id} onClick={() => setEditing(p)} className="cursor-pointer">
              <Td>
                <span className="font-medium text-zinc-900">{p.name}</span>
              </Td>
              <Td>
                <Chip value={p.type} group="ServiceProviderType" />
              </Td>
              <Td>
                <span className="text-zinc-600">{p.contactPerson ?? "—"}</span>
              </Td>
              <Td>
                <div className="text-xs text-zinc-500">
                  {p.email && <div>{p.email}</div>}
                  {p.phone && <div>{p.phone}</div>}
                  {!p.email && !p.phone && "—"}
                </div>
              </Td>
              <Td>{p.fee != null ? formatMoney(p.fee, p.currency) : "—"}</Td>
              <Td>{p.engagedCount}</Td>
              <Td>
                <span className="text-zinc-600">{p.status ?? "—"}</span>
              </Td>
              <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                <DeleteConfirm
                  mutation={DELETE_SERVICE_PROVIDER}
                  recordId={p.id}
                  entityLabel="service provider"
                  redirectTo="/service-providers"
                />
              </Td>
            </Tr>
          ))}
          {providers.length === 0 && (
            <Tr>
              <Td colSpan={8}>
                <span className="text-zinc-400">No service providers on record.</span>
              </Td>
            </Tr>
          )}
        </TBody>
      </Table>

      {editing && (
        <ServiceProviderFormDrawer
          mode="edit"
          initial={{
            id: editing.id,
            name: editing.name,
            type: editing.type,
            contactPerson: editing.contactPerson ?? "",
            email: editing.email ?? "",
            phone: editing.phone ?? "",
            fee: editing.fee ?? undefined,
            currency: editing.currency,
            status: editing.status ?? "",
            profile: editing.profile ?? "",
          }}
          open
          onOpenChange={(next) => { if (!next) setEditing(null); }}
        />
      )}
    </>
  );
}
