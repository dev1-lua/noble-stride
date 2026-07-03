// portal/investor/deals/[id]/page.tsx — tier-gated deal view (spec §5.2).
// Renders ONLY what the visibility projector returned for this investor's tier.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadInvestorPortalData, loadOwnEngagementForDeal } from "@/server/visibility";
import { getViewpoint } from "@/server/viewpoint";
import { label } from "@/lib/vocab";
import { formatMoney } from "@/lib/money";
import { MILESTONE_ORDER, MILESTONE_LABELS } from "@/lib/milestones";
import { TierBadge } from "@/components/portal/tier-badge";
import { expressInterest } from "./actions";

export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2">
      <dt className="text-sm text-zinc-500">{k}</dt>
      <dd className="text-right text-sm font-medium text-zinc-900">{v ?? "—"}</dd>
    </div>
  );
}

function CheckIcon({ done }: { done: boolean }) {
  if (!done) {
    return (
      <span className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded-full border border-zinc-300 bg-white" />
    );
  }
  return (
    <svg
      viewBox="0 0 16 16"
      className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-emerald-600 text-white"
      aria-hidden
    >
      <path
        d="M4.5 8.5l2.5 2.5 4.5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function InvestorDealPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ interest?: string }>;
}) {
  const vp = await getViewpoint();
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");

  const { id } = await params;
  const { interest } = await searchParams;
  const { deals } = await loadInvestorPortalData(prisma, vp.recordId);
  const deal = deals.find((d) => d.id === id);
  if (!deal) notFound();

  const journey = await loadOwnEngagementForDeal(prisma, vp.recordId, id);

  const fin = deal.financialsSummary;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/portal/investor" className="text-sm text-emerald-700 hover:underline">
          ← All opportunities
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-900">{deal.name}</h1>
          <TierBadge tier={deal.tier} />
        </div>
        <p className="mt-1 text-sm text-zinc-500">{deal.companyProfile.clientName}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Company Profile
          </h2>
          <dl className="mt-2 divide-y divide-zinc-100">
            <Row k="Sector" v={deal.companyProfile.sector.map((s) => label("Sector", s)).join(", ")} />
            <Row k="Core product" v={deal.companyProfile.coreProduct} />
            <Row k="HQ" v={deal.companyProfile.hqCity} />
            <Row
              k="Countries"
              v={deal.companyProfile.countries.map((c) => label("Geography", c)).join(", ") || null}
            />
            <Row k="Founded" v={deal.companyProfile.yearFounded} />
          </dl>
          {deal.companyProfile.description && (
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              {deal.companyProfile.description}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Deal &amp; Financials
          </h2>
          <dl className="mt-2 divide-y divide-zinc-100">
            <Row k="Deal type" v={deal.dealTypeTicket.dealType ? label("DealType", deal.dealTypeTicket.dealType) : null} />
            <Row
              k="Instrument"
              v={deal.dealTypeTicket.instrument.map((i) => label("Instrument", i)).join(", ") || null}
            />
            <Row
              k="Target raise"
              v={
                deal.dealTypeTicket.targetRaise != null
                  ? formatMoney(deal.dealTypeTicket.targetRaise, deal.dealTypeTicket.currency)
                  : null
              }
            />
            <Row
              k={fin.disclosure === "limited" ? "Revenue (range)" : "Revenue (last year)"}
              v={typeof fin.revenueLastYear === "number" ? formatMoney(fin.revenueLastYear) : fin.revenueLastYear}
            />
            <Row
              k={fin.disclosure === "limited" ? "Forecast (range)" : "Revenue forecast"}
              v={typeof fin.revenueForecast === "number" ? formatMoney(fin.revenueForecast) : fin.revenueForecast}
            />
            <Row k="Profitable" v={fin.profitable == null ? null : fin.profitable ? "Yes" : "No"} />
            <Row
              k="Mandate status"
              v={deal.matchingMandateStatus ? label("MandateStage", deal.matchingMandateStatus) : null}
            />
          </dl>
          {fin.disclosure === "limited" && (
            <p className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
              Detailed financials are shared after an NDA is signed. Contact your NobleStride
              advisor to proceed.
            </p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Documents</h2>
        {deal.documents.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            No documents available at your current access level.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100">
            {deal.documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-4 py-2.5">
                <div>
                  <div className="text-sm font-medium text-zinc-900">{doc.name}</div>
                  <div className="text-xs text-zinc-500">
                    {label("DocumentType", doc.type)}
                    {doc.version ? ` · v${doc.version}` : ""}
                  </div>
                </div>
                {doc.fileUrl ? (
                  <a
                    href={doc.fileUrl}
                    className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    Open
                  </a>
                ) : (
                  <span className="text-xs text-zinc-400">On request</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {deal.advisorClientContacts && deal.advisorClientContacts.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Company Contacts
          </h2>
          <ul className="mt-2 divide-y divide-zinc-100">
            {deal.advisorClientContacts.map((c, i) => (
              <li key={i} className="py-2.5 text-sm">
                <span className="font-medium text-zinc-900">{c.name}</span>
                {c.jobTitle && <span className="text-zinc-500"> — {c.jobTitle}</span>}
                {c.email && <span className="block text-xs text-zinc-500">{c.email}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {journey ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Your Progress on This Deal
            </h2>
            <span className="text-xs text-zinc-500">
              <span className="font-semibold text-zinc-700">
                {journey.own.milestoneKeys.length} of {MILESTONE_ORDER.length}
              </span>{" "}
              milestones · {label("EngagementStage", journey.own.stage)}
            </span>
          </div>
          <ol className="mt-3 divide-y divide-zinc-100">
            {MILESTONE_ORDER.map((key) => {
              const done = journey.own.milestoneKeys.includes(key);
              const date = journey.milestoneDates[key];
              return (
                <li key={key} className="flex items-center gap-3 py-2">
                  <CheckIcon done={done} />
                  <span
                    className={`text-sm ${done ? "font-medium text-zinc-900" : "text-zinc-400"}`}
                  >
                    {MILESTONE_LABELS[key]}
                  </span>
                  {done && date && (
                    <span className="ml-auto text-xs text-zinc-400">{DATE_FMT.format(date)}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <section className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-700/70">
          {journey ? "Request More Information" : "Express Interest"}
        </h2>
        {interest ? (
          <p className="mt-2 text-sm font-medium text-emerald-900">
            Thank you — your request has been sent to the NobleStride team. They will follow up
            shortly.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-emerald-900">
              {journey
                ? "Need something specific — data room access, a management call, updated financials? Let the deal team know."
                : "Interested in this opportunity? Register your interest and the NobleStride team will start your process."}
            </p>
            <form action={expressInterest} className="mt-3 space-y-3">
              <input type="hidden" name="dealId" value={deal.id} />
              <textarea
                name="message"
                rows={3}
                placeholder="Optional message for the deal team…"
                className="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-emerald-800/70">{deal.contact}</span>
                <button
                  type="submit"
                  className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                >
                  {journey ? "Send request" : "Express interest"}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
