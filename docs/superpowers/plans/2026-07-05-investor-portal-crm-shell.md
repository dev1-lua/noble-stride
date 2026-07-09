# Investor Portal CRM Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the investor portal (`/portal/investor/*`) the same CRM design language as the admin app (dark sidebar, sticky white topbar, zinc-50 canvas) while keeping the partner portal byte-identical.

**Architecture:** Split the shared external-portal shell at the nested-layout level: `portal/layout.tsx` becomes a pass-through; the partner layout absorbs the old external shell verbatim; the investor layout gets a new CRM-style shell built from primitives exported by the admin sidebar plus new `InvestorSidebar`/`InvestorTopbar` components. The amber "Viewing as" demo-lens banner is extracted into a shared `ViewingBanner` server component used by both shells.

**Tech Stack:** Next.js 16 App Router (RSC), Tailwind v4, lucide-react, Prisma, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-05-investor-portal-crm-shell-design.md`

## Global Constraints

- Repo root: `D:\LuaWork\NobleStride\noble-stride`; app root: `noblestride-crm/` (all `src/` paths below are relative to `noblestride-crm/`).
- Work on branch `feat/InvestorsPage`; commit after each task.
- **Partner portal must remain byte-identical** (`/portal/partner/*`, `PartnerTabs` untouched; DOM structure preserved exactly).
- **Admin shell must not change visually** — only additive `export` keywords in `sidebar.tsx`.
- Dev server is already running at `http://localhost:3000` (`next dev`, hot-reloads edits). Do not kill or restart it.
- Scratchpad for baseline/verification artifacts: `C:\Users\shaur\AppData\Local\Temp\claude\D--LuaWork-NobleStride-noble-stride\c2d46231-126c-44ed-a03f-6e5aa6247150\scratchpad` (referred to as `$SCRATCH`; in Bash-tool snippets set `SCRATCH='C:/Users/shaur/AppData/Local/Temp/claude/D--LuaWork-NobleStride-noble-stride/c2d46231-126c-44ed-a03f-6e5aa6247150/scratchpad'`).
- Test command: `npm run test` (vitest) from `noblestride-crm/`. Lint: `npm run lint`. Build: `npm run build`.
- No new dependencies.

---

### Task 0: Capture partner-portal baseline HTML (BEFORE any code change)

**Files:**
- Create (scratchpad only, not committed): `$SCRATCH/partner-before.html`, `$SCRATCH/jar-partner.txt`, `$SCRATCH/strip-scripts.py`

**Interfaces:**
- Produces: `$SCRATCH/partner-before.html` and `$SCRATCH/partner-before.stripped.html` used by Task 8's regression diff; `$SCRATCH/jar-partner.txt` cookie jar; `$SCRATCH/strip-scripts.py` normalizer.

- [ ] **Step 1: Find a partner recordId**

Run (Bash tool):
```bash
curl -s http://localhost:3000/dashboard -o /tmp/dash.html 2>/dev/null || true
grep -oE 'role=partner&(amp;)?recordId=[A-Za-z0-9_-]+' /tmp/dash.html | head -3
```
Expected: at least one match like `role=partner&amp;recordId=cmxyz123`. Take the recordId value (strip `&amp;`). If no match, fetch `http://localhost:3000/partners` and extract an id from `href="/partners/<id>"` links instead.

- [ ] **Step 2: Set the partner viewpoint cookie and capture the page**

Run (substitute `<PID>`):
```bash
SCRATCH='C:/Users/shaur/AppData/Local/Temp/claude/D--LuaWork-NobleStride-noble-stride/c2d46231-126c-44ed-a03f-6e5aa6247150/scratchpad'
curl -s -c "$SCRATCH/jar-partner.txt" -o /dev/null "http://localhost:3000/api/viewpoint?role=partner&recordId=<PID>"
curl -s -b "$SCRATCH/jar-partner.txt" http://localhost:3000/portal/partner -o "$SCRATCH/partner-before.html"
grep -c "Partner Portal" "$SCRATCH/partner-before.html"
```
Expected: count ≥ 1 (page rendered as partner, not a redirect stub).

- [ ] **Step 3: Create the script/noise stripper and a normalized baseline**

Write `$SCRATCH/strip-scripts.py`:
```python
import re, sys
html = open(sys.argv[1], encoding="utf-8").read()
html = re.sub(r"<script\b.*?</script>", "", html, flags=re.DOTALL)
html = re.sub(r"<link\b[^>]*>", "", html)
html = re.sub(r"\s+", " ", html)
open(sys.argv[2], "w", encoding="utf-8").write(html)
```
Run:
```bash
python "$SCRATCH/strip-scripts.py" "$SCRATCH/partner-before.html" "$SCRATCH/partner-before.stripped.html"
wc -c "$SCRATCH/partner-before.stripped.html"
```
Expected: non-trivial size (> 5 KB). No commit for this task (scratchpad only).

---

### Task 1: Export admin sidebar primitives + shared investor nav model with tests

**Files:**
- Modify: `src/components/shell/sidebar.tsx` (lines 23, 48, 74 — add `export` keywords only)
- Create: `src/components/portal/investor-portal-nav.ts`
- Test: `src/components/__tests__/investor-portal-nav.test.ts`

**Interfaces:**
- Produces: `export const SIDEBAR_FG: string`, `export function BrandMark()`, `export function NavItem({ href, label, Icon, active })` from `@/components/shell/sidebar` (Icon type: `React.ComponentType<{ className?: string; style?: React.CSSProperties }>`).
- Produces from `@/components/portal/investor-portal-nav`: `INVESTOR_NAV` (readonly array of `{ href, label, title, subtitle }`), `isInvestorNavActive(pathname: string, href: string): boolean`, `deriveInvestorPageMeta(pathname: string): { title: string; subtitle: string }`.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/investor-portal-nav.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  isInvestorNavActive,
  deriveInvestorPageMeta,
} from "../portal/investor-portal-nav";

describe("isInvestorNavActive", () => {
  it("marks Opportunities active on the root and on deal pages", () => {
    expect(isInvestorNavActive("/portal/investor", "/portal/investor")).toBe(true);
    expect(isInvestorNavActive("/portal/investor/deals/abc", "/portal/investor")).toBe(true);
  });

  it("does not mark Opportunities active on sibling tabs", () => {
    expect(isInvestorNavActive("/portal/investor/pipeline", "/portal/investor")).toBe(false);
    expect(isInvestorNavActive("/portal/investor/profile", "/portal/investor")).toBe(false);
  });

  it("marks siblings active on their own routes only", () => {
    expect(isInvestorNavActive("/portal/investor/pipeline", "/portal/investor/pipeline")).toBe(true);
    expect(isInvestorNavActive("/portal/investor", "/portal/investor/pipeline")).toBe(false);
  });
});

describe("deriveInvestorPageMeta", () => {
  it("maps each nav route to its title", () => {
    expect(deriveInvestorPageMeta("/portal/investor").title).toBe("Opportunities");
    expect(deriveInvestorPageMeta("/portal/investor/pipeline").title).toBe("My Pipeline");
    expect(deriveInvestorPageMeta("/portal/investor/profile").title).toBe("Fund Profile");
  });

  it("keeps deal detail pages under Opportunities", () => {
    expect(deriveInvestorPageMeta("/portal/investor/deals/xyz").title).toBe("Opportunities");
  });

  it("falls back for unknown routes", () => {
    expect(deriveInvestorPageMeta("/portal/investor/unknown").title).toBe("Investor Portal");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `noblestride-crm/`: `npm run test`
Expected: FAIL — cannot resolve `../portal/investor-portal-nav`.

- [ ] **Step 3: Create the nav model**

Create `src/components/portal/investor-portal-nav.ts`:
```ts
// Shared nav model for the investor portal's CRM-style shell (sidebar +
// topbar). Pure data/functions so active-state and title derivation are
// unit-testable; icons stay in the sidebar component (client-only).

export const INVESTOR_NAV = [
  {
    href: "/portal/investor",
    label: "Opportunities",
    title: "Opportunities",
    subtitle: "Deals matching your mandate",
  },
  {
    href: "/portal/investor/pipeline",
    label: "My Pipeline",
    title: "My Pipeline",
    subtitle: "Your journey on each opportunity",
  },
  {
    href: "/portal/investor/profile",
    label: "Fund Profile",
    title: "Fund Profile",
    subtitle: "Preferences that drive deal matching",
  },
] as const;

export type InvestorNavItem = (typeof INVESTOR_NAV)[number];

/** Active on the item's route or a sub-route; deal pages belong to Opportunities. */
export function isInvestorNavActive(pathname: string, href: string): boolean {
  if (href === "/portal/investor") {
    return pathname === href || pathname.startsWith("/portal/investor/deals");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Topbar title/subtitle for the current investor-portal route. */
export function deriveInvestorPageMeta(pathname: string): {
  title: string;
  subtitle: string;
} {
  const item = INVESTOR_NAV.find((i) => isInvestorNavActive(pathname, i.href));
  return item
    ? { title: item.title, subtitle: item.subtitle }
    : { title: "Investor Portal", subtitle: "" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test`
Expected: PASS (all suites, including the pre-existing avatar test).

- [ ] **Step 5: Export the admin sidebar primitives**

In `src/components/shell/sidebar.tsx`, make exactly three one-word edits (no other changes):
- Line 23: `const SIDEBAR_FG = "#cbd5cf";` → `export const SIDEBAR_FG = "#cbd5cf";`
- Line 48: `function BrandMark() {` → `export function BrandMark() {`
- Line 74: `function NavItem({ href, label, Icon, active }: NavItemProps) {` → `export function NavItem({ href, label, Icon, active }: NavItemProps) {`

- [ ] **Step 6: Lint and commit**

Run: `npm run lint`
Expected: no new errors.
```bash
git -C .. add noblestride-crm/src/components/shell/sidebar.tsx noblestride-crm/src/components/portal/investor-portal-nav.ts noblestride-crm/src/components/__tests__/investor-portal-nav.test.ts
git -C .. commit -m "feat(portal): shared investor nav model + exported sidebar primitives

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Extract the shared ViewingBanner server component

**Files:**
- Create: `src/components/portal/viewing-banner.tsx`

**Interfaces:**
- Consumes: `prisma`, `getViewpoint`, `label`, `PortalSwitcher` (all existing).
- Produces: `export async function ViewingBanner()` — an async RSC rendering the amber demo-lens banner div (self-contained: fetches its own data). Used by Task 3 (partner layout) and Task 5 (investor layout).

- [ ] **Step 1: Create the component**

Create `src/components/portal/viewing-banner.tsx` — the banner block moved **verbatim** from `src/app/portal/layout.tsx` (same classes, same logic):
```tsx
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
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-800">
      <span className="inline-flex flex-wrap items-center gap-2">
        <span>
          Viewing as{" "}
          {vp.role === "investor" || vp.role === "partner" ? (
            <PortalSwitcher
              role={vp.role}
              recordId={vp.recordId ?? ""}
              investors={investorOptions}
              partners={partnerOptions}
            />
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
      <Link
        href="/api/viewpoint?role=admin"
        className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
      >
        Return to Admin
      </Link>
    </div>
  );
}
```
Note: the original renders the switcher for non-admin org roles too (any role that isn't investor/partner falls to the `capitalize` branch) — this copy preserves that behavior exactly.

- [ ] **Step 2: Typecheck via lint**

Run: `npm run lint`
Expected: no errors. (Component is not wired up yet — that happens in Tasks 3 and 5.)

- [ ] **Step 3: Commit**

```bash
git -C .. add noblestride-crm/src/components/portal/viewing-banner.tsx
git -C .. commit -m "feat(portal): extract shared ViewingBanner demo-lens component

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Pass-through portal layout; partner layout absorbs the external shell

**Files:**
- Modify: `src/app/portal/layout.tsx` (full rewrite)
- Modify: `src/app/portal/partner/layout.tsx` (full rewrite)

**Interfaces:**
- Consumes: `ViewingBanner` from Task 2, existing `PartnerTabs`.
- Produces: partner portal DOM identical to the old shared shell with `Partner Portal` header tag; `portal/layout.tsx` keeps `export const dynamic = "force-dynamic"` cascading to both sub-trees.

- [ ] **Step 1: Rewrite `src/app/portal/layout.tsx` as a pass-through**

Replace the entire file with:
```tsx
// portal/layout.tsx — shared external-portal segment. Shell markup lives in
// the role-specific layouts: partner keeps the classic external shell, the
// investor portal uses the CRM-style shell (one design language with the
// internal CRM). Kept dynamic so both sub-trees read the live viewpoint
// cookie and Postgres data per request.
export const dynamic = "force-dynamic";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

- [ ] **Step 2: Rewrite `src/app/portal/partner/layout.tsx` with the absorbed shell**

Replace the entire file with:
```tsx
// portal/partner/layout.tsx — the external partner shell (design spec
// §5.3–§5.4, §6): amber demo-lens banner, emerald brand header, centered
// column with the partner sub-navigation. Deliberately separate from the
// internal CRM shell — partners only ever see what the visibility engine
// projects.
import { ViewingBanner } from "@/components/portal/viewing-banner";
import { PartnerTabs } from "@/components/portal/partner-tabs";

export default function PartnerPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <ViewingBanner />
      <header className="border-b border-zinc-200 bg-emerald-950 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <div className="text-lg font-bold tracking-tight text-white">NobleStride Capital</div>
            <div className="text-xs text-emerald-200/80">
              Create. Value. Investing. Sub-Saharan Africa
            </div>
          </div>
          <div className="text-xs uppercase tracking-widest text-emerald-200/60">
            Partner Portal
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="space-y-6">
          <PartnerTabs />
          {children}
        </div>
      </main>
      <footer className="mx-auto max-w-5xl px-6 pb-8 text-xs text-zinc-400">
        Confidential — shared under the terms of your NDA with NobleStride Capital.
      </footer>
    </div>
  );
}
```
(The old shared layout rendered `{vp.role === "partner" ? "Partner Portal" : "Investor Portal"}`; hardcoding `Partner Portal` here is identical output for partners. The old investor layout's `div.space-y-6` wrapper is reproduced by this layout's own `div.space-y-6`, matching the old nesting for partners exactly.)

- [ ] **Step 3: Verify partner output is unchanged (structural diff)**

⚠️ The investor portal is intentionally broken at this point (no shell) — that's fine; Task 5 fixes it. Only partner must be verified now:
```bash
SCRATCH='C:/Users/shaur/AppData/Local/Temp/claude/D--LuaWork-NobleStride-noble-stride/c2d46231-126c-44ed-a03f-6e5aa6247150/scratchpad'
curl -s -b "$SCRATCH/jar-partner.txt" http://localhost:3000/portal/partner -o "$SCRATCH/partner-after-task3.html"
python "$SCRATCH/strip-scripts.py" "$SCRATCH/partner-after-task3.html" "$SCRATCH/partner-after-task3.stripped.html"
diff "$SCRATCH/partner-before.stripped.html" "$SCRATCH/partner-after-task3.stripped.html" && echo IDENTICAL
```
Expected: `IDENTICAL` (or differences confined to Next.js dev-mode asset hashes/timestamps — anything touching visible markup is a failure; fix before committing).

- [ ] **Step 4: Lint and commit**

Run: `npm run lint` — expected: no errors.
```bash
git -C .. add noblestride-crm/src/app/portal/layout.tsx noblestride-crm/src/app/portal/partner/layout.tsx
git -C .. commit -m "refactor(portal): move external shell into partner layout, pass-through portal layout

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: InvestorSidebar and InvestorTopbar components

**Files:**
- Create: `src/components/portal/investor-sidebar.tsx`
- Create: `src/components/portal/investor-topbar.tsx`

**Interfaces:**
- Consumes: `BrandMark`, `NavItem`, `SIDEBAR_FG` from `@/components/shell/sidebar` (Task 1); `INVESTOR_NAV`, `isInvestorNavActive`, `deriveInvestorPageMeta` from `./investor-portal-nav` (Task 1); `Avatar` from `@/components/ui`.
- Produces: `export function InvestorSidebar()` (client, no props); `export function InvestorTopbar({ investorName }: { investorName: string })` (client). Used by Task 5's layout.

- [ ] **Step 1: Create `src/components/portal/investor-sidebar.tsx`**

```tsx
"use client";

// CRM-style sidebar for the investor portal — same visual system as the
// internal shell sidebar (dark emerald, brand mark, accented nav), but
// external-safe: portal-only nav, no internal routes, no agent cards.
// h-full instead of h-screen: the demo-lens banner sits above it in the
// investor layout's flex column.
import { usePathname } from "next/navigation";
import { LayoutGrid, TrendingUp, Building2, ChevronLeft } from "lucide-react";
import { BrandMark, NavItem, SIDEBAR_FG } from "@/components/shell/sidebar";
import { INVESTOR_NAV, isInvestorNavActive } from "./investor-portal-nav";

const NAV_ICONS = {
  "/portal/investor": LayoutGrid,
  "/portal/investor/pipeline": TrendingUp,
  "/portal/investor/profile": Building2,
} as const;

export function InvestorSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex h-full w-64 flex-shrink-0 flex-col overflow-hidden"
      style={{ backgroundColor: "#0b1a14" }}
    >
      <BrandMark />

      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        <p
          className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest opacity-60"
          style={{ color: SIDEBAR_FG }}
        >
          Portal
        </p>
        <nav className="flex flex-col gap-0.5">
          {INVESTOR_NAV.map(({ href, label }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              Icon={NAV_ICONS[href]}
              active={isInvestorNavActive(pathname, href)}
            />
          ))}
        </nav>
      </div>

      <div className="flex-shrink-0 border-t border-white/5 px-4 py-3">
        <p
          className="text-[10px] font-semibold uppercase tracking-widest opacity-60"
          style={{ color: SIDEBAR_FG }}
        >
          Investor Portal
        </p>
      </div>

      <div className="flex flex-shrink-0 items-center justify-center border-t border-white/5 py-3">
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/5"
          style={{ color: SIDEBAR_FG }}
          aria-label="Collapse sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create `src/components/portal/investor-topbar.tsx`**

```tsx
"use client";

// CRM-style topbar for the investor portal — same structure as the internal
// shell topbar (title block, search, bell, avatar) minus internal-only
// affordances: no AskBar (agents are internal) and no viewpoint switcher
// (the demo lens lives in the amber banner above).
import { usePathname } from "next/navigation";
import { Search, Bell } from "lucide-react";
import { Avatar } from "@/components/ui";
import { deriveInvestorPageMeta } from "./investor-portal-nav";

export function InvestorTopbar({ investorName }: { investorName: string }) {
  const pathname = usePathname();
  const { title, subtitle } = deriveInvestorPageMeta(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-zinc-200 bg-white px-6">
      <div className="flex w-52 min-w-0 flex-shrink-0 flex-col justify-center">
        <h1 className="truncate text-lg font-bold leading-tight text-zinc-900">{title}</h1>
        {subtitle && <p className="truncate text-xs leading-tight text-zinc-500">{subtitle}</p>}
      </div>

      <div className="flex-1" />

      <div className="flex flex-shrink-0 items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
          <input
            type="text"
            placeholder="Search…"
            className="w-28 bg-transparent text-xs text-zinc-600 placeholder:text-zinc-400 focus:outline-none"
          />
        </div>

        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>

        <Avatar name={investorName} size="sm" color="bg-emerald-600" />
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git -C .. add noblestride-crm/src/components/portal/investor-sidebar.tsx noblestride-crm/src/components/portal/investor-topbar.tsx
git -C .. commit -m "feat(portal): CRM-style investor sidebar and topbar components

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Investor layout — CRM shell; delete InvestorNav

**Files:**
- Modify: `src/app/portal/investor/layout.tsx` (full rewrite)
- Delete: `src/components/portal/investor-nav.tsx`

**Interfaces:**
- Consumes: `ViewingBanner` (Task 2), `InvestorSidebar`/`InvestorTopbar` (Task 4), `prisma`, `getViewpoint`.
- Produces: the investor portal shell; pages render unchanged inside `<main>`.

- [ ] **Step 1: Rewrite `src/app/portal/investor/layout.tsx`**

Replace the entire file with:
```tsx
// portal/investor/layout.tsx — CRM-style shell for the investor portal (one
// design language with the internal CRM): amber demo-lens banner on top,
// dark sidebar, sticky topbar, zinc-50 canvas. External-safe: the nav is
// portal-only and every page still renders only visibility-projected data.
import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";
import { ViewingBanner } from "@/components/portal/viewing-banner";
import { InvestorSidebar } from "@/components/portal/investor-sidebar";
import { InvestorTopbar } from "@/components/portal/investor-topbar";

export default async function InvestorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fund name for the topbar avatar; pages themselves gate + redirect
  // non-investor viewpoints, so a fallback label is fine here.
  const vp = await getViewpoint();
  const investor =
    vp.role === "investor" && vp.recordId
      ? await prisma.investor.findUnique({
          where: { id: vp.recordId },
          select: { name: true },
        })
      : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-50">
      <div className="flex-shrink-0">
        <ViewingBanner />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <InvestorSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <InvestorTopbar investorName={investor?.name ?? "Investor"} />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
            <p className="pt-8 text-xs text-zinc-400">
              Confidential — shared under the terms of your NDA with NobleStride Capital.
            </p>
          </main>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete the now-unused tab nav**

```bash
git -C .. rm noblestride-crm/src/components/portal/investor-nav.tsx
```
Then confirm nothing else references it:
```bash
grep -rn "investor-nav\|InvestorNav" noblestride-crm/src && echo "STILL REFERENCED — fix" || echo CLEAN
```
Expected: `CLEAN`.

- [ ] **Step 3: Smoke-check the investor portal renders the new shell**

```bash
SCRATCH='C:/Users/shaur/AppData/Local/Temp/claude/D--LuaWork-NobleStride-noble-stride/c2d46231-126c-44ed-a03f-6e5aa6247150/scratchpad'
curl -s http://localhost:3000/dashboard -o /tmp/dash.html
grep -oE 'role=investor&(amp;)?recordId=[A-Za-z0-9_-]+' /tmp/dash.html | head -1
# substitute <IID> below with the extracted recordId
curl -s -c "$SCRATCH/jar-investor.txt" -o /dev/null "http://localhost:3000/api/viewpoint?role=investor&recordId=<IID>"
curl -s -b "$SCRATCH/jar-investor.txt" http://localhost:3000/portal/investor -o "$SCRATCH/investor-after.html"
for m in "NobleStride" "Portal" "Opportunities" "My Pipeline" "Fund Profile" "Viewing as" "Deals matching your mandate" "Investment Opportunities"; do grep -qc "$m" "$SCRATCH/investor-after.html" && echo "OK: $m" || echo "MISSING: $m"; done
grep -c "INVESTOR PORTAL\|Investor Portal" "$SCRATCH/investor-after.html"
```
Expected: every marker `OK`; no `MISSING`.

- [ ] **Step 4: Lint and commit**

Run: `npm run lint` — expected: no errors.
```bash
git -C .. add noblestride-crm/src/app/portal/investor/layout.tsx
git -C .. commit -m "feat(portal): investor portal adopts CRM shell — sidebar, topbar, banner

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
(The `git rm` from Step 2 is already staged and lands in this commit.)

---

### Task 6: Opportunities grid uses the wider canvas

**Files:**
- Modify: `src/app/portal/investor/page.tsx:39`

**Interfaces:**
- Consumes/Produces: none (class-only change).

- [ ] **Step 1: Widen the grid**

In `src/app/portal/investor/page.tsx` line 39, change:
```tsx
<div className="grid gap-4 sm:grid-cols-2">
```
to:
```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
```

- [ ] **Step 2: Verify + commit**

```bash
SCRATCH='C:/Users/shaur/AppData/Local/Temp/claude/D--LuaWork-NobleStride-noble-stride/c2d46231-126c-44ed-a03f-6e5aa6247150/scratchpad'
curl -s -b "$SCRATCH/jar-investor.txt" http://localhost:3000/portal/investor | grep -c "lg:grid-cols-3"
```
Expected: ≥ 1.
```bash
git -C .. add noblestride-crm/src/app/portal/investor/page.tsx
git -C .. commit -m "feat(portal): opportunities grid uses full-width CRM canvas

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Full test suite, lint, production build

**Files:** none (verification only).

- [ ] **Step 1: Run the unit tests**

Run from `noblestride-crm/`: `npm run test`
Expected: all pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Production build**

Run: `npm run build` (needs the DB up for prisma generate only — no page prerender: portal tree is force-dynamic).
Expected: build succeeds, no type errors. Do not restart the dev server.

---

### Task 8: End-to-end verification (partner regression + investor + admin)

**Files:** none (verification only; scratchpad artifacts).

- [ ] **Step 1: Partner byte-identical regression**

```bash
SCRATCH='C:/Users/shaur/AppData/Local/Temp/claude/D--LuaWork-NobleStride-noble-stride/c2d46231-126c-44ed-a03f-6e5aa6247150/scratchpad'
curl -s -b "$SCRATCH/jar-partner.txt" http://localhost:3000/portal/partner -o "$SCRATCH/partner-after.html"
python "$SCRATCH/strip-scripts.py" "$SCRATCH/partner-after.html" "$SCRATCH/partner-after.stripped.html"
diff "$SCRATCH/partner-before.stripped.html" "$SCRATCH/partner-after.stripped.html" && echo IDENTICAL
```
Expected: `IDENTICAL` (or only dev-asset-hash noise). Also spot-check the other partner tabs render:
```bash
for p in /portal/partner /portal/partner/refer /portal/partner/details; do
  curl -s -b "$SCRATCH/jar-partner.txt" -o /dev/null -w "%{http_code} $p\n" "http://localhost:3000$p"
done
```
Expected: `200` for each.

- [ ] **Step 2: Investor portal — every route renders the CRM shell**

```bash
for p in /portal/investor /portal/investor/pipeline /portal/investor/profile; do
  curl -s -b "$SCRATCH/jar-investor.txt" "http://localhost:3000$p" -o "$SCRATCH/inv-check.html"
  echo "== $p"
  grep -qc 'aria-label="Collapse sidebar"' "$SCRATCH/inv-check.html" && echo "  sidebar OK" || echo "  sidebar MISSING"
  grep -qc "Viewing as" "$SCRATCH/inv-check.html" && echo "  banner OK" || echo "  banner MISSING"
  grep -qc 'aria-label="Notifications"' "$SCRATCH/inv-check.html" && echo "  topbar OK" || echo "  topbar MISSING"
done
```
Expected: all OK. Also open a deal page: extract a deal href from `/portal/investor` (`/portal/investor/deals/<id>`), fetch it, confirm HTTP 200 and sidebar marker present.

- [ ] **Step 3: Admin dashboard unchanged**

```bash
curl -s "http://localhost:3000/api/viewpoint?role=admin" -c "$SCRATCH/jar-admin.txt" -o /dev/null
curl -s -b "$SCRATCH/jar-admin.txt" http://localhost:3000/dashboard -o "$SCRATCH/admin-after.html"
for m in "Mandates" "Access Matrix" "Ask your agents" "Overview Agent"; do grep -qc "$m" "$SCRATCH/admin-after.html" && echo "OK: $m" || echo "MISSING: $m"; done
```
Expected: all OK.

- [ ] **Step 4: Visual confirmation**

Screenshot or carefully inspect the rendered investor portal HTML against the design intent: dark `#0b1a14` sidebar with NobleStride brand mark and three accented nav items, white sticky topbar with title/subtitle + search + bell + avatar, amber banner on top, content on zinc-50. If a browser/screenshot tool is unavailable, verify via the HTML markers above plus presence of `background-color:#0b1a14`/`style` on the aside element.
