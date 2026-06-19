# CRUD System — Plan B: UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the human UI for Create / Edit / guarded-Delete on Mandate, Transaction, Investor, Client, Partner — a right-side slide-over drawer per entity — plus a new clients list page, all on top of Plan A's GraphQL mutations.

**Architecture:** Shared plumbing built once — a `Drawer` slide-over, field components, a `useEntityForm` hook (validate → mutate → `router.refresh()`), and a guarded `DeleteConfirm`. Each entity gets a thin form-drawer composing those pieces, bound to its Plan-A Zod schema and `XInput` mutations. Triggers replace the disabled "+ New" buttons (list pages) and add Edit/Delete (detail pages).

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, urql 5, `motion` 12, Zod 4, Tailwind v4.

## Global Constraints

- **Depends on Plan A** (`2026-06-19-crud-system-backend.md`) being merged: the `XInput` GraphQL inputs, the `createX/updateX/deleteX` mutations, and the Zod schemas in `src/lib/schemas/*` must exist.
- Client mutation pattern = the existing `log-engagement-dialog.tsx`: `useMutation` from `urql`, then `router.refresh()` on success. Drawers are `"use client"` and render inside the existing `UrqlProvider` (`src/app/providers.tsx`).
- Reuse existing UI primitives from `@/components/ui` (`Button`, `Input`, `Select`, `Card`, `Table`/`Th`/`Td`, `Avatar`, `Chip`) and `EASE` + `motion` from the premium pass.
- Enum option lists come from `options(group)` in `@/lib/vocab`.
- RSC → client boundary: never pass Prisma `Decimal`/`Date` instances to a client component. Detail pages build a plain **form-values DTO** (numbers + `yyyy-mm-dd` strings) before passing `initial` to an edit drawer.
- Known limitations (acceptable this pass, documented): optional fields cannot be *cleared* in edit mode (empty values are pruned, not sent as null); `stage` is not edited here (Plan A excludes it).
- Run: `corepack pnpm exec tsc --noEmit` to typecheck, `corepack pnpm dev` to verify in browser (DB on port 5544).
- Commit trailers: Co-Authored-By + Claude-Session lines as in this repo.

---

### Task 1: `Drawer` slide-over shell

**Files:**
- Create: `src/components/ui/drawer.tsx`
- Modify: `src/components/ui/index.ts` (export `Drawer`)

**Interfaces:**
- Produces: `Drawer({ open, onClose, title, children, footer })` — right slide-over with overlay, ESC-to-close, motion slide-in/out.
- Consumes: `EASE` from `./motion`.

- [ ] **Step 1: Write `src/components/ui/drawer.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { EASE } from "./motion";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Drawer({ open, onClose, title, children, footer }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.35, ease: EASE }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <header className="flex flex-shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && (
              <footer className="flex-shrink-0 border-t border-zinc-200 px-5 py-3">{footer}</footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Export from the barrel**

In `src/components/ui/index.ts`, add:
```ts
export { Drawer } from "./drawer";
```

- [ ] **Step 3: Typecheck**

Run: `corepack pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/drawer.tsx src/components/ui/index.ts
git commit -m "feat(ui): slide-over Drawer component" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

### Task 2: Field components

**Files:**
- Create: `src/components/ui/fields.tsx`

**Interfaces:**
- Produces: `TextField`, `TextAreaField`, `NumberField`, `MoneyField`, `SelectField`, `RelationSelect`, `DateField`, `CheckboxField`, `MultiSelectField`. Each takes `{ label, value, onChange, error?, required? }` (plus `options` for selects/multiselect, `placeholder?` where relevant). `onChange` emits the field's native value (string | number | undefined | boolean | string[]).
- Consumes: `Input`, `Select`, `SelectOption` from `@/components/ui`; `cn`.

- [ ] **Step 1: Write `src/components/ui/fields.tsx`**

```tsx
"use client";

import { cn } from "@/lib/cn";
import { Input, Select } from "@/components/ui";
import type { SelectOption } from "@/components/ui";

const labelText = (label: string, required?: boolean) => (required ? `${label} *` : label);

export function TextField({ label, value, onChange, error, required, placeholder }: {
  label: string; value?: string; onChange: (v: string) => void;
  error?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <Input
      label={labelText(label, required)}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      placeholder={placeholder}
    />
  );
}

export function TextAreaField({ label, value, onChange, error, rows = 3 }: {
  label: string; value?: string; onChange: (v: string) => void; error?: string; rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-zinc-700">{label}</label>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function NumberField({ label, value, onChange, error, required, placeholder }: {
  label: string; value?: number; onChange: (v: number | undefined) => void;
  error?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <Input
      label={labelText(label, required)}
      type="number"
      inputMode="decimal"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      error={error}
      placeholder={placeholder}
    />
  );
}

export const MoneyField = NumberField;

export function SelectField({ label, value, onChange, options, error, required, placeholder }: {
  label: string; value?: string; onChange: (v: string) => void; options: SelectOption[];
  error?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <Select
      label={labelText(label, required)}
      value={value ?? ""}
      onChange={onChange}
      options={options}
      placeholder={placeholder ?? "Select…"}
      error={error}
    />
  );
}

// RelationSelect is a SelectField fed dynamic record options (clients, users, …).
export const RelationSelect = SelectField;

export function DateField({ label, value, onChange, error }: {
  label: string; value?: string; onChange: (v: string) => void; error?: string;
}) {
  // value is a yyyy-mm-dd string
  return (
    <Input label={label} type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} error={error} />
  );
}

export function CheckboxField({ label, value, onChange }: {
  label: string; value?: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-700">
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-accent"
      />
      {label}
    </label>
  );
}

export function MultiSelectField({ label, value, onChange, options }: {
  label: string; value?: string[]; onChange: (v: string[]) => void; options: SelectOption[];
}) {
  const selected = new Set<string>(value ?? []);
  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(Array.from(next));
  };
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-700">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs ring-1 ring-inset transition-colors",
              selected.has(o.value)
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `corepack pnpm exec tsc --noEmit` → PASS.
```bash
git add src/components/ui/fields.tsx
git commit -m "feat(ui): form field components (text/number/select/multiselect/date/checkbox)" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

### Task 3: `useEntityForm` hook

**Files:**
- Create: `src/components/ui/use-entity-form.ts`

**Interfaces:**
- Produces: `useEntityForm({ initial, schema, createMutation, updateMutation, mode, recordId, onSuccess })` → `{ values, setValue, errors, formError, pending, submit }`.
  - `values: Record<string, unknown>`; `setValue(key, value)`; `errors: Record<string,string>` (field → message); `formError: string | null`; `pending: boolean`; `submit(): Promise<void>`.
  - Prunes empty values, validates the pruned object with the Zod `schema`, then runs the create or update mutation and `router.refresh()` on success.
- Consumes: `useMutation` (urql), `useRouter` (next/navigation), a Zod schema (`safeParse`).

- [ ] **Step 1: Write `src/components/ui/use-entity-form.ts`**

```ts
"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "urql";
import type { ZodTypeAny } from "zod";

/** Drop "" / null / undefined so optional Zod fields stay optional and we never send blanks. */
function prune(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v === "" || v === null || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

interface UseEntityFormOptions {
  initial: Record<string, unknown>;
  schema: ZodTypeAny;
  createMutation: string;
  updateMutation: string;
  mode: "create" | "edit";
  recordId?: string;
  onSuccess: () => void;
}

export function useEntityForm(opts: UseEntityFormOptions) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>(opts.initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [, runCreate] = useMutation(opts.createMutation);
  const [, runUpdate] = useMutation(opts.updateMutation);

  const setValue = useCallback((key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  async function submit() {
    const input = prune(values);
    const parsed = opts.schema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "_");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setFormError(null);
    setPending(true);

    const result =
      opts.mode === "create"
        ? await runCreate({ input })
        : await runUpdate({ id: opts.recordId, input });

    setPending(false);

    if (result.error) {
      setFormError(result.error.message.replace(/^\[GraphQL\]\s*/, ""));
      return;
    }
    router.refresh();
    opts.onSuccess();
  }

  return { values, setValue, errors, formError, pending, submit };
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `corepack pnpm exec tsc --noEmit` → PASS.
```bash
git add src/components/ui/use-entity-form.ts
git commit -m "feat(ui): useEntityForm hook (validate, mutate, refresh)" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

### Task 4: `DeleteConfirm`

**Files:**
- Create: `src/components/crm/delete-confirm.tsx`

**Interfaces:**
- Produces: `DeleteConfirm({ mutation, recordId, entityLabel, redirectTo })` — renders a "Delete" trigger + confirm modal; runs the delete mutation; on success `router.push(redirectTo)`; surfaces the guard message (e.g. "Cannot delete: 3 transaction(s)…") inline on failure.
- Consumes: `useMutation` (urql), `useRouter`, `Button`, `Card`/`CardHeader`/`CardBody`.

- [ ] **Step 1: Write `src/components/crm/delete-confirm.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useMutation } from "urql";
import { useRouter } from "next/navigation";
import { Button, Card, CardHeader, CardBody } from "@/components/ui";

interface DeleteConfirmProps {
  /** A GraphQL mutation string taking $id: ID! and returning { id }. */
  mutation: string;
  recordId: string;
  entityLabel: string; // e.g. "investor"
  redirectTo: string; // list route to navigate to after delete
}

export function DeleteConfirm({ mutation, recordId, entityLabel, redirectTo }: DeleteConfirmProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, runDelete] = useMutation(mutation);

  async function handleDelete() {
    setError(null);
    setPending(true);
    const result = await runDelete({ id: recordId });
    setPending(false);
    if (result.error) {
      setError(result.error.message.replace(/^\[GraphQL\]\s*/, ""));
      return;
    }
    setOpen(false);
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Delete
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget && !pending) setOpen(false); }}
        >
          <Card className="mx-4 w-full max-w-sm shadow-xl">
            <CardHeader>
              <h2 className="text-sm font-semibold text-zinc-900">Delete {entityLabel}?</h2>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-zinc-600">
                This permanently removes the {entityLabel}. This cannot be undone.
              </p>
              {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDelete}
                  disabled={pending}
                  className="!bg-rose-600 hover:!bg-rose-700"
                >
                  {pending ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `corepack pnpm exec tsc --noEmit` → PASS.
```bash
git add src/components/crm/delete-confirm.tsx
git commit -m "feat(crm): DeleteConfirm with guard-message surfacing" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

### Task 5: `listUsers` service + relation-options helper

**Files:**
- Create: `src/server/services/users.ts`
- Create: `src/server/services/relation-options.ts`

**Interfaces:**
- Produces:
  - `listUsers()` → active users ordered by name.
  - `relationOptions()` → `{ clients: SelectOption[]; users: SelectOption[]; partners: SelectOption[]; mandates: SelectOption[] }` for form relation pickers. `SelectOption = { value: string; label: string }`.

- [ ] **Step 1: Write `src/server/services/users.ts`**

```ts
import { prisma } from "@/lib/db";

export async function listUsers() {
  return prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}
```

- [ ] **Step 2: Write `src/server/services/relation-options.ts`**

```ts
import { prisma } from "@/lib/db";

export interface RelationOption { value: string; label: string }

export interface RelationOptions {
  clients: RelationOption[];
  users: RelationOption[];
  partners: RelationOption[];
  mandates: RelationOption[];
}

/** Lightweight {id,name} option lists for form relation pickers (one query each). */
export async function relationOptions(): Promise<RelationOptions> {
  const [clients, users, partners, mandates] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.partner.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.mandate.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const map = (rows: { id: string; name: string }[]) => rows.map((r) => ({ value: r.id, label: r.name }));
  return { clients: map(clients), users: map(users), partners: map(partners), mandates: map(mandates) };
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `corepack pnpm exec tsc --noEmit` → PASS.
```bash
git add src/server/services/users.ts src/server/services/relation-options.ts
git commit -m "feat(services): listUsers + relationOptions for form pickers" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

### Task 6: Investor form drawer (reference implementation)

**Files:**
- Create: `src/components/crm/investor-form-drawer.tsx`

**Interfaces:**
- Consumes: `Drawer`, field components, `useEntityForm`, `investorCreateSchema`/`investorUpdateSchema`, `options`.
- Produces: `InvestorFormDrawer({ mode, initial?, triggerLabel? })`. `initial` is a form-values DTO (strings/numbers/arrays) including `id` for edit. Renders its own trigger button.
- **Pattern note:** Tasks 7–10 follow this exact structure — only `EMPTY`, the field list, the schema, and the mutation strings differ.

- [ ] **Step 1: Write `src/components/crm/investor-form-drawer.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Drawer } from "@/components/ui/drawer";
import { TextField, TextAreaField, NumberField, MoneyField, SelectField, MultiSelectField } from "@/components/ui/fields";
import { useEntityForm } from "@/components/ui/use-entity-form";
import { investorCreateSchema, investorUpdateSchema } from "@/lib/schemas/investor";
import { options } from "@/lib/vocab";

const CREATE = `mutation CreateInvestor($input: InvestorInput!) { createInvestor(input: $input) { id } }`;
const UPDATE = `mutation UpdateInvestor($id: ID!, $input: InvestorInput!) { updateInvestor(id: $id, input: $input) { id } }`;

const EMPTY: Record<string, unknown> = {
  name: "", investorType: "", website: "", status: "",
  sectorFocus: [], geographicFocus: [], instruments: [], investmentStages: [],
  aum: undefined, ticketMin: undefined, ticketMax: undefined, currency: "",
  targetIrr: undefined, countryRestrictions: "", esgFocus: "", decisionProcess: "", notes: "",
};

export function InvestorFormDrawer({ mode, initial, triggerLabel }: {
  mode: "create" | "edit";
  initial?: Record<string, unknown> & { id?: string };
  triggerLabel?: string;
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
          <TextField label="Website" value={v.website as string} onChange={(x) => f.setValue("website", x)} />
          <TextField label="Country Restrictions" value={v.countryRestrictions as string} onChange={(x) => f.setValue("countryRestrictions", x)} />
          <TextField label="ESG Focus" value={v.esgFocus as string} onChange={(x) => f.setValue("esgFocus", x)} />
          <TextAreaField label="Decision Process" value={v.decisionProcess as string} onChange={(x) => f.setValue("decisionProcess", x)} />
          <TextAreaField label="Notes" value={v.notes as string} onChange={(x) => f.setValue("notes", x)} />
          {f.formError && <p className="text-xs text-rose-600">{f.formError}</p>}
        </div>
      </Drawer>
    </>
  );
}
```

- [ ] **Step 2: Verify in browser**

Run `corepack pnpm dev`. On `/investors`, wire-up comes in Task 12, so temporarily render `<InvestorFormDrawer mode="create" />` or just typecheck. Run `corepack pnpm exec tsc --noEmit` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/crm/investor-form-drawer.tsx
git commit -m "feat(crm): investor create/edit drawer" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

### Task 7: Partner form drawer

**Files:**
- Create: `src/components/crm/partner-form-drawer.tsx`

**Interfaces:**
- Produces: `PartnerFormDrawer({ mode, initial?, triggerLabel? })` (same shape as Task 6).

- [ ] **Step 1: Write `src/components/crm/partner-form-drawer.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Drawer } from "@/components/ui/drawer";
import { TextField, TextAreaField, MoneyField, SelectField } from "@/components/ui/fields";
import { useEntityForm } from "@/components/ui/use-entity-form";
import { partnerCreateSchema, partnerUpdateSchema } from "@/lib/schemas/partner";
import { options } from "@/lib/vocab";

const CREATE = `mutation CreatePartner($input: PartnerInput!) { createPartner(input: $input) { id } }`;
const UPDATE = `mutation UpdatePartner($id: ID!, $input: PartnerInput!) { updatePartner(id: $id, input: $input) { id } }`;

const EMPTY: Record<string, unknown> = {
  name: "", partnerType: "", profile: "", status: "", location: "", amount: undefined, currency: "",
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
          <TextField label="Location" value={v.location as string} onChange={(x) => f.setValue("location", x)} />
          <MoneyField label="Amount" value={v.amount as number} onChange={(x) => f.setValue("amount", x)} />
          <TextAreaField label="Profile" value={v.profile as string} onChange={(x) => f.setValue("profile", x)} />
          {f.formError && <p className="text-xs text-rose-600">{f.formError}</p>}
        </div>
      </Drawer>
    </>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `corepack pnpm exec tsc --noEmit` → PASS.
```bash
git add src/components/crm/partner-form-drawer.tsx
git commit -m "feat(crm): partner create/edit drawer" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

### Task 8: Client form drawer

**Files:**
- Create: `src/components/crm/client-form-drawer.tsx`

- [ ] **Step 1: Write `src/components/crm/client-form-drawer.tsx`**

```tsx
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
```

- [ ] **Step 2: Typecheck + commit**

Run: `corepack pnpm exec tsc --noEmit` → PASS.
```bash
git add src/components/crm/client-form-drawer.tsx
git commit -m "feat(crm): client create/edit drawer" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

### Task 9: Mandate form drawer (relation pickers)

**Files:**
- Create: `src/components/crm/mandate-form-drawer.tsx`

**Interfaces:**
- Produces: `MandateFormDrawer({ mode, initial?, clients, users, partners, triggerLabel? })`. `clients`/`users`/`partners` are `SelectOption[]` from `relationOptions()`.

- [ ] **Step 1: Write `src/components/crm/mandate-form-drawer.tsx`**

```tsx
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
  name: "", clientId: "", leadId: "", referredById: "", dealSize: undefined, currency: "",
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
            <SelectField label="Source" value={v.source as string} onChange={(x) => f.setValue("source", x)} options={options("Source")} />
          </div>
          <DateField label="Date Opened" value={v.dateOpened as string} onChange={(x) => f.setValue("dateOpened", x)} />
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
```
(The NDA/EA sent/signed dates are omitted from the form for brevity; they're optional and managed elsewhere. Add `DateField`s for them later if needed — the schema/input already accept them.)

- [ ] **Step 2: Typecheck + commit**

Run: `corepack pnpm exec tsc --noEmit` → PASS.
```bash
git add src/components/crm/mandate-form-drawer.tsx
git commit -m "feat(crm): mandate create/edit drawer with relation pickers" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

### Task 10: Transaction form drawer

**Files:**
- Create: `src/components/crm/transaction-form-drawer.tsx`

**Interfaces:**
- Produces: `TransactionFormDrawer({ mode, initial?, clients, users, mandates, triggerLabel? })`.

- [ ] **Step 1: Write `src/components/crm/transaction-form-drawer.tsx`**

```tsx
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
          {f.formError && <p className="text-xs text-rose-600">{f.formError}</p>}
        </div>
      </Drawer>
    </>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `corepack pnpm exec tsc --noEmit` → PASS.
```bash
git add src/components/crm/transaction-form-drawer.tsx
git commit -m "feat(crm): transaction create/edit drawer" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

### Task 11: Clients list page + clients table

**Files:**
- Create: `src/components/crm/clients-table.tsx`
- Create: `src/app/(crm)/clients/page.tsx`

**Interfaces:**
- Consumes: `listClients()`; `ClientFormDrawer` (Task 8); `Table` primitives + `Chip` + `formatMoney`.
- Produces: a browseable `/clients` route with a "+ New Client" button.

- [ ] **Step 1: Write `src/components/crm/clients-table.tsx`**

```tsx
// clients-table.tsx — Client list table. Presentational, server-compatible.
import Link from "next/link";
import { Avatar, Chip, Table, THead, TBody, Tr, Th, Td } from "@/components/ui";
import { formatMoney } from "@/lib/money";

type ClientRow = {
  id: string;
  name: string;
  hqCity: string | null;
  sector: string[];
  revenueLastYear: number | null;
  mandateCount: number;
};

export function ClientsTable({ clients }: { clients: ClientRow[] }) {
  if (clients.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white px-5 py-12 text-center text-zinc-500 shadow-sm">
        No clients yet. Use “+ New Client” to add one.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <Table>
        <THead>
          <Tr className="hover:bg-transparent">
            <Th>Client</Th><Th>Sector</Th><Th>HQ City</Th><Th>Revenue (LY)</Th><Th>Mandates</Th>
          </Tr>
        </THead>
        <TBody>
          {clients.map((c) => (
            <Tr key={c.id}>
              <Td>
                <Link href={`/clients/${c.id}`} className="group flex items-center gap-3">
                  <Avatar name={c.name} size="sm" />
                  <span className="font-medium text-zinc-900 transition-colors group-hover:text-accent">{c.name}</span>
                </Link>
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {c.sector.slice(0, 3).map((s) => <Chip key={s} value={s} group="Sector" />)}
                  {c.sector.length > 3 && <span className="text-xs text-zinc-400">+{c.sector.length - 3}</span>}
                </div>
              </Td>
              <Td className="text-zinc-700">{c.hqCity ?? "—"}</Td>
              <Td className="whitespace-nowrap text-zinc-700">{c.revenueLastYear == null ? "—" : formatMoney(c.revenueLastYear)}</Td>
              <Td className="text-zinc-700">{c.mandateCount}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/app/(crm)/clients/page.tsx`**

```tsx
// clients/page.tsx — Clients list page (RSC).
import { prisma } from "@/lib/db";
import { ClientsTable } from "@/components/crm/clients-table";
import { ClientFormDrawer } from "@/components/crm/client-form-drawer";

export default async function ClientsPage() {
  const rows = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, hqCity: true, sector: true, revenueLastYear: true,
      _count: { select: { mandates: true } },
    },
  });

  const clients = rows.map((c) => ({
    id: c.id,
    name: c.name,
    hqCity: c.hqCity,
    sector: c.sector as string[],
    revenueLastYear: c.revenueLastYear == null ? null : Number(c.revenueLastYear),
    mandateCount: c._count.mandates,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Clients</h1>
          <p className="mt-1 text-sm text-zinc-500">{clients.length} portfolio companies</p>
        </div>
        <ClientFormDrawer mode="create" />
      </div>
      <ClientsTable clients={clients} />
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Run `corepack pnpm dev`, open `/clients`. Expected: a table of clients with a working "+ New Client" drawer that creates a client and refreshes the list. Run `corepack pnpm exec tsc --noEmit` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/crm/clients-table.tsx "src/app/(crm)/clients/page.tsx"
git commit -m "feat(clients): clients list page with + New Client" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

### Task 12: Wire "+ New" into the four existing list pages

**Files:**
- Modify: `src/app/(crm)/investors/page.tsx`
- Modify: `src/app/(crm)/partners/page.tsx`
- Modify: `src/app/(crm)/mandates/page.tsx`
- Modify: `src/app/(crm)/transactions/page.tsx`

**Interfaces:**
- Consumes: the form drawers (Tasks 6–10) and `relationOptions()` (Task 5).

- [ ] **Step 1: Investors page — replace the disabled action area**

In `src/app/(crm)/investors/page.tsx`, add the import:
```ts
import { InvestorFormDrawer } from "@/components/crm/investor-form-drawer";
```
Replace the `<div className="flex gap-2">…Import…Export…</div>` block with:
```tsx
        <div className="flex gap-2">
          <InvestorFormDrawer mode="create" />
        </div>
```

- [ ] **Step 2: Partners page**

Open `src/app/(crm)/partners/page.tsx`. Add `import { PartnerFormDrawer } from "@/components/crm/partner-form-drawer";`. Find the header action buttons (the disabled "+ New" / Import / Export) and replace the disabled "+ New …" button with:
```tsx
          <PartnerFormDrawer mode="create" />
```

- [ ] **Step 3: Mandates page — pass relation options**

In `src/app/(crm)/mandates/page.tsx`:
- Add imports:
```ts
import { relationOptions } from "@/server/services/relation-options";
import { MandateFormDrawer } from "@/components/crm/mandate-form-drawer";
```
- After `const rawColumns = await mandatesByStage();`, add:
```ts
  const rel = await relationOptions();
```
- Replace the disabled `<Button variant="primary" size="sm" disabled>+ New Lead</Button>` with:
```tsx
          <MandateFormDrawer mode="create" clients={rel.clients} users={rel.users} partners={rel.partners} />
```

- [ ] **Step 4: Transactions page**

In `src/app/(crm)/transactions/page.tsx`:
- Add imports:
```ts
import { relationOptions } from "@/server/services/relation-options";
import { TransactionFormDrawer } from "@/components/crm/transaction-form-drawer";
```
- Load options near the top of the component: `const rel = await relationOptions();`
- Replace the disabled "+ New Transaction" button with:
```tsx
          <TransactionFormDrawer mode="create" clients={rel.clients} users={rel.users} mandates={rel.mandates} />
```

- [ ] **Step 5: Verify in browser**

Run `corepack pnpm dev`. On each of `/investors`, `/partners`, `/mandates`, `/transactions`, click "+ New …", fill the required fields, Save → the new record appears after refresh. Run `corepack pnpm exec tsc --noEmit` → PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(crm)/investors/page.tsx" "src/app/(crm)/partners/page.tsx" "src/app/(crm)/mandates/page.tsx" "src/app/(crm)/transactions/page.tsx"
git commit -m "feat(crm): enable + New on investors/partners/mandates/transactions" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

### Task 13: Wire Edit + Delete into the five detail pages

**Files:**
- Modify: `src/app/(crm)/mandates/[id]/page.tsx`, `src/app/(crm)/transactions/[id]/page.tsx`, `src/app/(crm)/investors/[id]/page.tsx`, `src/app/(crm)/partners/[id]/page.tsx`, `src/app/(crm)/clients/[id]/page.tsx`

**Interfaces:**
- Consumes: the form drawers (edit mode) + `DeleteConfirm` + `relationOptions()`.
- Each detail page builds a plain **form-values DTO** (`toFormValues`) and renders `<XFormDrawer mode="edit" initial={dto} … />` + `<DeleteConfirm … />` in the header actions.

- [ ] **Step 1: Mandate detail — add Edit + Delete (worked example)**

In `src/app/(crm)/mandates/[id]/page.tsx`:
- Add imports:
```ts
import { relationOptions } from "@/server/services/relation-options";
import { MandateFormDrawer } from "@/components/crm/mandate-form-drawer";
import { DeleteConfirm } from "@/components/crm/delete-confirm";
```
- After `const mandate = await getMandate(id);` (and the `notFound()` guard), add:
```ts
  const rel = await relationOptions();
  const toDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
  const initial = {
    id: m.id,
    name: m.name,
    clientId: m.clientId ?? "",
    leadId: m.leadId ?? "",
    referredById: m.referredById ?? "",
    dealSize: m.dealSize == null ? undefined : Number(m.dealSize),
    sector: (m.sector ?? []) as string[],
    source: m.source ?? "",
    dateOpened: toDate(m.dateOpened),
    ndaStatus: m.ndaStatus ?? "",
    eaStatus: m.eaStatus ?? "",
    nextAction: m.nextAction ?? "",
    notes: m.notes ?? "",
  };
  const DELETE_MANDATE = `mutation DeleteMandate($id: ID!) { deleteMandate(id: $id) { id } }`;
```
- In the header actions `<div className="flex shrink-0 gap-2">` (which currently holds `<FindProspectsButton>` + disabled Export), add:
```tsx
          <MandateFormDrawer mode="edit" initial={initial} clients={rel.clients} users={rel.users} partners={rel.partners} />
          <DeleteConfirm mutation={DELETE_MANDATE} recordId={m.id} entityLabel="mandate" redirectTo="/mandates" />
```

- [ ] **Step 2: Transaction detail**

In `src/app/(crm)/transactions/[id]/page.tsx`, mirror Step 1 with:
- imports of `relationOptions`, `TransactionFormDrawer`, `DeleteConfirm`.
- `const rel = await relationOptions();` after the fetch.
- Build `initial` with fields: `id, name, clientId, mandateId, ownerId, dealType, instrument (string[]), targetRaise (Number), sector (string[]), dateOpened (toDate)`.
- `const DELETE_TRANSACTION = \`mutation DeleteTransaction($id: ID!) { deleteTransaction(id: $id) { id } }\`;`
- In the header actions, add:
```tsx
          <TransactionFormDrawer mode="edit" initial={initial} clients={rel.clients} users={rel.users} mandates={rel.mandates} />
          <DeleteConfirm mutation={DELETE_TRANSACTION} recordId={t.id} entityLabel="transaction" redirectTo="/transactions" />
```
(Use whatever the detail page already names the record, e.g. `t`/`txn`.)

- [ ] **Step 3: Investor detail**

In `src/app/(crm)/investors/[id]/page.tsx`:
- imports of `InvestorFormDrawer`, `DeleteConfirm`.
- Build `initial` with: `id, name, investorType, website, status, sectorFocus, geographicFocus, instruments, investmentStages (string[]s), aum/ticketMin/ticketMax/targetIrr (Number|undefined), countryRestrictions, esgFocus, decisionProcess, notes (strings)`.
- `const DELETE_INVESTOR = \`mutation DeleteInvestor($id: ID!) { deleteInvestor(id: $id) { id } }\`;`
- In the header actions, add:
```tsx
          <InvestorFormDrawer mode="edit" initial={initial} />
          <DeleteConfirm mutation={DELETE_INVESTOR} recordId={inv.id} entityLabel="investor" redirectTo="/investors" />
```

- [ ] **Step 4: Partner detail**

In `src/app/(crm)/partners/[id]/page.tsx`:
- imports of `PartnerFormDrawer`, `DeleteConfirm`.
- Build `initial` with: `id, name, partnerType, profile, status, location, amount (Number|undefined)`.
- `const DELETE_PARTNER = \`mutation DeletePartner($id: ID!) { deletePartner(id: $id) { id } }\`;`
- Header actions:
```tsx
          <PartnerFormDrawer mode="edit" initial={initial} />
          <DeleteConfirm mutation={DELETE_PARTNER} recordId={p.id} entityLabel="partner" redirectTo="/partners" />
```

- [ ] **Step 5: Client detail**

In `src/app/(crm)/clients/[id]/page.tsx`:
- imports of `ClientFormDrawer`, `DeleteConfirm`.
- Build `initial` with: `id, name, yearFounded (Number|undefined), hqCity, countries (string[]), website, sector (string[]), coreProduct, description, founders, founderGender, revenueLastYear/revenueForecast (Number|undefined), profitable (boolean), existingInvestors, source, pitchDeckUrl`.
- `const DELETE_CLIENT = \`mutation DeleteClient($id: ID!) { deleteClient(id: $id) { id } }\`;`
- Header actions (add an actions container if the client detail header lacks one):
```tsx
          <ClientFormDrawer mode="edit" initial={initial} />
          <DeleteConfirm mutation={DELETE_CLIENT} recordId={c.id} entityLabel="client" redirectTo="/clients" />
```

- [ ] **Step 6: Verify in browser**

Run `corepack pnpm dev`. For each detail page: **Edit** opens a prefilled drawer that saves changes (visible after refresh); **Delete** removes a dependency-free record and routes to the list; deleting a record *with* dependents shows the guard message instead. Run `corepack pnpm exec tsc --noEmit` → PASS.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(crm)"
git commit -m "feat(crm): edit + guarded-delete on all 5 detail pages" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

## Plan B Self-Review

- **Spec coverage:** §2 layer 4 (shared plumbing) ✓ Tasks 1–4. §2 layer 5 (per-entity drawers) ✓ Tasks 6–10. §2 Wiring (list "+New" + new clients list) ✓ Tasks 11–12. §2 Wiring (detail Edit/Delete) ✓ Task 13. §3 data flow (validate → mutate → refresh) ✓ `useEntityForm`. §5 delete-guard message surfacing ✓ `DeleteConfirm`/`formError`. §7 client validation ✓ `safeParse` → field errors. §8 clients list page ✓ Task 11.
- **Type/name consistency:** every drawer imports its schema as `xCreate/UpdateSchema` (Plan A names) and uses the `XInput` GraphQL input + `createX/updateX` mutation names from Plan A; `relationOptions()` returns `{clients,users,partners,mandates}` consumed identically in Tasks 9/10/12/13; `DeleteConfirm` mutation strings match Plan A's `deleteX` returning `{ id }`.
- **Known limitations (documented, intentional):** optional fields can't be cleared in edit (pruned, not nulled); NDA/EA sent/signed date fields omitted from the Mandate form; no nested-contacts editing (out of scope per spec).
- **Dependency:** Plan A must be merged first (schemas, inputs, mutations).
- **Verification is browser-based** for UI tasks (no unit tests added in Plan B); the drawers exercise Plan A's tested mutations.

## Cross-cutting note
Every drawer talks to the same Plan-A GraphQL mutations an AI agent would call, so the human UI and AI tools stay in lockstep — and human-created records correctly carry `createdSource = HUMAN` while agent writes carry `AGENT`.
