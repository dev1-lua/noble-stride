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
