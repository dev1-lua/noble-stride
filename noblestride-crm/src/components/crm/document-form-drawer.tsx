"use client";

import { useRef, useState } from "react";
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

export function DocumentFormDrawer({ mode, initial, supersedesId, transactions, clients, investors, users, mandates, partners, triggerLabel, triggerVariant }: {
  mode: "create" | "edit";
  initial?: Record<string, unknown> & { id?: string };
  /** When set, a chosen file is uploaded as a new, linked version of this
   *  document id (see `submitWithFile`). Kept out of the entity-form's
   *  `values` on purpose — it has no counterpart on the GraphQL `DocumentInput`
   *  type, so it must never flow through the plain (no-file) create/update path. */
  supersedesId?: string;
  transactions: SelectOption[];
  clients: SelectOption[];
  investors: SelectOption[];
  users: SelectOption[];
  mandates: SelectOption[];
  partners: SelectOption[];
  triggerLabel?: string;
  triggerVariant?: "primary" | "secondary" | "ghost";
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

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submitWithFile() {
    if (!file) return f.submit();
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      for (const k of ["name", "type", "accessLevel", "status", "version", "transactionId", "clientId", "investorId", "mandateId", "partnerId", "supersedesId"]) {
        const val = k === "supersedesId" ? supersedesId : v[k];
        if (typeof val === "string" && val.length > 0) fd.set(k, val);
      }
      const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      setOpen(false);
      window.location.reload();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <Button variant={triggerVariant ?? (mode === "create" ? "primary" : "secondary")} size="sm" onClick={() => setOpen(true)}>
        {triggerLabel ?? (mode === "create" ? "+ New Document" : "Edit")}
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "create" ? (supersedesId ? "New Version" : "New Document") : "Edit Document"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={f.pending}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={submitWithFile} disabled={f.pending || uploading}>{uploading || f.pending ? "Saving…" : "Save"}</Button>
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
          {mode === "create" ? (
            <div className="space-y-1.5">
              <label className="text-sm text-[var(--text-secondary)]">File</label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div className="flex items-center gap-3">
                <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                  {file ? "Change file" : "Choose file"}
                </Button>
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-secondary)]" title={file?.name}>
                  {file ? file.name : <span className="text-[var(--text-tertiary)]">No file selected</span>}
                </span>
                {file && (
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="shrink-0 text-xs text-[var(--text-tertiary)] hover:text-rose-600"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">Or leave empty and paste a link below.</p>
            </div>
          ) : null}
          <TextField label="File URL (optional link)" value={v.fileUrl as string} onChange={(x) => f.setValue("fileUrl", x)} placeholder="https://…" />

          {/* Linked records */}
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide pt-1">Linked Record</p>
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
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide pt-1">Review Chain</p>
          <div className="grid grid-cols-2 gap-3">
            <RelationSelect label="Reviewer" value={v.reviewerId as string} onChange={(x) => f.setValue("reviewerId", x)} options={users} placeholder="Select user…" />
            <DateField label="Reviewed At" value={v.reviewedAt as string} onChange={(x) => f.setValue("reviewedAt", x)} />
            <RelationSelect label="Approver" value={v.approverId as string} onChange={(x) => f.setValue("approverId", x)} options={users} placeholder="Select user…" />
            <DateField label="Approved At" value={v.approvedAt as string} onChange={(x) => f.setValue("approvedAt", x)} />
          </div>
          <DateField label="Client Reviewed At" value={v.clientReviewedAt as string} onChange={(x) => f.setValue("clientReviewedAt", x)} />
          {f.formError && <p className="text-xs text-rose-600">{f.formError}</p>}
          {uploadError && <p className="text-xs text-rose-600">{uploadError}</p>}
        </div>
      </Drawer>
    </>
  );
}
