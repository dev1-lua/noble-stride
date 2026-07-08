// register/page.tsx — public registration front door (real-auth spec §10).
// Email-first fork: the visitor enters an email; the server classifies it
// and routes to the internal staff form, the existing-investor-contact
// password form, or the new-fund wizard. Blocked emails get an inline error.
// No viewpoint/auth — this is the pre-approval front door; visibility stays
// zero until a team member approves (anti-broker gate).

import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/server/auth/current";
import { routeEmailAction, contactSignupAction } from "./actions";
import RegisterWizard from "./register-wizard";
import InternalForm from "./internal-form";
import ContactForm from "./contact-form";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ path?: string; step?: string; email?: string; error?: string }>;
}

const inputClass =
  "w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

const labelClass = "block text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]";

export default async function RegisterPage({ searchParams }: PageProps) {
  // Real session check (not cookie presence) — see login/page.tsx for why
  // this lives here instead of the edge middleware.
  const auth = await getCurrentAuth();
  if (auth) redirect(auth.account.kind === "INVESTOR" ? "/portal/investor" : "/dashboard");

  const sp = await searchParams;
  const email = sp.email ?? "";

  const view: "email" | "internal" | "contact" | "fund" | "pending" =
    sp.step === "pending"
      ? "pending"
      : sp.path === "internal"
        ? "internal"
        : sp.path === "contact"
          ? "contact"
          : sp.path === "fund"
            ? "fund"
            : "email";

  return (
    <div className="flex min-h-screen items-start justify-center bg-[var(--bg-secondary)] px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        {view !== "fund" && (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              {view === "email" && "Register"}
              {view === "internal" && "Staff account request"}
              {view === "contact" && "Create your account"}
              {view === "pending" && "Registration received"}
            </h1>
          </div>
        )}

        {sp.error && (
          <div className="rounded-lg border border-[var(--t-tag-bg-rose)] bg-[var(--t-tag-bg-rose)] p-4 text-sm text-[var(--t-tag-text-rose)]">
            {sp.error}
          </div>
        )}

        {view === "email" && (
          <section className="mx-auto w-full max-w-md rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
            <p className="mb-4 text-sm text-[var(--text-tertiary)]">
              NobleStride staff and investors both start here — enter your work email to continue.
            </p>
            <form action={routeEmailAction} className="space-y-4">
              <div>
                <label htmlFor="email" className={labelClass}>
                  Email <span className="text-rose-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  defaultValue={email}
                  placeholder="name@fund.com"
                  className={"mt-1 " + inputClass}
                />
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
                <a href="/login" className="text-xs font-medium text-[var(--accent)] hover:underline">
                  Already registered? Sign in
                </a>
                <button
                  type="submit"
                  className="rounded bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
                >
                  Continue →
                </button>
              </div>
            </form>
          </section>
        )}

        {view === "internal" && <InternalForm email={email} />}

        {view === "contact" && (
          <ContactForm email={email} action={contactSignupAction} />
        )}

        {view === "fund" && <RegisterWizard initialEmail={email} />}

        {view === "pending" && (
          <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-8 text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              Thanks — your account request is in. The NobleStride team reviews every account; you&apos;ll
              be able to sign in once approved.
            </p>
            <div className="mt-6 flex items-center justify-center gap-4 text-sm font-medium">
              <a href="/" className="text-[var(--text-secondary)] hover:text-[var(--accent)]">
                ← Back to home
              </a>
              <a href="/login" className="text-[var(--accent)] hover:underline">
                Sign in
              </a>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
