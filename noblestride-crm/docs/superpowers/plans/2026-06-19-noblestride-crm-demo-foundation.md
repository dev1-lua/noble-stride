# NobleStride CRM — Demo-Ready Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete-looking, navigable NobleStride CRM on realistic seed data — all six sections, record detail pages, two key writes, and canned AI surfaces — matching the wireframe's capability surface.

**Architecture:** Approach B — a shared `src/server/services/*` layer is the single source of truth over Prisma; **pure domain logic** (metrics/ranking/filters) lives in `src/server/domain/*` and is unit-tested; Pothos/Yoga GraphQL at `/api/graphql` wraps the services (the API for Lua + client writes); Server Components call services directly for SSR reads; client components use urql for the two writes + canned-AI calls.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5 · PostgreSQL 16 (Docker, port 5544) · Prisma 6 · Pothos v4 + GraphQL Yoga · urql · Tailwind v4 · Vitest · pnpm · Node 24.

## Global Constraints

- **Do NOT upgrade Prisma to v7** — pinned at `6.19.3` (v7's query-compiler/new-generator breaks Pothos plugin-prisma). Keep `@prisma/client` and `prisma` on `^6`.
- All business logic lives in `src/server/domain/*` (pure) and `src/server/services/*` (Prisma). **No logic in GraphQL resolvers or React components** — resolvers and components are thin.
- Money is exposed as GraphQL `Float` in USD; dates as a `DateTime` scalar (ISO string).
- Enum identifiers are PascalCase (Prisma); humans see labels via `src/lib/vocab.ts` (`label(group, value)`). Never hardcode a human label in a component.
- Provenance: `createdSource` defaults to `HUMAN`; writes from canned-AI seams set `AGENT`.
- Deferred (leave seams, do NOT build): auth/roles, investor portal, live Lua/Data API/webhooks, full create/edit/delete CRUD.
- Design: dark-green brand (see Task 11 tokens). Approximate the wireframe (`../../context-screens/*.png`); capability-complete is the bar, not pixel-match.
- Test runner: Vitest (`pnpm test`). Commit after every passing task. Conventional-commit messages, ending with the Co-Authored-By trailer for `Claude Opus 4.8 (1M context)`.
- Work on branch `build/demo-foundation`. The Postgres schema is already migrated; `lib/db.ts`, `lib/vocab.ts`, `graphql/builder.ts`, `graphql/context.ts` already exist.

---

## File Structure

```
src/
  lib/            cn.ts  money.ts  format.ts  vocab.ts(done)  db.ts(done)
  server/
    domain/       types.ts  metrics.ts  ranking.ts  filters.ts        (pure, unit-tested)
    services/     investors.ts clients.ts mandates.ts transactions.ts
                  engagements.ts partners.ts dashboard.ts ai.ts        (Prisma + domain)
    __tests__/    *.test.ts                                            (domain unit tests)
  graphql/        builder.ts(done) context.ts(done) types.ts queries.ts
                  mutations.ts schema.ts
  app/
    api/graphql/route.ts
    providers.tsx                  urql client provider
    (crm)/layout.tsx               shell
    (crm)/dashboard/page.tsx
    (crm)/mandates/page.tsx        + [id]/page.tsx
    (crm)/transactions/page.tsx    + [id]/page.tsx
    (crm)/investors/page.tsx       + [id]/page.tsx
    (crm)/clients/[id]/page.tsx
    (crm)/engagement/page.tsx      + [id]/page.tsx
    (crm)/partners/page.tsx        + [id]/page.tsx
  components/
    ui/      cn-based primitives: Tag Chip Avatar Button Card StatCard Table Badge Input Select Dropdown
    shell/   Sidebar Topbar AskBar
    crm/     KanbanBoard KanbanCard RecordTable FilterBar ActivityTimeline
             OverviewAgentCard MatchInvestorsButton StatRow PipelineChart SegmentRow
prisma/      schema.prisma(done)  seed.ts
vitest.config.ts
```

---

### Task 1: Test tooling + foundation libs

**Files:**
- Create: `vitest.config.ts`, `src/lib/cn.ts`, `src/lib/money.ts`, `src/lib/format.ts`
- Test: `src/lib/__tests__/money.test.ts`, `src/lib/__tests__/format.test.ts`

**Interfaces — Produces:**
- `cn(...inputs: ClassValue[]): string` (clsx + tailwind-merge)
- `formatMoney(amount: number | null | undefined, currency?: string): string` → `"$18.4M"`, `"$680K"`, `"$5.0M"`, `""` for null
- `formatCompact(n: number): string` → `"1,247"`, `"142"`
- `formatDate(d: Date | string | null): string` → `"19 Jun 2026"`; `daysAgoLabel(d): string` → `"3d ago"`

- [ ] **Step 1: Add dev deps**

Run: `pnpm add -D vitest @vitejs/plugin-react`
Expected: added to devDependencies.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", globals: true, include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 3: Write failing tests** (`src/lib/__tests__/money.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { formatMoney } from "@/lib/money";

describe("formatMoney", () => {
  it("formats millions", () => expect(formatMoney(18_400_000)).toBe("$18.4M"));
  it("formats thousands", () => expect(formatMoney(680_000)).toBe("$680K"));
  it("formats small", () => expect(formatMoney(500)).toBe("$500"));
  it("handles null", () => expect(formatMoney(null)).toBe(""));
  it("respects currency", () => expect(formatMoney(5_000_000, "USD")).toBe("$5.0M"));
});
```

`src/lib/__tests__/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatCompact, formatDate } from "@/lib/format";

describe("format", () => {
  it("compacts thousands", () => expect(formatCompact(1247)).toBe("1,247"));
  it("formats date", () => expect(formatDate(new Date("2026-06-19T00:00:00Z"))).toBe("19 Jun 2026"));
  it("null date -> empty", () => expect(formatDate(null)).toBe(""));
});
```

- [ ] **Step 4: Run, verify FAIL** — `pnpm test` → fails (modules not found).

- [ ] **Step 5: Implement** `cn.ts`, `money.ts`, `format.ts`.

```ts
// cn.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```
```ts
// money.ts
export function formatMoney(amount?: number | null, currency = "USD"): string {
  if (amount == null) return "";
  const sign = currency === "USD" ? "$" : "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${sign}${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${Math.round(amount / 1_000)}K`;
  return `${sign}${Math.round(amount)}`;
}
```
```ts
// format.ts
export const formatCompact = (n: number) => n.toLocaleString("en-US");
export function formatDate(d?: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
export function daysAgoLabel(d?: Date | string | null, now = new Date()): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  return days <= 0 ? "today" : `${days}d ago`;
}
```
> Note: `formatMoney(500)` → `"$500"` and `formatMoney(5_000_000)` → `"$5.0M"`; verify `toFixed(1)` matches expected `"$18.4M"`.

- [ ] **Step 6: Run, verify PASS** — `pnpm test` → all green.

- [ ] **Step 7: Commit** — `git commit -m "feat: test tooling + money/format/cn libs"`

---

### Task 2: Domain types + metrics (pure, unit-tested)

**Files:**
- Create: `src/server/domain/types.ts`, `src/server/domain/metrics.ts`
- Test: `src/server/__tests__/metrics.test.ts`

**Interfaces — Produces:**
- `quarterRange(now?: Date): { start: Date; end: Date }`
- `daysInStage(stageEnteredAt: Date, now?: Date): number`
- `avgTimeToCloseMonths(txns: { dateOpened: Date | null; closedAt: Date | null }[]): number | null`
- `isActiveInvestorThisQuarter(args: { status: InvestorStatus | null; activityDates: Date[] }, now?: Date): boolean`
- `ACTIVE_MANDATE_STAGES`, `CLOSED_TXN_STAGES`, `ACTIVE_CONVERSATION_STATUSES` constants
- `partnerReferralRollup(input: PartnerReferralInput): { referred: number; active: number; closed: number; revenue: number }`
- types: `InvestorFilter`, `Pagination`, `KanbanColumn<T>`, `DashboardStats`, `InvestorSegments`, `PartnerReferralInput`

- [ ] **Step 1: Failing tests** (`src/server/__tests__/metrics.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import {
  quarterRange, daysInStage, avgTimeToCloseMonths,
  isActiveInvestorThisQuarter, partnerReferralRollup,
} from "@/server/domain/metrics";

const NOW = new Date("2026-06-19T12:00:00Z");

describe("metrics", () => {
  it("daysInStage counts whole days", () => {
    expect(daysInStage(new Date("2026-06-11T12:00:00Z"), NOW)).toBe(8);
  });
  it("avgTimeToCloseMonths averages closed deals", () => {
    const r = avgTimeToCloseMonths([
      { dateOpened: new Date("2026-01-01"), closedAt: new Date("2026-04-01") }, // ~3mo
      { dateOpened: new Date("2026-01-01"), closedAt: new Date("2026-06-01") }, // ~5mo
    ]);
    expect(r).toBeCloseTo(4, 0);
  });
  it("avgTimeToCloseMonths -> null when none closed", () => {
    expect(avgTimeToCloseMonths([{ dateOpened: new Date(), closedAt: null }])).toBeNull();
  });
  it("active investor by status", () => {
    expect(isActiveInvestorThisQuarter({ status: "ActivelyDeploying", activityDates: [] }, NOW)).toBe(true);
  });
  it("active investor by recent activity", () => {
    const q = quarterRange(NOW);
    expect(isActiveInvestorThisQuarter({ status: null, activityDates: [q.start] }, NOW)).toBe(true);
  });
  it("inactive investor", () => {
    expect(isActiveInvestorThisQuarter({ status: "Dormant", activityDates: [new Date("2025-01-01")] }, NOW)).toBe(false);
  });
  it("partner rollup", () => {
    expect(partnerReferralRollup({
      mandates: [
        { transactions: [{ stage: "ClosedWon", targetRaise: 5_000_000 }] },
        { transactions: [{ stage: "DueDiligence", targetRaise: 2_000_000 }] },
        { transactions: [] },
      ],
    })).toEqual({ referred: 3, active: 1, closed: 1, revenue: 5_000_000 });
  });
});
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement `types.ts` then `metrics.ts`.** Key rules:
  - `quarterRange`: start = first day of current calendar quarter 00:00, end = now.
  - `daysInStage`: `floor((now - stageEnteredAt)/86_400_000)`.
  - `avgTimeToCloseMonths`: over txns with both dates and `closedAt`; months = days/30.44; return null if none.
  - `isActiveInvestorThisQuarter`: `status === "ActivelyDeploying"` OR any activityDate within `quarterRange`.
  - `partnerReferralRollup`: referred = mandates.length; active = mandates with ≥1 txn whose stage ∉ CLOSED_TXN_STAGES; closed = count of txns ClosedWon; revenue = Σ targetRaise of ClosedWon txns.
  - Constants: `ACTIVE_MANDATE_STAGES` = all except Signed, Lost; `CLOSED_TXN_STAGES` = [ClosedWon, ClosedLost]; `ACTIVE_CONVERSATION_STATUSES` = [InConversation, Interested].

- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat: pure domain metrics + types"`

---

### Task 3: Domain ranking (canned AI match) + filters (pure, unit-tested)

**Files:**
- Create: `src/server/domain/ranking.ts`, `src/server/domain/filters.ts`
- Test: `src/server/__tests__/ranking.test.ts`

**Interfaces — Produces:**
- `investorMatchScore(inv: MatchInvestor, txn: MatchTxn): { score: number; reasons: string[] }` — score 0–1
- `rankInvestorMatches(invs: MatchInvestor[], txn: MatchTxn, limit?: number): InvestorMatch[]` (sorted desc, score > 0)
- `buildInvestorWhere(filter: InvestorFilter): Prisma.InvestorWhereInput`
- types: `MatchInvestor { id; name; sectorFocus; geographicFocus; ticketMin; ticketMax; status }`, `MatchTxn { sector; targetRaise; geography? }`, `InvestorMatch { id; name; score; reasons }`

- [ ] **Step 1: Failing tests** — score weighting:
  - sector overlap = 0.5 weight, geography overlap = 0.3, ticket fit (txn.targetRaise within [ticketMin,ticketMax]) = 0.2; `ActivelyDeploying` adds +0.1 bonus capped at 1.0.
  - `reasons` includes human strings like `"Sector match: Technology"`, `"Ticket fits ($5.0M)"`.

```ts
import { describe, it, expect } from "vitest";
import { investorMatchScore, rankInvestorMatches } from "@/server/domain/ranking";

const txn = { sector: ["Technology"], targetRaise: 5_000_000, geography: ["EastAfrica"] } as const;

describe("ranking", () => {
  it("scores sector+geo+ticket", () => {
    const { score, reasons } = investorMatchScore(
      { id: "1", name: "A", sectorFocus: ["Technology"], geographicFocus: ["EastAfrica"],
        ticketMin: 1_000_000, ticketMax: 10_000_000, status: "ActivelyDeploying" }, txn);
    expect(score).toBeCloseTo(1.0, 1);
    expect(reasons.some(r => r.includes("Technology"))).toBe(true);
  });
  it("low score on no overlap", () => {
    const { score } = investorMatchScore(
      { id: "2", name: "B", sectorFocus: ["Banking"], geographicFocus: ["Europe"],
        ticketMin: 50_000_000, ticketMax: 100_000_000, status: "Dormant" }, txn);
    expect(score).toBeLessThan(0.2);
  });
  it("ranks and limits", () => {
    const res = rankInvestorMatches([
      { id: "1", name: "A", sectorFocus: ["Technology"], geographicFocus: ["EastAfrica"], ticketMin: 1e6, ticketMax: 1e7, status: "ActivelyDeploying" },
      { id: "2", name: "B", sectorFocus: ["Banking"], geographicFocus: ["Europe"], ticketMin: 5e7, ticketMax: 1e8, status: "Dormant" },
    ], txn, 1);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("1");
  });
});
```

- [ ] **Step 2–4: FAIL → implement → PASS.** `buildInvestorWhere` maps filter fields to Prisma (`investorType`, `sectorFocus: { has }`, `geographicFocus: { has }`, `status`, ticket range overlap, `name: { contains, mode: "insensitive" }`).
- [ ] **Step 5: Commit** — `git commit -m "feat: investor match ranking + investor filters"`

---

### Task 4: Investor + Client services

**Files:**
- Create: `src/server/services/investors.ts`, `src/server/services/clients.ts`

**Interfaces — Consumes:** `buildInvestorWhere` (T3), `isActiveInvestorThisQuarter`, types (T2). **Produces:**
- `listInvestors(filter, page?): Promise<Investor[]>`
- `countInvestors(filter): Promise<number>`
- `investorSegments(): Promise<InvestorSegments>` ({ total, activeThisQuarter, privateEquity, ventureCapital, dfi, debtProvider })
- `getInvestor(id): Promise<Investor & relations | null>`
- `listClients()`, `getClient(id)`

- [ ] **Step 1:** Implement using `prisma` + `buildInvestorWhere`. `investorSegments` runs counts by type + a query loading each investor's `status` and recent activity dates, reduced via `isActiveInvestorThisQuarter`. `getInvestor` includes `contacts`, `engagements: { include: { transaction } }`, recent `activities`.
- [ ] **Step 2: Verification** — add `src/server/__tests__/investors.smoke.test.ts` guarded by `process.env.DATABASE_URL` that, if a DB is reachable, asserts `listInvestors({})` returns an array (skips otherwise). Run `pnpm test`.
- [ ] **Step 3: Commit** — `git commit -m "feat: investor + client services"`

---

### Task 5: Mandate + Transaction services (incl. restage writes)

**Files:** Create `src/server/services/mandates.ts`, `src/server/services/transactions.ts`

**Interfaces — Produces:**
- `listMandates(filter?)`, `mandatesByStage(): Promise<KanbanColumn<Mandate>[]>`, `getMandate(id)`, `setMandateStage(id, stage): Promise<Mandate>` (sets `stageEnteredAt = now`)
- `listTransactions(filter?)`, `transactionsByStage(): Promise<KanbanColumn<Transaction>[]>`, `getTransaction(id)`, `setTransactionStage(id, stage)` (sets `stageEnteredAt`; sets `closedAt = now` when stage ∈ {ClosedWon, ClosedLost}, else `closedAt = null`)
- Transaction objects include derived `investorsContacted`, `activeConversations` (via `_count` + a count of engagements in `ACTIVE_CONVERSATION_STATUSES`).

- [ ] **Step 1:** Implement. `mandatesByStage`/`transactionsByStage` build one `KanbanColumn` per enum value in vocab order, label via `LABELS`.
- [ ] **Step 2:** Manually verify in a throwaway `tsx` script or rely on the GraphQL smoke test (Task 9). Commit — `git commit -m "feat: mandate + transaction services with restage"`

---

### Task 6: Engagement + Activity + Partner services

**Files:** Create `src/server/services/engagements.ts`, `src/server/services/partners.ts`, `src/server/services/activities.ts`

**Interfaces — Produces:**
- `engagementsByDeal(): Promise<{ transaction: Transaction; engagements: Engagement[] }[]>`
- `engagementCounters(): Promise<{ outreach; ndaSigned; dataRoom; meetings; feedback; termSheets }>` (counts of Activity by type)
- `activityTimeline(limit?): Promise<Activity[]>` (recent, newest first, with relations)
- `logEngagement(input: { transactionId; investorId; type: InteractionType; subject?; body? }): Promise<Activity>` — upserts the Engagement (create if missing, status→Contacted), creates an Activity (`createdSource: HUMAN`), bumps `lastContact`.
- `getEngagement(id)`
- `listPartners(filter?)`, `getPartner(id)`, `partnerReferralStats(): Promise<{ totalPartners; dealsReferred; closedRevenue; conversionRate; byPartner: {name; referred; active; closed; revenue}[] }>` (uses `partnerReferralRollup`)

- [ ] **Step 1:** Implement; `partnerReferralStats` loads partners with `referredMandates: { include: { transactions } }` and maps via `partnerReferralRollup`.
- [ ] **Step 2: Commit** — `git commit -m "feat: engagement/activity/partner services"`

---

### Task 7: Dashboard + canned-AI services

**Files:** Create `src/server/services/dashboard.ts`, `src/server/services/ai.ts`

**Interfaces — Produces:**
- `dashboardStats(): Promise<DashboardStats>` ({ activeMandates, activeTransactions, investorsEngagedQtr, capitalRaisedYtd } + each with a `delta` number for the "+N" chips — for the demo, delta is a deterministic derived figure, e.g. count created in last 30d).
- `pipelineOverview(): Promise<{ mandatesByStage; transactionsByStage }>` (counts per stage)
- `dealPipelineTrend(): Promise<{ month: string; active: number; closed: number }[]>` (last 6 months)
- `aiOverviewInsights(): Promise<Insight[]>` — `Insight { kind: "convert"|"attention"|"match"; title; detail }` derived from pipeline (e.g. mandates in Proposal/Negotiation → "ready to convert"; transactions with no activity in 14d → "needs attention"; top match from ranking).
- `aiMatchInvestors(transactionId): Promise<InvestorMatch[]>` — load txn + all investors → `rankInvestorMatches`, limit 8.
- `aiFindProspects(mandateId): Promise<{ name; sector; rationale }[]>` (canned, data-aware from clients in same sector).
- `aiAsk(question): Promise<{ answer: string; sources: string[] }>` — canned: keyword-route to a dashboard summary.
> Each AI function carries a top comment: `// SEAM: replace body with Lua (Data API semantic search / LuaTool) — see SPEC §8. Signature stays identical.`

- [ ] **Step 1:** Implement. `capitalRaisedYtd` = Σ `targetRaise` of ClosedWon transactions with `closedAt` in current year.
- [ ] **Step 2: Commit** — `git commit -m "feat: dashboard + canned-AI services (Lua seams)"`

---

### Task 8: GraphQL object types

**Files:** Create `src/graphql/types.ts`

**Interfaces — Consumes:** enum refs from `builder.ts`. **Produces:** Pothos `prismaObject` for Investor, Client, Mandate, Transaction, Engagement, Partner, Person, User, Activity — exposing the fields used by the UI (see spec §6). Enum + enum-array fields via `t.field({ type: [SectorEnum], resolve })`; money via `t.float({ resolve: p => p.x == null ? null : Number(p.x) })`; dates via `t.field({ type: "DateTime", resolve })`; relations via `t.relation(...)`; counts via `t.relationCount(...)`. Derived Transaction fields `investorsContacted`/`activeConversations` and Mandate `daysInStage` exposed via `t.int({ resolve })` calling domain helpers.

- [ ] **Step 1:** Implement all object types (one `builder.prismaObject` per model). No queries yet.
- [ ] **Step 2:** Build check — `pnpm exec tsc --noEmit` passes for `src/graphql/types.ts`.
- [ ] **Step 3: Commit** — `git commit -m "feat: GraphQL object types"`

---

### Task 9: GraphQL queries, mutations, schema, route + smoke test

**Files:** Create `src/graphql/queries.ts`, `src/graphql/mutations.ts`, `src/graphql/schema.ts`, `src/app/api/graphql/route.ts`; Test `src/graphql/__tests__/schema.smoke.test.ts`

**Interfaces — Consumes:** services (T4–7), types (T8). **Produces:** `schema` export; HTTP endpoint `/api/graphql`. Queries/mutations exactly per spec §6, each resolver a one-line call to the matching service.

- [ ] **Step 1: Failing smoke test**

```ts
import { describe, it, expect } from "vitest";
import { schema } from "@/graphql/schema";
import { execute, parse } from "graphql";
import { prisma } from "@/lib/db";

describe("graphql schema", () => {
  it("builds and answers dashboardStats", async () => {
    const result = await execute({
      schema,
      document: parse(`{ dashboardStats { activeMandates activeTransactions } }`),
      contextValue: { prisma, actor: { type: "HUMAN" } },
    });
    expect(result.errors).toBeUndefined();
    expect(result.data?.dashboardStats).toBeTruthy();
  });
});
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `queries.ts`, `mutations.ts`, `schema.ts` (imports types/queries/mutations for side effects, exports `builder.toSchema()`), and `route.ts`:

```ts
import { createYoga } from "graphql-yoga";
import { schema } from "@/graphql/schema";
import { createContext } from "@/graphql/context";
export const runtime = "nodejs";
const yoga = createYoga({
  schema, graphqlEndpoint: "/api/graphql",
  context: ({ request }) => createContext(request),
  fetchAPI: { Response },
});
export { yoga as GET, yoga as POST };
```

- [ ] **Step 4:** Ensure DB seeded (Task 10 may run first if smoke needs data) OR make the smoke test tolerate empty DB (counts ≥ 0). Run `pnpm test` → PASS.
- [ ] **Step 5: Manual check** — `pnpm db:up`, `pnpm dev`, open `/api/graphql` (GraphiQL), run a query. 
- [ ] **Step 6: Commit** — `git commit -m "feat: GraphQL queries/mutations/schema + /api/graphql route"`

---

### Task 10: Seed data

**Files:** Create `prisma/seed.ts`

- [ ] **Step 1:** Implement an idempotent seed (delete-all in FK-safe order, then create). Volumes per spec §9: ~13 users (real team names from SPEC §3.7), ~40 investors (varied type/sector/geo/ticket/status), ~15 clients, ~20 mandates (all stages, NDA/EA states, some `referredBy` a partner), ~12 transactions (all stages; ≥3 ClosedWon with `closedAt` this year; link to mandate+client+owner), ~60 engagements, ~10 partners, ~120 activities (spread across InteractionType + dates within the quarter). Use deterministic data (no random) so reviews are stable.
- [ ] **Step 2: Run** — `pnpm db:up && pnpm seed`. Expected: "Seeded: 13 users, 40 investors, …".
- [ ] **Step 3: Verify** — re-run `pnpm seed` (idempotent, no duplicates) and the Task 9 smoke test now returns non-zero counts.
- [ ] **Step 4: Commit** — `git commit -m "feat: realistic SSA demo seed data"`

---

### Task 11: Design system — tokens + UI primitives

**Files:** Modify `src/app/globals.css` (Tailwind v4 `@theme`); Create `src/components/ui/{tag,chip,avatar,button,card,stat-card,table,badge,input,select}.tsx`

**Interfaces — Produces (props):**
- `<Tag color? label />`, `<Chip value group />` (label+color via vocab), `<Avatar name color? size? />`, `<Button variant size />`, `<Card />`, `<StatCard label value delta? icon? sub? />`, `<Table>` parts, `<Badge tone />`, `<Input />`, `<Select options value onChange />`.

- [ ] **Step 1: Tokens** — in `globals.css`, define brand variables in `@theme`:

```css
@theme {
  --color-sidebar: #0b1a14;
  --color-sidebar-fg: #cbd5cf;
  --color-accent: #10b981;
  --color-accent-600: #059669;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}
```
Load Inter via `next/font` in the root layout. Canvas neutrals use Tailwind's zinc scale.

- [ ] **Step 2: Implement primitives** using `cn()`. `StatCard` renders label, big value, optional green `+delta` chip with up-arrow (lucide `ArrowUpRight`), optional icon — matching the wireframe stat cards. `Chip` derives label via `label(group, value)` and color via `chipClasses(value)` / `STATUS_DOT`.
- [ ] **Step 3: Visual sanity** — temporarily render a primitives gallery at `/dev/ui` (or Storybook-free page); screenshot with Playwright; remove the dev page before commit (or keep behind `(dev)`).
- [ ] **Step 4: Commit** — `git commit -m "feat: dark-green design tokens + UI primitives"`

---

### Task 12: App shell (layout, Sidebar, Topbar, urql provider)

**Files:** Create `src/app/(crm)/layout.tsx`, `src/components/shell/{sidebar,topbar,ask-bar}.tsx`, `src/app/providers.tsx`; Modify root `src/app/layout.tsx` (Inter font, providers).

**Interfaces — Consumes:** UI primitives. **Produces:** the persistent shell.

- [ ] **Step 1: urql provider** (`providers.tsx`, client component) — `createClient({ url: "/api/graphql", exchanges: [...] })` wrapped in `<Provider>`; used for client components only.
- [ ] **Step 2: Sidebar** — dark surface; brand mark "NobleStride / Capital"; MAIN nav (Dashboard, Mandates, Transactions, Investors, Engagement, Partners) with lucide icons + active highlight (accent left-bar) via `usePathname`; AGENTS section (Overview, Prospecting, CRM, Notes) as styled items; Settings pinned bottom. Matches `context-screens/home.png`.
- [ ] **Step 3: Topbar + AskBar** — page title slot, centered "Ask your agents anything…" `AskBar` (client; calls `aiAsk` via urql, shows canned reply in a popover), search input, notifications bell, avatar.
- [ ] **Step 4: Layout** wires Sidebar + Topbar + `{children}`.
- [ ] **Step 5: Visual verify** vs wireframe (Playwright screenshot of `/dashboard` shell). 
- [ ] **Step 6: Commit** — `git commit -m "feat: app shell (sidebar, topbar, ask bar)"`

---

### Task 13: Investors section + detail page

**Files:** Create `src/app/(crm)/investors/page.tsx`, `src/app/(crm)/investors/[id]/page.tsx`, `src/components/crm/{record-table,filter-bar,segment-row}.tsx`

- [ ] **Step 1:** `investors/page.tsx` (Server Component) calls `investorSegments()` + `listInvestors(filter)` (filter from `searchParams`). Renders `SegmentRow` (6 counters) + `FilterBar` (type/sector/geography/status selects + search; updates `searchParams`) + `RecordTable` with columns Investor (avatar+name), Type (Chip), Ticket (`formatMoney`), Sectors (Chips), Geography (Chips), Status (dot+label), Contact. Rows link to detail. Matches `context-screens/investors.png`.
- [ ] **Step 2:** `investors/[id]/page.tsx` calls `getInvestor(id)` → overview header + key facts grid + related Engagements + ActivityTimeline (Task 15 component; if not yet built, inline a simple list and refactor in Task 15).
- [ ] **Step 3: Visual verify** vs wireframe. Commit — `git commit -m "feat: investors list + detail"`

---

### Task 14: Mandates + Transactions Kanban + detail pages

**Files:** Create `src/app/(crm)/mandates/page.tsx` + `[id]/page.tsx`, `src/app/(crm)/transactions/page.tsx` + `[id]/page.tsx`, `src/components/crm/{kanban-board,kanban-card,stat-row}.tsx`

- [ ] **Step 1: Add dnd dep** — `pnpm add @hello-pangea/dnd` (React 19 compatible; same lib Twenty uses).
- [ ] **Step 2: Mandates page** (Server Component) → `mandatesByStage()` + counters; renders `StatRow` + `KanbanBoard` (client) with columns. `KanbanCard`: client name, sector chips, deal size, `nextAction` ("Next: …"), `daysInStage`, owner avatar. "Find Prospects" button (canned). Matches `context-screens/mandates.png`.
- [ ] **Step 3: Drag-to-restage** — `KanbanBoard` (client, urql) calls `updateMandateStage` mutation on drop; optimistic move; `router.refresh()` on success.
- [ ] **Step 4: Transactions page** → `transactionsByStage()` + counters (incl. Avg-Time-to-Close via `dashboardStats`/service). `KanbanCard` shows dealType, sector chips, target raise, "N contacted", "N active conversations", owner avatar, days in stage. "Match Investors" button → opens panel calling `aiMatchInvestors` (Task 16 component, or inline list). Matches `context-screens/transactions.png`.
- [ ] **Step 5: Detail pages** for mandate + transaction (overview + related + timeline + restage control).
- [ ] **Step 6: Visual verify** both boards vs wireframe; test a drag persists (manual + Playwright). Commit — `git commit -m "feat: mandates + transactions kanban with restage"`

---

### Task 15: Engagement tracker + Partners + shared ActivityTimeline

**Files:** Create `src/app/(crm)/engagement/page.tsx` + `[id]/page.tsx`, `src/app/(crm)/partners/page.tsx` + `[id]/page.tsx`, `src/app/(crm)/clients/[id]/page.tsx`, `src/components/crm/{activity-timeline,log-engagement-dialog}.tsx`

- [ ] **Step 1: Engagement page** → `engagementCounters()` + `engagementsByDeal()` + `activityTimeline()`. Left: per-deal grouped list (deal → its engagements with status chips); Right: ActivityTimeline. "Log engagement" button opens `LogEngagementDialog` (client, urql) → `logEngagement` mutation → `router.refresh()`. Matches `context-screens/engagement.png`.
- [ ] **Step 2: Partners page** → `partnerReferralStats()` + `listPartners()`. Counters + partners table (Partner, Type chips, Contact, Referred/Active/Closed/Revenue) + a simple "Referrals by Partner" bar list (CSS bars, no chart lib needed). Matches `context-screens/partners.png`.
- [ ] **Step 3: Detail pages** for engagement, partner, client (reuse ActivityTimeline; refactor Task 13's inline list to use it).
- [ ] **Step 4: Visual verify**; test log-engagement persists. Commit — `git commit -m "feat: engagement tracker + partners + activity timeline"`

---

### Task 16: Dashboard (stats, charts, Overview Agent, AskBar wiring)

**Files:** Create `src/app/(crm)/dashboard/page.tsx`, `src/components/crm/{overview-agent-card,pipeline-chart,match-investors-button}.tsx`

- [ ] **Step 1: Dashboard page** → `dashboardStats()`, `aiOverviewInsights()`, `pipelineOverview()`, `dealPipelineTrend()`. Layout: OverviewAgentCard (insights list, "Active" status, "Ask the Overview Agent a question") → 4 StatCards (Active Mandates, Active Transactions, Investors Engaged, Capital Raised YTD with deltas) → two chart cards (Deal Pipeline Trend, Pipeline Overview). Matches `context-screens/home.png`.
- [ ] **Step 2: Charts** — implement `PipelineChart` with lightweight inline SVG/CSS bars (avoid recharts/React-19 peer issues). Trend = simple line/area or grouped bars over 6 months; Overview = stacked bars by stage.
- [ ] **Step 3: MatchInvestorsButton** (client, urql) → calls `aiMatchInvestors`, renders ranked list with score + rationale in a panel (reused by Transactions Task 14).
- [ ] **Step 4: Visual verify** vs wireframe. Commit — `git commit -m "feat: dashboard with stats, charts, overview agent"`

---

### Task 17: README, run docs, final verification pass

**Files:** Create/replace `README.md`

- [ ] **Step 1: README** — stack, prerequisites, run steps (`pnpm install`, `pnpm db:up`, `pnpm migrate`, `pnpm seed`, `pnpm dev`), architecture diagram (Approach B), GraphQL endpoint + a sample Lua-tool query, link to the spec + analysis docs, and the deferred-items roadmap (live Lua, portal, CRUD, auth).
- [ ] **Step 2: Full verification** — `pnpm test` (all green), `pnpm build` (typechecks/builds), `pnpm dev` + Playwright screenshot every route; compare against `context-screens/`. Fix any regressions.
- [ ] **Step 3: Commit** — `git commit -m "docs: README + run guide; final verification"`

---

## Self-Review

**Spec coverage:** §2 scope → Tasks 13–16 (all 6 sections + detail pages + 2 writes) ✔; §3 architecture (Approach B) → Tasks 4–9 services+GraphQL ✔; §6 API/metrics → Tasks 2–9 ✔; §7 design system → Tasks 11–12 ✔; §8 AI canned + seams → Tasks 3,7,16 ✔; §9 seed → Task 10 ✔; §10 testing → Tasks 1–3 (unit), 9 (smoke), 11–17 (visual) ✔; §11 phasing → Tasks map 1:1 ✔. Deferred items (auth/portal/live-Lua/CRUD) intentionally absent ✔.

**Placeholder scan:** logic tasks (1–3) carry full test + impl code; service/UI tasks carry exact interfaces, file paths, data sources, and wireframe references. Per-task Opus review + `/code-review` + Playwright visual check is the gate that catches under-specification at execution time (acceptable per the subagent-driven model).

**Type consistency:** service names are referenced identically across tasks (`setMandateStage`, `aiMatchInvestors`, `partnerReferralRollup`, `investorSegments`, `logEngagement`); GraphQL resolvers (T9) call the service names defined in T4–T7; domain helpers (T2/T3) consumed by services (T4–T7) and GraphQL derived fields (T8).

**Ordering note:** Task 10 (seed) can run before Task 9's manual GraphQL check; the smoke test (T9) tolerates an empty DB so order is not strict. UI tasks (13–16) depend on services (4–7), GraphQL route (9), primitives (11), and shell (12).
