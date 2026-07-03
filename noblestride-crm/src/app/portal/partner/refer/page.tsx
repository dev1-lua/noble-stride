// portal/partner/refer/page.tsx — partner referral submission (write-back).
// RSC form posting to a server action; the acting partner is resolved from
// the viewpoint cookie inside the action, never from the form.
import { redirect } from "next/navigation";
import { getViewpoint } from "@/server/viewpoint";
import { options } from "@/lib/vocab";
import { submitReferralAction } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ submitted?: string; error?: string }>;
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "placeholder:text-zinc-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";

const labelClass = "block text-xs font-medium uppercase tracking-wide text-zinc-500";

export default async function SubmitReferralPage({ searchParams }: PageProps) {
  const vp = await getViewpoint();
  if (vp.role !== "partner" || !vp.recordId) redirect("/dashboard");

  const { submitted, error } = await searchParams;
  const sectorOptions = options("Sector");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Submit a Referral</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Introduce a company to NobleStride Capital. Referrals enter our mandate pipeline and
          you can track their progress on your overview.
        </p>
      </div>

      {submitted === "1" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-sm font-semibold text-emerald-800">Referral received</div>
          <p className="mt-1 text-sm text-emerald-700">
            The NobleStride team will review and reach out. Your referral now appears in the
            table on your Overview tab.
          </p>
        </div>
      )}
      {error === "name" && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Company name is required.
        </div>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          New referral
        </h2>
        <form action={submitReferralAction} className="mt-4 space-y-4">
          <div>
            <label htmlFor="companyName" className={labelClass}>
              Company name <span className="text-rose-500">*</span>
            </label>
            <input
              id="companyName"
              name="companyName"
              type="text"
              required
              placeholder="e.g. Savannah Agri Holdings"
              className={"mt-1 " + inputClass}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sector" className={labelClass}>
                Sector
              </label>
              <select id="sector" name="sector" defaultValue="" className={"mt-1 " + inputClass}>
                <option value="">— Select sector —</option>
                {sectorOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dealSize" className={labelClass}>
                Estimated deal size (USD)
              </label>
              <input
                id="dealSize"
                name="dealSize"
                type="number"
                min={0}
                step="any"
                placeholder="e.g. 5000000"
                className={"mt-1 " + inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="contactName" className={labelClass}>
              Contact at the company
            </label>
            <input
              id="contactName"
              name="contactName"
              type="text"
              placeholder="Name / role of your contact"
              className={"mt-1 " + inputClass}
            />
          </div>

          <div>
            <label htmlFor="context" className={labelClass}>
              Why is this a fit / context
            </label>
            <textarea
              id="context"
              name="context"
              rows={4}
              placeholder="What the company does, why they need capital, your relationship…"
              className={"mt-1 " + inputClass}
            />
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-zinc-100 pt-4">
            <p className="text-xs text-zinc-400">
              Shared with the NobleStride advisory team only — treated under your partner
              agreement.
            </p>
            <button
              type="submit"
              className="rounded-full bg-emerald-950 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
            >
              Submit referral
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
