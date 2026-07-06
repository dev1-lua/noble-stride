"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Drawer } from "@/components/ui/drawer";
import { TextField, TextAreaField, NumberField, MoneyField, SelectField, MultiSelectField } from "@/components/ui/fields";
import { useEntityForm } from "@/components/ui/use-entity-form";
import { clientCreateSchema, clientUpdateSchema } from "@/lib/schemas/client";
import { options } from "@/lib/vocab";

const CREATE = `mutation CreateClient($input: ClientInput!) { createClient(input: $input) { id } }`;
const UPDATE = `mutation UpdateClient($id: ID!, $input: ClientInput!) { updateClient(id: $id, input: $input) { id } }`;

const EMPTY: Record<string, unknown> = {
  name: "", yearFounded: undefined, hqCity: "", countries: [], website: "", sector: [],
  coreProduct: "", description: "", founders: "", founderGenders: [],
  revenueLastYear: undefined, revenueForecast: undefined, currency: "",
  profitability: "", existingInvestors: "", source: "", pitchDeckUrl: "",
  // Spec-gap: company profile fields (spec §3.1/§3.2)
  codename: "", status: "", registrationNo: "", hqCountry: "", businessModel: "",
  foundersNationality: "", ownershipStructure: "", directorsManagement: "", targetClients: "",
  staffCount: undefined, branchCount: undefined, ebitda: undefined, netProfit: undefined,
  existingDebt: undefined, loanBook: undefined, totalAssets: undefined, impactFlags: [],
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
          <MultiSelectField label="Founders' Gender" value={v.founderGenders as string[]} onChange={(x) => f.setValue("founderGenders", x)} options={options("FounderGender")} />
          <SelectField label="Source" value={v.source as string} onChange={(x) => f.setValue("source", x)} options={options("Source")} />
          <TextField label="Existing Investors" value={v.existingInvestors as string} onChange={(x) => f.setValue("existingInvestors", x)} />
          <TextField label="Pitch Deck URL" value={v.pitchDeckUrl as string} onChange={(x) => f.setValue("pitchDeckUrl", x)} />
          <TextAreaField label="Description" value={v.description as string} onChange={(x) => f.setValue("description", x)} />

          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide pt-1">Identity</p>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Codename" value={v.codename as string} onChange={(x) => f.setValue("codename", x)} />
            <SelectField label="Status" value={v.status as string} onChange={(x) => f.setValue("status", x)} options={options("ClientStatus")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Registration No." value={v.registrationNo as string} onChange={(x) => f.setValue("registrationNo", x)} />
            <TextField label="HQ Country" value={v.hqCountry as string} onChange={(x) => f.setValue("hqCountry", x)} />
          </div>
          <TextField label="Founders' Nationality" value={v.foundersNationality as string} onChange={(x) => f.setValue("foundersNationality", x)} />
          <MultiSelectField label="Impact Flags" value={v.impactFlags as string[]} onChange={(x) => f.setValue("impactFlags", x)} options={options("ImpactFlag")} />

          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide pt-1">Financials</p>
          <div className="grid grid-cols-2 gap-3">
            <MoneyField label="Revenue (Last Year)" value={v.revenueLastYear as number} onChange={(x) => f.setValue("revenueLastYear", x)} />
            <MoneyField label="Revenue (Forecast)" value={v.revenueForecast as number} onChange={(x) => f.setValue("revenueForecast", x)} />
            <MoneyField label="EBITDA" value={v.ebitda as number} onChange={(x) => f.setValue("ebitda", x)} />
            <MoneyField label="Net Profit" value={v.netProfit as number} onChange={(x) => f.setValue("netProfit", x)} />
            <MoneyField label="Existing Debt" value={v.existingDebt as number} onChange={(x) => f.setValue("existingDebt", x)} />
            <MoneyField label="Loan Book" value={v.loanBook as number} onChange={(x) => f.setValue("loanBook", x)} />
            <MoneyField label="Total Assets" value={v.totalAssets as number} onChange={(x) => f.setValue("totalAssets", x)} />
            <NumberField label="Staff Count" value={v.staffCount as number} onChange={(x) => f.setValue("staffCount", x)} min={0} />
            <NumberField label="Branch Count" value={v.branchCount as number} onChange={(x) => f.setValue("branchCount", x)} min={0} />
          </div>
          <SelectField label="Profitability" value={v.profitability as string} onChange={(x) => f.setValue("profitability", x)} options={options("Profitability")} />

          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide pt-1">Governance</p>
          <TextAreaField label="Business Model" value={v.businessModel as string} onChange={(x) => f.setValue("businessModel", x)} />
          <TextAreaField label="Ownership Structure" value={v.ownershipStructure as string} onChange={(x) => f.setValue("ownershipStructure", x)} />
          <TextAreaField label="Directors / Management" value={v.directorsManagement as string} onChange={(x) => f.setValue("directorsManagement", x)} />
          <TextAreaField label="Target Clients" value={v.targetClients as string} onChange={(x) => f.setValue("targetClients", x)} />
          {f.formError && <p className="text-xs text-rose-600">{f.formError}</p>}
        </div>
      </Drawer>
    </>
  );
}
