"use client";

// restage-select.tsx — Small client component: a Select that fires a restage mutation.
// Used on mandate and transaction detail pages.
// Fires updateMandateStage or updateTransactionStage via urql on change, then router.refresh().

import { useState } from "react";
import { useMutation } from "urql";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";
import type { SelectOption } from "@/components/ui";

// ─── GraphQL mutations ────────────────────────────────────────────────────────

const UPDATE_MANDATE_STAGE = `
  mutation UpdateMandateStage($id: ID!, $stage: MandateStage!) {
    updateMandateStage(id: $id, stage: $stage) { id stage }
  }
`;

const UPDATE_TRANSACTION_STAGE = `
  mutation UpdateTransactionStage($id: ID!, $stage: TransactionStage!) {
    updateTransactionStage(id: $id, stage: $stage) { id stage }
  }
`;

// ─── Props ────────────────────────────────────────────────────────────────────

interface RestageSelectProps {
  kind: "mandate" | "transaction";
  id: string;
  currentStage: string;
  stageOptions: SelectOption[];
}

/**
 * RestageSelect — renders a stage dropdown that fires the appropriate
 * updateMandateStage or updateTransactionStage mutation on change,
 * then calls router.refresh() so the RSC re-queries the DB.
 */
export function RestageSelect({ kind, id, currentStage, stageOptions }: RestageSelectProps) {
  const router = useRouter();
  const [stage, setStage] = useState(currentStage);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [, executeMandateMutation] = useMutation(UPDATE_MANDATE_STAGE);
  const [, executeTransactionMutation] = useMutation(UPDATE_TRANSACTION_STAGE);

  async function handleChange(newStage: string) {
    if (newStage === stage || pending) return;
    const prevStage = stage;
    setStage(newStage);
    setError(null);
    setPending(true);

    let err: Error | null = null;

    if (kind === "mandate") {
      const result = await executeMandateMutation({ id, stage: newStage });
      if (result.error) err = result.error;
    } else {
      const result = await executeTransactionMutation({ id, stage: newStage });
      if (result.error) err = result.error;
    }

    setPending(false);

    if (err) {
      console.error("[RestageSelect] failed:", err.message);
      setStage(prevStage);
      setError("Stage update failed — please try again.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-1">
      <Select
        label="Stage"
        options={stageOptions}
        value={stage}
        onChange={handleChange}
        disabled={pending}
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
