// F6b.4 staff side (image31): who at the fund is following this deal.
//
// Read-only by design. Participants are the investor's own roster — staff
// adding people to somebody else's team would be a different feature, and a
// worse one. The empty state says where the control lives instead.

import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { ParticipantRow } from "@/server/services/engagement-participants";

export function ParticipantsCard({ participants }: { participants: ParticipantRow[] }) {
  return (
    <Card id="participants" className="scroll-mt-24">
      <CardHeader>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Participants
          {participants.length > 0 && (
            <Badge tone="neutral" className="ml-2">
              {participants.length}
            </Badge>
          )}
        </h2>
      </CardHeader>
      <CardBody>
        {participants.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">
            No participants — the investor can add onboarded colleagues from their portal.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]" data-testid="staff-participants">
            {participants.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{p.name}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {[p.jobTitle, p.email].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <p className="text-xs text-[var(--text-tertiary)]">
                  Added {formatDate(p.addedAt)}
                  {p.addedByName ? ` by ${p.addedByName}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
