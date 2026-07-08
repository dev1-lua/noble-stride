// portal/investor/dashboard/page.tsx — investor analytics (SPEC §13).
// Own data only; everything rendered here came out of loadInvestorDashboard
// (visibility engine) — never other investors, feedback, probability or team
// identities.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadInvestorDashboard } from "@/server/visibility";
import { getViewpoint } from "@/server/viewpoint";
import { LABELS, label } from "@/lib/vocab";
import { formatMoney } from "@/lib/money";
import { StatCard } from "@/components/ui/stat-card";

export const dynamic = "force-dynamic";

export default async function InvestorDashboardPage() {
  const vp = await getViewpoint();
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");

  const data = await loadInvestorDashboard(prisma, vp.recordId);

  // Render stages in vocab order (loader returns insertion order).
  const stageOrder = Object.keys(LABELS.EngagementStage);
  const pipeline = [...data.pipeline].sort(
    (a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage),
  );
  const maxStage = Math.max(...pipeline.map((p) => p.count), 1);

  const kpis = [
    { label: "Matching opportunities", value: String(data.matchingOpportunities) },
    { label: "Deals engaged", value: String(data.engagedDeals) },
    { label: "Committed", value: formatMoney(data.disbursement.committed) || "$0" },
    { label: "Disbursed", value: formatMoney(data.disbursement.disbursed) || "$0" },
    { label: "Pending", value: formatMoney(data.disbursement.pending) || "$0" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Your engagement summary with NobleStride Capital —{" "}
          <span className="font-medium text-[var(--text-secondary)]">{data.investor.name}</span>
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <StatCard key={k.label} label={k.label} value={k.value} />
        ))}
      </div>

      {/* Own pipeline by stage */}
      <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          Your Pipeline by Stage
        </h2>
        {pipeline.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-tertiary)]">No active engagements yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {pipeline.map((p) => (
              <div key={p.stage} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-xs text-[var(--text-secondary)]">
                  {label("EngagementStage", p.stage)}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${(p.count / maxStage) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right text-xs font-semibold tabular-nums text-[var(--text-primary)]">
                  {p.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Own disbursements by quarter */}
      <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          Your Disbursements by Quarter
        </h2>
        {data.disbursementByPeriod.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-tertiary)]">No disbursements recorded.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                <th className="py-2">Period</th>
                <th className="py-2">Disbursed</th>
                <th className="py-2">Pending</th>
              </tr>
            </thead>
            <tbody>
              {data.disbursementByPeriod.map((row) => (
                <tr key={`${row.year}-${row.quarter}`} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="py-2 font-medium text-[var(--text-primary)]">
                    Q{row.quarter} {row.year}
                  </td>
                  <td className="py-2 text-[var(--text-secondary)]">{formatMoney(row.disbursed) || "$0"}</td>
                  <td className="py-2 text-[var(--text-secondary)]">{formatMoney(row.pending) || "$0"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
