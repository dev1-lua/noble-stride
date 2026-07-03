// portal/partner/page.tsx — read-only partner view (design spec §5.4).
// Own profile + own referred deals only; fed entirely by the visibility projector.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadPartnerPortalData } from "@/server/visibility";
import { referralFunnel } from "@/server/partner-portal";
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
  const funnelSegments = [
    {
      key: "introduced",
      title: "Introduced",
      count: funnel.introduced,
      cls: "border-zinc-200 bg-zinc-50 text-zinc-700",
    },
    {
      key: "inProgress",
      title: "In Progress",
      count: funnel.inProgress,
      cls: "border-sky-200 bg-sky-50 text-sky-700",
    },
    {
      key: "signed",
      title: "Signed",
      count: funnel.signed,
      cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    {
      key: "lost",
      title: "Lost",
      count: funnel.lost,
      cls: "border-rose-200 bg-rose-50 text-rose-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Partner Overview</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Your referrals and fee-sharing status with NobleStride Capital
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-zinc-900">{profile.name}</div>
            <div className="mt-0.5 text-sm text-zinc-500">
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
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-zinc-100 text-zinc-500")
              }
            >
              {profile.feeSharingAgreement ? "Fee-sharing agreed" : "No fee-sharing agreement"}
            </span>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
              Partner agreement: {label("PartnerAgreementStatus", profile.partnerAgreementStatus)}
            </span>
          </div>
        </div>
        {profile.feeSharingTerms && (
          <p className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            <span className="font-medium text-zinc-700">Terms:</span> {profile.feeSharingTerms}
          </p>
        )}
      </section>

      {/* Referral conversion funnel: introduced → in progress → signed / lost */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Referral Funnel
        </h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
          {funnelSegments.map((seg, i) => (
            <div key={seg.key} className="flex flex-1 items-center gap-2">
              {i > 0 && <span className="hidden text-zinc-300 sm:block">→</span>}
              <div className={"flex-1 rounded-lg border px-3 py-2.5 " + seg.cls}>
                <div className="text-lg font-bold">{seg.count}</div>
                <div className="text-[11px] font-medium uppercase tracking-wide">{seg.title}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Expected fee on conversion (fee-share lifecycle, spec §3.6) */}
      {profile.feeSharingAgreement && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Expected Fee
          </h2>
          <p className="mt-1 text-sm text-emerald-900">
            <span className="font-semibold">
              {funnel.signed} signed referral{funnel.signed === 1 ? "" : "s"}
            </span>
            {profile.feeSharingTerms ? <> — {profile.feeSharingTerms}</> : null}. Fee-sharing is
            settled by NobleStride on conversion of each referred mandate.
          </p>
        </section>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-2xl font-bold text-zinc-900">{referredDeals.length}</div>
          <div className="text-xs text-zinc-500">Deals referred</div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-2xl font-bold text-emerald-700">{converted}</div>
          <div className="text-xs text-zinc-500">Converted (signed)</div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-2xl font-bold text-zinc-900">
            {referredDeals.length ? Math.round((converted / referredDeals.length) * 100) : 0}%
          </div>
          <div className="text-xs text-zinc-500">Conversion rate</div>
        </div>
      </div>

      <section className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
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
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-zinc-400">
                  No referred deals yet.
                </td>
              </tr>
            ) : (
              referredDeals.map((d, i) => (
                <tr key={i} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-zinc-900">{d.mandateName}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{d.clientName ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-xs font-medium " +
                        (d.converted
                          ? "bg-emerald-50 text-emerald-700"
                          : d.stage === "Lost"
                            ? "bg-rose-50 text-rose-600"
                            : "bg-sky-50 text-sky-700")
                      }
                    >
                      {label("MandateStage", d.stage)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600">
                    {d.dealSize != null ? formatMoney(d.dealSize, d.currency) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600">{d.feeSharingStatus}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
