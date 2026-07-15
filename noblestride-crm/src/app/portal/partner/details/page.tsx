// portal/partner/details/page.tsx — the partner's own record. Agreement and
// fee-sharing fields are read-only (set by Noblestride); the partner may edit
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
  "w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

const labelClass = "block text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]";

export default async function PartnerDetailsPage({ searchParams }: PageProps) {
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role !== "partner" || !vp.recordId) redirect("/dashboard");

  const [{ saved }, partner] = await Promise.all([searchParams, getOwnPartnerDetails(vp.recordId)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">My Details</h1>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Your partner record with Noblestride Capital. Keep your contact details current so we
          can reach you about referral progress and fee payouts.
        </p>
      </div>

      {saved === "1" && (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--t-tag-bg-emerald)] p-4 text-sm text-[var(--t-tag-text-emerald)]">
          <span className="font-semibold text-[var(--t-tag-text-emerald)]">Saved</span> — your contact details
          have been updated.
        </div>
      )}

      {/* Read-only: agreement + fee-sharing, set by Noblestride */}
      <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          Partnership status
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className={labelClass}>Partner</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--text-primary)]">{partner.name}</dd>
          </div>
          <div>
            <dt className={labelClass}>Advisor type</dt>
            <dd className="mt-1 text-sm text-[var(--text-primary)]">
              {partner.advisorType ? label("AdvisorType", partner.advisorType) : "—"}
            </dd>
          </div>
          <div>
            <dt className={labelClass}>Partner agreement</dt>
            <dd className="mt-1 text-sm text-[var(--text-primary)]">
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
                    ? "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]"
                    : "bg-[var(--t-tag-bg-gray)] text-[var(--t-tag-text-gray)]")
                }
              >
                {partner.feeSharingAgreement ? "Fee-sharing agreed" : "No fee-sharing agreement"}
              </span>
            </dd>
          </div>
          {partner.feeSharingTerms && (
            <div className="sm:col-span-2">
              <dt className={labelClass}>Fee-sharing terms</dt>
              <dd className="mt-1 rounded-md bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                {partner.feeSharingTerms}
              </dd>
            </div>
          )}
        </dl>
        <p className="mt-4 text-xs text-[var(--text-tertiary)]">
          Agreement status and fee-sharing terms are maintained by Noblestride. Contact the team
          if anything looks wrong.
        </p>
      </section>

      {/* Editable: own contact details */}
      <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
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
          <div className="flex justify-end border-t border-[var(--border-subtle)] pt-4">
            <button
              type="submit"
              className="rounded bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
            >
              Save details
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
