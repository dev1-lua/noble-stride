"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { Drawer } from "@/components/ui/drawer";
import { TextField, TextAreaField, MoneyField, SelectField, RelationSelect, MultiSelectField, DateField } from "@/components/ui/fields";
import { useEntityForm } from "@/components/ui/use-entity-form";
import { mandateCreateSchema, mandateUpdateSchema } from "@/lib/schemas/mandate";
import { options } from "@/lib/vocab";

const CREATE = `mutation CreateMandate($input: MandateInput!) { createMandate(input: $input) { id } }`;
const UPDATE = `mutation UpdateMandate($id: ID!, $input: MandateInput!) { updateMandate(id: $id, input: $input) { id } }`;

const EMPTY: Record<string, unknown> = {
  name: "", clientId: "", leadId: "", referredById: "", dealStatus: "", dealSize: undefined, currency: "",
  sector: [], source: "", dateOpened: "", ndaStatus: "", ndaSentDate: "", ndaSignedDate: "",
  eaStatus: "", eaSentDate: "", eaSignedDate: "", nextAction: "", notes: "",
};

export function MandateFormDrawer({ mode, initial, clients, users, partners, triggerLabel }: {
  mode: "create" | "edit";
  initial?: Record<string, unknown> & { id?: string };
  clients: SelectOption[];
  users: SelectOption[];
  partners: SelectOption[];
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const f = useEntityForm({
    initial: { ...EMPTY, ...(initial ?? {}) },
    schema: mode === "create" ? mandateCreateSchema : mandateUpdateSchema,
    createMutation: CREATE, updateMutation: UPDATE,
    mode, recordId: initial?.id as string | undefined,
    onSuccess: () => setOpen(false),
  });
  const v = f.values;
  const lockDateOpened = mode === "edit" && Boolean(initial?.dateOpened);
  const lockSource = mode === "edit" && Boolean(initial?.source);

  return (
    <>
      <Button variant={mode === "create" ? "primary" : "secondary"} size="sm" onClick={() => setOpen(true)}>
        {triggerLabel ?? (mode === "create" ? "+ New Lead" : "Edit")}
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "create" ? "New Mandate" : "Edit Mandate"}
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
          <RelationSelect label="Lead" value={v.leadId as string} onChange={(x) => f.setValue("leadId", x)} options={users} placeholder="Select lead…" />
          <RelationSelect label="Referred By" value={v.referredById as string} onChange={(x) => f.setValue("referredById", x)} options={partners} placeholder="Select partner…" />
          <MultiSelectField label="Sector" value={v.sector as string[]} onChange={(x) => f.setValue("sector", x)} options={options("Sector")} />
          <div className="grid grid-cols-2 gap-3">
            <MoneyField label="Deal Size" value={v.dealSize as number} onChange={(x) => f.setValue("dealSize", x)} />
            <SelectField label="Source" value={v.source as string} onChange={(x) => f.setValue("source", x)} options={options("Source")} disabled={lockSource} />
          </div>
          <SelectField label="Deal Status" value={v.dealStatus as string} onChange={(x) => f.setValue("dealStatus", x)} options={options("DealStatus")} />
          <DateField label="Date Opened" value={v.dateOpened as string} onChange={(x) => f.setValue("dateOpened", x)} disabled={lockDateOpened} />
          {(lockDateOpened || lockSource) && (
            <p className="text-xs text-zinc-400">Date opened and source are locked once set.</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="NDA Status" value={v.ndaStatus as string} onChange={(x) => f.setValue("ndaStatus", x)} options={options("DocStatus")} />
            <SelectField label="EA Status" value={v.eaStatus as string} onChange={(x) => f.setValue("eaStatus", x)} options={options("DocStatus")} />
          </div>
          <TextField label="Next Action" value={v.nextAction as string} onChange={(x) => f.setValue("nextAction", x)} />
          <TextAreaField label="Notes" value={v.notes as string} onChange={(x) => f.setValue("notes", x)} />
          {f.formError && <p className="text-xs text-rose-600">{f.formError}</p>}
        </div>
      </Drawer>
    </>
  );
}
