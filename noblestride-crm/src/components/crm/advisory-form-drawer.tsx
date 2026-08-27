"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { Drawer } from "@/components/ui/drawer";
import { TextField, TextAreaField, MoneyField, SelectField, RelationSelect, MultiSelectField, DateField } from "@/components/ui/fields";
import { useEntityForm } from "@/components/ui/use-entity-form";
import { advisoryCreateSchema, advisoryUpdateSchema } from "@/lib/schemas/advisory";
import { options } from "@/lib/vocab";
import { balanceDue, formatMoney } from "@/lib/money";

const CREATE = `mutation CreateAdvisory($input: AdvisoryInput!) { createAdvisory(input: $input) { id } }`;
const UPDATE = `mutation UpdateAdvisory($id: ID!, $input: AdvisoryInput!) { updateAdvisory(id: $id, input: $input) { id } }`;

const EMPTY: Record<string, unknown> = {
  workflowTemplateId: "",
  name: "", clientId: "", leadId: "", assistIds: [], stage: "", dealStatus: "",
  feeAmount: undefined, feePaidAmount: undefined, classification: "",
  currency: "", sector: [], country: "", source: "",
  dateOpened: "", nextAction: "", notes: "", priority: "",
};

export function AdvisoryFormDrawer({ mode, initial, clients, users, workflowTemplates = [], triggerLabel }: {
  mode: "create" | "edit";
  initial?: Record<string, unknown> & { id?: string };
  clients: SelectOption[];
  users: SelectOption[];
    workflowTemplates?: SelectOption[];
triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const f = useEntityForm({
    initial: { ...EMPTY, ...(initial ?? {}) },
    schema: mode === "create" ? advisoryCreateSchema : advisoryUpdateSchema,
    createMutation: CREATE, updateMutation: UPDATE,
    mode, recordId: initial?.id as string | undefined,
    onSuccess: () => setOpen(false),
    // Priority is clearable back to unset via a blank selection (same
    // convention as the mandate drawer's clearableFields opt-in).
    clearableFields: ["priority", "workflowTemplateId", "classification"],
  });
  const v = f.values;
  const lockDateOpened = mode === "edit" && Boolean(initial?.dateOpened);
  const lockSource = mode === "edit" && Boolean(initial?.source);

  return (
    <>
      <Button variant={mode === "create" ? "primary" : "secondary"} size="sm" onClick={() => setOpen(true)}>
        {triggerLabel ?? (mode === "create" ? "+ New Advisory" : "Edit")}
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "create" ? "New Advisory Engagement" : "Edit Advisory Engagement"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={f.pending}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={f.submit} disabled={f.pending}>{f.pending ? "Saving…" : "Save"}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <TextField label="Name" required value={v.name as string} onChange={(x) => f.setValue("name", x)} error={f.errors.name} />
          <RelationSelect label="Client" required value={v.clientId as string} onChange={(x) => f.setValue("clientId", x)} options={clients} error={f.errors.clientId} placeholder="Select client…" />
          {/* F4.2.1: what kind of advisory work this is (image17). */}
          <SelectField label="Classification" value={v.classification as string} onChange={(x) => f.setValue("classification", x)} options={options("AdvisoryClassification")} placeholder="Unset" clearable />
          <SelectField label="Pipeline status" value={v.stage as string} onChange={(x) => f.setValue("stage", x)} options={options("AdvisoryStage")} />
          <RelationSelect label="Workflow template" value={(v.workflowTemplateId as string) ?? ""} onChange={(x) => f.setValue("workflowTemplateId", x)} options={workflowTemplates} placeholder="Default template" clearable />
          <RelationSelect label="Deal Lead" value={v.leadId as string} onChange={(x) => f.setValue("leadId", x)} options={users} placeholder="Select lead…" />
          <MultiSelectField label="Deal Assists" value={v.assistIds as string[]} onChange={(x) => f.setValue("assistIds", x)} options={users} />
          <MultiSelectField label="Sector" value={v.sector as string[]} onChange={(x) => f.setValue("sector", x)} options={options("Sector")} />
          <TextField label="Country" value={v.country as string} onChange={(x) => f.setValue("country", x)} />
          {/* F4.2.1 fee block: amount, amount paid, derived balance. */}
          <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Fee</p>
          <div className="grid grid-cols-2 gap-3">
            <MoneyField label="Fee Amount" value={v.feeAmount as number} onChange={(x) => f.setValue("feeAmount", x)} />
            <MoneyField label="Fee Paid" value={v.feePaidAmount as number} onChange={(x) => f.setValue("feePaidAmount", x)} />
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">
            Balance due:{" "}
            <span className="font-semibold text-[var(--text-secondary)]">
              {(() => {
                const b = balanceDue(v.feeAmount as number | null, v.feePaidAmount as number | null);
                return b == null ? "—" : formatMoney(b);
              })()}
            </span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Deal Status" value={v.dealStatus as string} onChange={(x) => f.setValue("dealStatus", x)} options={options("DealStatus")} />
            <SelectField label="Priority" value={v.priority as string} onChange={(x) => f.setValue("priority", x)} options={options("Priority")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Source" value={v.source as string} onChange={(x) => f.setValue("source", x)} options={options("Source")} disabled={lockSource} />
            <DateField label="Date Opened" value={v.dateOpened as string} onChange={(x) => f.setValue("dateOpened", x)} disabled={lockDateOpened} />
          </div>
          {(lockDateOpened || lockSource) && (
            <p className="text-xs text-[var(--text-tertiary)]">
              {lockDateOpened && lockSource
                ? "Date opened and source are locked once set."
                : lockDateOpened
                  ? "Date opened is locked once set."
                  : "Source is locked once set."}
            </p>
          )}
          <TextField label="Next Action" value={v.nextAction as string} onChange={(x) => f.setValue("nextAction", x)} />
          <TextAreaField label="Notes" value={v.notes as string} onChange={(x) => f.setValue("notes", x)} />
          {f.formError && <p className="text-xs text-rose-600">{f.formError}</p>}
        </div>
      </Drawer>
    </>
  );
}
