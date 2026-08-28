// verify-email/[token]/page.tsx — public confirmation gate for a self-service
// email change (F3.6). Renders a button; the token is only consumed by the POST
// behind it (see actions.ts for why).

import { VerifyEmailForm } from "./verify-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function VerifyEmailPage({ params }: PageProps) {
  const { token } = await params;
  return (
    <div className="flex min-h-screen items-start justify-center bg-[var(--bg-secondary)] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <span className="text-sm font-semibold tracking-tight text-emerald-950">Noblestride Capital</span>
          <h1 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">Confirm your new email</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            Confirming moves your sign-in email to this address and signs you out everywhere.
          </p>
        </div>
        <VerifyEmailForm token={token} />
      </div>
    </div>
  );
}
