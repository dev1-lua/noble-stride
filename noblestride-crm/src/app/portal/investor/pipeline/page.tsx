// portal/investor/pipeline — the investor's OWN journey across deals.
// Everything rendered here came out of loadInvestorPipeline (visibility
// engine): own stage/milestones/lastContact/termSheet only — never internal
// feedback, probability, notes, amounts, owners or other investors.
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadInvestorPipeline } from "@/server/visibility";
import { getViewpoint } from "@/server/viewpoint";
import { label } from "@/lib/vocab";
import { MILESTONE_ORDER } from "@/lib/milestones";
import { MilestoneStepper } from "@/components/portal/milestone-stepper";

export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function InvestorPipelinePage() {
  const vp = await getViewpoint();
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");

  const items = await loadInvestorPipeline(prisma, vp.recordId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">My Pipeline</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Your fund&apos;s progress on each opportunity — the {MILESTONE_ORDER.length}-step
          NobleStride investment cycle from teaser review to completion.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-zinc-600">No active engagements yet.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Express interest on an opportunity to start your journey.
          </p>
          <Link
            href="/portal/investor"
            className="mt-4 inline-block rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Browse opportunities
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(({ deal, own }) => {
            const declined = own.stage === "Declined";
            return (
              <Link
                key={deal.id}
                href={`/portal/investor/deals/${deal.id}`}
                className={`block rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${
                  declined ? "opacity-60" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-zinc-900">{deal.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {deal.companyProfile.sector.slice(0, 3).map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                        >
                          {label("Sector", s)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      declined
                        ? "bg-zinc-100 text-zinc-500"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {label("EngagementStage", own.stage)}
                  </span>
                </div>

                <div className="mt-4">
                  <MilestoneStepper completedKeys={own.milestoneKeys} muted={declined} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-zinc-500">
                  <span>
                    <span className="font-semibold text-zinc-700">
                      {own.milestoneKeys.length} of {MILESTONE_ORDER.length}
                    </span>{" "}
                    milestones
                  </span>
                  <span>
                    Last contact:{" "}
                    {own.lastContact ? DATE_FMT.format(own.lastContact) : "—"}
                  </span>
                  {own.termSheetIssued && (
                    <span className="font-medium text-emerald-700">
                      Term sheet issued
                      {own.termSheetDate ? ` · ${DATE_FMT.format(own.termSheetDate)}` : ""}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
