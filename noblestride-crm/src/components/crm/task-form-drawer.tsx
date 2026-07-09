"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { Drawer } from "@/components/ui/drawer";
import { TextField, TextAreaField, SelectField, RelationSelect, DateField } from "@/components/ui/fields";
import { useEntityForm } from "@/components/ui/use-entity-form";
import { taskCreateSchema, taskUpdateSchema } from "@/lib/schemas/task";
import { options } from "@/lib/vocab";

const CREATE = `mutation CreateTask($input: TaskInput!) { createTask(input: $input) { id } }`;
const UPDATE = `mutation UpdateTask($id: ID!, $input: TaskInput!) { updateTask(id: $id, input: $input) { id } }`;

const EMPTY: Record<string, unknown> = {
  title: "", status: "", source: "", dueAt: "", body: "",
  assigneeId: "", assistantId: "", mandateId: "", transactionId: "", investorId: "", clientId: "",
};

export function TaskFormDrawer({
  mode, initial, mandates, transactions, investors, clients, users, triggerLabel,
  open: controlledOpen, onOpenChange,
}: {
  mode: "create" | "edit";
  initial?: Record<string, unknown> & { id?: string };
  mandates: SelectOption[];
  transactions: SelectOption[];
  investors: SelectOption[];
  clients: SelectOption[];
  users: SelectOption[];
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
    schema: mode === "create" ? taskCreateSchema : taskUpdateSchema,
    createMutation: CREATE, updateMutation: UPDATE,
    mode, recordId: initial?.id as string | undefined,
    onSuccess: () => setOpen(false),
  });
  const v = f.values;

  return (
    <>
      {!isControlled && (
        <Button variant={mode === "create" ? "primary" : "secondary"} size="sm" onClick={() => setOpen(true)}>
          {triggerLabel ?? (mode === "create" ? "+ New Task" : "Edit")}
        </Button>
      )}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "create" ? "New Task" : "Edit Task"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={f.pending}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={f.submit} disabled={f.pending}>{f.pending ? "Saving…" : "Save"}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <TextField label="Title" required value={v.title as string} onChange={(x) => f.setValue("title", x)} error={f.errors.title} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Status" value={v.status as string} onChange={(x) => f.setValue("status", x)} options={options("TaskStatus")} />
            <SelectField label="Source" value={v.source as string} onChange={(x) => f.setValue("source", x)} options={options("TaskSource")} />
          </div>
          {f.errors._ && (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-600">{f.errors._}</p>
          )}
          <RelationSelect label="Mandate" value={v.mandateId as string} onChange={(x) => f.setValue("mandateId", x)} options={mandates} placeholder="Select mandate…" />
          <RelationSelect label="Transaction" value={v.transactionId as string} onChange={(x) => f.setValue("transactionId", x)} options={transactions} placeholder="Select transaction…" />
          <RelationSelect label="Investor" value={v.investorId as string} onChange={(x) => f.setValue("investorId", x)} options={investors} placeholder="Select investor…" />
          <RelationSelect label="Client" value={v.clientId as string} onChange={(x) => f.setValue("clientId", x)} options={clients} placeholder="Select client…" />
          <div className="grid grid-cols-2 gap-3">
            <RelationSelect label="Owner" value={v.assigneeId as string} onChange={(x) => f.setValue("assigneeId", x)} options={users} placeholder="Select owner…" />
            <RelationSelect label="Assistant" value={v.assistantId as string} onChange={(x) => f.setValue("assistantId", x)} options={users} placeholder="Select assistant…" />
          </div>
          <DateField label="Deadline" value={v.dueAt as string} onChange={(x) => f.setValue("dueAt", x)} />
          <TextAreaField label="Notes" value={v.body as string} onChange={(x) => f.setValue("body", x)} />
          {f.formError && <p className="text-xs text-rose-600">{f.formError}</p>}
        </div>
      </Drawer>
    </>
  );
}
