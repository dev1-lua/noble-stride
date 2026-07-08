// tier-badge.tsx — shows the disclosure tier a deal is being viewed at.
import type { Tier } from "@/server/visibility";

const TIER_STYLE: Record<Exclude<Tier, "NONE">, { label: string; cls: string }> = {
  PRE_INTEREST: { label: "Teaser", cls: "bg-[var(--t-tag-bg-gray)] text-[var(--t-tag-text-gray)]" },
  AFTER_NDA: { label: "NDA Signed", cls: "bg-[var(--t-tag-bg-sky)] text-[var(--t-tag-text-sky)]" },
  DD: { label: "Due Diligence", cls: "bg-[var(--t-tag-bg-violet)] text-[var(--t-tag-text-violet)]" },
};

export function TierBadge({ tier }: { tier: Exclude<Tier, "NONE"> }) {
  const t = TIER_STYLE[tier];
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${t.cls}`}>
      {t.label}
    </span>
  );
}
