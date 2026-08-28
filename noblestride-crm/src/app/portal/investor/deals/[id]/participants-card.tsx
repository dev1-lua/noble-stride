// F6b.4 (image31): "the investor should be able to add the onboarded members of
// their team as participants of a deal."
//
// A plain server component with two form actions — no client state to hold. The
// copy states the constraint up front (§2c: Aika's invite modals say what will
// happen) so a fund is not left guessing why a colleague is missing from the
// list: they have not accepted a portal invitation yet.

import Link from "next/link";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import type { ParticipantRow } from "@/server/services/engagement-participants";
import { addParticipantAction, removeParticipantAction } from "./actions";

const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function ParticipantsCard({
  dealId,
  participants,
  eligible,
  canEdit,
  notice,
}: {
  dealId: string;
  participants: ParticipantRow[];
  eligible: { personId: string; name: string; email: string | null }[];
  canEdit: boolean;
  notice?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Participants</h2>
      </CardHeader>
      <CardBody className="space-y-4" data-testid="participants-card">
        <p className="text-sm text-[var(--text-secondary)]">
          Participants can follow this deal&apos;s progress. They must already have portal access.
        </p>

        {notice && (
          <p
            data-testid="participant-notice"
            className={
              "rounded-md px-3 py-2 text-xs " +
              (notice === "added" || notice === "removed"
                ? "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]"
                : "bg-[var(--t-tag-bg-amber)] text-[var(--t-tag-text-amber)]")
            }
          >
            {notice === "added"
              ? "Added — they can see this deal in their portal."
              : notice === "removed"
                ? "Removed from this deal."
                : notice === "primary"
                  ? "The primary contact always follows the deal."
                  : notice === "not-onboarded"
                    ? "Only onboarded colleagues with portal access can be added. Invite them from the Team page first."
                    : "We couldn't do that. Please try again."}
          </p>
        )}

        {participants.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">
            No participants yet — only your fund&apos;s primary contact is following this deal.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {participants.map((p) => (
              <li
                key={p.id}
                data-testid="participant-row"
                className="flex flex-wrap items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{p.name}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {[p.jobTitle, p.email].filter(Boolean).join(" · ")}
                    {p.email || p.jobTitle ? " · " : ""}
                    added {DATE_FMT.format(p.addedAt)}
                  </p>
                </div>
                {canEdit && (
                  <form action={removeParticipantAction}>
                    <input type="hidden" name="dealId" value={dealId} />
                    <input type="hidden" name="personId" value={p.personId} />
                    <button
                      type="submit"
                      data-testid={`remove-participant-${p.personId}`}
                      className="rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]"
                    >
                      Remove
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit ? (
          eligible.length > 0 ? (
            <form action={addParticipantAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="dealId" value={dealId} />
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--text-tertiary)]">Add a colleague</span>
                <select
                  name="personId"
                  required
                  data-testid="participant-select"
                  className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                >
                  {eligible.map((p) => (
                    <option key={p.personId} value={p.personId}>
                      {p.name}
                      {p.email ? ` — ${p.email}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                data-testid="add-participant"
                className="rounded bg-[var(--t-tag-bg-emerald)] px-3 py-2 text-sm font-medium text-[var(--t-tag-text-emerald)] hover:opacity-80"
              >
                Add
              </button>
            </form>
          ) : (
            <p className="text-xs text-[var(--text-tertiary)]">
              Everyone with portal access is already following this deal.{" "}
              <Link href="/portal/investor/team" className="font-medium text-[var(--accent-hover)] hover:underline">
                Invite a colleague
              </Link>{" "}
              to add more.
            </p>
          )
        ) : (
          <p className="text-xs text-[var(--text-tertiary)]">
            A team member with edit access can add or remove participants.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
