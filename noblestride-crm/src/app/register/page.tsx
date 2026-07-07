// register/page.tsx — public investor registration (design spec §6).
// Step A: six mandatory fields (+ fund type). Step B: DEMO OTP. Step C: pending confirmation.
// No viewpoint/auth — this is the pre-approval front door; visibility stays zero
// until a team member approves (anti-broker gate).

import { CheckCircle2 } from "lucide-react";
import { DEMO_OTP } from "@/server/onboarding/register-investor";
import { verifyOtpAction } from "./actions";
import RegisterWizard from "./register-wizard";

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
        {step !== "form" && (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-zinc-900">
              {step === "verify" && "Verify your registration"}
              {step === "done" && "Registration received"}
            </h1>
          </div>
        )}

        {sp.error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {sp.error}
          </div>
        )}

        {step === "form" && <RegisterWizard />}

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
