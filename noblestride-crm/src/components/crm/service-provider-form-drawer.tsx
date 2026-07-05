"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Drawer } from "@/components/ui/drawer";
import { TextField, TextAreaField, MoneyField, SelectField } from "@/components/ui/fields";
import { useEntityForm } from "@/components/ui/use-entity-form";
import { serviceProviderCreateSchema, serviceProviderUpdateSchema } from "@/lib/schemas/service-provider";
import { options } from "@/lib/vocab";

const CREATE = `mutation CreateServiceProvider($input: ServiceProviderInput!) { createServiceProvider(input: $input) { id } }`;
const UPDATE = `mutation UpdateServiceProvider($id: ID!, $input: ServiceProviderInput!) { updateServiceProvider(id: $id, input: $input) { id } }`;

const EMPTY: Record<string, unknown> = {
  name: "", type: "", contactPerson: "", email: "", phone: "",
  profile: "", fee: undefined, currency: "", status: "",
};

export function ServiceProviderFormDrawer({
  mode, initial, triggerLabel, open: controlledOpen, onOpenChange,
}: {
  mode: "create" | "edit";
  initial?: Record<string, unknown> & { id?: string };
  triggerLabel?: string;
  /** Pass to drive the drawer externally (e.g. row-click-to-edit) instead of the built-in trigger button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;

  const f = useEntityForm({
    initial: { ...EMPTY, ...(initial ?? {}) },
    schema: mode === "create" ? serviceProviderCreateSchema : serviceProviderUpdateSchema,
    createMutation: CREATE, updateMutation: UPDATE,
    mode, recordId: initial?.id as string | undefined,
    onSuccess: () => setOpen(false),
  });
  const v = f.values;

  return (
    <>
      {!isControlled && (
        <Button variant={mode === "create" ? "primary" : "secondary"} size="sm" onClick={() => setOpen(true)}>
          {triggerLabel ?? (mode === "create" ? "+ New Service Provider" : "Edit")}
        </Button>
      )}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "create" ? "New Service Provider" : "Edit Service Provider"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={f.pending}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={f.submit} disabled={f.pending}>{f.pending ? "Saving…" : "Save"}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <TextField label="Name" required value={v.name as string} onChange={(x) => f.setValue("name", x)} error={f.errors.name} />
          <SelectField label="Type" value={v.type as string} onChange={(x) => f.setValue("type", x)} options={options("ServiceProviderType")} />
          <TextField label="Contact Person" value={v.contactPerson as string} onChange={(x) => f.setValue("contactPerson", x)} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Email" value={v.email as string} onChange={(x) => f.setValue("email", x)} />
            <TextField label="Phone" value={v.phone as string} onChange={(x) => f.setValue("phone", x)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MoneyField label="Fee" value={v.fee as number} onChange={(x) => f.setValue("fee", x)} />
            <TextField label="Currency" value={v.currency as string} onChange={(x) => f.setValue("currency", x)} placeholder="USD" />
          </div>
          <TextField label="Status" value={v.status as string} onChange={(x) => f.setValue("status", x)} placeholder="Proposed, Engaged, …" />
          <TextAreaField label="Profile" value={v.profile as string} onChange={(x) => f.setValue("profile", x)} />
          {f.formError && <p className="text-xs text-rose-600">{f.formError}</p>}
        </div>
      </Drawer>
    </>
  );
}
