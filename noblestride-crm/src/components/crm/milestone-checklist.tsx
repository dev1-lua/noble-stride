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
