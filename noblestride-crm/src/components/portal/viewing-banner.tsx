// Amber demo-lens banner shared by both external portal shells (spec §6):
// names who you're viewing as (with engagement classification, so an empty
// portal for a Greylisted fund is self-explaining) and lets you hop to
// another investor/partner inline. Self-contained: fetches its own options.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";
import { label } from "@/lib/vocab";
import { PortalSwitcher } from "@/components/portal/portal-switcher";

export async function ViewingBanner() {
  const vp = await getViewpoint();
  if (!vp || !vp.impersonating) return null;

  const [investors, partners] = await Promise.all([
    prisma.investor.findMany({
      select: { id: true, name: true, engagementClassification: true },
      orderBy: { name: "asc" },
    }),
    prisma.partner.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const investorOptions = investors.map((i) => ({
    id: i.id,
    name: i.name,
    hint: label("InvestorEngagementClassification", i.engagementClassification),
  }));
  const partnerOptions = partners.map((p) => ({ id: p.id, name: p.name }));

  const current =
    vp.role === "investor"
      ? investorOptions.find((i) => i.id === vp.recordId)
      : vp.role === "partner"
        ? partnerOptions.find((p) => p.id === vp.recordId)
        : undefined;
  const hint = current && "hint" in current ? (current as { hint?: string }).hint : undefined;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--t-tag-bg-amber)] bg-[var(--t-tag-bg-amber)] px-6 py-2 text-sm text-[var(--t-tag-text-amber)]">
      <span className="inline-flex flex-wrap items-center gap-2">
        <span>
          Viewing as{" "}
          {vp.role === "investor" || vp.role === "partner" ? (
            vp.impersonating ? (
              <PortalSwitcher
                role={vp.role}
                recordId={vp.recordId ?? ""}
                investors={investorOptions}
                partners={partnerOptions}
              />
            ) : (
              <span className="font-semibold">{current?.name ?? "Your account"}</span>
            )
          ) : (
            <span className="font-semibold capitalize">{vp.role}</span>
          )}
        </span>
        {hint && hint !== "Active" && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold">
            {hint} — this fund is blocked from all deal visibility
          </span>
        )}
      </span>
      <span className="inline-flex items-center gap-2">
        {vp.impersonating && (
          <Link
            href="/api/viewpoint?role=admin"
            className="rounded-md border border-amber-300 bg-[var(--bg-primary)] px-2.5 py-1 text-xs font-medium text-[var(--t-tag-text-amber)] hover:bg-amber-100"
          >
            Return to Admin
          </Link>
        )}
        <Link
          href="/api/viewpoint?role=signout"
          className="rounded-md border border-amber-300 bg-[var(--bg-primary)] px-2.5 py-1 text-xs font-medium text-[var(--t-tag-text-amber)] hover:bg-amber-100"
        >
          Sign out
        </Link>
      </span>
    </div>
  );
}
