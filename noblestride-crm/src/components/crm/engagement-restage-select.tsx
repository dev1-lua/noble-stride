"use client";

// engagement-restage-select.tsx — Small client component: a compact Select that
// moves an Engagement to a new pipeline stage (12-stage EngagementStage).
// Fires updateEngagement via urql on change, then router.refresh() so the RSC
// board re-queries authoritative DB state. Mirrors restage-select.tsx.

import { useState } from "react";
import { useMutation } from "urql";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";
import type { SelectOption } from "@/components/ui";

// EngagementInput requires transactionId + investorId, so the card passes them
// through unchanged alongside the new stage.
const UPDATE_ENGAGEMENT_STAGE = `
  mutation UpdateEngagementStage($id: ID!, $input: EngagementInput!) {
    updateEngagement(id: $id, input: $input) { id engagementStage }
  }
`;

interface EngagementRestageSelectProps {
  id: string;
  transactionId: string;
  investorId: string;
  currentStage: string;
  stageOptions: SelectOption[];
}

export function EngagementRestageSelect({
  id,
  transactionId,
  investorId,
  currentStage,
  stageOptions,
}: EngagementRestageSelectProps) {
  const router = useRouter();
  const [stage, setStage] = useState(currentStage);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [, executeMutation] = useMutation(UPDATE_ENGAGEMENT_STAGE);

  async function handleChange(newStage: string) {
    if (newStage === stage || pending) return;
    const prevStage = stage;
    setStage(newStage);
    setError(null);
    setPending(true);

    const result = await executeMutation({
      id,
      input: { transactionId, investorId, engagementStage: newStage },
    });

    setPending(false);

    if (result.error) {
      console.error("[EngagementRestageSelect] failed:", result.error.message);
      setStage(prevStage);
      const rawMessage = result.error.graphQLErrors?.[0]?.message ?? result.error.message;
      const message = rawMessage.startsWith("[GraphQL] ")
        ? rawMessage.slice("[GraphQL] ".length)
        : rawMessage;
      setError(message || "Stage update failed — please try again.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-1">
      <Select
        options={stageOptions}
        value={stage}
        onChange={handleChange}
        disabled={pending}
        className="h-7 text-xs"
        aria-label="Engagement stage"
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
