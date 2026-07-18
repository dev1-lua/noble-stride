// stage-history.tsx — Shared server component rendering StageChange history
// (SPEC §7.1): reverse-chronological "<from> → <to> · <relative date> · <actor>".

import { Card, CardHeader, CardBody } from "@/components/ui";
import { label } from "@/lib/vocab";
import { daysAgoLabel } from "@/lib/format";

export interface StageHistoryItem {
  id: string;
  field: string; // "stage" | "dealStatus" | "engagementStage" | "dealMilestone"
  fromValue: string | null;
  toValue: string;
  changedAt: Date;
  changedByName?: string | null;
  createdSource: string; // ActorSource
}

const FIELD_LABELS: Record<string, string> = {
  stage: "Stage",
  dealStatus: "Deal Status",
  engagementStage: "Engagement Stage",
  dealMilestone: "Milestone",
  name: "Name",
  registrationNo: "Registration No.",
  primaryContact: "Primary Contact",
};

/** Vocab group backing a StageChange.field value's from/to labels. */
function vocabGroupFor(field: string, stageGroup: string): string {
  switch (field) {
    case "stage":
      return stageGroup;
    case "dealStatus":
      return "DealStatus";
    case "engagementStage":
      return "EngagementStage";
    case "dealMilestone":
      return "DealMilestone";
    default:
      return field;
  }
}

export function StageHistory({
  items,
  stageGroup,
  title = "Stage History",
}: {
  items: StageHistoryItem[];
  /** Vocab group for the entity's own "stage" field — e.g. "MandateStage". */
  stageGroup?: "MandateStage" | "TransactionStage" | "AdvisoryStage" | "EngagementStage";
  title?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
      </CardHeader>
      <CardBody>
        {items.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">No stage changes recorded yet</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const group = vocabGroupFor(item.field, stageGroup ?? "MandateStage");
              const from = item.fromValue ? label(group, item.fromValue) : "—";
              const to = label(group, item.toValue);
              const actorLabel = item.changedByName ?? label("ActorSource", item.createdSource);
              return (
                <li key={item.id} className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-accent flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-[var(--text-secondary)]">
                        {FIELD_LABELS[item.field] ?? item.field}
                      </span>
                      <span className="text-sm text-[var(--text-primary)]">
                        {from} <span className="text-[var(--text-tertiary)]">→</span> {to}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                      {daysAgoLabel(item.changedAt)} · {actorLabel}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
