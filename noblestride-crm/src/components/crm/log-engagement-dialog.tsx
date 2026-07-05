"use client";

// log-engagement-dialog.tsx — Client component: opens a modal to log a
// communication/activity (spec §3.10 — generalized comm logging).
//
// Two write paths, chosen automatically at submit time:
//   1. Transaction + Investor picked together → logEngagement mutation
//      (upserts the Engagement, bumps lastContact — unchanged behavior).
//   2. Any other link (a fixed clientId/mandateId prop, or only one of
//      transaction/investor) → the generalized logActivity mutation, which
//      requires only `type` + at least one linked record.
//
// Mirror of restage-select.tsx error/pending pattern.

import { useState } from "react";
import { useMutation } from "urql";
import type { CombinedError } from "urql";
import { useRouter } from "next/navigation";
import { Button, Card, CardHeader, CardBody, Input, Select } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { options } from "@/lib/vocab";

// ─── GraphQL mutations ─────────────────────────────────────────────────────────

const LOG_ENGAGEMENT = `
  mutation LogEngagement(
    $transactionId: ID!
    $investorId: ID!
    $type: InteractionType!
    $subject: String
    $body: String
    $channel: CommChannel
    $direction: CommDirection
  ) {
    logEngagement(
      transactionId: $transactionId
      investorId: $investorId
      type: $type
      subject: $subject
      body: $body
      channel: $channel
      direction: $direction
    ) {
      id
    }
  }
`;

const LOG_ACTIVITY = `
  mutation LogActivity($input: LogActivityInput!) {
    logActivity(input: $input) {
      id
    }
  }
`;

// ─── Props ────────────────────────────────────────────────────────────────────

interface LogEngagementDialogProps {
  /** Pass both to offer the Transaction+Investor pickers (drives the
   *  Engagement upsert via logEngagement). Omit on single-record pages. */
  transactions?: SelectOption[];
  investors?: SelectOption[];
  /** Pre-fixed link for single-record pages (client/mandate detail) — not
   *  shown as a field, sent straight through to logActivity. */
  clientId?: string;
  mandateId?: string;
  triggerLabel?: string;
  dialogTitle?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LogEngagementDialog({
  transactions,
  investors,
  clientId,
  mandateId,
  triggerLabel = "Log Engagement",
  dialogTitle = "Log Engagement",
}: LogEngagementDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [investorId, setInvestorId] = useState("");
  const [type, setType] = useState("");
  const [channel, setChannel] = useState("");
  const [direction, setDirection] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [, executeLogEngagement] = useMutation(LOG_ENGAGEMENT);
  const [, executeLogActivity] = useMutation(LOG_ACTIVITY);

  const interactionTypeOptions = options("InteractionType");
  const channelOptions = options("CommChannel");
  const directionOptions = options("CommDirection");

  const showTransactionInvestorPickers = Boolean(transactions && investors);
  const hasFixedLink = Boolean(clientId || mandateId);
  const hasTransactionInvestorPair = Boolean(transactionId && investorId);

  /** Returns a validation message, or null when the form is submittable. */
  function validate(): string | null {
    if (!type) return "Type is required.";
    if (transactionId && !investorId) return "Select an investor to pair with the transaction.";
    if (investorId && !transactionId) return "Select a transaction to pair with the investor.";
    if (!hasFixedLink && !hasTransactionInvestorPair) {
      return "Select a transaction and investor, or a linked record is required.";
    }
    return null;
  }

  function resetForm() {
    setTransactionId("");
    setInvestorId("");
    setType("");
    setChannel("");
    setDirection("");
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

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setPending(true);

    let err: CombinedError | null = null;

    if (hasTransactionInvestorPair) {
      const result = await executeLogEngagement({
        transactionId,
        investorId,
        type,
        subject: subject || undefined,
        body: body || undefined,
        channel: channel || undefined,
        direction: direction || undefined,
      });
      err = result.error ?? null;
    } else {
      const result = await executeLogActivity({
        input: {
          type,
          subject: subject || undefined,
          body: body || undefined,
          channel: channel || undefined,
          direction: direction || undefined,
          clientId: clientId || undefined,
          mandateId: mandateId || undefined,
          transactionId: transactionId || undefined,
          investorId: investorId || undefined,
        },
      });
      err = result.error ?? null;
    }

    setPending(false);

    if (err) {
      console.error("[LogEngagementDialog] mutation failed:", err.message);
      const rawMessage = err.graphQLErrors?.[0]?.message ?? err.message;
      const message = rawMessage.startsWith("[GraphQL] ") ? rawMessage.slice("[GraphQL] ".length) : rawMessage;
      setError(message || "Failed to log — please try again.");
      return;
    }

    // Success: refresh RSC to show the new activity in the relevant timeline.
    router.refresh();
    resetForm();
    setOpen(false);
  }

  const canSubmit = !validate();

  return (
    <>
      {/* Trigger button */}
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <Card className="w-full max-w-md mx-4 shadow-xl">
            <CardHeader>
              <h2 className="text-sm font-semibold text-zinc-900">{dialogTitle}</h2>
            </CardHeader>
            <CardBody>
              <form onSubmit={handleSubmit} className="space-y-4">
                {showTransactionInvestorPickers && (
                  <>
                    <Select
                      label="Transaction"
                      options={transactions!}
                      value={transactionId}
                      onChange={setTransactionId}
                      placeholder="Select transaction…"
                      disabled={pending}
                    />
                    <Select
                      label="Investor"
                      options={investors!}
                      value={investorId}
                      onChange={setInvestorId}
                      placeholder="Select investor…"
                      disabled={pending}
                    />
                  </>
                )}
                <Select
                  label="Type"
                  options={interactionTypeOptions}
                  value={type}
                  onChange={setType}
                  placeholder="Select type…"
                  disabled={pending}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Channel"
                    options={channelOptions}
                    value={channel}
                    onChange={setChannel}
                    placeholder="Not specified"
                    disabled={pending}
                  />
                  <Select
                    label="Direction"
                    options={directionOptions}
                    value={direction}
                    onChange={setDirection}
                    placeholder="Not specified"
                    disabled={pending}
                  />
                </div>
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
                    disabled={pending || !canSubmit}
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
