"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { Drawer } from "@/components/ui/drawer";
import { TextField, MoneyField, SelectField, RelationSelect, MultiSelectField, DateField } from "@/components/ui/fields";
import { useEntityForm } from "@/components/ui/use-entity-form";
import { transactionCreateSchema, transactionUpdateSchema } from "@/lib/schemas/transaction";
import { options } from "@/lib/vocab";

const CREATE = `mutation CreateTransaction($input: TransactionInput!) { createTransaction(input: $input) { id } }`;
const UPDATE = `mutation UpdateTransaction($id: ID!, $input: TransactionInput!) { updateTransaction(id: $id, input: $input) { id } }`;

const EMPTY: Record<string, unknown> = {
  name: "", clientId: "", mandateId: "", ownerId: "", dealType: "", instrument: [],
  targetRaise: undefined, currency: "", sector: [], dateOpened: "",
  successFeeAmount: undefined, successFeeInvoicedDate: "", successFeePaidDate: "",
};

export function TransactionFormDrawer({ mode, initial, clients, users, mandates, triggerLabel }: {
  mode: "create" | "edit";
  initial?: Record<string, unknown> & { id?: string };
  clients: SelectOption[];
  users: SelectOption[];
  mandates: SelectOption[];
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const f = useEntityForm({
    initial: { ...EMPTY, ...(initial ?? {}) },
    schema: mode === "create" ? transactionCreateSchema : transactionUpdateSchema,
    createMutation: CREATE, updateMutation: UPDATE,
    mode, recordId: initial?.id as string | undefined,
    onSuccess: () => setOpen(false),
  });
  const v = f.values;

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
          <RelationSelect label="Owner" value={v.ownerId as string} onChange={(x) => f.setValue("ownerId", x)} options={users} placeholder="Select owner…" />
          <div className="grid grid-cols-2 gap-3">
            <MoneyField label="Target Raise" value={v.targetRaise as number} onChange={(x) => f.setValue("targetRaise", x)} />
            <SelectField label="Deal Type" value={v.dealType as string} onChange={(x) => f.setValue("dealType", x)} options={options("DealType")} />
          </div>
          <MultiSelectField label="Instrument" value={v.instrument as string[]} onChange={(x) => f.setValue("instrument", x)} options={options("Instrument")} />
          <MultiSelectField label="Sector" value={v.sector as string[]} onChange={(x) => f.setValue("sector", x)} options={options("Sector")} />
          <DateField label="Date Opened" value={v.dateOpened as string} onChange={(x) => f.setValue("dateOpened", x)} />
          <MoneyField label="Success Fee Amount" value={v.successFeeAmount as number} onChange={(x) => f.setValue("successFeeAmount", x)} />
          <div className="grid grid-cols-2 gap-3">
            <DateField label="Success Fee Invoiced" value={v.successFeeInvoicedDate as string} onChange={(x) => f.setValue("successFeeInvoicedDate", x)} />
            <DateField label="Success Fee Paid" value={v.successFeePaidDate as string} onChange={(x) => f.setValue("successFeePaidDate", x)} />
          </div>
          {f.formError && <p className="text-xs text-rose-600">{f.formError}</p>}
        </div>
      </Drawer>
    </>
  );
}
