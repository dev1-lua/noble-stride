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
import { getBoolSetting } from "@/server/services/app-settings";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { OnboardingStepper, type OnboardingStep } from "@/components/portal/onboarding-stepper";

export const dynamic = "force-dynamic";

export default async function InvestorDashboardPage() {
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");

  // image30 feedback: finance KPIs (Committed / Disbursed / Pending) and the
  // disbursements-by-quarter table are hidden unless an admin turns on
  // `portal.dashboard.financeTiles` under /settings/app. Values come from CRM
  // Engagement records — investors never edit them.
  const [data, showFinance] = await Promise.all([
    loadInvestorDashboard(prisma, vp.recordId),
    getBoolSetting("portal.dashboard.financeTiles", false),
  ]);

  // §2c: when the finance tiles are hidden — the default — the fund's home is
  // a checklist of what it still owes us, the way Aika's is. Every outstanding
  // step links to the page that completes it, so onboarding needs no emails.
  const onboarding: OnboardingStep[] | null = showFinance
    ? null
    : await (async (): Promise<OnboardingStep[]> => {
        const investor = await prisma.investor.findUniqueOrThrow({
          where: { id: vp.recordId as string },
          select: {
            onboardingStatus: true,
            ndaStatus: true,
            sectorFocus: true,
            geographicFocus: true,
            ticketMin: true,
          },
        });
        const criteria = await prisma.document.count({
          where: {
            investorId: vp.recordId as string,
            type: "InvestmentCriteria",
            isCurrent: true,
          },
        });
        const profileComplete =
          investor.sectorFocus.length > 0 && investor.geographicFocus.length > 0 && investor.ticketMin != null;
        return [
          {
            key: "account",
            label: "Account created",
            done: true,
            href: "/portal/investor",
            hint: "",
          },
          {
            key: "profile",
            label: "Fund profile",
            done: profileComplete,
            href: "/portal/investor/profile",
            hint: "Sectors, geographies and ticket size — this is what we match opportunities against.",
          },
          {
            key: "nda",
            label: "NDA signed",
            done: investor.ndaStatus !== "None",
            href: "/portal/investor/nda",
            hint: "Sign the Noblestride NDA, or upload your own, to unlock detailed deal information.",
          },
          {
            key: "criteria",
            label: "Investment criteria uploaded",
            done: criteria > 0,
            href: "/portal/investor/profile#documents",
            hint: "Optional — a one-page mandate summary helps us shortlist better.",
          },
          {
            key: "approved",
            label: "Approved by Noblestride",
            done: investor.onboardingStatus === "Approved",
            href: "/portal/investor",
            hint: "We are reviewing your registration. Nothing further is needed from you.",
            waiting: true,
          },
        ];
      })();

  // Render stages in vocab order (loader returns insertion order).
  const stageOrder = Object.keys(LABELS.EngagementStage);
  const pipeline = [...data.pipeline].sort(
    (a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage),
  );
  const maxStage = Math.max(...pipeline.map((p) => p.count), 1);

  const kpis = [
    { label: "Matching opportunities", value: String(data.matchingOpportunities), icon: <Target className="h-4 w-4" /> },
    { label: "Deals engaged", value: String(data.engagedDeals), icon: <Handshake className="h-4 w-4" /> },
    ...(showFinance
      ? [
          { label: "Committed", value: formatMoney(data.disbursement.committed) || "$0", icon: <Landmark className="h-4 w-4" /> },
          { label: "Disbursed", value: formatMoney(data.disbursement.disbursed) || "$0", icon: <CheckCircle2 className="h-4 w-4" /> },
          { label: "Pending", value: formatMoney(data.disbursement.pending) || "$0", icon: <Clock className="h-4 w-4" /> },
        ]
      : []),
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
      <div
        data-testid="portal-kpis"
        className={showFinance ? "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" : "grid grid-cols-2 gap-4"}
      >
        {kpis.map((k) => (
          <StatCard key={k.label} label={k.label} value={k.value} icon={k.icon} />
        ))}
      </div>

      {onboarding && <OnboardingStepper steps={onboarding} />}

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

      {/* Own disbursements by quarter — finance data, gated with the tiles */}
      {showFinance && (
      <Card data-testid="portal-disbursements">
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
      )}
    </div>
  );
}
