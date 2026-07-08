// deal-summary-panel.tsx — Deal-summary header panel (Task 13, queue-rework spec).
// Presentational only: no data fetching, no Prisma types, no Decimals. The
// mandate/transaction detail pages (RSC) build this plain DTO from the
// already-loaded record and mount <DealSummaryPanel/> right under the page
// header, above the existing "Key Facts"/"Deal Facts" panels.

import { Avatar, Card, CardHeader, CardBody, Chip, Badge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { STATUS_DOT } from "@/lib/vocab";

export interface DealSummaryProps {
  kind: "mandate" | "transaction";
  statusLabel: string;
  statusValue: string | null;
  stageLabel: string;
  daysInStage: number;
  leadName: string | null;
  assistantName: string | null;
  nextAction: string | null;
  dateOnboarded: string | null;
  // mandate
  dealSize?: number | null;
  sectors?: string[];
  ndaStatusLabel?: string;
  eaStatusLabel?: string;
  referrer?: string | null;
  // transaction
  targetRaise?: number | null;
  instruments?: string[];
  milestoneLabel?: string;
  probability?: number | null;
  docReadiness?: { label: string; state: string }[];
  engagement?: { investors: number; total: number; disbursed: number; pending: number } | null;
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 text-sm text-[var(--text-primary)]">{children}</dd>
    </div>
  );
}

function PersonCell({ name }: { name: string | null }) {
  if (!name) return <span className="text-[var(--text-tertiary)]">—</span>;
  return (
    <span className="flex items-center gap-2">
      <Avatar name={name} size="sm" />
      <span className="font-medium text-[var(--text-primary)]">{name}</span>
    </span>
  );
}

/**
 * DealSummaryPanel — compact "at a glance" header for mandate/transaction
 * detail pages. Status chip color comes from `STATUS_DOT[statusValue]`;
 * everything else is pre-formatted plain values from the server component.
 */
export function DealSummaryPanel(props: DealSummaryProps) {
  const {
    kind, statusLabel, statusValue, stageLabel, daysInStage, leadName, assistantName,
    nextAction, dateOnboarded, dealSize, sectors, ndaStatusLabel, eaStatusLabel, referrer,
    targetRaise, instruments, milestoneLabel, probability, docReadiness, engagement,
  } = props;

  const dotClass = statusValue ? (STATUS_DOT[statusValue] ?? "bg-zinc-400") : "bg-zinc-300";

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Deal Summary</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-secondary)]">
            <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dotClass}`} />
            {statusLabel || "—"}
          </span>
          <span className="text-[var(--text-tertiary)]">·</span>
          <span className="text-[var(--text-secondary)]">
            {stageLabel}{" "}
            <span className="text-[var(--text-tertiary)]">
              ({daysInStage} day{daysInStage === 1 ? "" : "s"} in stage)
            </span>
          </span>
        </div>
      </CardHeader>
      <CardBody>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          <Cell label="Lead">
            <PersonCell name={leadName} />
          </Cell>
          <Cell label="Assistant">
            <PersonCell name={assistantName} />
          </Cell>
          <Cell label="Date Onboarded">{dateOnboarded ? formatDate(dateOnboarded) : "—"}</Cell>
          <Cell label="Next Action">{nextAction || "—"}</Cell>

          {kind === "mandate" ? (
            <>
              <Cell label="Deal Size">{dealSize != null ? formatMoney(dealSize) : "—"}</Cell>
              <Cell label="Sector">
                {sectors && sectors.length > 0 ? (
                  <span className="flex flex-wrap gap-1">
                    {sectors.map((s) => (
                      <Chip key={s} value={s} group="Sector" />
                    ))}
                  </span>
                ) : (
                  <span className="text-[var(--text-tertiary)]">—</span>
                )}
              </Cell>
              <Cell label="NDA">
                <Badge tone="neutral">{ndaStatusLabel || "—"}</Badge>
              </Cell>
              <Cell label="EA">
                <Badge tone="neutral">{eaStatusLabel || "—"}</Badge>
              </Cell>
              {referrer && <Cell label="Referrer">{referrer}</Cell>}
            </>
          ) : (
            <>
              <Cell label="Target Raise">{targetRaise != null ? formatMoney(targetRaise) : "—"}</Cell>
              <Cell label="Instrument">
                {instruments && instruments.length > 0 ? (
                  <span className="flex flex-wrap gap-1">
                    {instruments.map((i) => (
                      <Chip key={i} value={i} group="Instrument" />
                    ))}
                  </span>
                ) : (
                  <span className="text-[var(--text-tertiary)]">—</span>
                )}
              </Cell>
              {milestoneLabel && (
                <Cell label="Milestone">
                  <Badge tone="info">{milestoneLabel}</Badge>
                </Cell>
              )}
              {probability != null && <Cell label="Probability">{probability}%</Cell>}
              {docReadiness && docReadiness.length > 0 && (
                <Cell label="Doc Readiness">
                  <span className="flex flex-wrap gap-1">
                    {docReadiness.map((d) => (
                      <Badge
                        key={d.label}
                        tone={d.state === "Signed" || d.state === "Complete" ? "success" : "neutral"}
                      >
                        {d.label}
                      </Badge>
                    ))}
                  </span>
                </Cell>
              )}
              {engagement && (
                <div className="col-span-2 sm:col-span-3 lg:col-span-4">
                  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Engagement</dt>
                  <dd className="mt-1 text-sm text-[var(--text-primary)]">
                    {engagement.investors} investor{engagement.investors === 1 ? "" : "s"} ·{" "}
                    {formatMoney(engagement.total)} total · {formatMoney(engagement.disbursed)} disbursed ·{" "}
                    {formatMoney(engagement.pending)} pending
                  </dd>
                </div>
              )}
            </>
          )}
        </dl>
      </CardBody>
    </Card>
  );
}
