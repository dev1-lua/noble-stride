// onboarding-queue-card.tsx — top-of-dashboard alert for investors awaiting
// onboarding review. Inline Approve/Decline/Greylist per row (reuses
// OnboardingActions) + a "View list" link to the shared review-queue page.
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { OnboardingActions } from "@/components/crm/onboarding-actions";

export interface PendingOnboardingDTO {
  id: string;
  name: string;
  registeredAt: string | null;
  contactName: string | null;
  contactEmail: string | null;
}

export function OnboardingQueueCard({ investors }: { investors: PendingOnboardingDTO[] }) {
  if (investors.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
            <UserPlus className="h-4 w-4 text-amber-700" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-amber-900">
              {investors.length} investor registration{investors.length === 1 ? "" : "s"} awaiting review
            </h2>
            <p className="text-xs text-amber-700">Approve, decline, or greylist — or open the full queue.</p>
          </div>
        </div>
        <Link
          href="/investors?onboarding=PendingReview"
          className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
        >
          View list →
        </Link>
      </div>

      {/* Fixed-height scroll area: the card's footprint stays compact no matter
          how many are pending (the list scrolls INSIDE the card), and every row
          is still actionable inline. "View list →" opens the full queue page. */}
      <div className="mt-4 overflow-y-auto pr-1" style={{ maxHeight: "14rem" }}>
        <ul className="divide-y divide-amber-200/70">
          {investors.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <Link href={`/investors/${inv.id}`} className="text-sm font-medium text-zinc-900 hover:text-accent">
                  {inv.name}
                </Link>
                <p className="truncate text-xs text-zinc-500">
                  {inv.contactName ? `${inv.contactName} · ` : ""}
                  {inv.contactEmail ?? "no contact email"}
                </p>
              </div>
              <OnboardingActions investorId={inv.id} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
