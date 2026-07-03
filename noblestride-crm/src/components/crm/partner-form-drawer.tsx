"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Drawer } from "@/components/ui/drawer";
import { TextField, TextAreaField, MoneyField, SelectField, CheckboxField } from "@/components/ui/fields";
import { useEntityForm } from "@/components/ui/use-entity-form";
import { partnerCreateSchema, partnerUpdateSchema } from "@/lib/schemas/partner";
import { options } from "@/lib/vocab";

const CREATE = `mutation CreatePartner($input: PartnerInput!) { createPartner(input: $input) { id } }`;
const UPDATE = `mutation UpdatePartner($id: ID!, $input: PartnerInput!) { updatePartner(id: $id, input: $input) { id } }`;

const EMPTY: Record<string, unknown> = {
  name: "", partnerType: "", profile: "", status: "", location: "", amount: undefined, currency: "",
  advisorType: "", feeSharingAgreement: false, feeSharingTerms: "", partnerAgreementStatus: "", internalOnly: true,
};

export function PartnerFormDrawer({ mode, initial, triggerLabel }: {
  mode: "create" | "edit";
  initial?: Record<string, unknown> & { id?: string };
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const f = useEntityForm({
    initial: { ...EMPTY, ...(initial ?? {}) },
    schema: mode === "create" ? partnerCreateSchema : partnerUpdateSchema,
    createMutation: CREATE, updateMutation: UPDATE,
    mode, recordId: initial?.id as string | undefined,
    onSuccess: () => setOpen(false),
  });
  const v = f.values;

  return (
    <>
      <Button variant={mode === "create" ? "primary" : "secondary"} size="sm" onClick={() => setOpen(true)}>
        {triggerLabel ?? (mode === "create" ? "+ New Partner" : "Edit")}
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "create" ? "New Partner" : "Edit Partner"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={f.pending}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={f.submit} disabled={f.pending}>{f.pending ? "Saving…" : "Save"}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <TextField label="Name" required value={v.name as string} onChange={(x) => f.setValue("name", x)} error={f.errors.name} />
          <SelectField label="Partner Type" value={v.partnerType as string} onChange={(x) => f.setValue("partnerType", x)} options={options("PartnerType")} />
          <SelectField label="Status" value={v.status as string} onChange={(x) => f.setValue("status", x)} options={options("PartnerStatus")} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Advisor Type" value={v.advisorType as string} onChange={(x) => f.setValue("advisorType", x)} options={options("AdvisorType")} />
            <SelectField label="Agreement Status" value={v.partnerAgreementStatus as string} onChange={(x) => f.setValue("partnerAgreementStatus", x)} options={options("PartnerAgreementStatus")} />
          </div>
          <TextField label="Location" value={v.location as string} onChange={(x) => f.setValue("location", x)} />
          <MoneyField label="Amount" value={v.amount as number} onChange={(x) => f.setValue("amount", x)} />
          <CheckboxField label="Fee-sharing agreement in place" value={v.feeSharingAgreement as boolean} onChange={(x) => f.setValue("feeSharingAgreement", x)} />
          {(v.feeSharingAgreement as boolean) && (
            <TextAreaField label="Fee-Sharing Terms" value={v.feeSharingTerms as string} onChange={(x) => f.setValue("feeSharingTerms", x)} />
          )}
          <CheckboxField label="Internal only (not client-facing)" value={v.internalOnly as boolean} onChange={(x) => f.setValue("internalOnly", x)} />
          <TextAreaField label="Profile" value={v.profile as string} onChange={(x) => f.setValue("profile", x)} />
          {f.formError && <p className="text-xs text-rose-600">{f.formError}</p>}
        </div>
      </Drawer>
    </>
  );
}
