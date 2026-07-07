"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { Drawer } from "@/components/ui/drawer";
import { TextField, SelectField, RelationSelect, DateField } from "@/components/ui/fields";
import { useEntityForm } from "@/components/ui/use-entity-form";
import { documentCreateSchema, documentUpdateSchema } from "@/lib/schemas/document";
import { options } from "@/lib/vocab";

const CREATE = `mutation CreateDocument($input: DocumentInput!) { createDocument(input: $input) { id } }`;
const UPDATE = `mutation UpdateDocument($id: ID!, $input: DocumentInput!) { updateDocument(id: $id, input: $input) { id } }`;

const EMPTY: Record<string, unknown> = {
  name: "", type: "", version: "", accessLevel: "", status: "", fileUrl: "",
  uploadedById: "", transactionId: "", clientId: "", investorId: "", mandateId: "", partnerId: "",
  reviewerId: "", reviewedAt: "", approverId: "", approvedAt: "", clientReviewedAt: "",
};

export function DocumentFormDrawer({ mode, initial, transactions, clients, investors, users, mandates, partners, triggerLabel }: {
  mode: "create" | "edit";
  initial?: Record<string, unknown> & { id?: string };
  transactions: SelectOption[];
  clients: SelectOption[];
  investors: SelectOption[];
  users: SelectOption[];
  mandates: SelectOption[];
  partners: SelectOption[];
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const f = useEntityForm({
    initial: { ...EMPTY, ...(initial ?? {}) },
    schema: mode === "create" ? documentCreateSchema : documentUpdateSchema,
    createMutation: CREATE, updateMutation: UPDATE,
    mode, recordId: initial?.id as string | undefined,
    onSuccess: () => setOpen(false),
  });
  const v = f.values;

  return (
    <>
      <Button variant={mode === "create" ? "primary" : "secondary"} size="sm" onClick={() => setOpen(true)}>
        {triggerLabel ?? (mode === "create" ? "+ New Document" : "Edit")}
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "create" ? "New Document" : "Edit Document"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={f.pending}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={f.submit} disabled={f.pending}>{f.pending ? "Saving…" : "Save"}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <TextField label="Name" required value={v.name as string} onChange={(x) => f.setValue("name", x)} error={f.errors.name} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Type" required value={v.type as string} onChange={(x) => f.setValue("type", x)} options={options("DocumentType")} error={f.errors.type} />
            <TextField label="Version" value={v.version as string} onChange={(x) => f.setValue("version", x)} placeholder="v1.0" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Access Level" value={v.accessLevel as string} onChange={(x) => f.setValue("accessLevel", x)} options={options("DocumentAccessLevel")} />
            <SelectField label="Status" value={v.status as string} onChange={(x) => f.setValue("status", x)} options={options("DocumentStatus")} />
          </div>
          <TextField label="File URL" value={v.fileUrl as string} onChange={(x) => f.setValue("fileUrl", x)} placeholder="https://…" />

          {/* Linked records */}
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide pt-1">Linked Record</p>
          <div className="grid grid-cols-2 gap-3">
            <RelationSelect label="Transaction" value={v.transactionId as string} onChange={(x) => f.setValue("transactionId", x)} options={transactions} placeholder="Select transaction…" />
            <RelationSelect label="Mandate" value={v.mandateId as string} onChange={(x) => f.setValue("mandateId", x)} options={mandates} placeholder="Select mandate…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <RelationSelect label="Client" value={v.clientId as string} onChange={(x) => f.setValue("clientId", x)} options={clients} placeholder="Select client…" />
            <RelationSelect label="Investor" value={v.investorId as string} onChange={(x) => f.setValue("investorId", x)} options={investors} placeholder="Select investor…" />
          </div>
          {v.type === "FeeShareAgreement" && (
            <RelationSelect label="Partner" value={v.partnerId as string} onChange={(x) => f.setValue("partnerId", x)} options={partners} placeholder="Select partner…" />
          )}
          <RelationSelect label="Uploaded By" value={v.uploadedById as string} onChange={(x) => f.setValue("uploadedById", x)} options={users} placeholder="Select user…" />

          {/* Review chain: peer review → MD approval → client review */}
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide pt-1">Review Chain</p>
          <div className="grid grid-cols-2 gap-3">
            <RelationSelect label="Reviewer" value={v.reviewerId as string} onChange={(x) => f.setValue("reviewerId", x)} options={users} placeholder="Select user…" />
            <DateField label="Reviewed At" value={v.reviewedAt as string} onChange={(x) => f.setValue("reviewedAt", x)} />
            <RelationSelect label="Approver" value={v.approverId as string} onChange={(x) => f.setValue("approverId", x)} options={users} placeholder="Select user…" />
            <DateField label="Approved At" value={v.approvedAt as string} onChange={(x) => f.setValue("approvedAt", x)} />
          </div>
          <DateField label="Client Reviewed At" value={v.clientReviewedAt as string} onChange={(x) => f.setValue("clientReviewedAt", x)} />
          {f.formError && <p className="text-xs text-rose-600">{f.formError}</p>}
        </div>
      </Drawer>
    </>
  );
}
