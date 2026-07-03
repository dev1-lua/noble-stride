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
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Your engagement summary with NobleStride Capital —{" "}
          <span className="font-medium text-zinc-700">{data.investor.name}</span>
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="text-xl font-bold text-zinc-900">{k.value}</div>
            <div className="mt-0.5 text-xs text-zinc-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Own pipeline by stage */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Your Pipeline by Stage
        </h2>
        {pipeline.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">No active engagements yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {pipeline.map((p) => (
              <div key={p.stage} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-xs text-zinc-600">
                  {label("EngagementStage", p.stage)}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-emerald-600"
                    style={{ width: `${(p.count / maxStage) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right text-xs font-semibold tabular-nums text-zinc-900">
                  {p.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Own disbursements by quarter */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Your Disbursements by Quarter
        </h2>
        {data.disbursementByPeriod.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">No disbursements recorded.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <th className="py-2">Period</th>
                <th className="py-2">Disbursed</th>
                <th className="py-2">Pending</th>
              </tr>
            </thead>
            <tbody>
              {data.disbursementByPeriod.map((row) => (
                <tr key={`${row.year}-${row.quarter}`} className="border-b border-zinc-100 last:border-0">
                  <td className="py-2 font-medium text-zinc-900">
                    Q{row.quarter} {row.year}
                  </td>
                  <td className="py-2 text-zinc-600">{formatMoney(row.disbursed) || "$0"}</td>
                  <td className="py-2 text-zinc-600">{formatMoney(row.pending) || "$0"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
