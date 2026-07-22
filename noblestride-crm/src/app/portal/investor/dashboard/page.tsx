// portal/investor/dashboard/page.tsx — investor analytics (SPEC §13).
// Own data only; everything rendered here came out of loadInvestorDashboard
// (visibility engine) — never other investors, feedback, probability or team
// identities.
import { redirect } from "next/navigation";
import { Target, Handshake, Landmark, CheckCircle2, Clock } from "lucide-react";
import { prisma } from "@/lib/db";
import { loadInvestorDashboard } from "@/server/visibility";
import { getViewpoint } from "@/server/viewpoint";
import { LABELS, label } from "@/lib/vocab";
import { formatMoney } from "@/lib/money";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function InvestorDashboardPage() {
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");

  const data = await loadInvestorDashboard(prisma, vp.recordId);

  // Render stages in vocab order (loader returns insertion order).
  const stageOrder = Object.keys(LABELS.EngagementStage);
  const pipeline = [...data.pipeline].sort(
    (a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage),
  );
  const maxStage = Math.max(...pipeline.map((p) => p.count), 1);

  const kpis = [
    { label: "Matching opportunities", value: String(data.matchingOpportunities), icon: <Target className="h-4 w-4" /> },
    { label: "Deals engaged", value: String(data.engagedDeals), icon: <Handshake className="h-4 w-4" /> },
    { label: "Committed", value: formatMoney(data.disbursement.committed) || "$0", icon: <Landmark className="h-4 w-4" /> },
    { label: "Disbursed", value: formatMoney(data.disbursement.disbursed) || "$0", icon: <CheckCircle2 className="h-4 w-4" /> },
    { label: "Pending", value: formatMoney(data.disbursement.pending) || "$0", icon: <Clock className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Your engagement summary with Noblestride Capital —{" "}
          <span className="font-medium text-[var(--text-secondary)]">{data.investor.name}</span>
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <StatCard key={k.label} label={k.label} value={k.value} icon={k.icon} />
        ))}
      </div>

      {/* Own pipeline by stage */}
      <Card>
        <CardHeader>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            Your Pipeline by Stage
          </h2>
        </CardHeader>
        <CardBody>
          {pipeline.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No active engagements yet.</p>
          ) : (
            <div className="space-y-2">
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
        </CardBody>
      </Card>

      {/* Own disbursements by quarter */}
      <Card>
        <CardHeader>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            Your Disbursements by Quarter
          </h2>
        </CardHeader>
        <CardBody>
          {data.disbursementByPeriod.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No disbursements recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
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
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
