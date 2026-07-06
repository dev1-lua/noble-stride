// register/page.tsx — public investor registration (design spec §6).
// Step A: six mandatory fields (+ fund type). Step B: DEMO OTP. Step C: pending confirmation.
// No viewpoint/auth — this is the pre-approval front door; visibility stays zero
// until a team member approves (anti-broker gate).

import { CheckCircle2 } from "lucide-react";
import { options } from "@/lib/vocab";
import { TICKET_BANDS } from "@/lib/ticket-bands";
import { DEMO_OTP } from "@/server/onboarding/register-investor";
import { registerAction, verifyOtpAction } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ step?: string; rid?: string; error?: string }>;
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "placeholder:text-zinc-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";

const labelClass = "block text-xs font-medium uppercase tracking-wide text-zinc-500";

export default async function RegisterPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const step = sp.step === "verify" && sp.rid ? "verify" : sp.step === "done" ? "done" : "form";

  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900">
            {step === "form" && "Register as an Investor"}
            {step === "verify" && "Verify your registration"}
            {step === "done" && "Registration received"}
          </h1>
          {step === "form" && (
            <p className="mt-1 text-sm text-zinc-500">
              NobleStride Capital — investor access request ·{" "}
              <a href="/login" className="font-medium text-emerald-800 hover:underline">
                Already registered? Sign in
              </a>
            </p>
          )}
        </div>

        {sp.error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {sp.error}
          </div>
        )}

        {step === "form" && (
          <section className="rounded-xl border border-zinc-200 bg-white p-5">
            <form action={registerAction} className="space-y-4">
              <div>
                <label htmlFor="fundName" className={labelClass}>
                  Fund / entity name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="fundName"
                  name="fundName"
                  type="text"
                  required
                  placeholder="e.g. Savannah Growth Partners"
                  className={"mt-1 " + inputClass}
                />
              </div>

              <div>
                <label htmlFor="contactPerson" className={labelClass}>
                  Contact person <span className="text-rose-500">*</span>
                </label>
                <input
                  id="contactPerson"
                  name="contactPerson"
                  type="text"
                  required
                  placeholder="Full name"
                  className={"mt-1 " + inputClass}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="email" className={labelClass}>
                    Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="name@fund.com"
                    className={"mt-1 " + inputClass}
                  />
                  <p className="mt-1 text-xs text-zinc-400">
                    Corporate email only — free providers are not accepted
                  </p>
                </div>
                <div>
                  <label htmlFor="phone" className={labelClass}>
                    Phone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    placeholder="+254 700 000000"
                    className={"mt-1 " + inputClass}
                  />
                  <p className="mt-1 text-xs text-zinc-400">Used for OTP verification</p>
                </div>
              </div>

              <div>
                <label htmlFor="investorType" className={labelClass}>
                  Investor type <span className="text-rose-500">*</span>
                </label>
                <select
                  id="investorType"
                  name="investorType"
                  required
                  defaultValue=""
                  className={"mt-1 " + inputClass}
                >
                  <option value="" disabled>
                    — Select investor type —
                  </option>
                  {options("InvestorType").map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className={labelClass}>
                  Sector preference <span className="text-rose-500">*</span>
                </span>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {options("Sector").map((o) => (
                    <label
                      key={o.value}
                      className="flex items-center gap-2 rounded-md border border-zinc-200 px-2 py-1.5 text-sm text-zinc-700"
                    >
                      <input
                        type="checkbox"
                        name="sectorPreference"
                        value={o.value}
                        className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-600"
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="dealType" className={labelClass}>
                    Deal type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="dealType"
                    name="dealType"
                    required
                    defaultValue=""
                    className={"mt-1 " + inputClass}
                  >
                    <option value="" disabled>
                      — Select deal type —
                    </option>
                    {options("Instrument").map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="dealSizeBand" className={labelClass}>
                    Deal size <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="dealSizeBand"
                    name="dealSizeBand"
                    required
                    defaultValue=""
                    className={"mt-1 " + inputClass}
                  >
                    <option value="" disabled>
                      — Select deal size —
                    </option>
                    {TICKET_BANDS.map((b) => (
                      <option key={b.key} value={b.key}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 border-t border-zinc-100 pt-4">
                <button
                  type="submit"
                  className="rounded-full bg-emerald-950 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
                >
                  Continue to verification
                </button>
              </div>
            </form>
          </section>
        )}

        {step === "verify" && (
          <section className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Demo mode — OTP delivery is not wired yet. Use code {DEMO_OTP} for both fields.
            </div>

            <form action={verifyOtpAction} className="mt-4 space-y-4">
              <input type="hidden" name="rid" value={sp.rid} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="emailOtp" className={labelClass}>
                    Email code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="emailOtp"
                    name="emailOtp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    placeholder="000000"
                    className={"mt-1 " + inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="phoneOtp" className={labelClass}>
                    Phone code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="phoneOtp"
                    name="phoneOtp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    placeholder="000000"
                    className={"mt-1 " + inputClass}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 border-t border-zinc-100 pt-4">
                <button
                  type="submit"
                  className="rounded-full bg-emerald-950 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
                >
                  Verify
                </button>
              </div>
            </form>
          </section>
        )}

        {step === "done" && (
          <section className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <p className="mt-4 text-sm text-zinc-600">
              Your registration is under review by the NobleStride team. You will be contacted at
              your corporate email once approved. No deal information is visible before approval.
            </p>
            <div className="mt-6 flex items-center justify-center gap-4 text-sm font-medium">
              <a href="/" className="text-zinc-600 hover:text-emerald-950">
                ← Back to home
              </a>
              <a href="/login" className="text-emerald-800 hover:underline">
                Sign in
              </a>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
