"use client";

// engagement-form-drawer.tsx — edit surface for §3.11 engagement fields.
// Edit-only: engagements are created via logEngagement / createEngagement.
// engagementStage is deliberately NOT here (restage control owns it, with the
// NDA guard); amountPending/year/quarter are server-derived on save.

import { useState } from "react";
import { Button } from "@/components/ui";
import { Drawer } from "@/components/ui/drawer";
import { TextAreaField, MoneyField, NumberField, SelectField, DateField, CheckboxField } from "@/components/ui/fields";
import { useEntityForm } from "@/components/ui/use-entity-form";
import { engagementUpdateSchema } from "@/lib/schemas/engagement";
import { options } from "@/lib/vocab";

const UPDATE = `mutation UpdateEngagement($id: ID!, $input: EngagementInput!) { updateEngagement(id: $id, input: $input) { id } }`;

export function EngagementFormDrawer({ initial, triggerLabel, open: controlledOpen, onOpenChange }: {
  /** Must include id, transactionId, investorId (EngagementInput requires the pair). */
  initial: Record<string, unknown> & { id: string; transactionId: string; investorId: string };
  triggerLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;

  const f = useEntityForm({
    initial,
    schema: engagementUpdateSchema,
    createMutation: UPDATE, updateMutation: UPDATE,
    mode: "edit", recordId: initial.id,
    onSuccess: () => setOpen(false),
  });
  const v = f.values;

  return (
    <>
      {!isControlled && (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          {triggerLabel ?? "Edit"}
        </Button>
      )}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Edit Engagement"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={f.pending}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={f.submit} disabled={f.pending}>{f.pending ? "Saving…" : "Save"}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Interest Level" value={v.interestLevel as string} onChange={(x) => f.setValue("interestLevel", x)} options={options("InterestLevel")} />
            <SelectField label="NDA Type" value={v.ndaType as string} onChange={(x) => f.setValue("ndaType", x)} options={options("NdaType")} />
          </div>
          <CheckboxField label="Term sheet issued" value={v.termSheetIssued as boolean} onChange={(x) => f.setValue("termSheetIssued", x)} />
          <DateField label="Term Sheet Date" value={v.termSheetDate as string} onChange={(x) => f.setValue("termSheetDate", x)} />

          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide pt-1">Disbursement</p>
          <div className="grid grid-cols-2 gap-3">
            <MoneyField label="Total Amount" value={v.totalAmount as number} onChange={(x) => f.setValue("totalAmount", x)} />
            <MoneyField label="Amount Disbursed" value={v.amountDisbursed as number} onChange={(x) => f.setValue("amountDisbursed", x)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Disbursement Status" value={v.disbursementStatus as string} onChange={(x) => f.setValue("disbursementStatus", x)} options={options("DisbursementStatus")} />
            <DateField label="Date Received" value={v.dateReceived as string} onChange={(x) => f.setValue("dateReceived", x)} />
          </div>
          <p className="text-xs text-zinc-400">Pending amount and year/quarter are derived automatically on save.</p>

          <NumberField label="Probability (%)" value={v.probability as number} onChange={(x) => f.setValue("probability", x)} min={0} max={100} />
          <TextAreaField label="Feedback" value={v.feedback as string} onChange={(x) => f.setValue("feedback", x)} />
          <TextAreaField label="Notes" value={v.notes as string} onChange={(x) => f.setValue("notes", x)} />
          {f.formError && <p className="text-xs text-rose-600">{f.formError}</p>}
        </div>
      </Drawer>
    </>
  );
}
