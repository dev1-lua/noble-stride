"use client";

// log-engagement-dialog.tsx — Client component: opens a modal to log an engagement.
// Fires the logEngagement GraphQL mutation via urql, then router.refresh() on success.
// Mirror of restage-select.tsx error/pending pattern.

import { useState } from "react";
import { useMutation } from "urql";
import { useRouter } from "next/navigation";
import { Button, Card, CardHeader, CardBody, Input, Select } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { options } from "@/lib/vocab";

// ─── GraphQL mutation ─────────────────────────────────────────────────────────

const LOG_ENGAGEMENT = `
  mutation LogEngagement(
    $transactionId: ID!
    $investorId: ID!
    $type: InteractionType!
    $subject: String
    $body: String
  ) {
    logEngagement(
      transactionId: $transactionId
      investorId: $investorId
      type: $type
      subject: $subject
      body: $body
    ) {
      id
    }
  }
`;

// ─── Props ────────────────────────────────────────────────────────────────────

interface LogEngagementDialogProps {
  transactions: SelectOption[];
  investors: SelectOption[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LogEngagementDialog({ transactions, investors }: LogEngagementDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [investorId, setInvestorId] = useState("");
  const [type, setType] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [, executeLogEngagement] = useMutation(LOG_ENGAGEMENT);

  const interactionTypeOptions = options("InteractionType");

  function resetForm() {
    setTransactionId("");
    setInvestorId("");
    setType("");
    setSubject("");
    setBody("");
    setError(null);
  }

  function handleClose() {
    if (pending) return;
    resetForm();
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transactionId || !investorId || !type) {
      setError("Transaction, Investor, and Type are required.");
      return;
    }
    setError(null);
    setPending(true);

    const result = await executeLogEngagement({
      transactionId,
      investorId,
      type,
      subject: subject || undefined,
      body: body || undefined,
    });

    setPending(false);

    if (result.error) {
      console.error("[LogEngagementDialog] mutation failed:", result.error.message);
      setError("Failed to log engagement — please try again.");
      return;
    }

    // Success: refresh RSC to show the new activity in activityTimeline()
    router.refresh();
    resetForm();
    setOpen(false);
  }

  return (
    <>
      {/* Trigger button */}
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        Log Engagement
      </Button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <Card className="w-full max-w-md mx-4 shadow-xl">
            <CardHeader>
              <h2 className="text-sm font-semibold text-zinc-900">Log Engagement</h2>
            </CardHeader>
            <CardBody>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Select
                  label="Transaction"
                  options={transactions}
                  value={transactionId}
                  onChange={setTransactionId}
                  placeholder="Select transaction…"
                  disabled={pending}
                />
                <Select
                  label="Investor"
                  options={investors}
                  value={investorId}
                  onChange={setInvestorId}
                  placeholder="Select investor…"
                  disabled={pending}
                />
                <Select
                  label="Type"
                  options={interactionTypeOptions}
                  value={type}
                  onChange={setType}
                  placeholder="Select type…"
                  disabled={pending}
                />
                <Input
                  label="Subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief subject…"
                  disabled={pending}
                />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-700">Notes</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Additional notes…"
                    disabled={pending}
                    rows={3}
                    className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent disabled:bg-zinc-50 disabled:text-zinc-400 disabled:cursor-not-allowed resize-none"
                  />
                </div>

                {error && (
                  <p className="text-xs text-rose-600">{error}</p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleClose}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={pending || !transactionId || !investorId || !type}
                  >
                    {pending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
