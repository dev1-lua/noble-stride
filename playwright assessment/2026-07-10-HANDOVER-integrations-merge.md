# HANDOVER — Verify the external-integrations merge (integration/all-features)

**For:** a fresh Claude Code session. **Goal:** verify that merging `feat/external-integrations-scaffold` into `integration/all-features` broke nothing, then drive a full real-time Playwright E2E pass over everything new + everything that already worked.

---

## 1. What happened (the merge)

- **Branch:** `integration/all-features`. **Merge commit:** `3188654` (parents: `00aaba3` current-branch tip + `ad1a19c` scaffold tip).
- **Safety backup (pre-merge HEAD `00aaba3`):** tag `pre-integrations-merge-2026-07-10` and branch `backup/pre-integrations-merge`. **Roll back with:** `git reset --hard pre-integrations-merge-2026-07-10`.
- **Nothing is pushed.**
- The scaffold brought in **external-integration structure, all config-gated OFF by default** (each activates only when its `*_ENABLED=true` AND creds are set — same drop-in pattern as SharePoint storage):
  - **MS Graph** shared client-credentials auth — `src/server/integrations/msgraph/auth.ts`
  - **Outlook** mail sync seam + Graph client + ingestion/matching — `src/server/integrations/mailsync/*`, `src/server/services/mailsync.ts`
  - **Teams** meetings seam + Graph events client + service + gated button — `src/server/integrations/meetings/*`, `src/server/services/meetings.ts`
  - **DocuSign** e-sign seam + JWT client + HMAC Connect webhook + NDA-completion convergence — `src/server/integrations/esign/*`, `src/server/services/esign.ts`, `src/components/crm/send-esign-button.tsx`, `src/app/api/integrations/docusign/connect/route.ts`
  - **Box** docshare seam + CCG client (upload/watermark/shared-link) + webhook — `src/server/integrations/docshare/*`, `src/server/services/docshare.ts`, `src/components/crm/share-box-button.tsx`, `src/app/api/integrations/box/webhook/route.ts`
  - **Graph notifications** webhook — `src/app/api/integrations/msgraph/notifications/route.ts`
  - **Config gate** — `src/server/integrations/config.ts` (`isConfigured(id)`, `IntegrationId`)
  - **Additive Prisma migration** `20260708222833_external_integrations_scaffold` — models `ESignEnvelope, Meeting, EmailMessage, GraphSubscription, DocumentShareEvent` + Box fields on `Document`
  - New GraphQL mutations (`shareDocumentViaBox`, e-sign send, `scheduleMeeting`) in `src/graphql/mutations.ts`; output types in `src/graphql/types.ts`

## 2. Conflict resolutions made — SCRUTINIZE THESE

1. **`prisma/schema.prisma`** — combined `Document` fields (file-storage fields + the 3 Box fields). Both kept.
2. **`src/app/(crm)/documents/page.tsx` + `documents-table.tsx`** — the current branch had refactored the page to a `<DocumentsTable>` client component; the scaffold had added `ShareBoxButton` to the *old* inline table. **Resolution:** kept the refactored `DocumentsTable`, added a server-computed `boxEnabled={isConfigured("box")}` prop on the page, and rendered `ShareBoxButton` inside `documents-table.tsx`'s name cell when `boxEnabled`. **Verify:** button appears only when `BOX_ENABLED=true`, and the documents page renders normally when it's off.
3. **`.env.example`, `.gitignore`** — combined both blocks (RESEND+storage from current branch, integration env blocks from scaffold).
4. **`src/graphql/__tests__/schema.smoke.test.ts`** — expected counts set to **30 queries / 53 mutations** (30 = +globalSearch; 53 = +3 integration mutations). **Verify against the actually-built schema; correct the number if off.**
5. **`src/generated/pothos-types.ts`** — regenerated from the merged schema (the Pothos generator ran successfully; the file now contains `DocumentAccessLog` + all 5 new models).
6. **`src/server/services/engagements.ts`** — git auto-merged a small scaffold change. Eyeball it for correctness.

## 3. CRITICAL environment note (why local verification is pending)

A `next dev` server was running on **:3000 (PID 9440)** during the merge and **holds the Prisma query-engine DLL**, so `prisma generate` fails with `EPERM` on Windows. **The generated Prisma CLIENT is therefore STALE — it does not yet contain the new integration models.** `tsc`, `pnpm test`, and `pnpm build` **cannot pass until the client is regenerated.** This is the first thing you must fix.

## 4. Required steps, in order (from `noblestride-crm/`)

1. **Stop the :3000 dev server** to free the DLL (e.g. `taskkill /PID 9440 /F`, or stop whatever holds :3000). Confirm no `next dev` is running.
2. `pnpm exec prisma generate` — MUST succeed now (regenerates client for the new models + pothos-types).
3. `pnpm exec prisma migrate dev` (or `migrate deploy`) — applies `20260708222833_external_integrations_scaffold` on top of `20260708200143_document_file_storage`. They're additive/orthogonal; confirm clean apply. If Prisma reports drift, investigate — do **not** blindly reset a seeded DB.
4. `pnpm exec tsc --noEmit` — expect clean. Likely fix points if not: `documents-table.tsx` box wiring, integration services referencing new models, the smoke-test count.
5. `pnpm test` — expect green. Pre-merge baseline was **783 pass / 8 skip** PLUS the scaffold's own integration tests. Fix the smoke-test expected count if it's wrong.
6. `pnpm build` — expect success.

## 5. Full real-time Playwright E2E pass (the main ask)

Start a fresh dev server with `RESEND_API_KEY=` empty (2FA off → investor portal reachable) and **all `*_ENABLED` flags OFF** (integrations dormant). Drive the app via the **Playwright MCP** browser tools against the running server. Use the existing scripts in `playwright assessment/test-scripts/` (01–06). Priorities:

- **A. App health** — log in as admin (`evans@noblestride.capital` / `NobleStride!Demo2026`). Console + network error sweep on every route. **Bar: zero console errors / zero failed requests** (that was the pre-merge state).
- **B. Regression of this session's features** — global search (Cmd/Ctrl-K, grouped results, nav), design (colored portal icons, visible card borders/shadow, Fund Profile field borders), 2FA gate behavior. All must still work.
- **C. Integrations dormant-state correctness (flags OFF)** — the most important new-surface check:
  - `/documents`: **"Share via Box" button must NOT appear**; page renders normally.
  - Any Send-for-signature / Schedule-Teams-meeting controls hidden/disabled when their flag is off; their pages render fine.
  - Webhook routes return **404 / not-configured** (never 500) when unconfigured: `/api/integrations/docusign/connect`, `/api/integrations/box/webhook`, `/api/integrations/msgraph/notifications`.
  - GraphQL `shareDocumentViaBox` / e-sign / `scheduleMeeting` mutations **fail cleanly** ("not configured"/FORBIDDEN), never 500.
- **D. (Optional)** If you have sandbox creds, flip one integration's `*_ENABLED` + creds and smoke the happy path. Otherwise record it as "gated, not live-tested" (matches the SharePoint precedent).
- **E. Confidentiality/RBAC** — re-run script 01 security cases + the investor global-search leakage checks (an investor must not find other investors, partners, internal docs, or masked client identities).

## 6. Reporting & rules

- Write results to a new dated file `playwright assessment/2026-07-11-integrations-merge-verification.md` (follow the folder convention). Append any NEW bugs to `01-BUGS.md`.
- If `tsc`/tests/build fail, **fix forward on `integration/all-features`** (small focused commits, or leave dirty for review). The backup tag `pre-integrations-merge-2026-07-10` exists if you must abandon.
- **Do NOT push. Do NOT commit secrets (`.env`).** Leave commits/working tree for the user's review.

### Success criteria
`prisma generate` + `migrate` + `tsc` + `test` + `build` all green; Playwright shows zero console errors across routes, this session's features intact, integrations dormant-safe (buttons hidden, webhooks 404, mutations fail cleanly, no crashes), and investor confidentiality intact; a dated verification file written; any bugs logged and fixed forward.
