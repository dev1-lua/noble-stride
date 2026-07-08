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
  "w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

const labelClass = "block text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]";

export default async function SubmitReferralPage({ searchParams }: PageProps) {
  const vp = await getViewpoint();
  if (vp.role !== "partner" || !vp.recordId) redirect("/dashboard");

  const { submitted, error } = await searchParams;
  const sectorOptions = options("Sector");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Submit a Referral</h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Introduce a company to NobleStride Capital. Referrals enter our mandate pipeline and
          you can track their progress on your overview.
        </p>
      </div>

      {submitted === "1" && (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--t-tag-bg-emerald)] p-4">
          <div className="text-sm font-semibold text-[var(--t-tag-text-emerald)]">Referral received</div>
          <p className="mt-1 text-sm text-[var(--t-tag-text-emerald)]">
            The NobleStride team will review and reach out. Your referral now appears in the
            table on your Overview tab.
          </p>
        </div>
      )}
      {error === "name" && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Company name is required.
        </div>
      )}

      <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
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

          <div className="flex items-center justify-between gap-4 border-t border-[var(--border-subtle)] pt-4">
            <p className="text-xs text-[var(--text-tertiary)]">
              Shared with the NobleStride advisory team only — treated under your partner
              agreement.
            </p>
            <button
              type="submit"
              className="rounded bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
            >
              Submit referral
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
