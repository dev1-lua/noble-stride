// portal/partner/details/page.tsx — the partner's own record. Agreement and
// fee-sharing fields are read-only (set by NobleStride); the partner may edit
// only their own contact details (email / phone / organization).
import { redirect } from "next/navigation";
import { getViewpoint } from "@/server/viewpoint";
import { getOwnPartnerDetails } from "@/server/partner-portal";
import { label } from "@/lib/vocab";
import { updateOwnDetailsAction } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ saved?: string }>;
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "placeholder:text-zinc-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";

const labelClass = "block text-xs font-medium uppercase tracking-wide text-zinc-500";

export default async function PartnerDetailsPage({ searchParams }: PageProps) {
  const vp = await getViewpoint();
  if (vp.role !== "partner" || !vp.recordId) redirect("/dashboard");

  const [{ saved }, partner] = await Promise.all([searchParams, getOwnPartnerDetails(vp.recordId)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">My Details</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Your partner record with NobleStride Capital. Keep your contact details current so we
          can reach you about referral progress and fee payouts.
        </p>
      </div>

      {saved === "1" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <span className="font-semibold text-emerald-800">Saved</span> — your contact details
          have been updated.
        </div>
      )}

      {/* Read-only: agreement + fee-sharing, set by NobleStride */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Partnership status
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className={labelClass}>Partner</dt>
            <dd className="mt-1 text-sm font-medium text-zinc-900">{partner.name}</dd>
          </div>
          <div>
            <dt className={labelClass}>Advisor type</dt>
            <dd className="mt-1 text-sm text-zinc-900">
              {partner.advisorType ? label("AdvisorType", partner.advisorType) : "—"}
            </dd>
          </div>
          <div>
            <dt className={labelClass}>Partner agreement</dt>
            <dd className="mt-1 text-sm text-zinc-900">
              {label("PartnerAgreementStatus", partner.partnerAgreementStatus)}
            </dd>
          </div>
          <div>
            <dt className={labelClass}>Fee-sharing</dt>
            <dd className="mt-1">
              <span
                className={
                  "rounded-full px-2.5 py-1 text-xs font-medium " +
                  (partner.feeSharingAgreement
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-zinc-100 text-zinc-500")
                }
              >
                {partner.feeSharingAgreement ? "Fee-sharing agreed" : "No fee-sharing agreement"}
              </span>
            </dd>
          </div>
          {partner.feeSharingTerms && (
            <div className="sm:col-span-2">
              <dt className={labelClass}>Fee-sharing terms</dt>
              <dd className="mt-1 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                {partner.feeSharingTerms}
              </dd>
            </div>
          )}
        </dl>
        <p className="mt-4 text-xs text-zinc-400">
          Agreement status and fee-sharing terms are maintained by NobleStride. Contact the team
          if anything looks wrong.
        </p>
      </section>

      {/* Editable: own contact details */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Contact details
        </h2>
        <form action={updateOwnDetailsAction} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className={labelClass}>
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={partner.email ?? ""}
                placeholder="you@firm.com"
                className={"mt-1 " + inputClass}
              />
            </div>
            <div>
              <label htmlFor="phone" className={labelClass}>
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={partner.phone ?? ""}
                placeholder="+254 …"
                className={"mt-1 " + inputClass}
              />
            </div>
          </div>
          <div>
            <label htmlFor="organization" className={labelClass}>
              Organization
            </label>
            <input
              id="organization"
              name="organization"
              type="text"
              defaultValue={partner.organization ?? ""}
              placeholder="Firm / organization name"
              className={"mt-1 " + inputClass}
            />
          </div>
          <div className="flex justify-end border-t border-zinc-100 pt-4">
            <button
              type="submit"
              className="rounded-full bg-emerald-950 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
            >
              Save details
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
