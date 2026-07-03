// portal/investor/page.tsx — investor discovery list (design spec §5.3).
// Everything rendered here came out of the visibility projector; this page
// never touches raw records.
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadInvestorPortalData } from "@/server/visibility";
import { getViewpoint } from "@/server/viewpoint";
import { label } from "@/lib/vocab";
import { formatMoney } from "@/lib/money";
import { TierBadge } from "@/components/portal/tier-badge";

export const dynamic = "force-dynamic";

export default async function InvestorPortalPage() {
  const vp = await getViewpoint();
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");

  const { investor, deals } = await loadInvestorPortalData(prisma, vp.recordId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Investment Opportunities</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Prepared for <span className="font-medium text-zinc-700">{investor.name}</span> — showing
          opportunities matching your mandate
        </p>
      </div>

      {deals.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-zinc-600">No opportunities available right now.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Please contact your NobleStride advisor for more information.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {deals.map((deal) => (
            <Link
              key={deal.id}
              href={`/portal/investor/deals/${deal.id}`}
              className="group rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold text-zinc-900 group-hover:text-emerald-800">
                  {deal.name}
                </div>
                <TierBadge tier={deal.tier} />
              </div>
              <div className="mt-1 text-sm text-zinc-500">{deal.companyProfile.clientName}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {deal.companyProfile.sector.slice(0, 3).map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                  >
                    {label("Sector", s)}
                  </span>
                ))}
                {deal.dealTypeTicket.instrument.map((i) => (
                  <span
                    key={i}
                    className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600"
                  >
                    {label("Instrument", i)}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-zinc-500">Target raise</span>
                <span className="font-semibold text-zinc-900">
                  {deal.dealTypeTicket.targetRaise != null
                    ? formatMoney(deal.dealTypeTicket.targetRaise, deal.dealTypeTicket.currency)
                    : "On request"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
