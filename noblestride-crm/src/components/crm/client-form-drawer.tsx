"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Drawer } from "@/components/ui/drawer";
import { TextField, TextAreaField, NumberField, MoneyField, SelectField, MultiSelectField, CheckboxField } from "@/components/ui/fields";
import { useEntityForm } from "@/components/ui/use-entity-form";
import { clientCreateSchema, clientUpdateSchema } from "@/lib/schemas/client";
import { options } from "@/lib/vocab";

const CREATE = `mutation CreateClient($input: ClientInput!) { createClient(input: $input) { id } }`;
const UPDATE = `mutation UpdateClient($id: ID!, $input: ClientInput!) { updateClient(id: $id, input: $input) { id } }`;

const EMPTY: Record<string, unknown> = {
  name: "", yearFounded: undefined, hqCity: "", countries: [], website: "", sector: [],
  coreProduct: "", description: "", founders: "", founderGender: "",
  revenueLastYear: undefined, revenueForecast: undefined, currency: "",
  profitable: false, existingInvestors: "", source: "", pitchDeckUrl: "",
};

export function ClientFormDrawer({ mode, initial, triggerLabel }: {
  mode: "create" | "edit";
  initial?: Record<string, unknown> & { id?: string };
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const f = useEntityForm({
    initial: { ...EMPTY, ...(initial ?? {}) },
    schema: mode === "create" ? clientCreateSchema : clientUpdateSchema,
    createMutation: CREATE, updateMutation: UPDATE,
    mode, recordId: initial?.id as string | undefined,
    onSuccess: () => setOpen(false),
  });
  const v = f.values;

  return (
    <>
      <Button variant={mode === "create" ? "primary" : "secondary"} size="sm" onClick={() => setOpen(true)}>
        {triggerLabel ?? (mode === "create" ? "+ New Client" : "Edit")}
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "create" ? "New Client" : "Edit Client"}
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
            <NumberField label="Year Founded" value={v.yearFounded as number} onChange={(x) => f.setValue("yearFounded", x)} />
            <TextField label="HQ City" value={v.hqCity as string} onChange={(x) => f.setValue("hqCity", x)} />
          </div>
          <MultiSelectField label="Sector" value={v.sector as string[]} onChange={(x) => f.setValue("sector", x)} options={options("Sector")} />
          <MultiSelectField label="Countries" value={v.countries as string[]} onChange={(x) => f.setValue("countries", x)} options={options("Geography")} />
          <TextField label="Website" value={v.website as string} onChange={(x) => f.setValue("website", x)} />
          <TextField label="Core Product" value={v.coreProduct as string} onChange={(x) => f.setValue("coreProduct", x)} />
          <TextField label="Founders" value={v.founders as string} onChange={(x) => f.setValue("founders", x)} />
          <SelectField label="Founder Gender" value={v.founderGender as string} onChange={(x) => f.setValue("founderGender", x)} options={options("FounderGender")} />
          <div className="grid grid-cols-2 gap-3">
            <MoneyField label="Revenue (Last Year)" value={v.revenueLastYear as number} onChange={(x) => f.setValue("revenueLastYear", x)} />
            <MoneyField label="Revenue (Forecast)" value={v.revenueForecast as number} onChange={(x) => f.setValue("revenueForecast", x)} />
          </div>
          <SelectField label="Source" value={v.source as string} onChange={(x) => f.setValue("source", x)} options={options("Source")} />
          <TextField label="Existing Investors" value={v.existingInvestors as string} onChange={(x) => f.setValue("existingInvestors", x)} />
          <TextField label="Pitch Deck URL" value={v.pitchDeckUrl as string} onChange={(x) => f.setValue("pitchDeckUrl", x)} />
          <CheckboxField label="Profitable" value={v.profitable as boolean} onChange={(x) => f.setValue("profitable", x)} />
          <TextAreaField label="Description" value={v.description as string} onChange={(x) => f.setValue("description", x)} />
          {f.formError && <p className="text-xs text-rose-600">{f.formError}</p>}
        </div>
      </Drawer>
    </>
  );
}
