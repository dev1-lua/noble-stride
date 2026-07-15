// intake/page.tsx — public client-intake wizard ("Raise capital with Noblestride").
// Step A: 5 mandatory-field steps + review. Step B: neutral confirmation —
// no verdict is ever shown here; qualification triage is strictly internal
// (design spec §04.3 anti-broker-style guardrail: applicant sees "under
// review", nothing more, ever).

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import IntakeWizard from "./intake-wizard";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ step?: string }>;
}

export default async function IntakePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const step = sp.step === "done" ? "done" : "form";

  return (
    <div className="flex min-h-screen items-start justify-center bg-[var(--bg-secondary)] px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        {step === "done" && (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Application received</h1>
          </div>
        )}

        {step === "form" && (
          <>
            <IntakeWizard />
            <p className="text-center text-sm text-[var(--text-secondary)]">
              Prefer to talk it through?{" "}
              <Link href="/talk-to-us" className="font-medium text-[var(--accent)] hover:underline">
                Chat with us
              </Link>
              .
            </p>
          </>
        )}

        {step === "done" && (
          <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <p className="mt-4 text-sm text-[var(--text-secondary)]">
              Thank you — your application is under review. Our team will be in touch after an
              initial assessment.
            </p>
            <div className="mt-6 flex items-center justify-center gap-4 text-sm font-medium">
              <Link href="/" className="text-[var(--text-secondary)] hover:text-[var(--accent)]">
                ← Back to home
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
