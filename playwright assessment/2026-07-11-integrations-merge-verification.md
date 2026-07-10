# Verification — external-integrations merge into `integration/all-features`

**Date:** 2026-07-11 · **Branch:** `integration/all-features` · **Merge under test:** `3188654` (merged `feat/external-integrations-scaffold`).
**Backup/rollback:** tag `pre-integrations-merge-2026-07-10`.
**Verifier:** Claude Code session. **Brief:** `2026-07-10-HANDOVER-integrations-merge.md`.
**Env for the live pass:** fresh `next dev` on :3000, `RESEND_API_KEY=` empty (2FA OFF → investor portal reachable), **all `*_ENABLED` flags OFF** (integrations dormant), `STORAGE_PROVIDER` local.

**Verdict: ✅ PASS.** The merge is sound. All build/test gates green; zero organic console errors across admin + investor; this session's features (global search, design unification, 2FA gate) intact; integrations are dormant-safe (UI triggers hidden, webhooks 404/405 never 500, mutations never 500); investor confidentiality + RBAC intact. **One low-severity finding (BUG-20) found and fixed forward** during the pass.

---

## 1. Build / test gates (from `noblestride-crm/`)

| Step | Result | Notes |
|---|---|---|
| Stop :3000 dev server (free Prisma DLL) | ✅ | Killed the old `next dev` tree (orig PID 9440 + a live `npm run dev` at PID 19740→34520→37516 that re-grabbed the port). Port confirmed free. |
| `prisma generate` | ✅ | Client + `pothos-types.ts` regenerated (v6.19.3); no machine-path churn left in the tree this time. |
| `prisma migrate deploy` | ✅ | Exactly one pending, additive migration (`20260708222833_external_integrations_scaffold`); **no drift**. Used `deploy` (never resets) to protect the seeded DB. Clean apply. |
| `tsc --noEmit` | ✅ | 0 errors (before and after the BUG-20 fix). |
| `pnpm test` (vitest, `DATABASE_URL` exported) | ✅ | **832 → 834 pass / 0 fail** (834 after adding 2 BUG-20 tests). 127 test files. Smoke-test counts (30 queries / 53 mutations incl. `shareDocumentViaBox`/`sendEsignEnvelope`/`scheduleMeeting`) pass as merged — no correction needed. |
| `pnpm build` | ✅ | Success. All 3 integration webhook routes registered: `/api/integrations/box/webhook`, `/api/integrations/docusign/connect`, `/api/integrations/msgraph/notifications`. |

Conflict-resolution spot-checks (handover §2): `config.ts` gate requires both `*_ENABLED` truthy **and** all creds present (sound); `documents-table.tsx` renders `ShareBoxButton` only when `boxEnabled` (defaults `false`, page passes `isConfigured("box")`) — correct; `mask-error.ts` / `engagements.ts` compile & tests pass.

---

## 2. Live Playwright pass

### A. App health — ✅ zero console errors
- **Admin** (`evans@noblestride.capital`): logged in → `/dashboard`. All 16 CRM routes probed: 200 except `/mandates`→`/deals?type=mandate`, `/transactions`→`/deals?type=transaction`, `/engagement`→`/engagement/deals` (benign filter redirects, confirmed land on real content).
- **Investor** (`cmiriti@ifc.org`): all 4 portal routes 200.
- **Console:** zero organic console errors across both sessions. The only 6 error-level messages in the log are the **404/405 responses from my own webhook probes** (browser auto-logs failed `fetch` resource loads) — not app-origin.

### B. Regression of this session's features — ✅ all intact
- **Global search (Cmd/Ctrl-K):** Admin — opens, debounced, **grouped results** (Clients / Mandates / Deals / Engagements) for "Study Buddy"; clicking a result navigates (→ `/transactions/…`). Investor — opens, **scoped** to the investor's own matched deal only (single "Deals" group).
- **Design unification:** Investor portal Fund Profile shows **colored sidebar icons** (amber Pipeline, blue Dashboard, teal Fund Profile), **visible card borders + shadow** on section cards, and **bordered form fields** (mandate/country textareas, ticket-size inputs). Evidence: `verify-merge-02-investor-fund-profile.png`.
- **2FA gate (Option B):** with `RESEND_API_KEY` empty, investor login went **straight to `/portal/investor` with no `/login/verify` OTP step** — gate correctly bypasses to password-only when the key is absent. (Key-set / OTP-required path not exercised this pass — env fixed with key empty; covered by unit tests `login-otp-gate.smoke.test.ts`.)

### C. Integrations dormant-state (flags OFF) — ✅ dormant-safe
- **`/documents`:** renders normally (9 rows); **no "Share via Box" button**, no e-sign / schedule-meeting controls present.
- **Webhook routes** (unconfigured): `GET`→**405** (only POST handler defined), `POST`→**404 "Not found"** for all three (`docusign/connect`, `box/webhook`, `msgraph/notifications`). **Never 500.**
- **GraphQL mutations** (via authenticated endpoint): all return **HTTP 200, `data: null`, no 500 / no crash.**
  - `sendEsignEnvelope` → clean error **"E-signature not configured"** ✅
  - `scheduleMeeting` → clean error **"Teams meetings not configured"** ✅
  - `shareDocumentViaBox` → fails cleanly (masked "Unexpected error."), but this is because the resolver does a server-side `fetch(doc.fileUrl)` *before* the Box provider gate, and the only seeded doc with a `fileUrl` has junk (`"http://x"`, a BUG-15 test record) while all other docs have `fileUrl: null`. So the Box "not configured" gate can't be driven E2E with current seed data; masking of the resulting fetch failure is correct. The Box 503 → clean-message path is proven by unit test (see BUG-20).
- **D. Live integration happy-path:** not run — no sandbox creds. Recorded as **"gated, not live-tested"** (matches the SharePoint-storage precedent).

### E. Confidentiality / RBAC — ✅ intact
- **Investor global-search leakage** (as IFC): probed 14 terms. **Zero leakage** —
  - other investors (`Norfund`, `Lightrock`, `Afrexim`, `IFC`-self) → **0 results**
  - partners (`Anjarwalla`, `Bowmans`, `Kaplan`) → **0 results**
  - internal/other deals + masked client identities (`Study Buddy`, `Chipori`, `Sabor`, `Ewaka`, `Prodigy`, `City Health`) → **0 results**
  - **positive control** `Akili` (IFC's own matched deal) → returns exactly that deal with a `/portal/investor/deals/…` href. ✅
- **Direct-URL RBAC** (as investor): `/dashboard`, `/investors`, `/settings/users`, `/documents`, `/deals`, `/partners` all **redirect** (blocked, not served).

> Note on BUG-01 (pre-interest doc-title identity leak): the masked real-name terms (`Chipori`, `Sabor`) do **not** leak via global search. BUG-01 concerns the deal-detail Documents *section*, a different surface — not re-tested here; remains as previously logged.

---

## 3. Finding logged this pass

- **BUG-20 (P3)** — GraphQL masked integration "not configured" gate errors to generic "Unexpected error." **Found and fixed forward** (`mask-error.ts` + 2 unit tests). See `01-BUGS.md`. Re-verified live: `sendEsignEnvelope` / `scheduleMeeting` now surface their real "…not configured" message; full suite 834/834 + tsc clean after the fix.

No new P1/P2 issues. Previously-logged bugs (BUG-01…19) were not re-swept beyond the confidentiality/search cases above; the merge did not touch their surfaces.

---

## 4. Working tree (left dirty for review — NOT committed, NOT pushed)

```
 M noblestride-crm/src/graphql/mask-error.ts              (BUG-20 fix)
 M noblestride-crm/src/graphql/__tests__/mask-error.test.ts (2 new cases)
?? verify-merge-01-admin-dashboard.png                    (evidence)
?? verify-merge-02-investor-fund-profile.png              (evidence)
?? playwright assessment/2026-07-10-HANDOVER-integrations-merge.md
```

Nothing pushed. No secrets committed. Rollback tag `pre-integrations-merge-2026-07-10` remains available.
