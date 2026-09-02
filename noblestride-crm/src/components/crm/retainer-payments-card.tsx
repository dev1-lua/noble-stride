"use client";

// retainer-payments-card.tsx — F4.3.1's third clause (Aug-2026 feedback): the
// ledger of individual retainer payments behind the mandate's paid amount.
// Client component fed a plain DTO by the mandate detail RSC; recording or
// deleting a payment fires the mutation via urql, then router.refresh() so the
// header's Paid/Balance re-derives from the updated retainerPaidAmount.
//
// The paid amount stays directly editable in the mandate drawer (pre-ledger
// history), so the ledger total can legitimately be smaller than the paid
// amount on old mandates — the footer states the recorded total honestly
// rather than pretending the ledger is complete.

import { useState } from "react";
import { useMutation } from "urql";
import { useRouter } from "next/navigation";
import { Button, Card, CardHeader, CardBody, Badge, Input } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

const RECORD_RETAINER_PAYMENT = `
  mutation RecordRetainerPayment($mandateId: ID!, $amount: Float!, $paidOn: DateTime, $reference: String) {
    recordRetainerPayment(mandateId: $mandateId, amount: $amount, paidOn: $paidOn, reference: $reference) { id }
  }
`;

const DELETE_RETAINER_PAYMENT = `
  mutation DeleteRetainerPayment($id: ID!) {
    deleteRetainerPayment(id: $id)
  }
`;

export interface RetainerPaymentItem {
  id: string;
  amount: number;
  paidOn: string; // ISO
  reference: string | null;
  recordedByName: string | null;
}

interface RetainerPaymentsCardProps {
  mandateId: string;
  payments: RetainerPaymentItem[];
  canEdit: boolean;
}

export function RetainerPaymentsCard({ mandateId, payments, canEdit }: RetainerPaymentsCardProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [, executeRecord] = useMutation(RECORD_RETAINER_PAYMENT);
  const [, executeDelete] = useMutation(DELETE_RETAINER_PAYMENT);

  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  async function handleRecord(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a payment amount greater than zero.");
      return;
    }
    setPending(true);
    setError(null);
    const res = await executeRecord({
      mandateId,
      amount: value,
      paidOn: paidOn ? new Date(paidOn).toISOString() : null,
      reference: reference.trim() || null,
    });
    setPending(false);
    if (res.error) {
      setError(res.error.graphQLErrors[0]?.message ?? "Could not record the payment.");
      return;
    }
    setAmount("");
    setReference("");
    router.refresh();
  }

  async function handleDelete(id: string) {
    setPending(true);
    setError(null);
    const res = await executeDelete({ id });
    setPending(false);
    if (res.error) {
      setError(res.error.graphQLErrors[0]?.message ?? "Could not delete the payment.");
      return;
    }
    router.refresh();
  }

  return (
    <Card id="retainer-payments" className="scroll-mt-24" data-testid="retainer-payments">
      <CardHeader>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Retainer Payments
          {payments.length > 0 && <Badge tone="neutral" className="ml-2">{payments.length}</Badge>}
        </h2>
      </CardHeader>
      <CardBody>
        {payments.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">
            No individual payments recorded yet. The Paid amount in the Deal Summary can still carry
            history entered before this ledger existed.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {payments.map((p) => (
              <li key={p.id} className="py-2.5 flex items-center justify-between gap-4" data-testid="retainer-payment-row">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {formatMoney(p.amount)}
                    <span className="ml-2 font-normal text-[var(--text-tertiary)]">{formatDate(p.paidOn)}</span>
                  </p>
                  {(p.reference || p.recordedByName) && (
                    <p className="mt-0.5 text-xs text-[var(--text-tertiary)] truncate">
                      {p.reference}
                      {p.reference && p.recordedByName && " · "}
                      {p.recordedByName && <>Recorded by {p.recordedByName}</>}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => handleDelete(p.id)}
                    aria-label={`Delete payment of ${formatMoney(p.amount)}`}
                  >
                    Delete
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {payments.length > 0 && (
          <p className="mt-3 text-xs text-[var(--text-secondary)]" data-testid="retainer-payments-total">
            {payments.length} payment{payments.length === 1 ? "" : "s"} · {formatMoney(total)} recorded
          </p>
        )}

        {canEdit && (
          <form onSubmit={handleRecord} className="mt-4 flex flex-wrap items-end gap-3 border-t border-[var(--border-subtle)] pt-4">
            <div className="w-36">
              <Input
                label="Amount"
                id="retainer-payment-amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000"
              />
            </div>
            <div className="w-40">
              <Input
                label="Paid on"
                id="retainer-payment-date"
                type="date"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
              />
            </div>
            <div className="min-w-48 flex-1">
              <Input
                label="Reference (optional)"
                id="retainer-payment-reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Invoice no., bank transfer…"
              />
            </div>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Log payment"}
            </Button>
            {error && <p className="w-full text-xs text-rose-600">{error}</p>}
          </form>
        )}
      </CardBody>
    </Card>
  );
}
