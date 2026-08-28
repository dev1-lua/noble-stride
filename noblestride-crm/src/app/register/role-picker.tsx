// role-picker.tsx — step 1 of /register (F1.1, image1): pick who you are, then
// go to the right form. Mirrors Aika's role-first signup, with the fourth card
// being Noblestride's own staff, as the client's annotation asked.
//
// Pure routing: every card is a Link, so there is no action, no state, and
// nothing to get out of step with the forms behind it.

import Link from "next/link";

export type RegisterRole = "client" | "investor" | "partner" | "staff";

export const REGISTER_ROLES = ["client", "investor", "partner", "staff"] as const satisfies readonly RegisterRole[];

export const REGISTER_ROLE_COPY: Record<RegisterRole, { title: string; description: string; cta: string }> = {
  client: {
    title: "Company raising capital",
    description:
      "Tell us about your business and what you're raising. We review every application and come back to you.",
    cta: "Start an application",
  },
  investor: {
    title: "Investor or fund",
    description:
      "Register your fund and your investment criteria to see matching opportunities once approved.",
    cta: "Register your fund",
  },
  partner: {
    title: "Referral partner",
    description:
      "Already been invited by Noblestride? Claim your invitation to follow the deals you referred.",
    cta: "Claim an invitation",
  },
  staff: {
    title: "Noblestride staff",
    description:
      "Internal team accounts. An administrator approves every staff account before first sign-in.",
    cta: "Request a staff account",
  },
};

export function registerRoleHref(role: RegisterRole): string {
  switch (role) {
    case "client":
      return "/intake";
    case "investor":
      return "/register?path=fund";
    case "partner":
      return "/register?path=partner";
    case "staff":
      return "/register?path=internal";
  }
}

export function RolePicker() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {REGISTER_ROLES.map((role) => {
          const copy = REGISTER_ROLE_COPY[role];
          return (
            <Link
              key={role}
              href={registerRoleHref(role)}
              data-testid={`register-role-${role}`}
              className="group flex flex-col rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 transition-colors hover:border-[var(--accent)]"
            >
              <span className="text-sm font-semibold text-[var(--text-primary)]">{copy.title}</span>
              <span className="mt-1 flex-1 text-xs text-[var(--text-tertiary)]">{copy.description}</span>
              <span className="mt-3 text-xs font-medium text-[var(--accent)] group-hover:underline">
                {copy.cta} →
              </span>
            </Link>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4 text-xs">
        <Link href="/register?path=email" className="font-medium text-[var(--accent)] hover:underline">
          Not sure? Enter your work email instead →
        </Link>
        <Link href="/login" className="font-medium text-[var(--text-secondary)] hover:text-[var(--accent)]">
          Already registered? Sign in
        </Link>
      </div>
    </div>
  );
}
