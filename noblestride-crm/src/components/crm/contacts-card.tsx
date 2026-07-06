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
