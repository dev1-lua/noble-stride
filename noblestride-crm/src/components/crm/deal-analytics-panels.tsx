// deal-analytics-panels.tsx — presentational panels for the spec §13 pass-2
// dashboards: stage-change feed, per-investor engagement rollup, historical
// year/quarter engagement summary, partner referral conversion funnel.

import Link from "next/link";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui";
import { label } from "@/lib/vocab";
import { daysAgoLabel } from "@/lib/format";
import type {
  StageChangeFeedItem,
  InvestorEngagementRollupRow,
  HistoricalEngagementRow,
  PartnerFunnelRow,
} from "@/server/services/dashboard";

const FEED_FIELD_LABELS: Record<string, string> = {
  stage: "Stage",
  dealStatus: "Deal Status",
  engagementStage: "Engagement Stage",
  dealMilestone: "Milestone",
  name: "Name",
  registrationNo: "Registration No.",
  primaryContact: "Primary Contact",
};

const FEED_VOCAB_GROUPS: Record<string, string> = {
  dealStatus: "DealStatus",
  engagementStage: "EngagementStage",
  dealMilestone: "DealMilestone",
};

const feedValue = (field: string, value: string | null) =>
  value == null ? "—" : label(FEED_VOCAB_GROUPS[field] ?? field, value);

export function StageChangeFeedList({ items }: { items: StageChangeFeedItem[] }) {
  if (items.length === 0) return <p className="text-xs text-[var(--text-tertiary)]">No changes recorded yet.</p>;
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3">
          <span className="mt-1.5 h-2 w-2 rounded-full bg-accent flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap text-sm">
              {item.entityHref ? (
                <Link href={item.entityHref} className="font-medium text-[var(--text-primary)] hover:text-accent transition-colors">
                  {item.entityLabel}
                </Link>
              ) : (
                <span className="font-medium text-[var(--text-primary)]">{item.entityLabel}</span>
              )}
              <span className="text-xs font-medium text-[var(--text-tertiary)]">{FEED_FIELD_LABELS[item.field] ?? item.field}</span>
              <span className="text-[var(--text-secondary)]">
                {feedValue(item.field, item.fromValue)} <span className="text-[var(--text-tertiary)]">→</span> {feedValue(item.field, item.toValue)}
              </span>
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              {daysAgoLabel(item.changedAt)} · {item.actorName ?? label("ActorSource", item.createdSource)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function InvestorRollupTable({ rows }: { rows: InvestorEngagementRollupRow[] }) {
  if (rows.length === 0) return <p className="text-xs text-[var(--text-tertiary)]">No engagements yet.</p>;
  return (
    <Table>
      <THead>
        <Tr className="hover:bg-transparent">
          <Th>Investor</Th>
          <Th>Under Review</Th>
          <Th>Rejected</Th>
          <Th>Invested</Th>
        </Tr>
      </THead>
      <TBody>
        {rows.map((r) => (
          <Tr key={r.investorId}>
            <Td>
              <Link href={`/investors/${r.investorId}`} className="font-medium text-[var(--text-primary)] hover:text-accent transition-colors">
                {r.name}
              </Link>
            </Td>
            <Td className="tabular-nums">{r.underReview}</Td>
            <Td className="tabular-nums">{r.rejected}</Td>
            <Td className="tabular-nums">{r.invested}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

export function HistoricalEngagementTable({ rows }: { rows: HistoricalEngagementRow[] }) {
  if (rows.length === 0) return <p className="text-xs text-[var(--text-tertiary)]">No dated engagements yet.</p>;
  return (
    <Table>
      <THead>
        <Tr className="hover:bg-transparent">
          <Th>Period</Th>
          <Th>Active</Th>
          <Th>Invested</Th>
          <Th>Declined</Th>
        </Tr>
      </THead>
      <TBody>
        {rows.map((r) => (
          <Tr key={`${r.year}-${r.quarter}`}>
            <Td className="font-medium text-[var(--text-primary)]">{r.year} Q{r.quarter}</Td>
            <Td className="tabular-nums">{r.active}</Td>
            <Td className="tabular-nums">{r.invested}</Td>
            <Td className="tabular-nums">{r.declined}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

export function PartnerFunnelTable({ rows }: { rows: PartnerFunnelRow[] }) {
  if (rows.length === 0) return <p className="text-xs text-[var(--text-tertiary)]">No partner referrals yet.</p>;
  return (
    <Table>
      <THead>
        <Tr className="hover:bg-transparent">
          <Th>Partner</Th>
          <Th>Introduced</Th>
          <Th>Progressed</Th>
          <Th>Won</Th>
          <Th>Lost</Th>
        </Tr>
      </THead>
      <TBody>
        {rows.map((r) => (
          <Tr key={r.partnerId}>
            <Td>
              <Link href={`/partners/${r.partnerId}`} className="font-medium text-[var(--text-primary)] hover:text-accent transition-colors">
                {r.name}
              </Link>
            </Td>
            <Td className="tabular-nums">{r.introduced}</Td>
            <Td className="tabular-nums">{r.progressed}</Td>
            <Td className="tabular-nums">{r.won}</Td>
            <Td className="tabular-nums">{r.lost}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
