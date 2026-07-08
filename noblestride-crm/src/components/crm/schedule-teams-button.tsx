"use client";
// Schedule-a-Teams-call button (Task 15). Rendered ONLY by a server parent
// that has already checked isConfigured("teams") AND resolved at least one
// attendee email — see src/app/(crm)/engagement/[id]/page.tsx. Mirrors
// send-esign-button.tsx: raw urql mutation string, router.refresh() on success.
//
// A time-picker is out of scope for this scaffold — start/end default to a
// day out from click time (30-minute slot), computed in the browser so the
// mutation always sends fresh values.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "urql";

const SCHEDULE = `
  mutation ScheduleMeeting($input: ScheduleMeetingInput!) {
    scheduleMeeting(input: $input)
  }
`;

export function ScheduleTeamsButton(props: {
  subject: string;
  attendees: { email: string; name?: string }[];
  engagementId?: string;
  transactionId?: string;
  investorId?: string;
}) {
  const router = useRouter();
  const [{ fetching }, schedule] = useMutation(SCHEDULE);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        className="rounded bg-[var(--t-tag-bg-violet)] px-3 py-1.5 text-sm font-medium text-[var(--t-tag-text-violet)] hover:opacity-80 disabled:opacity-50"
        disabled={fetching}
        onClick={async () => {
          const startAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
          const res = await schedule({
            input: {
              subject: props.subject,
              startAt: startAt.toISOString(),
              endAt: endAt.toISOString(),
              attendeesJson: JSON.stringify(props.attendees),
              engagementId: props.engagementId,
              transactionId: props.transactionId,
              investorId: props.investorId,
            },
          });
          if (res.error) setError(res.error.message);
          else router.refresh();
        }}
      >
        {fetching ? "Scheduling…" : "Schedule Teams call"}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
