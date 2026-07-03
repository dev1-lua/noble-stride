// portal/investor/deals/[id]/page.tsx — tier-gated deal view (spec §5.2).
// Renders ONLY what the visibility projector returned for this investor's tier.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadInvestorPortalData } from "@/server/visibility";
import { getViewpoint } from "@/server/viewpoint";
import { label } from "@/lib/vocab";
import { formatMoney } from "@/lib/money";
import { TierBadge } from "@/components/portal/tier-badge";

export const dynamic = "force-dynamic";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2">
      <dt className="text-sm text-zinc-500">{k}</dt>
      <dd className="text-right text-sm font-medium text-zinc-900">{v ?? "—"}</dd>
    </div>
  );
}

export default async function InvestorDealPage({ params }: { params: Promise<{ id: string }> }) {
  const vp = await getViewpoint();
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");

  const { id } = await params;
  const { deals } = await loadInvestorPortalData(prisma, vp.recordId);
  const deal = deals.find((d) => d.id === id);
  if (!deal) notFound();

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

      <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-5 py-4 text-sm text-emerald-900">
        Interested in this opportunity? {deal.contact}
      </div>
    </div>
  );
}
