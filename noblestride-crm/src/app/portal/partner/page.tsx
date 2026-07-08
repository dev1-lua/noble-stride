// portal/partner/page.tsx — read-only partner view (design spec §5.4).
// Own profile + own referred deals only; fed entirely by the visibility projector.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadPartnerPortalData } from "@/server/visibility";
import { referralFunnel, referralsByStage } from "@/server/partner-portal";
import { getViewpoint } from "@/server/viewpoint";
import { label } from "@/lib/vocab";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function PartnerPortalPage() {
  const vp = await getViewpoint();
  if (vp.role !== "partner" || !vp.recordId) redirect("/dashboard");

  const view = await loadPartnerPortalData(prisma, vp.recordId);
  const { profile, referredDeals } = view;
  const converted = referredDeals.filter((d) => d.converted).length;
  const funnel = referralFunnel(referredDeals);
  const stageRows = referralsByStage(
    referredDeals.map((d) => ({ stage: d.stage, dealSize: d.dealSize })),
  );
  const maxStageCount = Math.max(...stageRows.map((r) => r.count), 1);
  const funnelSegments = [
    {
      key: "introduced",
      title: "Introduced",
      count: funnel.introduced,
      cls: "bg-[var(--t-tag-bg-gray)] text-[var(--t-tag-text-gray)]",
    },
    {
      key: "inProgress",
      title: "In Progress",
      count: funnel.inProgress,
      cls: "bg-[var(--t-tag-bg-sky)] text-[var(--t-tag-text-sky)]",
    },
    {
      key: "signed",
      title: "Signed",
      count: funnel.signed,
      cls: "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]",
    },
    {
      key: "lost",
      title: "Lost",
      count: funnel.lost,
      cls: "bg-[var(--t-tag-bg-rose)] text-[var(--t-tag-text-rose)]",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Partner Overview</h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Your referrals and fee-sharing status with NobleStride Capital
        </p>
      </div>

      <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-[var(--text-primary)]">{profile.name}</div>
            <div className="mt-0.5 text-sm text-[var(--text-tertiary)]">
              {[
                profile.advisorType ? label("AdvisorType", profile.advisorType) : null,
                profile.organization,
              ]
                .filter(Boolean)
                .join(" · ") || "Referral partner"}
            </div>
          </div>
          <div className="flex gap-2">
            <span
              className={
                "rounded-full px-2.5 py-1 text-xs font-medium " +
                (profile.feeSharingAgreement
                  ? "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]"
                  : "bg-[var(--t-tag-bg-gray)] text-[var(--t-tag-text-gray)]")
              }
            >
              {profile.feeSharingAgreement ? "Fee-sharing agreed" : "No fee-sharing agreement"}
            </span>
            <span className="rounded-full bg-[var(--t-tag-bg-gray)] px-2.5 py-1 text-xs font-medium text-[var(--t-tag-text-gray)]">
              Partner agreement: {label("PartnerAgreementStatus", profile.partnerAgreementStatus)}
            </span>
          </div>
        </div>
        {profile.feeSharingTerms && (
          <p className="mt-3 rounded-md bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-secondary)]">Terms:</span> {profile.feeSharingTerms}
          </p>
        )}
      </section>

      {/* Referral conversion funnel: introduced → in progress → signed / lost */}
      <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          Referral Funnel
        </h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
          {funnelSegments.map((seg, i) => (
            <div key={seg.key} className="flex flex-1 items-center gap-2">
              {i > 0 && <span className="hidden text-[var(--text-tertiary)] sm:block">→</span>}
              <div className={"flex-1 rounded-lg px-3 py-2.5 " + seg.cls}>
                <div className="text-lg font-bold">{seg.count}</div>
                <div className="text-[11px] font-medium uppercase tracking-wide">{seg.title}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Referrals by stage (§13): count + total deal size per pipeline stage */}
      {stageRows.length > 0 && (
        <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            Referrals by Stage
          </h2>
          <div className="mt-3 space-y-2">
            {stageRows.map((row) => (
              <div key={row.stage} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-xs text-[var(--text-secondary)]">
                  {label("MandateStage", row.stage)}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                  <div
                    className={
                      "h-full rounded-full " +
                      (row.stage === "Signed"
                        ? "bg-[var(--accent)]"
                        : row.stage === "Lost"
                          ? "bg-slate-300"
                          : "bg-sky-500")
                    }
                    style={{ width: `${(row.count / maxStageCount) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right text-xs font-semibold tabular-nums text-[var(--text-primary)]">
                  {row.count}
                </span>
                <span className="w-16 text-right text-xs text-[var(--text-tertiary)]">
                  {row.totalSize > 0 ? formatMoney(row.totalSize) : "—"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Expected fee on conversion (fee-share lifecycle, spec §3.6) */}
      {profile.feeSharingAgreement && (
        <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--t-tag-bg-emerald)] p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--t-tag-text-emerald)]">
            Expected Fee
          </h2>
          <p className="mt-1 text-sm text-[var(--t-tag-text-emerald)]">
            <span className="font-semibold">
              {funnel.signed} signed referral{funnel.signed === 1 ? "" : "s"}
            </span>
            {profile.feeSharingTerms ? <> — {profile.feeSharingTerms}</> : null}. Fee-sharing is
            settled by NobleStride on conversion of each referred mandate.
          </p>
        </section>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
          <div className="text-2xl font-bold text-[var(--text-primary)]">{referredDeals.length}</div>
          <div className="text-xs text-[var(--text-tertiary)]">Deals referred</div>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
          <div className="text-2xl font-bold text-[var(--accent-hover)]">{converted}</div>
          <div className="text-xs text-[var(--text-tertiary)]">Converted (signed)</div>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            {referredDeals.length ? Math.round((converted / referredDeals.length) * 100) : 0}%
          </div>
          <div className="text-xs text-[var(--text-tertiary)]">Conversion rate</div>
        </div>
      </div>

      <section className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              <th className="px-4 py-3">Referred deal</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Deal size</th>
              <th className="px-4 py-3">Fee-sharing</th>
            </tr>
          </thead>
          <tbody>
            {referredDeals.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-[var(--text-tertiary)]">
                  No referred deals yet.
                </td>
              </tr>
            ) : (
              referredDeals.map((d, i) => (
                <tr key={i} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">{d.mandateName}</td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)]">{d.clientName ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-xs font-medium " +
                        (d.converted
                          ? "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]"
                          : d.stage === "Lost"
                            ? "bg-[var(--t-tag-bg-rose)] text-[var(--t-tag-text-rose)]"
                            : "bg-[var(--t-tag-bg-sky)] text-[var(--t-tag-text-sky)]")
                      }
                    >
                      {label("MandateStage", d.stage)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                    {d.dealSize != null ? formatMoney(d.dealSize, d.currency) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)]">{d.feeSharingStatus}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
