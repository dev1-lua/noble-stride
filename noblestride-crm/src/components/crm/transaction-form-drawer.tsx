"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { Drawer } from "@/components/ui/drawer";
import { TextField, TextAreaField, NumberField, MoneyField, SelectField, RelationSelect, MultiSelectField, DateField } from "@/components/ui/fields";
import { useEntityForm } from "@/components/ui/use-entity-form";
import { transactionCreateSchema, transactionUpdateSchema } from "@/lib/schemas/transaction";
import { options } from "@/lib/vocab";

const CREATE = `mutation CreateTransaction($input: TransactionInput!) { createTransaction(input: $input) { id } }`;
const UPDATE = `mutation UpdateTransaction($id: ID!, $input: TransactionInput!) { updateTransaction(id: $id, input: $input) { id } }`;

const EMPTY: Record<string, unknown> = {
  name: "", clientId: "", mandateId: "", ownerId: "", assistIds: [], dealType: "", instrument: [],
  stage: "",
  targetRaise: undefined, currency: "", sector: [], country: "", dateOpened: "",
  successFeeAmount: undefined, successFeeInvoicedDate: "", successFeePaidDate: "",
  // Spec-gap: deal status/milestone/financing fields (spec §4.1/§4.3/§4.5/§4.7)
  dealStatus: "", dealMilestone: "", financingType: "", maxSellingStake: "",
  targetProfile: "", useOfFunds: "", vdrLink: "", probability: undefined, notes: "",
  referredById: "", serviceProviderIds: [],
  icFirstApprovalDate: "", icSecondApprovalDate: "",
  cakComesaStatus: "", cakComesaFiledDate: "", cakComesaApprovedDate: "",
  // Task 8: priority + partner fee tracking (Task 6 migration)
  priority: "", partnerFeeStatus: "", partnerFeeAmount: undefined,
};

export function TransactionFormDrawer({ mode, initial, clients, users, mandates, partners, serviceProviders, triggerLabel }: {
  mode: "create" | "edit";
  initial?: Record<string, unknown> & { id?: string };
  clients: SelectOption[];
  users: SelectOption[];
  mandates: SelectOption[];
  partners: SelectOption[];
  serviceProviders: SelectOption[];
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const f = useEntityForm({
    initial: { ...EMPTY, ...(initial ?? {}) },
    schema: mode === "create" ? transactionCreateSchema : transactionUpdateSchema,
    createMutation: CREATE, updateMutation: UPDATE,
    mode, recordId: initial?.id as string | undefined,
    onSuccess: () => setOpen(false),
    // Reviewer finding: these Task 8 fields must be clearable back to unset
    // via a blank selection, unlike this app's default "blank = leave
    // unchanged" convention for optional fields.
    clearableFields: ["priority", "partnerFeeStatus"],
  });
  const v = f.values;
  const lockDateOpened = mode === "edit" && Boolean(initial?.dateOpened);

  return (
    <>
      <Button variant={mode === "create" ? "primary" : "secondary"} size="sm" onClick={() => setOpen(true)}>
        {triggerLabel ?? (mode === "create" ? "+ New Transaction" : "Edit")}
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "create" ? "New Transaction" : "Edit Transaction"}
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
          <RelationSelect label="Mandate" value={v.mandateId as string} onChange={(x) => f.setValue("mandateId", x)} options={mandates} placeholder="Select mandate…" />
          <SelectField label="Stage" value={v.stage as string} onChange={(x) => f.setValue("stage", x)} options={options("TransactionStage")} />
          <RelationSelect label="Deal Lead" value={v.ownerId as string} onChange={(x) => f.setValue("ownerId", x)} options={users} placeholder="Select lead…" />
          <MultiSelectField label="Deal Assists" value={v.assistIds as string[]} onChange={(x) => f.setValue("assistIds", x)} options={users} />
          <RelationSelect label="Referred By (Consultant/Partner)" value={v.referredById as string} onChange={(x) => f.setValue("referredById", x)} options={partners} placeholder="Select partner…" />
          {Boolean(v.referredById) && (
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Partner Fee Status" value={v.partnerFeeStatus as string} onChange={(x) => f.setValue("partnerFeeStatus", x)} options={options("PartnerFeeStatus")} />
              <MoneyField label="Partner Fee Amount" value={v.partnerFeeAmount as number} onChange={(x) => f.setValue("partnerFeeAmount", x)} />
            </div>
          )}
          <MultiSelectField label="Service Providers Engaged" value={v.serviceProviderIds as string[]} onChange={(x) => f.setValue("serviceProviderIds", x)} options={serviceProviders} />
          <div className="grid grid-cols-2 gap-3">
            <MoneyField label="Target Raise" value={v.targetRaise as number} onChange={(x) => f.setValue("targetRaise", x)} />
            <SelectField label="Round" value={v.dealType as string} onChange={(x) => f.setValue("dealType", x)} options={options("DealType")} />
          </div>
          <MultiSelectField label="Instrument" value={v.instrument as string[]} onChange={(x) => f.setValue("instrument", x)} options={options("Instrument")} />
          <MultiSelectField label="Sector" value={v.sector as string[]} onChange={(x) => f.setValue("sector", x)} options={options("Sector")} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Country" value={v.country as string} onChange={(x) => f.setValue("country", x)} />
            <DateField label="Date Opened" value={v.dateOpened as string} onChange={(x) => f.setValue("dateOpened", x)} disabled={lockDateOpened} />
          </div>
          {lockDateOpened && (
            <p className="text-xs text-[var(--text-tertiary)]">Date opened is locked once set.</p>
          )}

          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide pt-1">Deal Status</p>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Deal Status" value={v.dealStatus as string} onChange={(x) => f.setValue("dealStatus", x)} options={options("DealStatus")} />
            <SelectField label="Deal Milestone" value={v.dealMilestone as string} onChange={(x) => f.setValue("dealMilestone", x)} options={options("DealMilestone")} />
          </div>
          <SelectField label="Priority" value={v.priority as string} onChange={(x) => f.setValue("priority", x)} options={options("Priority")} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Deal Type" value={v.financingType as string} onChange={(x) => f.setValue("financingType", x)} options={options("DealFinancingType")} />
            <SelectField label="Max Selling Stake" value={v.maxSellingStake as string} onChange={(x) => f.setValue("maxSellingStake", x)} options={options("MaxSellingStake")} />
          </div>
          <NumberField label="Probability (%)" value={v.probability as number} onChange={(x) => f.setValue("probability", x)} min={0} max={100} />
          <TextAreaField label="Target Profile" value={v.targetProfile as string} onChange={(x) => f.setValue("targetProfile", x)} />
          <TextAreaField label="Use of Funds" value={v.useOfFunds as string} onChange={(x) => f.setValue("useOfFunds", x)} />
          <TextField label="VDR Link" value={v.vdrLink as string} onChange={(x) => f.setValue("vdrLink", x)} />

          <MoneyField label="Success Fee Amount" value={v.successFeeAmount as number} onChange={(x) => f.setValue("successFeeAmount", x)} />
          <div className="grid grid-cols-2 gap-3">
            <DateField label="Success Fee Invoiced" value={v.successFeeInvoicedDate as string} onChange={(x) => f.setValue("successFeeInvoicedDate", x)} />
            <DateField label="Success Fee Paid" value={v.successFeePaidDate as string} onChange={(x) => f.setValue("successFeePaidDate", x)} />
          </div>
          <TextAreaField label="Notes" value={v.notes as string} onChange={(x) => f.setValue("notes", x)} />
          <p className="pt-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">IC &amp; Regulatory</p>
          <div className="grid grid-cols-2 gap-3">
            <DateField label="First IC Approval" value={v.icFirstApprovalDate as string} onChange={(x) => f.setValue("icFirstApprovalDate", x)} />
            <DateField label="Second IC Approval" value={v.icSecondApprovalDate as string} onChange={(x) => f.setValue("icSecondApprovalDate", x)} />
          </div>
          <SelectField label="CAK / COMESA Status" value={v.cakComesaStatus as string} onChange={(x) => f.setValue("cakComesaStatus", x)} options={options("RegulatoryStatus")} />
          <div className="grid grid-cols-2 gap-3">
            <DateField label="CAK/COMESA Filed" value={v.cakComesaFiledDate as string} onChange={(x) => f.setValue("cakComesaFiledDate", x)} />
            <DateField label="CAK/COMESA Approved" value={v.cakComesaApprovedDate as string} onChange={(x) => f.setValue("cakComesaApprovedDate", x)} />
          </div>
          {f.formError && <p className="text-xs text-rose-600">{f.formError}</p>}
        </div>
      </Drawer>
    </>
  );
}
