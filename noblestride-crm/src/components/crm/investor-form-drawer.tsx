"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { Drawer } from "@/components/ui/drawer";
import { TextField, TextAreaField, NumberField, MoneyField, SelectField, MultiSelectField, DateField, RelationSelect } from "@/components/ui/fields";
import { useEntityForm } from "@/components/ui/use-entity-form";
import { investorCreateSchema, investorUpdateSchema } from "@/lib/schemas/investor";
import { options } from "@/lib/vocab";
import { CURRENCY_OPTIONS } from "@/lib/currencies";

const CREATE = `mutation CreateInvestor($input: InvestorInput!) { createInvestor(input: $input) { id } }`;
const UPDATE = `mutation UpdateInvestor($id: ID!, $input: InvestorInput!) { updateInvestor(id: $id, input: $input) { id } }`;

const EMPTY: Record<string, unknown> = {
  name: "", investorType: "", website: "", status: "",
  sectorFocus: [], geographicFocus: [], instruments: [], investmentStages: [],
  aum: undefined, ticketMin: undefined, ticketMax: undefined, currency: "",
  targetIrr: undefined, countryRestrictions: "", esgFocus: "", decisionProcess: "", notes: "",
  engagementClassification: "", ndaStatus: "",
  shareholdingPreference: "", nextActionDate: "", feedback: "",
  ssaRegionContactId: "",
};

export function InvestorFormDrawer({ mode, initial, triggerLabel, contacts = [] }: {
  mode: "create" | "edit";
  initial?: Record<string, unknown> & { id?: string };
  triggerLabel?: string;
  contacts?: SelectOption[];
}) {
  const [open, setOpen] = useState(false);
  const f = useEntityForm({
    initial: { ...EMPTY, ...(initial ?? {}) },
    schema: mode === "create" ? investorCreateSchema : investorUpdateSchema,
    createMutation: CREATE,
    updateMutation: UPDATE,
    mode,
    recordId: initial?.id as string | undefined,
    onSuccess: () => setOpen(false),
  });
  const v = f.values;

  return (
    <>
      <Button variant={mode === "create" ? "primary" : "secondary"} size="sm" onClick={() => setOpen(true)}>
        {triggerLabel ?? (mode === "create" ? "+ New Investor" : "Edit")}
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "create" ? "New Investor" : "Edit Investor"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={f.pending}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={f.submit} disabled={f.pending}>
              {f.pending ? "Saving…" : "Save"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <TextField label="Name" required value={v.name as string} onChange={(x) => f.setValue("name", x)} error={f.errors.name} />
          <SelectField label="Investor Type" required value={v.investorType as string} onChange={(x) => f.setValue("investorType", x)} options={options("InvestorType")} error={f.errors.investorType} />
          <SelectField label="Status" value={v.status as string} onChange={(x) => f.setValue("status", x)} options={options("InvestorStatus")} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Engagement Classification" value={v.engagementClassification as string} onChange={(x) => f.setValue("engagementClassification", x)} options={options("InvestorEngagementClassification")} />
            <SelectField label="NDA Status" value={v.ndaStatus as string} onChange={(x) => f.setValue("ndaStatus", x)} options={options("InvestorNdaStatus")} />
          </div>
          <MultiSelectField label="Sector Focus" value={v.sectorFocus as string[]} onChange={(x) => f.setValue("sectorFocus", x)} options={options("Sector")} />
          <MultiSelectField label="Geographic Focus" value={v.geographicFocus as string[]} onChange={(x) => f.setValue("geographicFocus", x)} options={options("Geography")} />
          <MultiSelectField label="Instruments" value={v.instruments as string[]} onChange={(x) => f.setValue("instruments", x)} options={options("Instrument")} />
          <MultiSelectField label="Investment Stages" value={v.investmentStages as string[]} onChange={(x) => f.setValue("investmentStages", x)} options={options("InvestmentStage")} />
          <div className="grid grid-cols-2 gap-3">
            <MoneyField label="AUM" value={v.aum as number} onChange={(x) => f.setValue("aum", x)} />
            <NumberField label="Target IRR (%)" value={v.targetIrr as number} onChange={(x) => f.setValue("targetIrr", x)} />
            <MoneyField label="Ticket Min" value={v.ticketMin as number} onChange={(x) => f.setValue("ticketMin", x)} />
            <MoneyField label="Ticket Max" value={v.ticketMax as number} onChange={(x) => f.setValue("ticketMax", x)} />
          </div>
          {/* Zod schema always accepted currency — this was the missing input (defaulted USD). */}
          <SelectField label="Currency" value={v.currency as string} onChange={(x) => f.setValue("currency", x)} options={CURRENCY_OPTIONS} />
          <TextField label="Website" value={v.website as string} onChange={(x) => f.setValue("website", x)} />
          <TextField label="Country Restrictions" value={v.countryRestrictions as string} onChange={(x) => f.setValue("countryRestrictions", x)} />
          <TextField label="ESG Focus" value={v.esgFocus as string} onChange={(x) => f.setValue("esgFocus", x)} />
          <TextField label="Shareholding Preference" value={v.shareholdingPreference as string} onChange={(x) => f.setValue("shareholdingPreference", x)} />
          {contacts.length > 0 && (
            <RelationSelect label="SSA Region Contact" value={v.ssaRegionContactId as string} onChange={(x) => f.setValue("ssaRegionContactId", x)} options={contacts} placeholder="Select contact…" />
          )}
          <TextAreaField label="Decision Process" value={v.decisionProcess as string} onChange={(x) => f.setValue("decisionProcess", x)} />
          <DateField label="Next Action Date" value={v.nextActionDate as string} onChange={(x) => f.setValue("nextActionDate", x)} />
          <TextAreaField label="Feedback" value={v.feedback as string} onChange={(x) => f.setValue("feedback", x)} />
          <TextAreaField label="Notes" value={v.notes as string} onChange={(x) => f.setValue("notes", x)} />
          {f.formError && <p className="text-xs text-rose-600">{f.formError}</p>}
        </div>
      </Drawer>
    </>
  );
}
