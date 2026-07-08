// intake-queue-callout.tsx — top-of-dashboard alert for website-intake
// mandates awaiting review (Task 12). Mirrors OnboardingQueueCard's alert
// styling, but is a plain count + link (the per-mandate review actions live
// on the mandate detail page's IntakeReviewPanel, not inline here).
import Link from "next/link";
import { Globe } from "lucide-react";

export function IntakeQueueCallout({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
            <Globe className="h-4 w-4 text-amber-700" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-amber-900">
              {count} website application{count === 1 ? "" : "s"} awaiting review
            </h2>
            <p className="text-xs text-amber-700">Submitted via the public intake wizard — accept, deprioritize, or re-run qualification.</p>
          </div>
        </div>
        <Link
          href="/deals?type=mandate&stage=NewLead&source=Website"
          className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
        >
          View queue →
        </Link>
      </div>
    </div>
  );
}
