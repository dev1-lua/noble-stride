# Spec-Gap Pass 2 — "Convert the Remaining Yellows" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement every remaining no-client-decision 🟡/❌ item from `docs/CRM-VS-BUILD-SPEC-COMPARATIVE-ANALYSIS-2026-07-06.md` per the approved design `docs/superpowers/specs/2026-07-06-spec-gap-pass-2-design.md` (workstreams A–F).

**Architecture:** Every feature follows the proven stack chain: Prisma schema → zod schema (`src/lib/schemas/*`) → Pothos input (`src/graphql/inputs.ts`) → mutation (`src/graphql/mutations.ts`) → service (`src/server/services/*`) → drawer/RSC (`src/components/crm/*`, `src/app/(crm)/*`). The §7.1 identifier audit reuses the existing `StageChange` model + `recordStageChange` helper + `stage-history.tsx` renderer (widened, not duplicated). Dashboards are plain service functions consumed directly by the RSC dashboard page (no GraphQL needed).

**Tech Stack:** Next.js 16 (App Router, RSC), Prisma + PostgreSQL (docker), Pothos GraphQL + urql, zod, vitest, Tailwind.

## Global Constraints

- **App root is `noblestride-crm/` inside the repo.** ALL file paths below are relative to `noblestride-crm/` unless prefixed `docs/`. Run all commands from `noblestride-crm/`.
- **Branch:** `test/comparisionAgainstTheBuildSpecs`. Commit frequently; never push unless asked.
- **Windows Prisma DLL quirk:** `prisma migrate dev` / `prisma generate` can fail with EPERM while the dev server (localhost:3000) holds the query-engine DLL. If a migration step hits EPERM, STOP and report to the orchestrator (who coordinates stopping/restarting the dev server) — do not retry in a loop, do not kill processes yourself.
- **Never commit `src/generated/pothos-types.ts` churn.** `prisma generate` rewrites it with a machine-specific path. Before every commit run `git diff --stat` and if `src/generated/pothos-types.ts` shows only the generator-path churn, `git checkout -- src/generated/pothos-types.ts`. (If your task legitimately changes the schema, the regenerated file may still contain ONLY path churn — Pothos types come from the `.prisma` client types, check the diff.)
- **Tests:** vitest, `fileParallelism: false`. DB-backed tests are `*.smoke.test.ts` and MUST use the `withDb` skip pattern (copy from `src/server/services/__tests__/stage-history.smoke.test.ts`). Each smoke test creates its own rows and deletes them in `finally`. Run a single file with `npx vitest run <path>`; full suite `pnpm test` (baseline 363+ passing — must stay green).
- **Typecheck:** `npx tsc --noEmit` (there is no package script). Must be clean after every task.
- **Lint baseline (pre-existing, NOT yours to fix):** errors/warnings in `clients-table.tsx`, `count-up.tsx`, `prisma/seed.ts`, `investors-crud.smoke.test.ts` (3 errors / 2 warnings). `pnpm lint` must introduce NO NEW problems.
- **Enum display labels** live in `src/lib/vocab.ts` `LABELS` (+ `options()`/`label()` helpers). New enums need: Prisma enum → `builder.enumType` ref in `src/graphql/builder.ts` → `LABELS` entry.
- Drawer forms use `useEntityForm` (`src/components/ui/use-entity-form.ts`): it **prunes** `""`/`null`/`undefined` values before zod `safeParse` and mutation submit (so `false` booleans DO get sent, empty strings do NOT). Inline GraphQL strings, `router.refresh()` on success.
- Services re-parse input with zod (`schema.parse`), throw `CrudError` (`src/server/services/crud.ts`) for domain violations; mutations are thin one-line resolvers using `args.input as never`.

---

### Task 1: Person (contact) CRUD — data layer

**Files:**
- Create: `src/lib/schemas/person.ts`
- Create: `src/server/services/persons.ts`
- Modify: `src/graphql/inputs.ts` (append `PersonInput`)
- Modify: `src/graphql/mutations.ts` (add create/update/deletePerson)
- Test: `src/server/services/__tests__/persons-crud.smoke.test.ts`

**Interfaces:**
- Consumes: `Person` Prisma model (`prisma/schema.prisma:444-470` — firstName required; lastName/email/phone/jobTitle/linkedinUrl optional; isPrimaryContact/isSSAContact booleans; optional FKs investorId/clientId/partnerId; **NO `createdSource` column** — do not try to set it). `CrudError` from `./crud`. `PersonRef` already exists in `src/graphql/types.ts:71-93` — no type changes needed.
- Produces: `createPerson(raw: unknown): Promise<Person>`, `updatePerson(id: string, raw: unknown): Promise<Person>`, `deletePerson(id: string): Promise<Person>` from `@/server/services/persons`; GraphQL mutations `createPerson(input: PersonInput!)`, `updatePerson(id: ID!, input: PersonInput!)`, `deletePerson(id: ID!)` all returning `Person`; zod schemas `personCreateSchema`/`personUpdateSchema` from `@/lib/schemas/person`. Task 2 (drawer) and Task 5 (primary-contact audit refactor) build on these exact names.

- [ ] **Step 1: Write the failing smoke test**

Create `src/server/services/__tests__/persons-crud.smoke.test.ts`:

```ts
// DB-backed smoke test for Person (contact) CRUD (spec §3.5).
// withDb pattern: skips cleanly when DATABASE_URL is unset or DB unreachable.

import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { createClient, deleteClient } from "@/server/services/clients";
import { createPerson, updatePerson, deletePerson } from "@/server/services/persons";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await fn();
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

describe("person CRUD (smoke)", () => {
  it("rejects a contact with no parent link", async () => {
    const out = await withDb(async () => {
      await expect(createPerson({ firstName: "ZZ Orphan" })).rejects.toThrow(/linked to a client/i);
      return true;
    });
    if (out === null) return;
  });

  it("creates, updates, and deletes a contact under a client", async () => {
    const out = await withDb(async () => {
      const client = await createClient({ name: "__person_crud_client__" }, { type: "HUMAN" });
      try {
        const created = await createPerson({ firstName: "ZZ", lastName: "Contact", email: "zz@x.com", clientId: client.id });
        expect(created.firstName).toBe("ZZ");
        expect(created.clientId).toBe(client.id);
        expect(created.isPrimaryContact).toBe(false);

        const updated = await updatePerson(created.id, { jobTitle: "CFO", phone: "+254700000000" });
        expect(updated.jobTitle).toBe("CFO");

        // clearing all parents on update is rejected
        await expect(updatePerson(created.id, { clientId: undefined, ...( { clientId: null } as never) })).rejects.toThrow();

        await deletePerson(created.id);
        expect(await prisma.person.findUnique({ where: { id: created.id } })).toBeNull();
      } finally {
        await prisma.person.deleteMany({ where: { clientId: client.id } });
        await deleteClient(client.id);
      }
      return true;
    });
    if (out === null) return;
  });

  it("keeps exactly one primary contact per parent", async () => {
    const out = await withDb(async () => {
      const client = await createClient({ name: "__person_primary_client__" }, { type: "HUMAN" });
      try {
        const a = await createPerson({ firstName: "ZZ A", clientId: client.id, isPrimaryContact: true });
        expect(a.isPrimaryContact).toBe(true);

        const b = await createPerson({ firstName: "ZZ B", clientId: client.id, isPrimaryContact: true });
        expect(b.isPrimaryContact).toBe(true);
        const aAfter = await prisma.person.findUniqueOrThrow({ where: { id: a.id } });
        expect(aAfter.isPrimaryContact).toBe(false);

        // promoting via update also demotes the sibling
        await updatePerson(a.id, { isPrimaryContact: true });
        const bAfter = await prisma.person.findUniqueOrThrow({ where: { id: b.id } });
        expect(bAfter.isPrimaryContact).toBe(false);
      } finally {
        await prisma.person.deleteMany({ where: { clientId: client.id } });
        await deleteClient(client.id);
      }
      return true;
    });
    if (out === null) return;
  });
});
```

Note on the "clearing all parents" assertion: zod `.partial()` makes `clientId` optional but the drawer never sends `null`; the service must still guard the merged state. If the `{ clientId: null }` cast fights the types, simplify that single assertion to call `updatePerson(created.id, { clientId: null } as never)` — the intent is: an update whose merged parents are all empty throws `CrudError`.

- [ ] **Step 2: Run the test — expect module-not-found failure**

Run: `npx vitest run src/server/services/__tests__/persons-crud.smoke.test.ts`
Expected: FAIL — cannot resolve `@/server/services/persons` / `@/lib/schemas/person`.

- [ ] **Step 3: Create the zod schema**

Create `src/lib/schemas/person.ts`:

```ts
import { z } from "zod";

export const personCreateSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().optional(),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  jobTitle: z.string().trim().optional(),
  linkedinUrl: z.string().trim().optional(),
  isPrimaryContact: z.boolean().optional(),
  isSSAContact: z.boolean().optional(),
  investorId: z.string().trim().nullish(),
  clientId: z.string().trim().nullish(),
  partnerId: z.string().trim().nullish(),
});
export const personUpdateSchema = personCreateSchema.partial();
export type PersonCreateInput = z.infer<typeof personCreateSchema>;
export type PersonUpdateInput = z.infer<typeof personUpdateSchema>;
```

(`nullish()` on the FKs so an explicit `null` can clear a link server-side without tripping validation; the drawer itself never sends null.)

- [ ] **Step 4: Create the service**

Create `src/server/services/persons.ts`:

```ts
// Person (contact) service — single source of truth over Prisma for contacts
// (spec §3.5). Thin layer: Prisma calls + domain rules only. No GraphQL, no React.
//
// Domain rules:
//   1. A contact must link to ≥1 parent (client / investor / partner) — like
//      logActivity's "at least one linked record" rule.
//   2. One primary contact per parent: setting isPrimaryContact=true demotes
//      the parent's other contacts inside the same $transaction.

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { CrudError } from "./crud";
import { personCreateSchema, personUpdateSchema } from "@/lib/schemas/person";

const PARENT_FIELDS = ["clientId", "investorId", "partnerId"] as const;
type ParentField = (typeof PARENT_FIELDS)[number];
type ParentLinks = Partial<Record<ParentField, string | null | undefined>>;

const hasParent = (p: ParentLinks) => PARENT_FIELDS.some((f) => Boolean(p[f]));

/** Demote every other primary contact of the same parent(s). */
async function demoteSiblingPrimaries(tx: Prisma.TransactionClient, parents: ParentLinks, excludeId?: string) {
  for (const field of PARENT_FIELDS) {
    const parentId = parents[field];
    if (!parentId) continue;
    await tx.person.updateMany({
      where: { [field]: parentId, isPrimaryContact: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
      data: { isPrimaryContact: false },
    });
  }
}

export async function createPerson(raw: unknown) {
  const input = personCreateSchema.parse(raw);
  if (!hasParent(input)) {
    throw new CrudError("A contact must be linked to a client, investor, or partner.");
  }
  return prisma.$transaction(async (tx) => {
    if (input.isPrimaryContact) await demoteSiblingPrimaries(tx, input);
    return tx.person.create({ data: input });
  });
}

export async function updatePerson(id: string, raw: unknown) {
  const input = personUpdateSchema.parse(raw);
  const existing = await prisma.person.findUnique({ where: { id } });
  if (!existing) throw new CrudError("Contact not found");
  const merged: ParentLinks = {
    clientId: "clientId" in input ? input.clientId : existing.clientId,
    investorId: "investorId" in input ? input.investorId : existing.investorId,
    partnerId: "partnerId" in input ? input.partnerId : existing.partnerId,
  };
  if (!hasParent(merged)) {
    throw new CrudError("A contact must remain linked to a client, investor, or partner.");
  }
  return prisma.$transaction(async (tx) => {
    if (input.isPrimaryContact) await demoteSiblingPrimaries(tx, merged, id);
    return tx.person.update({ where: { id }, data: input });
  });
}

export async function deletePerson(id: string) {
  try {
    return await prisma.person.delete({ where: { id } });
  } catch {
    throw new CrudError("Contact not found");
  }
}
```

- [ ] **Step 5: Add `PersonInput` to `src/graphql/inputs.ts`**

Append at the end of the file (no new builder imports needed — only scalars):

```ts
// Person (contact) CRUD (spec §3.5). The parent FK trio mirrors the Prisma
// model; the service enforces "at least one parent" at runtime.
export const PersonInput = builder.inputType("PersonInput", {
  fields: (t) => ({
    firstName: t.string({ required: true }),
    lastName: t.string({ required: false }),
    email: t.string({ required: false }),
    phone: t.string({ required: false }),
    jobTitle: t.string({ required: false }),
    linkedinUrl: t.string({ required: false }),
    isPrimaryContact: t.boolean({ required: false }),
    isSSAContact: t.boolean({ required: false }),
    investorId: t.id({ required: false }),
    clientId: t.id({ required: false }),
    partnerId: t.id({ required: false }),
  }),
});
```

- [ ] **Step 6: Add the mutations to `src/graphql/mutations.ts`**

Add to the existing import from `./inputs`: `PersonInput`. Add a new import:

```ts
import { createPerson, updatePerson, deletePerson } from "@/server/services/persons";
```

Add inside `builder.mutationFields((t) => ({ ... }))`, after the Task block:

```ts
  // ── Person (contacts, spec §3.5) ──
  createPerson: t.prismaField({
    type: "Person", nullable: false,
    args: { input: t.arg({ type: PersonInput, required: true }) },
    resolve: (_q, _r, args) => createPerson(args.input as never),
  }),
  updatePerson: t.prismaField({
    type: "Person", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: PersonInput, required: true }) },
    resolve: (_q, _r, args) => updatePerson(args.id, args.input as never),
  }),
  deletePerson: t.prismaField({
    type: "Person", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_q, _r, args) => deletePerson(args.id),
  }),
```

- [ ] **Step 7: Run the test — expect PASS**

Run: `npx vitest run src/server/services/__tests__/persons-crud.smoke.test.ts`
Expected: PASS (3 tests). Also run `npx tsc --noEmit` — clean.

- [ ] **Step 8: Commit**

```bash
git add src/lib/schemas/person.ts src/server/services/persons.ts src/graphql/inputs.ts src/graphql/mutations.ts "src/server/services/__tests__/persons-crud.smoke.test.ts"
git commit -m "feat(spec-gaps): Person contact CRUD data layer - zod/service/mutations, primary-contact uniqueness (A, spec 3.5)"
```

---

### Task 2: Contacts card UI — drawer + wiring on client/investor/partner detail

**Files:**
- Create: `src/components/crm/contacts-card.tsx`
- Modify: `src/app/(crm)/clients/[id]/page.tsx` (replace Contacts card, ~lines 320-363)
- Modify: `src/app/(crm)/investors/[id]/page.tsx` (replace its contacts section)
- Modify: `src/app/(crm)/partners/[id]/page.tsx` (replace Contacts card, ~lines 131-174)

**Interfaces:**
- Consumes: Task 1's `personCreateSchema`/`personUpdateSchema`, `createPerson`/`updatePerson`/`deletePerson` GraphQL mutations; `useEntityForm`, `Drawer`, `TextField`/`CheckboxField` from `src/components/ui/*`.
- Produces: `<ContactsCard contacts={ContactDTO[]} parent={{ clientId?|investorId?|partnerId? }} showSSAFlag?: boolean />` client component. Pages pass plain DTOs (no Prisma objects/Dates across the RSC→client boundary).

- [ ] **Step 1: Create `src/components/crm/contacts-card.tsx`**

```tsx
"use client";

// contacts-card.tsx — contact list card with full Person CRUD (spec §3.5).
// Client island mounted on client / investor / partner detail pages:
// "+ Add Contact" button, click-to-edit rows, delete inside the drawer.
// The parent FK is preset via the `parent` prop and never user-editable.

import { useState } from "react";
import { useMutation } from "urql";
import { useRouter } from "next/navigation";
import { Avatar, Badge, Button, Card, CardHeader, CardBody } from "@/components/ui";
import { Drawer } from "@/components/ui/drawer";
import { TextField, CheckboxField } from "@/components/ui/fields";
import { useEntityForm } from "@/components/ui/use-entity-form";
import { personCreateSchema, personUpdateSchema } from "@/lib/schemas/person";

const CREATE = `mutation CreatePerson($input: PersonInput!) { createPerson(input: $input) { id } }`;
const UPDATE = `mutation UpdatePerson($id: ID!, $input: PersonInput!) { updatePerson(id: $id, input: $input) { id } }`;
const DELETE = `mutation DeletePerson($id: ID!) { deletePerson(id: $id) { id } }`;

export interface ContactDTO {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  linkedinUrl: string | null;
  isPrimaryContact: boolean;
  isSSAContact: boolean;
}

export interface ContactParent {
  clientId?: string;
  investorId?: string;
  partnerId?: string;
}

const EMPTY: Record<string, unknown> = {
  firstName: "", lastName: "", email: "", phone: "", jobTitle: "", linkedinUrl: "",
  isPrimaryContact: false, isSSAContact: false,
};

function PersonFormDrawer({ mode, parent, initial, showSSAFlag, open, onOpenChange }: {
  mode: "create" | "edit";
  parent: ContactParent;
  initial?: Record<string, unknown> & { id?: string };
  showSSAFlag: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [, runDelete] = useMutation(DELETE);

  const f = useEntityForm({
    initial: { ...EMPTY, ...parent, ...(initial ?? {}) },
    schema: mode === "create" ? personCreateSchema : personUpdateSchema,
    createMutation: CREATE, updateMutation: UPDATE,
    mode, recordId: initial?.id as string | undefined,
    onSuccess: () => onOpenChange(false),
  });
  const v = f.values;

  async function handleDelete() {
    if (!initial?.id) return;
    setDeleteError(null);
    setDeleting(true);
    const result = await runDelete({ id: initial.id });
    setDeleting(false);
    if (result.error) {
      setDeleteError(result.error.message.replace(/^\[GraphQL\]\s*/, ""));
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Drawer
      open={open}
      onClose={() => onOpenChange(false)}
      title={mode === "create" ? "New Contact" : "Edit Contact"}
      footer={
        <div className="flex items-center justify-between gap-2">
          <div>
            {mode === "edit" && (
              <Button variant="secondary" size="sm" onClick={handleDelete} disabled={deleting || f.pending} className="!text-rose-600">
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={f.pending}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={f.submit} disabled={f.pending}>{f.pending ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="First Name" required value={v.firstName as string} onChange={(x) => f.setValue("firstName", x)} error={f.errors.firstName} />
          <TextField label="Last Name" value={v.lastName as string} onChange={(x) => f.setValue("lastName", x)} />
        </div>
        <TextField label="Job Title" value={v.jobTitle as string} onChange={(x) => f.setValue("jobTitle", x)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Email" value={v.email as string} onChange={(x) => f.setValue("email", x)} />
          <TextField label="Phone" value={v.phone as string} onChange={(x) => f.setValue("phone", x)} />
        </div>
        <TextField label="LinkedIn URL" value={v.linkedinUrl as string} onChange={(x) => f.setValue("linkedinUrl", x)} placeholder="https://linkedin.com/in/…" />
        <CheckboxField label="Primary contact" value={v.isPrimaryContact as boolean} onChange={(x) => f.setValue("isPrimaryContact", x)} />
        {showSSAFlag && (
          <CheckboxField label="SSA region contact" value={v.isSSAContact as boolean} onChange={(x) => f.setValue("isSSAContact", x)} />
        )}
        {f.formError && <p className="text-xs text-rose-600">{f.formError}</p>}
        {deleteError && <p className="text-xs text-rose-600">{deleteError}</p>}
      </div>
    </Drawer>
  );
}

export function ContactsCard({ contacts, parent, showSSAFlag = false }: {
  contacts: ContactDTO[];
  parent: ContactParent;
  showSSAFlag?: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const editing = contacts.find((c) => c.id === editId) ?? null;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">
          Contacts
          {contacts.length > 0 && <Badge tone="neutral" className="ml-2">{contacts.length}</Badge>}
        </h2>
        <Button variant="secondary" size="sm" onClick={() => setCreateOpen(true)}>+ Add Contact</Button>
      </CardHeader>
      <CardBody>
        {contacts.length === 0 ? (
          <p className="text-sm text-zinc-400">No contacts on record.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {contacts.map((contact) => (
              <li key={contact.id} className="py-3 flex items-start gap-4">
                <Avatar name={`${contact.firstName} ${contact.lastName ?? ""}`} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setEditId(contact.id)}
                      className="text-sm font-medium text-zinc-900 hover:text-accent transition-colors text-left"
                    >
                      {contact.firstName} {contact.lastName ?? ""}
                    </button>
                    {contact.isPrimaryContact && <Badge tone="neutral">Primary</Badge>}
                    {showSSAFlag && contact.isSSAContact && <Badge tone="neutral">SSA</Badge>}
                  </div>
                  {contact.jobTitle && <p className="text-xs text-zinc-500">{contact.jobTitle}</p>}
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} className="text-xs text-accent hover:underline">{contact.email}</a>
                    )}
                    {contact.phone && (
                      <a href={`tel:${contact.phone}`} className="text-xs text-zinc-500 hover:underline">{contact.phone}</a>
                    )}
                    {contact.linkedinUrl && (
                      <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">LinkedIn</a>
                    )}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setEditId(contact.id)}>Edit</Button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>

      <PersonFormDrawer mode="create" parent={parent} showSSAFlag={showSSAFlag} open={createOpen} onOpenChange={setCreateOpen} />
      {editing && (
        <PersonFormDrawer
          mode="edit"
          parent={parent}
          showSSAFlag={showSSAFlag}
          initial={{
            id: editing.id,
            firstName: editing.firstName,
            lastName: editing.lastName ?? "",
            email: editing.email ?? "",
            phone: editing.phone ?? "",
            jobTitle: editing.jobTitle ?? "",
            linkedinUrl: editing.linkedinUrl ?? "",
            isPrimaryContact: editing.isPrimaryContact,
            isSSAContact: editing.isSSAContact,
          }}
          open={editId != null}
          onOpenChange={(o) => { if (!o) setEditId(null); }}
        />
      )}
    </Card>
  );
}
```

Note: if `CardHeader` does not accept `className`, wrap the header content in a `<div className="flex items-center justify-between">` inside `CardHeader` instead — check `src/components/ui` before fighting it.

- [ ] **Step 2: Wire the client detail page**

In `src/app/(crm)/clients/[id]/page.tsx`: add import `import { ContactsCard } from "@/components/crm/contacts-card";` and REPLACE the whole `{/* Contacts — ... */} <Card>…</Card>` block (currently ~lines 320-363) with:

```tsx
      <ContactsCard
        contacts={client.contacts.map((p) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          phone: p.phone,
          jobTitle: p.jobTitle,
          linkedinUrl: p.linkedinUrl,
          isPrimaryContact: p.isPrimaryContact,
          isSSAContact: p.isSSAContact,
        }))}
        parent={{ clientId: client.id }}
      />
```

- [ ] **Step 3: Wire the partner detail page**

Same pattern in `src/app/(crm)/partners/[id]/page.tsx`: replace the Contacts `<Card>` block (~lines 131-174) with `<ContactsCard contacts={partner.contacts.map(...)} parent={{ partnerId: partner.id }} />` (identical mapping).

- [ ] **Step 4: Wire the investor detail page**

Read `src/app/(crm)/investors/[id]/page.tsx` (contacts render around lines 70, 109, 325-345 — there may be a summary count AND a card). Replace the contacts *card/list* section with `<ContactsCard contacts={investor.contacts.map(...)} parent={{ investorId: investor.id }} showSSAFlag />`. Leave any header count chips that merely display `investor.contacts.length` intact.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` → clean. Run: `pnpm lint` → no NEW problems.
If the dev server is running, load `http://localhost:3000/clients`, open a client, add a contact, edit it, mark primary, delete it — each action refreshes the list.

- [ ] **Step 6: Commit**

```bash
git add src/components/crm/contacts-card.tsx "src/app/(crm)/clients/[id]/page.tsx" "src/app/(crm)/investors/[id]/page.tsx" "src/app/(crm)/partners/[id]/page.tsx"
git commit -m "feat(spec-gaps): contacts card with add/edit/delete drawer on client/investor/partner detail (A, spec 3.5)"
```

---

### Task 3: Engagement edit drawer (§3.11)

**Files:**
- Modify: `src/lib/schemas/engagement.ts` (dates → `z.coerce.date()`)
- Create: `src/components/crm/engagement-form-drawer.tsx`
- Modify: `src/app/(crm)/engagement/[id]/page.tsx` (Edit button in header)
- Modify: `src/app/(crm)/engagement/page.tsx` + `src/components/crm/disbursement-table.tsx` (row edit)

**Interfaces:**
- Consumes: existing `updateEngagement` mutation (`updateEngagement(id: ID!, input: EngagementInput!)`) — the service (`src/server/services/engagements-crud.ts:31-66`) already recomputes `amountPending`/`year`/`quarter` over merged state and NDA-guards stage moves. **`EngagementInput` requires `transactionId` + `investorId`** (`inputs.ts:253-271`), so the drawer must always include both in its values.
- Produces: `<EngagementFormDrawer initial={...} triggerLabel? open? onOpenChange? />` editing interestLevel, ndaType, termSheetIssued/date, totalAmount, amountDisbursed, disbursementStatus, dateReceived, probability, feedback, notes. NOT editable here: `engagementStage` (stays in the restage control with its NDA guard), `amountPending`/`year`/`quarter` (server-derived).

- [ ] **Step 1: Make the engagement zod schema coerce dates**

In `src/lib/schemas/engagement.ts` change `termSheetDate: z.date().optional()` → `termSheetDate: z.coerce.date().optional()` and `dateReceived: z.date().optional()` → `dateReceived: z.coerce.date().optional()`. (The drawer submits `yyyy-mm-dd` strings; the client-side `safeParse` and the server re-parse both need coercion. `z.coerce.date()` still accepts `Date` instances, so existing callers are unaffected.)

Run: `npx vitest run src/server/services/__tests__/engagements-crud.smoke.test.ts` → still PASS.

- [ ] **Step 2: Create `src/components/crm/engagement-form-drawer.tsx`**

```tsx
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
```

- [ ] **Step 3: Mount on the engagement detail page**

In `src/app/(crm)/engagement/[id]/page.tsx`: import the drawer, build `initial` after the null-check, and add the button to the header (the header currently has no action buttons — add a `<div className="flex shrink-0 gap-2">` beside the title block, mirroring other detail pages):

```tsx
import { EngagementFormDrawer } from "@/components/crm/engagement-form-drawer";
```

```tsx
  const toDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
  const editInitial = {
    id: engagement.id,
    transactionId: engagement.transactionId,
    investorId: engagement.investorId,
    interestLevel: engagement.interestLevel ?? "",
    ndaType: engagement.ndaType ?? "",
    termSheetIssued: engagement.termSheetIssued,
    termSheetDate: toDate(engagement.termSheetDate),
    totalAmount: engagement.totalAmount == null ? undefined : Number(engagement.totalAmount),
    amountDisbursed: engagement.amountDisbursed == null ? undefined : Number(engagement.amountDisbursed),
    disbursementStatus: engagement.disbursementStatus ?? "",
    dateReceived: toDate(engagement.dateReceived),
    probability: engagement.probability == null ? undefined : Number(engagement.probability),
    feedback: engagement.feedback ?? "",
    notes: engagement.notes ?? "",
  };
```

In the header JSX (after the title `<div className="flex-1 min-w-0">…</div>`):

```tsx
        <div className="flex shrink-0 gap-2">
          <EngagementFormDrawer initial={editInitial} />
        </div>
```

- [ ] **Step 4: Row edit on the /engagement disbursement table**

`src/components/crm/disbursement-table.tsx` is server-safe and stays so — it just renders the (client) drawer per row. Extend `DisbursementRow`:

```ts
export interface DisbursementRow {
  // ...existing fields unchanged...
  /** Prebuilt EngagementFormDrawer initial (plain serializable values). */
  editInitial: Record<string, unknown> & { id: string; transactionId: string; investorId: string };
}
```

Import `import { EngagementFormDrawer } from "@/components/crm/engagement-form-drawer";`, add `<Th />` as the last header cell, and in each data row add as the last cell:

```tsx
              <Td>
                <EngagementFormDrawer initial={r.editInitial} triggerLabel="Edit" />
              </Td>
```

Add one empty `<Td />` to the totals row to keep columns aligned.

In `src/app/(crm)/engagement/page.tsx`, extend the `disbursementRows` mapping (listDisbursements already returns full engagement rows):

```tsx
  const toDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
  const disbursementRows: DisbursementRow[] = disbursements.map((eng) => ({
    id: eng.id,
    investorId: eng.investorId,
    investorName: eng.investor.name,
    transactionId: eng.transactionId,
    transactionName: eng.transaction.name,
    totalAmount: eng.totalAmount == null ? null : Number(eng.totalAmount),
    amountDisbursed: eng.amountDisbursed == null ? null : Number(eng.amountDisbursed),
    amountPending: eng.amountPending == null ? null : Number(eng.amountPending),
    disbursementStatus: eng.disbursementStatus,
    dateReceived: eng.dateReceived,
    editInitial: {
      id: eng.id,
      transactionId: eng.transactionId,
      investorId: eng.investorId,
      interestLevel: eng.interestLevel ?? "",
      ndaType: eng.ndaType ?? "",
      termSheetIssued: eng.termSheetIssued,
      termSheetDate: toDate(eng.termSheetDate),
      totalAmount: eng.totalAmount == null ? undefined : Number(eng.totalAmount),
      amountDisbursed: eng.amountDisbursed == null ? undefined : Number(eng.amountDisbursed),
      disbursementStatus: eng.disbursementStatus ?? "",
      dateReceived: toDate(eng.dateReceived),
      probability: eng.probability == null ? undefined : Number(eng.probability),
      feedback: eng.feedback ?? "",
      notes: eng.notes ?? "",
    },
  }));
```

- [ ] **Step 5: Verify**

`npx tsc --noEmit` clean; `npx vitest run src/server/services/__tests__/engagements-crud.smoke.test.ts` PASS; if dev server is up, edit an engagement's amounts on `/engagement` and confirm Pending recomputes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/schemas/engagement.ts src/components/crm/engagement-form-drawer.tsx src/components/crm/disbursement-table.tsx "src/app/(crm)/engagement/[id]/page.tsx" "src/app/(crm)/engagement/page.tsx"
git commit -m "feat(spec-gaps): engagement edit drawer on detail + disbursement rows (B, spec 3.11)"
```

---

### Task 4: §6.2 milestone write path + checklist UI

**Files:**
- Create: `src/server/services/milestones-crud.ts`
- Create: `src/components/crm/milestone-checklist.tsx`
- Modify: `src/graphql/builder.ts` (`MilestoneKeyEnum`), `src/graphql/types.ts` (`EngagementMilestoneRef`), `src/graphql/inputs.ts` (`MilestoneInput`), `src/graphql/mutations.ts` (record/unrecord)
- Modify: `src/server/services/engagements.ts` (`getEngagement` include milestones)
- Modify: `src/app/(crm)/engagement/[id]/page.tsx` (mount checklist)
- Test: `src/server/services/__tests__/milestones-crud.smoke.test.ts`

**Interfaces:**
- Consumes: `EngagementMilestone` model (`schema.prisma:746-757`, `@@unique([engagementId,key])`, has `createdSource`); `MILESTONE_ORDER`/`MILESTONE_LABELS`/`effectiveMilestones` from `src/lib/milestones.ts`; `LABELS.MilestoneKey` already in vocab.ts.
- Produces: `recordMilestone(raw: unknown, actor: Actor): Promise<EngagementMilestone>` (upsert), `unrecordMilestone(engagementId: string, key: MilestoneKey): Promise<boolean>`; GraphQL `recordMilestone(input: MilestoneInput!): EngagementMilestone`, `unrecordMilestone(engagementId: ID!, key: MilestoneKey!): Boolean!`; `<MilestoneChecklist engagementId items />` client component. The portal steppers (`milestone-stepper.tsx`, `visibility/project.ts:320-356`) read the same merged data and benefit automatically — do NOT touch them.

- [ ] **Step 1: Write the failing smoke test**

Create `src/server/services/__tests__/milestones-crud.smoke.test.ts` (copy the `withDb` helper verbatim from `stage-history.smoke.test.ts`):

```ts
// DB-backed smoke test for the EngagementMilestone write path (spec §6.2).

import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { createClient, deleteClient } from "@/server/services/clients";
import { createTransaction, deleteTransaction } from "@/server/services/transactions";
import { createEngagement } from "@/server/services/engagements-crud";
import { recordMilestone, unrecordMilestone } from "@/server/services/milestones-crud";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await fn();
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

describe("milestone record/unrecord (smoke)", () => {
  it("records (upsert), re-records with a new date, and unrecords a milestone", async () => {
    const out = await withDb(async () => {
      const client = await createClient({ name: "__milestone_client__" }, { type: "HUMAN" });
      const txn = await createTransaction({ name: "__milestone_txn__", clientId: client.id }, { type: "HUMAN" });
      const investor = await prisma.investor.create({ data: { name: "__milestone_investor__", investorType: "DFI" } });
      let engagementId: string | null = null;
      try {
        const eng = await createEngagement({ transactionId: txn.id, investorId: investor.id }, { type: "HUMAN" });
        engagementId = eng.id;

        const rec = await recordMilestone({ engagementId: eng.id, key: "TeaserReview", notes: "reviewed" }, { type: "HUMAN" });
        expect(rec.key).toBe("TeaserReview");
        expect(rec.notes).toBe("reviewed");
        expect(rec.createdSource).toBe("HUMAN");

        // upsert: same key updates the date, no duplicate row
        const newDate = new Date("2026-01-15T00:00:00Z");
        const rec2 = await recordMilestone({ engagementId: eng.id, key: "TeaserReview", completedAt: newDate }, { type: "HUMAN" });
        expect(rec2.id).toBe(rec.id);
        expect(rec2.completedAt.getTime()).toBe(newDate.getTime());
        expect(await prisma.engagementMilestone.count({ where: { engagementId: eng.id } })).toBe(1);

        expect(await unrecordMilestone(eng.id, "TeaserReview")).toBe(true);
        expect(await prisma.engagementMilestone.count({ where: { engagementId: eng.id } })).toBe(0);
        // unrecording a missing row is a no-op, not an error
        expect(await unrecordMilestone(eng.id, "TeaserReview")).toBe(false);

        await expect(recordMilestone({ engagementId: "nope", key: "TeaserReview" }, { type: "HUMAN" })).rejects.toThrow(/not found/i);
      } finally {
        if (engagementId) {
          await prisma.engagementMilestone.deleteMany({ where: { engagementId } });
          await prisma.engagement.delete({ where: { id: engagementId } });
        }
        await prisma.investor.delete({ where: { id: investor.id } });
        await deleteTransaction(txn.id);
        await deleteClient(client.id);
      }
      return true;
    });
    if (out === null) return;
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`@/server/services/milestones-crud` unresolved).

Run: `npx vitest run src/server/services/__tests__/milestones-crud.smoke.test.ts`

- [ ] **Step 3: Create the service**

Create `src/server/services/milestones-crud.ts`:

```ts
// EngagementMilestone write path (spec §6.2) — record / re-date / unrecord the
// fixed investor milestones per engagement. Display stays derived (stage-implied
// ∪ recorded, see src/lib/milestones.ts); unrecording a stage-implied milestone
// therefore does not hide it — it only removes the explicit record.

import { z } from "zod";
import { MilestoneKey } from "@prisma/client";
import { prisma } from "@/lib/db";
import { actorSource, CrudError } from "./crud";
import type { Actor } from "@/graphql/context";

const recordMilestoneSchema = z.object({
  engagementId: z.string().min(1),
  key: z.nativeEnum(MilestoneKey),
  completedAt: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
});

export async function recordMilestone(raw: unknown, actor: Actor) {
  const input = recordMilestoneSchema.parse(raw);
  const engagement = await prisma.engagement.findUnique({ where: { id: input.engagementId }, select: { id: true } });
  if (!engagement) throw new CrudError("Engagement not found");
  return prisma.engagementMilestone.upsert({
    where: { engagementId_key: { engagementId: input.engagementId, key: input.key } },
    create: {
      engagementId: input.engagementId,
      key: input.key,
      completedAt: input.completedAt ?? new Date(),
      notes: input.notes,
      createdSource: actorSource(actor),
    },
    update: {
      ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  });
}

export async function unrecordMilestone(engagementId: string, key: MilestoneKey): Promise<boolean> {
  const res = await prisma.engagementMilestone.deleteMany({ where: { engagementId, key } });
  return res.count > 0;
}
```

- [ ] **Step 4: GraphQL surface**

`src/graphql/builder.ts`: add `MilestoneKey` to the `@prisma/client` import list and register (alphabetical spot near the other exports):

```ts
export const MilestoneKeyEnum = builder.enumType(MilestoneKey, { name: "MilestoneKey" });
```

`src/graphql/types.ts`: add `MilestoneKeyEnum` to the `./builder` import and append:

```ts
// ─── EngagementMilestone ─────────────────────────────────────────────────────

export const EngagementMilestoneRef = builder.prismaObject("EngagementMilestone", {
  fields: (t) => ({
    id: t.exposeID("id"),
    engagementId: t.exposeString("engagementId"),
    key: t.field({ type: MilestoneKeyEnum, resolve: (m) => m.key }),
    completedAt: t.field({ type: "DateTime", resolve: (m) => m.completedAt }),
    notes: t.exposeString("notes", { nullable: true }),
  }),
});
```

`src/graphql/inputs.ts`: add `MilestoneKeyEnum` to the `./builder` import and append:

```ts
export const MilestoneInput = builder.inputType("MilestoneInput", {
  fields: (t) => ({
    engagementId: t.id({ required: true }),
    key: t.field({ type: MilestoneKeyEnum, required: true }),
    completedAt: t.field({ type: "DateTime", required: false }),
    notes: t.string({ required: false }),
  }),
});
```

`src/graphql/mutations.ts`: import `MilestoneKeyEnum` from `./builder`, `MilestoneInput` from `./inputs`, `recordMilestone, unrecordMilestone` from `@/server/services/milestones-crud`; add:

```ts
  // ── Engagement milestones (spec §6.2) ──
  recordMilestone: t.prismaField({
    type: "EngagementMilestone", nullable: false,
    args: { input: t.arg({ type: MilestoneInput, required: true }) },
    resolve: (_q, _r, args, ctx) => recordMilestone(args.input as never, ctx.actor),
  }),
  unrecordMilestone: t.boolean({
    nullable: false,
    args: {
      engagementId: t.arg.id({ required: true }),
      key: t.arg({ type: MilestoneKeyEnum, required: true }),
    },
    resolve: (_r, args) => unrecordMilestone(String(args.engagementId), args.key),
  }),
```

- [ ] **Step 5: Run the smoke test — expect PASS**

Run: `npx vitest run src/server/services/__tests__/milestones-crud.smoke.test.ts` → PASS. `npx tsc --noEmit` → clean.

- [ ] **Step 6: Checklist UI**

Create `src/components/crm/milestone-checklist.tsx`:

```tsx
"use client";

// milestone-checklist.tsx — internal §6.2 milestone checklist for the
// engagement detail page. Three states per milestone:
//   recorded — an EngagementMilestone row exists (date shown, editable, unrecordable)
//   implied  — no row, but the current engagementStage implies it (STAGE_MILESTONES)
//   open     — neither
// Recording writes an explicit row; unrecording removes it (stage-implied
// display elsewhere is unaffected). Portal steppers pick changes up on refresh.

import { useState } from "react";
import { useMutation } from "urql";
import { useRouter } from "next/navigation";
import { Button, Card, CardHeader, CardBody, Badge } from "@/components/ui";

const RECORD = `mutation RecordMilestone($input: MilestoneInput!) { recordMilestone(input: $input) { id } }`;
const UNRECORD = `mutation UnrecordMilestone($engagementId: ID!, $key: MilestoneKey!) { unrecordMilestone(engagementId: $engagementId, key: $key) }`;

export interface MilestoneItemDTO {
  key: string;
  label: string;
  state: "recorded" | "implied" | "open";
  /** yyyy-mm-dd when recorded, else null */
  completedAt: string | null;
}

export function MilestoneChecklist({ engagementId, items }: {
  engagementId: string;
  items: MilestoneItemDTO[];
}) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, runRecord] = useMutation(RECORD);
  const [, runUnrecord] = useMutation(UNRECORD);

  async function record(key: string, completedAt?: string) {
    setError(null);
    setPendingKey(key);
    const result = await runRecord({ input: { engagementId, key, ...(completedAt ? { completedAt } : {}) } });
    setPendingKey(null);
    if (result.error) { setError(result.error.message.replace(/^\[GraphQL\]\s*/, "")); return; }
    router.refresh();
  }

  async function unrecord(key: string) {
    setError(null);
    setPendingKey(key);
    const result = await runUnrecord({ engagementId, key });
    setPendingKey(null);
    if (result.error) { setError(result.error.message.replace(/^\[GraphQL\]\s*/, "")); return; }
    router.refresh();
  }

  const doneCount = items.filter((i) => i.state !== "open").length;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-zinc-900">
          Investor Milestones
          <Badge tone="neutral" className="ml-2">{doneCount}/{items.length}</Badge>
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Record each milestone with its date; stage-implied milestones show automatically.
        </p>
      </CardHeader>
      <CardBody>
        <ul className="divide-y divide-zinc-100">
          {items.map((m) => {
            const busy = pendingKey === m.key;
            return (
              <li key={m.key} className="flex items-center gap-3 py-2.5">
                <span
                  className={
                    "h-2.5 w-2.5 shrink-0 rounded-full " +
                    (m.state === "recorded" ? "bg-emerald-500" : m.state === "implied" ? "bg-sky-400" : "bg-zinc-200")
                  }
                />
                <span className={"flex-1 text-sm " + (m.state === "open" ? "text-zinc-500" : "font-medium text-zinc-900")}>
                  {m.label}
                </span>
                {m.state === "recorded" ? (
                  <>
                    <input
                      type="date"
                      value={m.completedAt ?? ""}
                      disabled={busy}
                      onChange={(e) => { if (e.target.value) record(m.key, e.target.value); }}
                      className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700"
                    />
                    <Button variant="secondary" size="sm" disabled={busy} onClick={() => unrecord(m.key)}>Unrecord</Button>
                  </>
                ) : (
                  <>
                    {m.state === "implied" && (
                      <span className="text-xs uppercase tracking-wide text-sky-600">Implied by stage</span>
                    )}
                    <Button variant="secondary" size="sm" disabled={busy} onClick={() => record(m.key)}>Record</Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
        {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 7: Include milestones in `getEngagement` and mount the checklist**

In `src/server/services/engagements.ts` `getEngagement`, add to the `include`: `milestones: true,`.

In `src/app/(crm)/engagement/[id]/page.tsx`:

```tsx
import { MilestoneChecklist } from "@/components/crm/milestone-checklist";
import type { MilestoneItemDTO } from "@/components/crm/milestone-checklist";
import { MILESTONE_ORDER, MILESTONE_LABELS, effectiveMilestones } from "@/lib/milestones";
```

After building `stageHistoryItems`:

```tsx
  const recordedByKey = new Map(engagement.milestones.map((m) => [m.key, m]));
  const implied = effectiveMilestones(engagement.engagementStage, []);
  const milestoneItems: MilestoneItemDTO[] = MILESTONE_ORDER.map((key) => {
    const rec = recordedByKey.get(key);
    return {
      key,
      label: MILESTONE_LABELS[key],
      state: rec ? ("recorded" as const) : implied.has(key) ? ("implied" as const) : ("open" as const),
      completedAt: rec ? rec.completedAt.toISOString().slice(0, 10) : null,
    };
  });
```

Render between the NDA card and `<StageHistory …/>`:

```tsx
      <MilestoneChecklist engagementId={engagement.id} items={milestoneItems} />
```

- [ ] **Step 8: Verify + commit**

`npx tsc --noEmit` clean; `pnpm lint` no new problems; if dev server up: open an engagement, record/unrecord a milestone, see the dot flip and the portal deal page stepper move.

```bash
git add src/server/services/milestones-crud.ts src/components/crm/milestone-checklist.tsx src/graphql/builder.ts src/graphql/types.ts src/graphql/inputs.ts src/graphql/mutations.ts src/server/services/engagements.ts "src/app/(crm)/engagement/[id]/page.tsx" "src/server/services/__tests__/milestones-crud.smoke.test.ts"
git commit -m "feat(spec-gaps): engagement milestone write path + internal checklist (C, spec 6.2)"
```

---

### Task 5: §7.1 identifier audit — StageChange extension + writes + panels

**Files:**
- Modify: `prisma/schema.prisma` (StageChange + Client/Investor/Partner relations) + new migration
- Modify: `src/server/services/stage-history.ts` (widen field union + targets)
- Modify: `src/server/services/clients.ts`, `src/server/services/investors.ts`, `src/server/services/partners.ts` (audited updates + includes)
- Modify: `src/server/services/persons.ts` (primary-contact reassignment audit)
- Modify: `src/graphql/mutations.ts` (pass `ctx.actor` to updateClient/updateInvestor/updatePartner/create+updatePerson)
- Modify: `src/components/crm/stage-history.tsx` (labels + optional stageGroup)
- Modify: `src/app/(crm)/clients/[id]/page.tsx`, `investors/[id]/page.tsx`, `partners/[id]/page.tsx` (Change History panel)
- Test: `src/server/services/__tests__/identifier-audit.smoke.test.ts`

**Interfaces:**
- Consumes: `recordStageChange(tx, { field, fromValue, toValue, actor, ...targets })` (`stage-history.ts` — no-ops when `toValue == null` or unchanged); existing StageChange writers stay untouched.
- Produces: `StageChangeField` union extended with `"name" | "registrationNo" | "primaryContact"`; `StageChangeTargets` extended with `clientId`/`investorId`/`partnerId`; `updateClient(id, input, actor?)`, `updateInvestor(id, input, actor?)`, `updatePartner(id, input, actor?)` (actor defaults `{ type: "HUMAN" }`); `createPerson(raw, actor?)`/`updatePerson(id, raw, actor?)` now take an actor. `StageHistory` accepts `stageGroup?:` (optional). Task 9's `stageChangeFeed` relies on the three new FKs.

- [ ] **Step 1: Schema + migration**

In `prisma/schema.prisma`:

1. Extend `StageChange` (after the `engagement` relation):

```prisma
  clientId      String?
  client        Client?      @relation(fields: [clientId], references: [id], onDelete: Cascade)
  investorId    String?
  investor      Investor?    @relation(fields: [investorId], references: [id], onDelete: Cascade)
  partnerId     String?
  partner       Partner?     @relation(fields: [partnerId], references: [id], onDelete: Cascade)
```

and add to its index block:

```prisma
  @@index([clientId])
  @@index([investorId])
  @@index([partnerId])
```

2. Update the `field` comment on StageChange to: `// "stage" | "dealStatus" | "engagementStage" | "dealMilestone" | "name" | "registrationNo" | "primaryContact"`.
3. Add the back-relations: `stageChanges StageChange[]` to `Client`, `Investor`, and `Partner` (next to their other relation lists).

Run (respect the DLL quirk — report EPERM to the orchestrator instead of retrying):

```bash
npx prisma migrate dev --name stage_change_identity_audit
```

Expected: new migration under `prisma/migrations/`, `prisma generate` succeeds. Then `git checkout -- src/generated/pothos-types.ts` if only path churn.

- [ ] **Step 2: Widen the stage-history helper**

In `src/server/services/stage-history.ts`:

```ts
export type StageChangeField =
  | "stage" | "dealStatus" | "engagementStage" | "dealMilestone"
  | "name" | "registrationNo" | "primaryContact";

interface StageChangeTargets {
  mandateId?: string;
  transactionId?: string;
  engagementId?: string;
  clientId?: string;
  investorId?: string;
  partnerId?: string;
}
```

(No other change — the create call spreads `...targets` already.)

- [ ] **Step 3: Write the failing audit smoke test**

Create `src/server/services/__tests__/identifier-audit.smoke.test.ts` (same `withDb` helper as Task 1's test):

```ts
// DB-backed smoke test for the §7.1 core-identifier audit: renames of
// client/investor/partner and primary-contact reassignment write StageChange rows.

import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { createClient, updateClient, deleteClient } from "@/server/services/clients";
import { createInvestor, updateInvestor, deleteInvestor } from "@/server/services/investors";
import { createPartner, updatePartner, deletePartner } from "@/server/services/partners";
import { createPerson } from "@/server/services/persons";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await fn();
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

describe("identifier audit (smoke)", () => {
  it("audits client name + registrationNo changes", async () => {
    const out = await withDb(async () => {
      const client = await createClient({ name: "__audit_client_v1__" }, { type: "HUMAN" });
      try {
        await updateClient(client.id, { name: "__audit_client_v2__", registrationNo: "C-123" }, { type: "HUMAN" });

        const nameRows = await prisma.stageChange.findMany({ where: { clientId: client.id, field: "name" } });
        expect(nameRows).toHaveLength(1);
        expect(nameRows[0].fromValue).toBe("__audit_client_v1__");
        expect(nameRows[0].toValue).toBe("__audit_client_v2__");

        // registrationNo was null before → recordStageChange (fromValue null) still writes
        const regRows = await prisma.stageChange.findMany({ where: { clientId: client.id, field: "registrationNo" } });
        expect(regRows).toHaveLength(1);
        expect(regRows[0].toValue).toBe("C-123");

        // unchanged update writes nothing new
        await updateClient(client.id, { name: "__audit_client_v2__" }, { type: "HUMAN" });
        expect(await prisma.stageChange.count({ where: { clientId: client.id, field: "name" } })).toBe(1);
      } finally {
        await prisma.stageChange.deleteMany({ where: { clientId: client.id } });
        await deleteClient(client.id);
      }
      return true;
    });
    if (out === null) return;
  });

  it("audits investor and partner renames", async () => {
    const out = await withDb(async () => {
      const investor = await createInvestor({ name: "__audit_inv_v1__", investorType: "DFI" } as never, { type: "HUMAN" });
      const partner = await createPartner({ name: "__audit_partner_v1__" }, { type: "HUMAN" });
      try {
        await updateInvestor(investor.id, { name: "__audit_inv_v2__" }, { type: "HUMAN" });
        await updatePartner(partner.id, { name: "__audit_partner_v2__" }, { type: "HUMAN" });
        const invRows = await prisma.stageChange.findMany({ where: { investorId: investor.id, field: "name" } });
        expect(invRows).toHaveLength(1);
        const partnerRows = await prisma.stageChange.findMany({ where: { partnerId: partner.id, field: "name" } });
        expect(partnerRows).toHaveLength(1);
      } finally {
        await prisma.stageChange.deleteMany({ where: { OR: [{ investorId: investor.id }, { partnerId: partner.id }] } });
        await deleteInvestor(investor.id);
        await deletePartner(partner.id);
      }
      return true;
    });
    if (out === null) return;
  });

  it("audits primary-contact reassignment against the parent", async () => {
    const out = await withDb(async () => {
      const client = await createClient({ name: "__audit_primary_client__" }, { type: "HUMAN" });
      try {
        await createPerson({ firstName: "First", lastName: "Primary", clientId: client.id, isPrimaryContact: true }, { type: "HUMAN" });
        await createPerson({ firstName: "Second", lastName: "Primary", clientId: client.id, isPrimaryContact: true }, { type: "HUMAN" });

        const rows = await prisma.stageChange.findMany({
          where: { clientId: client.id, field: "primaryContact" },
          orderBy: { changedAt: "asc" },
        });
        expect(rows).toHaveLength(2);
        expect(rows[0].fromValue).toBeNull();
        expect(rows[0].toValue).toBe("First Primary");
        expect(rows[1].fromValue).toBe("First Primary");
        expect(rows[1].toValue).toBe("Second Primary");
      } finally {
        await prisma.stageChange.deleteMany({ where: { clientId: client.id } });
        await prisma.person.deleteMany({ where: { clientId: client.id } });
        await deleteClient(client.id);
      }
      return true;
    });
    if (out === null) return;
  });
});
```

Run: `npx vitest run src/server/services/__tests__/identifier-audit.smoke.test.ts` → FAIL (updateClient takes 2 args / no audit rows).

- [ ] **Step 4: Audited updateClient / updateInvestor / updatePartner**

`src/server/services/clients.ts` — add imports `import { recordStageChange } from "./stage-history";` and replace `updateClient`:

```ts
export async function updateClient(id: string, input: ClientUpdateInput, actor: Actor = { type: "HUMAN" }) {
  const data = clientUpdateSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.client.findUniqueOrThrow({ where: { id }, select: { name: true, registrationNo: true } });
    const updated = await tx.client.update({ where: { id }, data });
    if (data.name !== undefined) {
      await recordStageChange(tx, { field: "name", fromValue: existing.name, toValue: data.name, actor, clientId: id });
    }
    if (data.registrationNo !== undefined) {
      await recordStageChange(tx, { field: "registrationNo", fromValue: existing.registrationNo, toValue: data.registrationNo, actor, clientId: id });
    }
    return updated;
  });
}
```

`src/server/services/investors.ts` — same shape for `updateInvestor` (audit `name` only, target `investorId: id`; add the `recordStageChange` import). `src/server/services/partners.ts` — same for `updatePartner` (`name`, `partnerId: id`).

`src/graphql/mutations.ts`: change the three resolvers to pass the actor, e.g. `resolve: (_q, _r, args, ctx) => updateClient(args.id, args.input as never, ctx.actor)` (same for updateInvestor/updatePartner).

- [ ] **Step 5: Primary-contact audit in the person service**

In `src/server/services/persons.ts`: add imports `import { recordStageChange } from "./stage-history";` and `import type { Actor } from "@/graphql/context";`. Replace `demoteSiblingPrimaries` with an audited reassignment and thread an actor through:

```ts
const displayName = (p: { firstName: string; lastName: string | null }) =>
  [p.firstName, p.lastName].filter(Boolean).join(" ");

/** Demote the parent's current primary and audit the handover (spec §7.1). */
async function reassignPrimary(
  tx: Prisma.TransactionClient,
  parents: ParentLinks,
  person: { id: string; firstName: string; lastName: string | null },
  actor: Actor,
) {
  for (const field of PARENT_FIELDS) {
    const parentId = parents[field];
    if (!parentId) continue;
    const prev = await tx.person.findFirst({
      where: { [field]: parentId, isPrimaryContact: true, id: { not: person.id } },
      select: { id: true, firstName: true, lastName: true },
    });
    if (prev) {
      await tx.person.update({ where: { id: prev.id }, data: { isPrimaryContact: false } });
    }
    await recordStageChange(tx, {
      field: "primaryContact",
      fromValue: prev ? displayName(prev) : null,
      toValue: displayName(person),
      actor,
      [field]: parentId,
    });
  }
}
```

`createPerson(raw: unknown, actor: Actor = { type: "HUMAN" })`: create the person FIRST inside the `$transaction`, then `if (input.isPrimaryContact) await reassignPrimary(tx, input, created, actor);` and return `created`. `updatePerson(id, raw, actor: Actor = { type: "HUMAN" })`: update first, then `if (input.isPrimaryContact) await reassignPrimary(tx, merged, updated, actor);`. (Create/update first so `id: { not: person.id }` excludes the person themselves.)

`src/graphql/mutations.ts`: pass `ctx.actor` to `createPerson`/`updatePerson`.

- [ ] **Step 6: Run the audit test — expect PASS**

Run: `npx vitest run src/server/services/__tests__/identifier-audit.smoke.test.ts` → PASS. Also rerun `npx vitest run src/server/services/__tests__/persons-crud.smoke.test.ts src/server/services/__tests__/stage-history.smoke.test.ts` → PASS.

- [ ] **Step 7: Render panels**

`src/components/crm/stage-history.tsx`:
- Add to `FIELD_LABELS`: `name: "Name", registrationNo: "Registration No.", primaryContact: "Primary Contact",`.
- Make the prop optional: `stageGroup?: "MandateStage" | "TransactionStage" | "EngagementStage";` and in `vocabGroupFor(item.field, stageGroup ?? "MandateStage")` — identity fields never hit the `"stage"` case, and unknown groups fall back to the raw value in `label()`, which is exactly right for free-text names.

Services: add `stageChanges: { orderBy: { changedAt: "desc" }, include: { changedBy: true } }` to the `include` of `getClient` (clients.ts), `getInvestor` (investors.ts), and `getPartner` (partners.ts).

Pages — in each of `clients/[id]/page.tsx`, `investors/[id]/page.tsx`, `partners/[id]/page.tsx`, import `StageHistory`/`StageHistoryItem` (see `engagement/[id]/page.tsx:10-11` for the import shape), map:

```tsx
  const changeHistoryItems: StageHistoryItem[] = (client.stageChanges ?? []).map((s) => ({
    id: s.id,
    field: s.field,
    fromValue: s.fromValue,
    toValue: s.toValue,
    changedAt: s.changedAt,
    changedByName: s.changedBy?.name,
    createdSource: s.createdSource,
  }));
```

(substitute `investor.`/`partner.` accordingly) and render near the bottom of each page:

```tsx
      <StageHistory title="Change History" items={changeHistoryItems} />
```

- [ ] **Step 8: Verify + commit**

`npx tsc --noEmit` clean; `pnpm test` fully green; `pnpm lint` no new problems.

```bash
git add prisma/schema.prisma prisma/migrations src/server/services/stage-history.ts src/server/services/clients.ts src/server/services/investors.ts src/server/services/partners.ts src/server/services/persons.ts src/graphql/mutations.ts src/components/crm/stage-history.tsx "src/app/(crm)/clients/[id]/page.tsx" "src/app/(crm)/investors/[id]/page.tsx" "src/app/(crm)/partners/[id]/page.tsx" "src/server/services/__tests__/identifier-audit.smoke.test.ts"
git commit -m "feat(spec-gaps): core-identifier audit - StageChange client/investor/partner FKs, rename+primary-contact writes, change-history panels (E, spec 7.1)"
```

---

### Task 6: Immutability — dateOpened / source locked once set (§7.1)

**Files:**
- Modify: `src/server/services/mandates.ts` (`updateMandate` guards)
- Modify: `src/server/services/transactions.ts` (`updateTransaction` guard)
- Modify: `src/components/ui/fields.tsx` (`disabled` on SelectField/DateField)
- Modify: `src/components/crm/mandate-form-drawer.tsx`, `src/components/crm/transaction-form-drawer.tsx` (disabled fields in edit mode)
- Test: `src/server/services/__tests__/immutability.smoke.test.ts`

**Interfaces:**
- Consumes: existing `updateMandate(id, input, actor?)` / `updateTransaction(id, input, actor?)` `$transaction` bodies (they already `findUniqueOrThrow` — just widen the `select`).
- Produces: server rejects (CrudError) any CHANGE to `Mandate.dateOpened`, `Mandate.source`, `Transaction.dateOpened` once non-null. **Setting a currently-null value stays allowed** (legacy imports have nulls). **Re-sending the identical value stays allowed** (drawers submit all seeded fields on every save — compare with `getTime()` for dates, `===` for the source enum). `SelectField`/`DateField` gain `disabled?: boolean`.

- [ ] **Step 1: Write the failing smoke test**

Create `src/server/services/__tests__/immutability.smoke.test.ts` (same `withDb` helper):

```ts
// DB-backed smoke test: Mandate.dateOpened/source and Transaction.dateOpened
// are immutable once set (spec §7.1) — set-when-null OK, identical resend OK,
// change rejected.

import { describe, it, expect } from "vitest";
import { createClient, deleteClient } from "@/server/services/clients";
import { createMandate, updateMandate, deleteMandate } from "@/server/services/mandates";
import { createTransaction, updateTransaction, deleteTransaction } from "@/server/services/transactions";
import { prisma } from "@/lib/db";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await fn();
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

describe("identifier immutability (smoke)", () => {
  it("locks Mandate.dateOpened and Mandate.source once set", async () => {
    const out = await withDb(async () => {
      const client = await createClient({ name: "__immutable_mandate_client__" }, { type: "HUMAN" });
      const mandate = await createMandate({ name: "__immutable_mandate__", clientId: client.id }, { type: "HUMAN" });
      try {
        const d1 = new Date("2026-01-01T00:00:00Z");
        // setting a null value is allowed
        await updateMandate(mandate.id, { dateOpened: d1, source: "Referral" }, { type: "HUMAN" });
        // re-sending the identical values is allowed (drawers resend everything)
        await updateMandate(mandate.id, { dateOpened: d1, source: "Referral" }, { type: "HUMAN" });
        // changing either is rejected
        await expect(
          updateMandate(mandate.id, { dateOpened: new Date("2026-02-02T00:00:00Z") }, { type: "HUMAN" }),
        ).rejects.toThrow(/locked once set/i);
        await expect(
          updateMandate(mandate.id, { source: "Email" }, { type: "HUMAN" }),
        ).rejects.toThrow(/locked once set/i);
      } finally {
        await prisma.stageChange.deleteMany({ where: { mandateId: mandate.id } });
        await deleteMandate(mandate.id);
        await deleteClient(client.id);
      }
      return true;
    });
    if (out === null) return;
  });

  it("locks Transaction.dateOpened once set", async () => {
    const out = await withDb(async () => {
      const client = await createClient({ name: "__immutable_txn_client__" }, { type: "HUMAN" });
      const txn = await createTransaction({ name: "__immutable_txn__", clientId: client.id }, { type: "HUMAN" });
      try {
        const d1 = new Date("2026-01-01T00:00:00Z");
        await updateTransaction(txn.id, { dateOpened: d1 }, { type: "HUMAN" });
        await updateTransaction(txn.id, { dateOpened: d1 }, { type: "HUMAN" });
        await expect(
          updateTransaction(txn.id, { dateOpened: new Date("2026-03-03T00:00:00Z") }, { type: "HUMAN" }),
        ).rejects.toThrow(/locked once set/i);
      } finally {
        await prisma.stageChange.deleteMany({ where: { transactionId: txn.id } });
        await deleteTransaction(txn.id);
        await deleteClient(client.id);
      }
      return true;
    });
    if (out === null) return;
  });
});
```

Run: `npx vitest run src/server/services/__tests__/immutability.smoke.test.ts` → FAIL (updates succeed).

- [ ] **Step 2: Server guards**

`src/server/services/mandates.ts` `updateMandate` — widen the existing select and add the guards immediately after `findUniqueOrThrow`:

```ts
export async function updateMandate(id: string, input: MandateUpdateInput, actor: Actor = { type: "HUMAN" }) {
  const data = mandateUpdateSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.mandate.findUniqueOrThrow({
      where: { id },
      select: { dealStatus: true, dateOpened: true, source: true },
    });
    if (
      data.dateOpened !== undefined &&
      existing.dateOpened != null &&
      data.dateOpened.getTime() !== existing.dateOpened.getTime()
    ) {
      throw new CrudError("Date opened is locked once set (spec §7.1: creation date is immutable).");
    }
    if (data.source !== undefined && existing.source != null && data.source !== existing.source) {
      throw new CrudError("Source is locked once set (spec §7.1: originating source is immutable).");
    }
    const updated = await tx.mandate.update({ where: { id }, data });
    if (data.dealStatus !== undefined) {
      await recordStageChange(tx, { field: "dealStatus", fromValue: existing.dealStatus, toValue: data.dealStatus, actor, mandateId: id });
    }
    return updated;
  });
}
```

`src/server/services/transactions.ts` `updateTransaction` — add `dateOpened: true` to the select and, right after `findUniqueOrThrow`:

```ts
    if (
      data.dateOpened !== undefined &&
      existing.dateOpened != null &&
      data.dateOpened.getTime() !== existing.dateOpened.getTime()
    ) {
      throw new CrudError("Date opened is locked once set (spec §7.1: creation date is immutable).");
    }
```

- [ ] **Step 3: Run — expect PASS**

`npx vitest run src/server/services/__tests__/immutability.smoke.test.ts` → PASS. Also `npx vitest run src/server/__tests__/mandates-crud.smoke.test.ts src/server/__tests__/transactions-crud.smoke.test.ts` → still PASS (if either legitimately changes `dateOpened` on an already-set value, fix the TEST expectation to match the new rule and note it in the commit message).

- [ ] **Step 4: Disabled form fields**

`src/components/ui/fields.tsx` — add pass-through `disabled`:

```tsx
export function SelectField({ label, value, onChange, options, error, required, placeholder, disabled }: {
  label: string; value?: string; onChange: (v: string) => void; options: SelectOption[];
  error?: string; required?: boolean; placeholder?: string; disabled?: boolean;
}) {
  return (
    <Select
      label={labelText(label, required)}
      value={value ?? ""}
      onChange={onChange}
      options={options}
      placeholder={placeholder ?? "Select…"}
      error={error}
      disabled={disabled}
    />
  );
}
```

```tsx
export function DateField({ label, value, onChange, error, disabled }: {
  label: string; value?: string; onChange: (v: string) => void; error?: string; disabled?: boolean;
}) {
  // value is a yyyy-mm-dd string
  return (
    <Input label={label} type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} error={error} disabled={disabled} />
  );
}
```

(`Select` and `Input` both already accept `disabled` — the log dialog uses it.)

`src/components/crm/mandate-form-drawer.tsx` — after `const v = f.values;` add:

```tsx
  const lockDateOpened = mode === "edit" && Boolean(initial?.dateOpened);
  const lockSource = mode === "edit" && Boolean(initial?.source);
```

then set `disabled={lockSource}` on the Source `SelectField` and `disabled={lockDateOpened}` on the Date Opened `DateField`, and add below the Date Opened field:

```tsx
          {(lockDateOpened || lockSource) && (
            <p className="text-xs text-zinc-400">Date opened and source are locked once set.</p>
          )}
```

`src/components/crm/transaction-form-drawer.tsx` — same for `dateOpened` only (`lockDateOpened`, `disabled` on its DateField, hint text "Date opened is locked once set.").

- [ ] **Step 5: Verify + commit**

`npx tsc --noEmit` clean; `pnpm lint` no new problems.

```bash
git add src/server/services/mandates.ts src/server/services/transactions.ts src/components/ui/fields.tsx src/components/crm/mandate-form-drawer.tsx src/components/crm/transaction-form-drawer.tsx "src/server/services/__tests__/immutability.smoke.test.ts"
git commit -m "feat(spec-gaps): dateOpened/source immutable once set - server guards + disabled edit fields (E, spec 7.1)"
```

---

### Task 7: Field-sweep migration — Profitability, founderGenders[], Document.mandateId, Transaction.referredById, Transaction↔ServiceProvider

**Files:**
- Modify: `prisma/schema.prisma` + hand-edited migration (data-preserving)
- Modify: `src/graphql/builder.ts` (`ProfitabilityEnum`), `src/lib/vocab.ts` (labels)
- Modify: `src/lib/schemas/client.ts`, `src/lib/schemas/transaction.ts`, `src/lib/schemas/document.ts`
- Modify: `src/graphql/inputs.ts` (ClientInput/TransactionInput/DocumentInput), `src/graphql/queries.ts` (documents mandateId arg)
- Modify: `src/server/services/transactions.ts` (serviceProviders connect/set, referredBy include), `src/server/services/documents.ts` (mandateId filter), `src/server/services/relation-options.ts` (serviceProviders)
- Modify: `src/components/crm/client-form-drawer.tsx`, `transaction-form-drawer.tsx`, `document-form-drawer.tsx`
- Modify: `src/app/(crm)/clients/[id]/page.tsx`, `transactions/[id]/page.tsx`, `mandates/[id]/page.tsx`, plus every reader of `profitable`/`founderGender` (grep — includes `prisma/seed.ts`, possibly `src/server/visibility/*`, tests) and every mount-site of the changed drawers (grep)
- Test: extend `src/server/__tests__/transactions-crud.smoke.test.ts` (service-provider linking) — plus existing suites guard the rename

**Interfaces:**
- Consumes: existing `FounderGender` enum (reused for the array), `TransactionServiceProviders` implicit m-n relation (schema:686/882), `Mandate.referredBy` pattern (schema:629-630) mirrored onto Transaction.
- Produces: `Client.profitability: Profitability?` (enum `Profitability { Profitable, LossMaking }`) REPLACES `Client.profitable`; `Client.founderGenders: FounderGender[]` REPLACES `Client.founderGender`; `Document.mandateId` FK (+ `Mandate.documents`); `Transaction.referredById` FK → Partner (relation `"PartnerTransactionReferral"`, + `Partner.referredTransactions`); `TransactionInput.serviceProviderIds: [ID]` → connect/set; `relationOptions()` gains `serviceProviders`. Task 8/9 and all UI use the NEW field names.

- [ ] **Step 1: Schema edits**

In `prisma/schema.prisma`:

1. Add after the `ImpactFlag` enum:

```prisma
enum Profitability {
  Profitable
  LossMaking
}
```

2. In `Client`: replace `profitable Boolean?` with `profitability Profitability?` and replace `founderGender FounderGender?` with `founderGenders FounderGender[] @default([])`.
3. In `Document`: after the `investor` relation add:

```prisma
  mandateId     String?
  mandate       Mandate?            @relation(fields: [mandateId], references: [id], onDelete: SetNull)
```

and `@@index([mandateId])` in its index block. In `Mandate`, add `documents Document[]` to the relation list.
4. In `Transaction`: after the `assistant` relation add:

```prisma
  referredById String?
  referredBy   Partner?     @relation("PartnerTransactionReferral", fields: [referredById], references: [id], onDelete: SetNull)
```

In `Partner`, add `referredTransactions Transaction[] @relation("PartnerTransactionReferral")`.

- [ ] **Step 2: Data-preserving migration**

```bash
npx prisma migrate dev --create-only --name field_sweep_profitability_founders_docs_referrer
```

Open the generated `prisma/migrations/<timestamp>_field_sweep_profitability_founders_docs_referrer/migration.sql` and REPLACE the destructive `Client` statements (Prisma will have generated plain DROP/ADD) with this data-preserving version — keep the Document/Transaction statements Prisma generated (they're additive; verify they match):

```sql
-- Profitability picklist replaces Client.profitable boolean (spec §3.1)
CREATE TYPE "Profitability" AS ENUM ('Profitable', 'LossMaking');
ALTER TABLE "Client" ADD COLUMN "profitability" "Profitability";
UPDATE "Client" SET "profitability" =
  CASE WHEN "profitable" IS TRUE  THEN 'Profitable'::"Profitability"
       WHEN "profitable" IS FALSE THEN 'LossMaking'::"Profitability"
  END;
ALTER TABLE "Client" DROP COLUMN "profitable";

-- founderGender -> founderGenders multi-select (spec §3.1: Multi)
ALTER TABLE "Client" ADD COLUMN "founderGenders" "FounderGender"[] NOT NULL DEFAULT ARRAY[]::"FounderGender"[];
UPDATE "Client" SET "founderGenders" = ARRAY["founderGender"]::"FounderGender"[] WHERE "founderGender" IS NOT NULL;
ALTER TABLE "Client" DROP COLUMN "founderGender";

-- Document -> Mandate link (spec §3.9 linked record = Deal)
ALTER TABLE "Document" ADD COLUMN "mandateId" TEXT;
ALTER TABLE "Document" ADD CONSTRAINT "Document_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Document_mandateId_idx" ON "Document"("mandateId");

-- Transaction consultant/referrer (spec §3.2), mirroring Mandate.referredBy
ALTER TABLE "Transaction" ADD COLUMN "referredById" TEXT;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

Apply: `npx prisma migrate dev` (DLL quirk applies — report EPERM to the orchestrator). Verify with a quick `npx prisma db pull --print | Select-String profitability` or by checking `npx tsc --noEmit` after regeneration. Revert `src/generated/pothos-types.ts` if only path churn.

- [ ] **Step 3: Enum plumbing + zod + inputs**

`src/graphql/builder.ts`: add `Profitability` to the `@prisma/client` import; add `export const ProfitabilityEnum = builder.enumType(Profitability, { name: "Profitability" });`.

`src/lib/vocab.ts` LABELS (after `ImpactFlag`): `Profitability: { Profitable: "Profitable", LossMaking: "Loss-making" },`.

`src/lib/schemas/client.ts`: import `Profitability`; replace `founderGender: z.nativeEnum(FounderGender).optional(),` with `founderGenders: z.array(z.nativeEnum(FounderGender)).optional(),` and `profitable: z.boolean().optional(),` with `profitability: z.nativeEnum(Profitability).optional(),`.

`src/graphql/inputs.ts` ClientInput: replace `founderGender`/`profitable` fields with:

```ts
    founderGenders: t.field({ type: [FounderGenderEnum], required: false }),
    profitability: t.field({ type: ProfitabilityEnum, required: false }),
```

(add `ProfitabilityEnum` to the builder import).

`src/lib/schemas/transaction.ts`: add `referredById: z.string().trim().optional(),` and `serviceProviderIds: z.array(z.string()).optional(),`.

`src/graphql/inputs.ts` TransactionInput: add `referredById: t.id({ required: false }),` and `serviceProviderIds: t.field({ type: ["ID"], required: false }),`.

`src/lib/schemas/document.ts`: add `mandateId: z.string().trim().optional(),`. `src/graphql/inputs.ts` DocumentInput: add `mandateId: t.id({ required: false }),`.

- [ ] **Step 4: Service updates**

`src/server/services/transactions.ts`:

```ts
export async function createTransaction(input: TransactionCreateInput, actor: Actor) {
  const { serviceProviderIds, ...data } = transactionCreateSchema.parse(input);
  return prisma.transaction.create({
    data: {
      ...data,
      createdSource: actorSource(actor),
      ...(serviceProviderIds ? { serviceProviders: { connect: serviceProviderIds.map((id) => ({ id })) } } : {}),
    },
  });
}
```

In `updateTransaction`, destructure the same way (`const { serviceProviderIds, ...data } = transactionUpdateSchema.parse(input);`) and change the update call to:

```ts
    const updated = await tx.transaction.update({
      where: { id },
      data: {
        ...data,
        ...(serviceProviderIds ? { serviceProviders: { set: serviceProviderIds.map((spId) => ({ id: spId })) } } : {}),
      },
    });
```

Add `referredBy: true,` to `getTransaction`'s include.

`src/server/services/documents.ts`: read the file; extend its list filter interface + `where` with `mandateId?: string` exactly like the existing `transactionId` handling.

`src/graphql/queries.ts` `documents` query (~line 429): add `mandateId: t.arg.id({ required: false }),` and pass `mandateId: args.mandateId ?? undefined` through to `listDocuments`.

`src/server/services/relation-options.ts`: add `serviceProviders: RelationOption[]` to the interface, add `prisma.serviceProvider.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })` to the `Promise.all`, and map it into the return.

- [ ] **Step 5: Update ALL readers of the renamed client fields**

Run: `grep -rn "profitable\|founderGender" src prisma --include="*.ts" --include="*.tsx"` (from `noblestride-crm/`). Every hit must move to `profitability`/`founderGenders`. Known sites:

- `src/components/crm/client-form-drawer.tsx`: EMPTY gets `profitability: "", founderGenders: []` (remove `profitable: false`, `founderGender: ""`); replace the Founder Gender `SelectField` with `<MultiSelectField label="Founders' Gender" value={v.founderGenders as string[]} onChange={(x) => f.setValue("founderGenders", x)} options={options("FounderGender")} />`; replace the `<CheckboxField label="Profitable" …/>` with `<SelectField label="Profitability" value={v.profitability as string} onChange={(x) => f.setValue("profitability", x)} options={options("Profitability")} />`.
- `src/app/(crm)/clients/[id]/page.tsx`: `initial` — replace `founderGender: c.founderGender ?? ""` with `founderGenders: (c.founderGenders ?? []) as string[]` and `profitable: c.profitable ?? false` with `profitability: c.profitability ?? ""`. Display — replace the Founder Gender `<div>` with one mapping `c.founderGenders` (`(c.founderGenders ?? []).map((g: string) => label("FounderGender", g)).join(", ")`, render when non-empty, `dt` text "Founders' Gender"); replace the Profitable `<div>` with `{c.profitability && (<div><dt …>Profitability</dt><dd …>{label("Profitability", c.profitability)}</dd></div>)}`.
- `prisma/seed.ts`: update seeded clients (`profitable: true` → `profitability: "Profitable"`, `profitable: false` → `profitability: "LossMaking"`, `founderGender: "Male"` → `founderGenders: ["Male"]`, etc.). Seed file has pre-existing lint errors — don't fix those, only rename fields.
- Any `src/server/visibility/*`, portal pages, or tests that project these fields (grep will find them) — rename mechanically.

- [ ] **Step 6: Expose the new Transaction + Document fields in UI**

`src/components/crm/transaction-form-drawer.tsx`: add props `partners: SelectOption[]` and `serviceProviders: SelectOption[]`; EMPTY gets `referredById: "", serviceProviderIds: []`; after the Assistant RelationSelect add:

```tsx
          <RelationSelect label="Referred By (Consultant/Partner)" value={v.referredById as string} onChange={(x) => f.setValue("referredById", x)} options={partners} placeholder="Select partner…" />
          <MultiSelectField label="Service Providers Engaged" value={v.serviceProviderIds as string[]} onChange={(x) => f.setValue("serviceProviderIds", x)} options={serviceProviders} />
```

Then `grep -rn "TransactionFormDrawer" src --include="*.tsx"` and update EVERY mount site to pass `partners={rel.partners} serviceProviders={rel.serviceProviders}` (the transactions list page and `transactions/[id]/page.tsx`; both already call `relationOptions()`). On `transactions/[id]/page.tsx` also extend `initial` with `referredById: txn.referredById ?? "", serviceProviderIds: (txn.serviceProviders ?? []).map((sp: { id: string }) => sp.id),`, delete the stale "read-only: TransactionInput has no connect/disconnect" comment above the Service Providers card, and add a Deal Facts row:

```tsx
              {txn.referredBy && (
                <div>
                  <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Referred By</dt>
                  <dd className="mt-1 text-sm text-zinc-900">
                    <Link href={`/partners/${txn.referredBy.id}`} className="hover:text-accent transition-colors">{txn.referredBy.name}</Link>
                  </dd>
                </div>
              )}
```

`src/components/crm/document-form-drawer.tsx`: add prop `mandates: SelectOption[]`; EMPTY gets `mandateId: ""`; in the Linked Record section add `<RelationSelect label="Mandate" value={v.mandateId as string} onChange={(x) => f.setValue("mandateId", x)} options={mandates} placeholder="Select mandate…" />` next to Transaction. `grep -rn "DocumentFormDrawer" src` and pass `mandates={rel.mandates}` at every mount (documents page; anywhere else grep finds).

`src/app/(crm)/mandates/[id]/page.tsx`: read the page; fetch documents (add `import { listDocuments } from "@/server/services/documents";` and `const documents = await listDocuments({ mandateId: id });` after the mandate null-check, or into an existing `Promise.all`), import `formatDate` from `@/lib/format` if not present, and add this card before the page's StageHistory/timeline section:

```tsx
      {/* Documents linked to this deal (spec §3.9 linked record = Deal) */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-zinc-900">
            Documents
            {documents.length > 0 && <Badge tone="neutral" className="ml-2">{documents.length}</Badge>}
          </h2>
        </CardHeader>
        <CardBody>
          {documents.length === 0 ? (
            <p className="text-sm text-zinc-400">No documents linked to this mandate.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {documents.map((doc) => (
                <li key={doc.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    {doc.fileUrl ? (
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-zinc-900 hover:text-accent transition-colors truncate block">
                        {doc.name}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-zinc-900 truncate">{doc.name}</p>
                    )}
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {doc.version ? `${doc.version} · ` : ""}
                      Uploaded {formatDate(doc.uploadedAt)}
                      {doc.uploadedBy?.name ? ` by ${doc.uploadedBy.name}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Chip value={doc.type} group="DocumentType" />
                    <Chip value={doc.accessLevel} group="DocumentAccessLevel" />
                    {doc.status && <Chip value={doc.status} group="DocumentStatus" />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
```

(Check `Card/CardHeader/CardBody/Badge/Chip` are already imported on the mandate page — they almost certainly are; if `listDocuments` returns `uploadedBy` only with an include, match whatever filter/include shape `listDocuments` has after your documents.ts change — the transaction page uses the same call, copy its behavior.)

- [ ] **Step 7: Test the service-provider linking**

Append to `src/server/__tests__/transactions-crud.smoke.test.ts` (reuse its existing `withDb` helper and imports):

```ts
describe("transaction service-provider linking (smoke)", () => {
  it("connects on create and replaces via set on update", async () => {
    const out = await withDb(async () => {
      const client = await createClient({ name: "__txn_sp_client__" }, { type: "HUMAN" });
      const spA = await prisma.serviceProvider.create({ data: { name: "__sp_a__", type: "Audit" } });
      const spB = await prisma.serviceProvider.create({ data: { name: "__sp_b__", type: "LawFirm" } });
      let txnId: string | null = null;
      try {
        const txn = await createTransaction(
          { name: "__txn_sp__", clientId: client.id, serviceProviderIds: [spA.id] } as never,
          { type: "HUMAN" },
        );
        txnId = txn.id;
        let linked = await prisma.transaction.findUniqueOrThrow({ where: { id: txn.id }, include: { serviceProviders: true } });
        expect(linked.serviceProviders.map((s) => s.id)).toEqual([spA.id]);

        await updateTransaction(txn.id, { serviceProviderIds: [spB.id] } as never, { type: "HUMAN" });
        linked = await prisma.transaction.findUniqueOrThrow({ where: { id: txn.id }, include: { serviceProviders: true } });
        expect(linked.serviceProviders.map((s) => s.id)).toEqual([spB.id]);
      } finally {
        if (txnId) await deleteTransaction(txnId);
        await prisma.serviceProvider.deleteMany({ where: { id: { in: [spA.id, spB.id] } } });
        await deleteClient(client.id);
      }
      return true;
    });
    if (out === null) return;
  });
});
```

(Adjust imports to whatever that file already imports — it has `createTransaction`/`updateTransaction`/`deleteTransaction`/`createClient`/`deleteClient`/`prisma` already or add them.)

- [ ] **Step 8: Verify + commit**

Run: `npx vitest run src/server/__tests__/transactions-crud.smoke.test.ts` → PASS. `pnpm test` fully green (this catches any missed `profitable`/`founderGender` reader). `npx tsc --noEmit` clean. `pnpm lint` no new problems. Re-seed check NOT required (seed only runs on demand).

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed.ts src/graphql src/lib src/server src/components src/app
git commit -m "feat(spec-gaps): field sweep - Profitability enum, founderGenders multi, Document<->Mandate, Transaction referrer + service-provider linking (F, spec 3.1/3.2/3.7/3.9)"
```

(Use `git status` first and stage precisely what changed; the wildcard dirs above are indicative.)

---

### Task 8: Small-surface sweep — task-from-communication, valuation conditionality, SSA contact, required summary, years of operation

**Files:**
- Modify: `src/lib/schemas/activity.ts`, `src/graphql/inputs.ts` (LogActivityInput subject required), `src/components/crm/log-engagement-dialog.tsx`
- Modify: `src/components/crm/activity-timeline.tsx` (+ per-activity task creation & linked-task display)
- Modify: `src/server/services/clients.ts`, `transactions.ts`, `engagements.ts`, `src/server/services/activities.ts` (activity includes gain `tasks`)
- Modify: `src/app/(crm)/clients/[id]/page.tsx`, `transactions/[id]/page.tsx`, `engagement/[id]/page.tsx`, `engagement/page.tsx` (pass task options + task links)
- Modify: `src/lib/milestones.ts` (`visiblePrepMilestones`), `src/components/crm/prep-milestones.tsx`, `transactions/[id]/page.tsx` (financingType)
- Modify: `src/components/crm/investor-form-drawer.tsx`, `src/app/(crm)/investors/[id]/page.tsx` (ssaRegionContact)
- Test: `src/lib/__tests__/milestones.test.ts` (create if absent), `src/server/services/__tests__/log-activity.smoke.test.ts` (extend)

**Interfaces:**
- Consumes: `TaskInput.activityId` already exists (`inputs.ts:228`) and `TaskFormDrawer` already accepts any `initial` values incl. `activityId` (no visible field); `Activity.tasks` relation `"ActivityTasks"` (schema:821); `Investor.ssaRegionContactId` already in schema/zod/InvestorInput (schema:525-526, inputs.ts:64) — only the UI is missing; `PREP_MILESTONES` (milestones.ts:89-95); `Transaction.financingType`.
- Produces: `logActivitySchema.subject` required (min 1); `visiblePrepMilestones(financingType?: string | null)` exported from `src/lib/milestones.ts`; `ActivityTimelineItem` gains `links?` + `tasks?`; `ActivityTimeline` gains `taskOptions?` prop enabling a per-row "+ Task" drawer.

- [ ] **Step 1: Required summary (spec §3.10) — failing test first**

In `src/server/services/__tests__/log-activity.smoke.test.ts` (read it; reuse its helpers) add a test:

```ts
  it("rejects logActivity without a subject (spec §3.10 summary required)", async () => {
    const out = await withDb(async () => {
      const client = await createClient({ name: "__log_subject_client__" }, { type: "HUMAN" });
      try {
        await expect(
          logActivity({ type: "Note", clientId: client.id } as never, { type: "HUMAN" }),
        ).rejects.toThrow();
      } finally {
        await deleteClient(client.id);
      }
      return true;
    });
    if (out === null) return;
  });
```

Run: `npx vitest run src/server/services/__tests__/log-activity.smoke.test.ts` → the new test FAILS (subject optional). **Check the existing tests in that file — any that log without a subject must be updated to pass one (they're now exercising the new rule).**

Then in `src/lib/schemas/activity.ts` change `subject: z.string().trim().optional(),` → `subject: z.string().trim().min(1, "Summary is required"),` and update the file's header comment. In `src/graphql/inputs.ts` LogActivityInput change `subject: t.string({ required: false }),` → `subject: t.string({ required: true }),`.

In `src/components/crm/log-engagement-dialog.tsx`: in `validate()` add as the second check `if (!subject.trim()) return "Subject is required.";` and change the Subject `<Input label="Subject" …/>` to `label="Subject *"`. (This enforces it client-side for BOTH write paths; server-side the rule applies to `logActivity` — `logEngagement`'s signature is unchanged.)

Re-run the smoke file → PASS. `npx tsc --noEmit` → clean (fix any other `logActivity` caller the compiler flags — grep `logActivity(` if unsure).

- [ ] **Step 2: Valuation conditionality (§6.1) — pure test first**

Check for `src/lib/__tests__/milestones.test.ts`; create if absent:

```ts
import { describe, it, expect } from "vitest";
import { visiblePrepMilestones, PREP_MILESTONES } from "@/lib/milestones";

describe("visiblePrepMilestones (spec §6.1)", () => {
  it("hides the Valuation row for Debt deals only", () => {
    expect(visiblePrepMilestones("Debt").map((m) => m.key)).not.toContain("Valuation");
    expect(visiblePrepMilestones("Equity").map((m) => m.key)).toContain("Valuation");
    expect(visiblePrepMilestones("EquityAndDebt").map((m) => m.key)).toContain("Valuation");
    expect(visiblePrepMilestones(null)).toEqual([...PREP_MILESTONES]);
    expect(visiblePrepMilestones(undefined)).toEqual([...PREP_MILESTONES]);
  });
});
```

Run → FAIL (no export). Add to `src/lib/milestones.ts` (after `PREP_MILESTONES`):

```ts
/** §6.1: the valuation report applies to equity deals — hidden when the deal is Debt-only. */
export function visiblePrepMilestones(financingType?: string | null) {
  return PREP_MILESTONES.filter((m) => !(financingType === "Debt" && m.key === "Valuation"));
}
```

Run → PASS.

Update `src/components/crm/prep-milestones.tsx`: import `visiblePrepMilestones` instead of `PREP_MILESTONES`, change the signature to `export function PrepMilestones({ docTypes, financingType }: { docTypes: string[]; financingType?: string | null })` and map over `visiblePrepMilestones(financingType)`.

Update `src/app/(crm)/transactions/[id]/page.tsx`: pass `financingType={txn.financingType}` to `<PrepMilestones …/>`, and change the Deal Preparation badge count (~lines 405-408) to use the same filtered list:

```tsx
import { visiblePrepMilestones } from "@/lib/milestones";
```

```tsx
            <Badge tone="neutral" className="ml-2">
              {visiblePrepMilestones(txn.financingType).filter((m) => documents.some((d) => d.type === m.docType)).length}
              /{visiblePrepMilestones(txn.financingType).length}
            </Badge>
```

(Remove the now-unused `PREP_MILESTONES` import from the page.)

- [ ] **Step 3: SSA-region contact (§3.4)**

`src/components/crm/investor-form-drawer.tsx` (read it first): add prop `contacts?: SelectOption[]` (default `[]`), add `ssaRegionContactId: ""` to its EMPTY object, and render — in the profile section of the form —

```tsx
          {contacts.length > 0 && (
            <RelationSelect label="SSA Region Contact" value={v.ssaRegionContactId as string} onChange={(x) => f.setValue("ssaRegionContactId", x)} options={contacts} placeholder="Select contact…" />
          )}
```

(Import `RelationSelect` if the drawer doesn't already.)

`src/server/services/investors.ts` `getInvestor`: add `ssaRegionContact: true,` to the include.

`src/app/(crm)/investors/[id]/page.tsx`: pass to the edit drawer `contacts={investor.contacts.map((p) => ({ value: p.id, label: [p.firstName, p.lastName].filter(Boolean).join(" ") }))}` and add `ssaRegionContactId: investor.ssaRegionContactId ?? ""` to its `initial`; add a profile display row:

```tsx
            {investor.ssaRegionContact && (
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">SSA Region Contact</dt>
                <dd className="mt-1 text-sm text-zinc-900">
                  {[investor.ssaRegionContact.firstName, investor.ssaRegionContact.lastName].filter(Boolean).join(" ")}
                </dd>
              </div>
            )}
```

(Grep `InvestorFormDrawer` mounts — the investors list page keeps working with the defaulted prop.)

- [ ] **Step 4: Years of operation (§3.1, derived — display only)**

In `src/app/(crm)/clients/[id]/page.tsx` Company Profile `<dl>` add (next to the other simple rows):

```tsx
            {c.yearFounded && (
              <div>
                <dt className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Years of Operation</dt>
                <dd className="mt-1 text-sm text-zinc-900">{new Date().getFullYear() - c.yearFounded}</dd>
              </div>
            )}
```

- [ ] **Step 5: Create-task-from-communication (§3.10)**

`src/components/crm/activity-timeline.tsx` — extend the DTO and render task actions when options are provided (stays a server component; `TaskFormDrawer` is the client island):

```tsx
import Link from "next/link";
import { TaskFormDrawer } from "@/components/crm/task-form-drawer";
import type { SelectOption } from "@/components/ui";
```

```tsx
export interface ActivityTimelineItem {
  id: string;
  type: string;
  subject?: string | null;
  occurredAt: Date;
  context?: string | null;
  channel?: string | null;
  direction?: string | null;
  /** Record links copied onto tasks created from this activity (spec §3.10). */
  links?: { clientId?: string | null; mandateId?: string | null; transactionId?: string | null; investorId?: string | null };
  /** Tasks already extracted from this activity. */
  tasks?: { id: string; title: string; status: string }[];
}

export interface ActivityTaskOptions {
  mandates: SelectOption[];
  transactions: SelectOption[];
  investors: SelectOption[];
  clients: SelectOption[];
  users: SelectOption[];
}
```

Add `taskOptions?: ActivityTaskOptions;` to the component props. Inside each `<li>` (after the `daysAgoLabel` line, before `context`):

```tsx
                  {(a.tasks ?? []).length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {a.tasks!.map((task) => (
                        <li key={task.id} className="flex items-center gap-1.5 text-xs text-zinc-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                          <Link href="/tasks" className="hover:text-accent transition-colors">{task.title}</Link>
                          <span className="text-zinc-400">· {label("TaskStatus", task.status)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {taskOptions && (
                    <div className="mt-1.5">
                      <TaskFormDrawer
                        mode="create"
                        triggerLabel="+ Task"
                        initial={{
                          title: a.subject ?? label("InteractionType", a.type),
                          activityId: a.id,
                          clientId: a.links?.clientId ?? "",
                          mandateId: a.links?.mandateId ?? "",
                          transactionId: a.links?.transactionId ?? "",
                          investorId: a.links?.investorId ?? "",
                        }}
                        mandates={taskOptions.mandates}
                        transactions={taskOptions.transactions}
                        investors={taskOptions.investors}
                        clients={taskOptions.clients}
                        users={taskOptions.users}
                      />
                    </div>
                  )}
```

(If `/tasks` is not the task list route, grep the nav for the right href.)

Services — add `tasks: { select: { id: true, title: true, status: true } }` to the activity includes in: `getClient` (clients.ts — the `activities:` include), `getTransaction` (transactions.ts), `getEngagement` (engagements.ts), and `activityTimeline()` in `src/server/services/activities.ts` (read that file to find its select/include shape).

Pages — extend the timeline mappings with links + tasks and pass `taskOptions`:

- `clients/[id]/page.tsx`: page must fetch `relationOptions()` (add import + `const rel = await relationOptions();` alongside `getClient`). Mapping adds:

```tsx
    links: { clientId: client.id, mandateId: a.mandateId, transactionId: a.transactionId, investorId: a.investorId },
    tasks: (a.tasks ?? []).map((t: { id: string; title: string; status: string }) => ({ id: t.id, title: t.title, status: t.status })),
```

and the render gains `taskOptions={{ mandates: rel.mandates, transactions: rel.transactions, investors: rel.investors, clients: rel.clients, users: rel.users }}`.
- `transactions/[id]/page.tsx`: already has `rel`; mapping adds `links: { clientId: txn.clientId, transactionId: txn.id, investorId: a.investorId, mandateId: a.mandateId }` + `tasks` as above; pass `taskOptions`.
- `engagement/[id]/page.tsx`: fetch `relationOptions()`; links `{ transactionId: engagement.transactionId, investorId: engagement.investorId }` + tasks; pass `taskOptions`.
- `engagement/page.tsx`: fetch `relationOptions()` in its `Promise.all`; extend `timelineItems` mapping with links (from each activity row's own scalars: `clientId: a.clientId, mandateId: a.mandateId, transactionId: a.transactionId, investorId: a.investorId`) + tasks; pass `taskOptions`.

- [ ] **Step 6: Verify + commit**

`npx tsc --noEmit` clean; `npx vitest run src/lib/__tests__/milestones.test.ts src/server/services/__tests__/log-activity.smoke.test.ts` PASS; `pnpm lint` no new problems. If dev server up: log a communication on a client (subject now required), click "+ Task" on it, save, see the task listed under the activity.

```bash
git add src/lib/schemas/activity.ts src/lib/milestones.ts "src/lib/__tests__/milestones.test.ts" src/graphql/inputs.ts src/components/crm/log-engagement-dialog.tsx src/components/crm/activity-timeline.tsx src/components/crm/prep-milestones.tsx src/components/crm/investor-form-drawer.tsx src/server/services/clients.ts src/server/services/transactions.ts src/server/services/engagements.ts src/server/services/activities.ts src/server/services/investors.ts "src/app/(crm)/clients/[id]/page.tsx" "src/app/(crm)/transactions/[id]/page.tsx" "src/app/(crm)/engagement/[id]/page.tsx" "src/app/(crm)/engagement/page.tsx" "src/app/(crm)/investors/[id]/page.tsx" "src/server/services/__tests__/log-activity.smoke.test.ts"
git commit -m "feat(spec-gaps): task-from-communication, required summary, valuation conditionality, SSA contact, years-of-operation (F, spec 3.4/3.10/6.1)"
```

---

### Task 9: Remaining §13 dashboards

**Files:**
- Modify: `src/server/services/dashboard.ts` (6 new functions)
- Create: `src/components/crm/deal-analytics-panels.tsx`
- Modify: `src/app/(crm)/dashboard/page.tsx`
- Test: `src/server/__tests__/new-dashboards.smoke.test.ts`

**Interfaces:**
- Consumes: Task 5's StageChange FKs (feed covers all six entity targets); `DealStatus` values (`Open|OnHold|Closed|ClosedReopened|ClosedOnHold|Dropped` — active = `Open` + `ClosedReopened`); `EngagementStage` terminal values `Invested`/`Declined`; `MandateStage` `Signed`/`Lost`; presentational primitives `Card/Table/...`, `BreakdownBarList`, `AnimatedStatCard`, `label()`, `daysAgoLabel`, `formatMoney`.
- Produces (all exported from `@/server/services/dashboard`): `pipelineActiveSplit(): Promise<ActiveInactiveSplit>`, `stageChangeFeed(limit?): Promise<StageChangeFeedItem[]>`, `stageChangeCounts(): Promise<CountBreakdown[]>`, `investorEngagementRollup(limit?): Promise<InvestorEngagementRollupRow[]>`, `investedSummary(): Promise<{ count: number; totalDisbursed: number }>`, `historicalEngagementSummary(): Promise<HistoricalEngagementRow[]>`, `partnerConversionFunnel(): Promise<PartnerFunnelRow[]>`. Components: `StageChangeFeedList`, `InvestorRollupTable`, `HistoricalEngagementTable`, `PartnerFunnelTable`.

- [ ] **Step 1: Failing smoke test**

Create `src/server/__tests__/new-dashboards.smoke.test.ts` (same `withDb`):

```ts
// Shape-level smoke test for the spec §13 pass-2 dashboard functions.

import { describe, it, expect } from "vitest";
import {
  pipelineActiveSplit,
  stageChangeFeed,
  stageChangeCounts,
  investorEngagementRollup,
  investedSummary,
  historicalEngagementSummary,
  partnerConversionFunnel,
} from "@/server/services/dashboard";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await fn();
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

describe("pass-2 dashboards (smoke)", () => {
  it("returns well-formed aggregates", async () => {
    const out = await withDb(async () => {
      const split = await pipelineActiveSplit();
      expect(split.mandates.active).toBeGreaterThanOrEqual(0);
      expect(split.transactions.inactive).toBeGreaterThanOrEqual(0);

      const feed = await stageChangeFeed(5);
      expect(feed.length).toBeLessThanOrEqual(5);
      for (const item of feed) {
        expect(typeof item.field).toBe("string");
        expect(typeof item.entityLabel).toBe("string");
      }

      const counts = await stageChangeCounts();
      for (const c of counts) {
        expect(c.count).toBeGreaterThan(0);
        expect(typeof c.label).toBe("string");
      }

      const rollup = await investorEngagementRollup(5);
      for (const row of rollup) {
        expect(row.underReview + row.rejected + row.invested).toBeGreaterThan(0);
      }

      const invested = await investedSummary();
      expect(invested.count).toBeGreaterThanOrEqual(0);
      expect(invested.totalDisbursed).toBeGreaterThanOrEqual(0);

      const history = await historicalEngagementSummary();
      for (let i = 1; i < history.length; i++) {
        const prev = history[i - 1], cur = history[i];
        expect(prev.year * 10 + prev.quarter).toBeLessThan(cur.year * 10 + cur.quarter);
      }

      const funnel = await partnerConversionFunnel();
      for (const row of funnel) {
        expect(row.introduced).toBeGreaterThanOrEqual(row.won + row.lost);
      }
      return true;
    });
    if (out === null) return;
  });
});
```

Run: `npx vitest run src/server/__tests__/new-dashboards.smoke.test.ts` → FAIL (no such exports).

- [ ] **Step 2: Service functions**

Append to `src/server/services/dashboard.ts`:

```ts
// ─── Spec-gap pass 2: remaining §13 dashboards ────────────────────────────────

export interface ActiveInactiveSplit {
  mandates: { active: number; inactive: number };
  transactions: { active: number; inactive: number };
}

/** Active deal statuses per the design: Open + Closed & Reopened. */
const ACTIVE_DEAL_STATUSES: string[] = ["Open", "ClosedReopened"];

/**
 * Pipeline activity split by dealStatus (spec §13 "active vs inactive").
 * Two groupBy queries — no N+1.
 */
export async function pipelineActiveSplit(): Promise<ActiveInactiveSplit> {
  const [mandateGroups, txnGroups] = await Promise.all([
    prisma.mandate.groupBy({ by: ["dealStatus"], _count: { _all: true } }),
    prisma.transaction.groupBy({ by: ["dealStatus"], _count: { _all: true } }),
  ]);
  const split = (groups: { dealStatus: string; _count: { _all: number } }[]) => {
    let active = 0;
    let inactive = 0;
    for (const g of groups) {
      if (ACTIVE_DEAL_STATUSES.includes(g.dealStatus)) active += g._count._all;
      else inactive += g._count._all;
    }
    return { active, inactive };
  };
  return { mandates: split(mandateGroups), transactions: split(txnGroups) };
}

export interface StageChangeFeedItem {
  id: string;
  field: string;
  fromValue: string | null;
  toValue: string;
  changedAt: Date;
  actorName: string | null;
  createdSource: string;
  entityLabel: string;
  entityHref: string | null;
}

/**
 * Recent stage/status/identifier changes across ALL audited entities
 * (spec §13 "stage history roll-up"). One findMany with narrow includes.
 */
export async function stageChangeFeed(limit = 12): Promise<StageChangeFeedItem[]> {
  const rows = await prisma.stageChange.findMany({
    orderBy: { changedAt: "desc" },
    take: limit,
    include: {
      changedBy: { select: { name: true } },
      mandate: { select: { id: true, name: true } },
      transaction: { select: { id: true, name: true } },
      engagement: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      investor: { select: { id: true, name: true } },
      partner: { select: { id: true, name: true } },
    },
  });
  return rows.map((r) => {
    const target =
      (r.mandate && { label: r.mandate.name, href: `/mandates/${r.mandate.id}` }) ||
      (r.transaction && { label: r.transaction.name, href: `/transactions/${r.transaction.id}` }) ||
      (r.engagement && { label: r.engagement.name, href: `/engagement/${r.engagement.id}` }) ||
      (r.client && { label: r.client.name, href: `/clients/${r.client.id}` }) ||
      (r.investor && { label: r.investor.name, href: `/investors/${r.investor.id}` }) ||
      (r.partner && { label: r.partner.name, href: `/partners/${r.partner.id}` }) ||
      { label: "—", href: null };
    return {
      id: r.id,
      field: r.field,
      fromValue: r.fromValue,
      toValue: r.toValue,
      changedAt: r.changedAt,
      actorName: r.changedBy?.name ?? null,
      createdSource: r.createdSource,
      entityLabel: target.label,
      entityHref: target.href,
    };
  });
}

/**
 * Transition counts by audited field (spec §13 roll-up companion to the feed).
 * One groupBy; labels via the same field map the feed uses.
 */
export async function stageChangeCounts(): Promise<CountBreakdown[]> {
  const FIELD_LABELS: Record<string, string> = {
    stage: "Stage",
    dealStatus: "Deal Status",
    engagementStage: "Engagement Stage",
    dealMilestone: "Milestone",
    name: "Name",
    registrationNo: "Registration No.",
    primaryContact: "Primary Contact",
  };
  const groups = await prisma.stageChange.groupBy({ by: ["field"], _count: { _all: true } });
  return groups
    .map((g) => ({ key: g.field, label: FIELD_LABELS[g.field] ?? g.field, count: g._count._all }))
    .sort((a, b) => b.count - a.count);
}

export interface InvestorEngagementRollupRow {
  investorId: string;
  name: string;
  underReview: number;
  rejected: number;
  invested: number;
}

/**
 * Per-investor engagement rollup (spec §13): deals under review / rejected /
 * invested. One groupBy + one name lookup — no N+1.
 */
export async function investorEngagementRollup(limit = 10): Promise<InvestorEngagementRollupRow[]> {
  const groups = await prisma.engagement.groupBy({
    by: ["investorId", "engagementStage"],
    _count: { _all: true },
  });
  const byInvestor = new Map<string, { underReview: number; rejected: number; invested: number }>();
  for (const g of groups) {
    const bucket = byInvestor.get(g.investorId) ?? { underReview: 0, rejected: 0, invested: 0 };
    if (g.engagementStage === "Invested") bucket.invested += g._count._all;
    else if (g.engagementStage === "Declined") bucket.rejected += g._count._all;
    else bucket.underReview += g._count._all;
    byInvestor.set(g.investorId, bucket);
  }
  const ids = [...byInvestor.keys()];
  const investors = ids.length
    ? await prisma.investor.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const nameMap = new Map(investors.map((i) => [i.id, i.name]));
  return [...byInvestor.entries()]
    .map(([investorId, b]) => ({ investorId, name: nameMap.get(investorId) ?? "Unknown", ...b }))
    .sort((a, b) => b.underReview + b.rejected + b.invested - (a.underReview + a.rejected + a.invested))
    .slice(0, limit);
}

/**
 * Invested/completed summary stat (spec §13): engagements that reached
 * Invested or have money out the door.
 */
export async function investedSummary(): Promise<{ count: number; totalDisbursed: number }> {
  const agg = await prisma.engagement.aggregate({
    where: { OR: [{ engagementStage: "Invested" }, { disbursementStatus: "Disbursed" }] },
    _count: { _all: true },
    _sum: { amountDisbursed: true },
  });
  return { count: agg._count._all, totalDisbursed: Number(agg._sum.amountDisbursed ?? 0) };
}

export interface HistoricalEngagementRow {
  year: number;
  quarter: number;
  active: number;
  invested: number;
  declined: number;
}

/**
 * Historical engagement summary (spec §13, was ❌): outcome counts by the
 * already-derived year/quarter. One groupBy, bucketed in-process.
 */
export async function historicalEngagementSummary(): Promise<HistoricalEngagementRow[]> {
  const groups = await prisma.engagement.groupBy({
    by: ["year", "quarter", "engagementStage"],
    where: { year: { not: null }, quarter: { not: null } },
    _count: { _all: true },
  });
  const byPeriod = new Map<string, HistoricalEngagementRow>();
  for (const g of groups) {
    const key = `${g.year}-${g.quarter}`;
    const row = byPeriod.get(key) ?? {
      year: g.year as number,
      quarter: g.quarter as number,
      active: 0,
      invested: 0,
      declined: 0,
    };
    if (g.engagementStage === "Invested") row.invested += g._count._all;
    else if (g.engagementStage === "Declined") row.declined += g._count._all;
    else row.active += g._count._all;
    byPeriod.set(key, row);
  }
  return [...byPeriod.values()].sort((a, b) => a.year - b.year || a.quarter - b.quarter);
}

export interface PartnerFunnelRow {
  partnerId: string;
  name: string;
  introduced: number;
  progressed: number;
  won: number;
  lost: number;
}

/**
 * Referral conversion funnel per partner (spec §13), replacing the single
 * aggregate %: introduced → progressed (past NewLead) → Signed / Lost.
 * One findMany with a stage-only select — rollup in-process.
 */
export async function partnerConversionFunnel(): Promise<PartnerFunnelRow[]> {
  const partners = await prisma.partner.findMany({
    include: { referredMandates: { select: { stage: true } } },
    orderBy: { name: "asc" },
  });
  return partners
    .map((p) => {
      const stages = p.referredMandates.map((m) => m.stage as string);
      return {
        partnerId: p.id,
        name: p.name,
        introduced: stages.length,
        progressed: stages.filter((s) => s !== "NewLead").length,
        won: stages.filter((s) => s === "Signed").length,
        lost: stages.filter((s) => s === "Lost").length,
      };
    })
    .filter((r) => r.introduced > 0);
}
```

Run: `npx vitest run src/server/__tests__/new-dashboards.smoke.test.ts` → PASS.

- [ ] **Step 3: Presentational panels**

Create `src/components/crm/deal-analytics-panels.tsx` (server-safe — no "use client", same family as `team-tasks-panel.tsx`):

```tsx
// deal-analytics-panels.tsx — presentational panels for the spec §13 pass-2
// dashboards: stage-change feed, per-investor engagement rollup, historical
// year/quarter engagement summary, partner referral conversion funnel.

import Link from "next/link";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui";
import { label } from "@/lib/vocab";
import { daysAgoLabel } from "@/lib/format";
import type {
  StageChangeFeedItem,
  InvestorEngagementRollupRow,
  HistoricalEngagementRow,
  PartnerFunnelRow,
} from "@/server/services/dashboard";

const FEED_FIELD_LABELS: Record<string, string> = {
  stage: "Stage",
  dealStatus: "Deal Status",
  engagementStage: "Engagement Stage",
  dealMilestone: "Milestone",
  name: "Name",
  registrationNo: "Registration No.",
  primaryContact: "Primary Contact",
};

const FEED_VOCAB_GROUPS: Record<string, string> = {
  dealStatus: "DealStatus",
  engagementStage: "EngagementStage",
  dealMilestone: "DealMilestone",
};

const feedValue = (field: string, value: string | null) =>
  value == null ? "—" : label(FEED_VOCAB_GROUPS[field] ?? field, value);

export function StageChangeFeedList({ items }: { items: StageChangeFeedItem[] }) {
  if (items.length === 0) return <p className="text-xs text-zinc-400">No changes recorded yet.</p>;
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3">
          <span className="mt-1.5 h-2 w-2 rounded-full bg-accent flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap text-sm">
              {item.entityHref ? (
                <Link href={item.entityHref} className="font-medium text-zinc-900 hover:text-accent transition-colors">
                  {item.entityLabel}
                </Link>
              ) : (
                <span className="font-medium text-zinc-900">{item.entityLabel}</span>
              )}
              <span className="text-xs font-medium text-zinc-500">{FEED_FIELD_LABELS[item.field] ?? item.field}</span>
              <span className="text-zinc-700">
                {feedValue(item.field, item.fromValue)} <span className="text-zinc-400">→</span> {feedValue(item.field, item.toValue)}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {daysAgoLabel(item.changedAt)} · {item.actorName ?? label("ActorSource", item.createdSource)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function InvestorRollupTable({ rows }: { rows: InvestorEngagementRollupRow[] }) {
  if (rows.length === 0) return <p className="text-xs text-zinc-400">No engagements yet.</p>;
  return (
    <Table>
      <THead>
        <Tr className="hover:bg-transparent">
          <Th>Investor</Th>
          <Th>Under Review</Th>
          <Th>Rejected</Th>
          <Th>Invested</Th>
        </Tr>
      </THead>
      <TBody>
        {rows.map((r) => (
          <Tr key={r.investorId}>
            <Td>
              <Link href={`/investors/${r.investorId}`} className="font-medium text-zinc-900 hover:text-accent transition-colors">
                {r.name}
              </Link>
            </Td>
            <Td className="tabular-nums">{r.underReview}</Td>
            <Td className="tabular-nums">{r.rejected}</Td>
            <Td className="tabular-nums">{r.invested}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

export function HistoricalEngagementTable({ rows }: { rows: HistoricalEngagementRow[] }) {
  if (rows.length === 0) return <p className="text-xs text-zinc-400">No dated engagements yet.</p>;
  return (
    <Table>
      <THead>
        <Tr className="hover:bg-transparent">
          <Th>Period</Th>
          <Th>Active</Th>
          <Th>Invested</Th>
          <Th>Declined</Th>
        </Tr>
      </THead>
      <TBody>
        {rows.map((r) => (
          <Tr key={`${r.year}-${r.quarter}`}>
            <Td className="font-medium text-zinc-900">{r.year} Q{r.quarter}</Td>
            <Td className="tabular-nums">{r.active}</Td>
            <Td className="tabular-nums">{r.invested}</Td>
            <Td className="tabular-nums">{r.declined}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

export function PartnerFunnelTable({ rows }: { rows: PartnerFunnelRow[] }) {
  if (rows.length === 0) return <p className="text-xs text-zinc-400">No partner referrals yet.</p>;
  return (
    <Table>
      <THead>
        <Tr className="hover:bg-transparent">
          <Th>Partner</Th>
          <Th>Introduced</Th>
          <Th>Progressed</Th>
          <Th>Won</Th>
          <Th>Lost</Th>
        </Tr>
      </THead>
      <TBody>
        {rows.map((r) => (
          <Tr key={r.partnerId}>
            <Td>
              <Link href={`/partners/${r.partnerId}`} className="font-medium text-zinc-900 hover:text-accent transition-colors">
                {r.name}
              </Link>
            </Td>
            <Td className="tabular-nums">{r.introduced}</Td>
            <Td className="tabular-nums">{r.progressed}</Td>
            <Td className="tabular-nums">{r.won}</Td>
            <Td className="tabular-nums">{r.lost}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
```

(Check `Table/THead/TBody/Tr/Th/Td` are exported from `@/components/ui` — `disbursement-table.tsx` imports them exactly like this.)

- [ ] **Step 4: Wire the dashboard page**

`src/app/(crm)/dashboard/page.tsx`:

Imports — extend the dashboard-service import with `pipelineActiveSplit, stageChangeFeed, stageChangeCounts, investorEngagementRollup, investedSummary, historicalEngagementSummary, partnerConversionFunnel`; add `import { StageChangeFeedList, InvestorRollupTable, HistoricalEngagementTable, PartnerFunnelTable } from "@/components/crm/deal-analytics-panels";` and add `History, TrendingUp` (or similar available lucide icons) if desired for the stat cards.

`Promise.all` — append the seven calls and destructure `activeSplit, feed, feedCounts, rollup, invested, history, funnel`. (If `CardBody` doesn't accept `className`, put the `space-y-4` on an inner `<div>` instead.)

Add sections after the "Pipeline Breakdown" Stagger and before "Investor Onboarding":

```tsx
      {/* Deal Status & Activity — active vs inactive split, invested summary, change feed */}
      <Reveal delay={0.19}>
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Deal Status &amp; Activity</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Active vs inactive pipeline, invested deals &amp; recent changes</p>
        </div>
      </Reveal>

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <AnimatedStatCard
          label="Active Pipeline"
          value={activeSplit.mandates.active + activeSplit.transactions.active}
          format="compact"
          sub={`${activeSplit.mandates.active} mandates · ${activeSplit.transactions.active} transactions`}
        />
        <AnimatedStatCard
          label="Inactive / On Hold"
          value={activeSplit.mandates.inactive + activeSplit.transactions.inactive}
          format="compact"
          sub={`${activeSplit.mandates.inactive} mandates · ${activeSplit.transactions.inactive} transactions`}
        />
        <AnimatedStatCard
          label="Invested / Completed"
          value={invested.count}
          format="compact"
          sub={`$${Math.round(invested.totalDisbursed).toLocaleString()} disbursed`}
        />
      </Stagger>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-zinc-900">Recent Changes</h3>
            <p className="mt-0.5 text-xs text-zinc-500">Stage, status &amp; identifier changes across all records</p>
          </CardHeader>
          <CardBody className="space-y-4">
            <StageChangeFeedList items={feed} />
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Transitions by field</p>
              <BreakdownBarList rows={feedCounts} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-zinc-900">Investor Engagement</h3>
            <p className="mt-0.5 text-xs text-zinc-500">Per-investor deals under review, rejected &amp; invested</p>
          </CardHeader>
          <CardBody>
            <InvestorRollupTable rows={rollup} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-zinc-900">Historical Engagement</h3>
            <p className="mt-0.5 text-xs text-zinc-500">Engagement outcomes by year &amp; quarter</p>
          </CardHeader>
          <CardBody>
            <HistoricalEngagementTable rows={history} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-zinc-900">Referral Conversion</h3>
            <p className="mt-0.5 text-xs text-zinc-500">Per-partner funnel: introduced → progressed → won / lost</p>
          </CardHeader>
          <CardBody>
            <PartnerFunnelTable rows={funnel} />
          </CardBody>
        </Card>
      </div>
```

(If `AnimatedStatCard` requires an `icon`, reuse icons already imported on the page — check its props before adding new lucide imports.)

- [ ] **Step 5: Verify + commit**

`npx tsc --noEmit` clean; `npx vitest run src/server/__tests__/new-dashboards.smoke.test.ts src/server/__tests__/dashboard.smoke.test.ts` PASS; `pnpm lint` no new problems; if dev server up, `http://localhost:3000/dashboard` renders the four new panels + three stat cards with real data.

```bash
git add src/server/services/dashboard.ts src/components/crm/deal-analytics-panels.tsx "src/app/(crm)/dashboard/page.tsx" "src/server/__tests__/new-dashboards.smoke.test.ts"
git commit -m "feat(spec-gaps): remaining spec-13 dashboards - activity split, change feed, investor rollup, invested summary, historical periods, referral funnel (D)"
```

---

## Final verification (run after ALL tasks — orchestrator-led)

1. `npx tsc --noEmit` — clean.
2. `pnpm test` — all green (baseline 363 + every new test file).
3. `pnpm lint` — ONLY the pre-existing baseline problems (clients-table.tsx, count-up.tsx, prisma/seed.ts, investors-crud.smoke.test.ts).
4. Production build: schema CHANGED this pass, so `npm run build` needs `prisma generate` — coordinate the dev-server DLL lock with the user's environment (stop server → build → restart), or verify `npx next build` after a successful standalone `npx prisma generate`.
5. Playwright end-to-end against `http://localhost:3000` (per the design's verification list): contact CRUD from client/investor/partner pages, engagement drawer edit with derived-pending recompute, milestone record/unrecord + portal stepper, all new dashboard panels, task-from-communication both ways, immutability (disabled fields + server rejection via a raw GraphQL call), audit rows after a rename, Profitability/foundersGender fields, Transaction referrer + service-provider linking, Document→Mandate link, §6.1 valuation row hidden on a Debt transaction, SSA-region contact, subject-required validation.
6. Update `docs/CRM-VS-BUILD-SPEC-COMPARATIVE-ANALYSIS-2026-07-06.md` (statuses with file:line evidence, implementation-log banner, §16 rewrite) — separate commit.



