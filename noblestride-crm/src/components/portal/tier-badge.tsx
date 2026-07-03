// tier-badge.tsx — shows the disclosure tier a deal is being viewed at.
import type { Tier } from "@/server/visibility";

const TIER_STYLE: Record<Exclude<Tier, "NONE">, { label: string; cls: string }> = {
  PRE_INTEREST: { label: "Teaser", cls: "bg-zinc-100 text-zinc-600" },
  AFTER_NDA: { label: "NDA Signed", cls: "bg-sky-50 text-sky-700" },
  DD: { label: "Due Diligence", cls: "bg-violet-50 text-violet-700" },
};

export function TierBadge({ tier }: { tier: Exclude<Tier, "NONE"> }) {
  const t = TIER_STYLE[tier];
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${t.cls}`}>
      {t.label}
    </span>
  );
}
