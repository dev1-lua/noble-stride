# HANDOVER — External Integrations Scaffold (NobleStride CRM)

**Date:** 2026-07-09 · **Status:** Implementation COMPLETE, reviewed, verified. Awaiting the user's explicit go-ahead to merge.
**Branch:** `feat/external-integrations-scaffold` · **Worktree:** `D:\LuaWork\NobleStride\noble-stride\.claude\worktrees\external-integrations` · **Base:** `integration/all-features` @ `fc1986f`.

Paste the "RESUME PROMPT" at the bottom into a new session to continue. Everything needed is below.

---

## 1. The task (original user request, verbatim intent)

Build **integration architecture/scaffolding** for external services named in the client's concept note (`docs/GMAIL-request.md` / `decrypted/Noblestride-CRM-Concept-Note-decrypted.pdf`), such that when the client later provides API keys/credentials, we "just put them in and it starts functioning" — **without breaking any currently-working workflow**. Example the user gave: NDA signing is currently a button toggle; after adding DocuSign architecture it must still work exactly as now (even with no key).

**Scope decided with the user (build fully now):** DocuSign (e-sign), Box (watermarked doc sharing), Microsoft Teams (meeting scheduling), Office 365/Outlook (email tracking). **Explicitly deferred / NOT touched:** Intralinks, Ansarada, Read.ai.

**User's hard rules:**
- Every current workflow behaves **identically with no keys**. New UI controls are **hidden entirely** until that integration is configured (chosen over "disabled" or "settings toggle").
- Fully-coded, working-on-key-drop code for the 4 vendors (the 3 partner-gated ones were dropped).
- **Process:** brainstorm → write spec → write plan → **SDD**: Sonnet implements each task, **Opus reviews right after each task** (not batched), fix loop, then next.
- **Separate worktree + branch**; the user **merges manually** — do NOT merge without explicit instruction.
- Standing memory rules honored: **no direct commits** without go-ahead (commits to this dedicated feature branch are the sanctioned exception and were authorized as part of the SDD run); Sonnet implements / Fable-or-Opus reviews; Playwright verification as one pass at the end.

## 2. Architecture (Approach A — capability seams), all under `noblestride-crm/src/server/integrations/`

```
config.ts        # ONLY module that reads integration env; isConfigured(id) + per-vendor predicates + typed env accessors
errors.ts        # IntegrationError(message, status=502)
msgraph/auth.ts  # shared client-credentials Graph token (Teams + Outlook), in-memory cached; __resetGraphTokenCache() for tests
esign/    { provider.ts (ESignProvider + getESignProvider), manual.ts (ManualESignProvider→throws 503), docusign.ts (JWT grant via jose, buildEnvelopeBody), webhook.ts (verifyDocusignHmac, parseConnectEvent) }
docshare/ { provider.ts (DocShareProvider + getDocShareProvider), null.ts (NullDocShareProvider), box.ts (CCG, upload/watermark/shared-link, buildSharedLinkBody), webhook.ts (verifyBoxSignature, parseBoxEvent) }
meetings/ { provider.ts (MeetingProvider + getMeetingProvider), manual.ts, teams.ts (Graph calendar event w/ isOnlineMeeting, buildEventBody) }
mailsync/ { provider.ts (MailSyncProvider + getMailSyncProvider), off.ts (inert), outlook.ts (mail read + subscriptions, mapGraphMessage), match.ts (matchMessageToRecord) }
```
Services: `src/server/services/{esign,docshare,meetings,mailsync}.ts`. Webhook routes: `src/app/api/integrations/{docusign/connect,box/webhook,msgraph/notifications}/route.ts` (all **404 until configured**). Gated UI components: `src/components/crm/{send-esign-button,share-box-button,schedule-teams-button}.tsx`.

**Pattern:** each `getXProvider()` returns the real client only when `xConfigured()` (its `*_ENABLED` flag truthy AND all vars present), else the manual/null provider. Factories use **top-level imports** (house style, like the auth code) — NOT lazy `require`. All vendor clients are raw `fetch` (no new deps; DocuSign JWT uses existing `jose`). Config read only in server components → controls render only when configured → **no secret reaches the client, no-keys UI is byte-identical**.

**Convergence:** DocuSign `envelope-completed` webhook calls the EXISTING `recordOpenNda`/`recordClosedNda` so the signed path and the manual buttons land on the same state.

## 3. Data model (one additive migration `20260708222833_external_integrations_scaffold`)

New tables: `ESignEnvelope`, `Meeting`, `EmailMessage`, `GraphSubscription`, `DocumentShareEvent`. `Document` gained nullable `boxFileId`, `boxSharedLinkUrl`, `boxWatermarkApplied`, `shareEvents`. Back-relations added to `Investor`/`Engagement`/`Transaction`. **All additive** (nullable/defaulted cols + new tables, FKs `ON DELETE SET NULL` except `DocumentShareEvent`→`Document` cascade). No existing column/table altered.

## 4. CRITICAL environment quirks (read before running anything)

- **Isolated DB.** This worktree's `.env` `DATABASE_URL` points to **`noblestride_integrations`** (its own Postgres DB), NOT the shared `noblestride`. Reason: a concurrent, **uncommitted** *file-storage-integration* effort had already `prisma migrate dev`'d the shared dev DB, causing drift that made our migration want a reset. Isolation avoids the collision. The isolated DB is migrated + seeded.
- **file-storage seam is NOT on this branch.** `src/server/storage/*`, `Document.storageKey`, `DocumentAccessLog`, and the documents *bytes* layer are uncommitted WIP elsewhere. That's why Box tracking uses our own **`DocumentShareEvent`** (not `DocumentAccessLog`) and the Box share mutation sources bytes from `Document.fileUrl` (not a storage seam). On merge the two efforts coexist cleanly.
- **Vitest does NOT load `.env`.** Run DB-backed tests with the URL inline:
  `DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride_integrations" pnpm test <path>`
  Do NOT use `export $(grep .env)` — an `.env` value contains angle brackets and breaks it.
- **pnpm** may not be on PATH → `corepack enable` / `corepack pnpm ...`.
- **Postgres** runs in Docker container `noblestride-postgres` (host port 5544); `pnpm db:up` to ensure it.
- **Lint baseline:** `pnpm lint` has ~8 pre-existing errors + 3 warnings in UNRELATED files. The gate is "no NEW lint errors in touched files", not a clean repo.
- **Full `pnpm test` shows ~2 pre-existing failures** (`login.smoke`/`two-factor.smoke` — real Resend API calls rejected in sandbox) and ~14 DB failures if `DATABASE_URL` is unset. Neither is our code.
- **Port 3000 is occupied** by another checkout; run this branch's dev server on another port: `corepack pnpm exec next dev -p 3005`.
- **Credential guardrails:** the harness blocks materializing `SEED_USER_PASSWORD` and blocks minting/forging an auth session. So a browser snapshot of *authenticated* internal pages could not be automated (see §6). Do not try to bypass these.

## 5. What's committed (branch history, newest first)

`0028f38` docs plan update (DocumentShareEvent decoupling) · `9bd231a` final-review fixes (NDA-before-status reorder; portable pothos import) · `664a44e` .env.example + client checklist · `5fe6e58` Graph notifications webhook · `be054ba` mail matching + ingestion · `722df54` mailsync seam + Outlook · `5e6f210` meetings service + gated Teams button · `0628f4a` meetings seam + Teams client · `f76bf3f` Box webhook + gated Share UI · `8894a43` docshare service · `b8af18a` docshare seam + Box client · `dea90b5` e-sign mutation + gated button · `f29b944` DocuSign webhook · `f50858a` e-sign service (NDA convergence) · `d25d9b1` e-sign seam + DocuSign client · `768aacb` additive data model · `c9aa51f` MS Graph auth · `9333a7d` config gate + IntegrationError · `beebe4e` plan · `61c0f54` design spec.

Key docs: spec `docs/superpowers/specs/2026-07-09-external-integrations-scaffold-design.md`; plan `docs/superpowers/plans/2026-07-09-external-integrations-scaffold.md`; client checklist `noblestride-crm/docs/integrations-client-checklist.md`; SDD ledger `.superpowers/sdd/progress.md` (has every task's commit range + all deferred Minors).

## 6. Verification status

- Every one of 16 impl tasks: Opus review returned **spec ✅ + quality Approved** (fixes applied where flagged).
- **Final whole-branch Opus review: CLEAN** after 2 must-fixes (both applied & re-verified). Additive migration confirmed; config gate consistent; all factories fall back safely; webhooks 404-before-work + HMAC-verified; no committed secrets; no-keys parity holds.
- Full `pnpm exec tsc --noEmit` **green**; app **boots with no keys** (Next ready in ~400ms).
- **Static audit:** all 4 controls render only inside `isConfigured(...)` (documents→box, investors→docusign, engagement→docusign+teams) — no un-gated site.
- Real-browser render of `/login`: form present, **no integration strings**.
- **NOT done (blocked by credential guardrails, not by any defect):** browser snapshot of authenticated internal pages. To do it yourself: `corepack pnpm exec next dev -p 3005` in the worktree, log in as a seeded team user (e.g. `evans@noblestride.capital`, password = `SEED_USER_PASSWORD` from `.env`), visit an investor/engagement/documents page → confirm no integration controls appear with no keys set.

## 7. Deferred to go-live / follow-up (from the ledger — none block merge)

- Replace the placeholder PDF in `send-esign-button.tsx` `fetchTemplateBase64` with a real per-kind stored-template lookup **before DocuSign goes live**.
- Add a timeout + SSRF host-allowlist to the `fetch(doc.fileUrl)` in the Box share mutation (staff-gated, low blast radius); consider a shared outbound-fetch helper across integration mutations.
- Batch a `try/catch` on webhook/mutation body parsing (`box/webhook`, `msgraph/notifications`, `scheduleMeeting`) for clean 4xx instead of 500 (only reachable when configured).
- Optional: instance/fetch-scoped token caches + `__reset` hooks for docusign/box (msgraph already has one); `clientState` validation on the Graph notifications route; author attribution (`createdById`) on the meeting Activity; Teams button on the transaction detail page (scope decision).
- After merge to the target checkout, run `pnpm generate` there so `pothos-types.ts` regenerates for that tree (the import is already portable `@prisma/client`, so this is belt-and-suspenders).

## 8. Immediate next steps (pick up here)

1. **Merge when ready** (user does this, or asks explicitly): the branch is clean, tree is clean, everything committed. Merges onto `integration/all-features`.
2. Optionally run the authenticated no-keys browser pass (§6).
3. Optionally tackle go-live hardening (§7) — but those are post-key-provisioning concerns.
4. When the client provides real credentials, fill the `.env` block for that vendor + set its `*_ENABLED=true`, run the smoke checklist in `docs/integrations-client-checklist.md`.

---

## RESUME PROMPT (paste into a new session)

> I'm continuing work on the NobleStride CRM external-integrations scaffold. **First read `docs/superpowers/HANDOVER-2026-07-09-external-integrations.md` in full** — it has the complete context. Then confirm the state and wait for my instruction.
>
> Key facts: I'm working in the git worktree at `D:\LuaWork\NobleStride\noble-stride\.claude\worktrees\external-integrations` on branch `feat/external-integrations-scaffold` (branched from `integration/all-features` @ fc1986f). The whole feature (DocuSign, Box, Teams, Outlook integration seams — inert until keys are dropped in, current workflows unchanged) is **implemented, per-task-reviewed by Opus, final-reviewed clean, and verified**; it is NOT merged and I will merge it myself. Do not merge without my explicit say-so, and follow my "no direct commits without go-ahead" rule.
>
> Environment quirks that will bite you if ignored: this worktree uses an **isolated DB** `noblestride_integrations` (its `.env` DATABASE_URL points there; vitest needs `DATABASE_URL=...noblestride_integrations` inline because vitest doesn't load .env); `pnpm` via `corepack`; Postgres in docker `noblestride-postgres` on port 5544 (`pnpm db:up`); dev server on port **3005** (3000 is taken); `pnpm lint` has a known ~8-error pre-existing baseline in unrelated files; the file-storage effort's storage seam / `DocumentAccessLog` are NOT on this branch (we use `DocumentShareEvent`).
>
> Verify: `git -C D:\LuaWork\NobleStride\noble-stride\.claude\worktrees\external-integrations log --oneline -5` should show `0028f38` at HEAD and `9bd231a` (final-review fixes) below it; `git status` should be clean. Then tell me what you see and ask what I want to do next (candidates: merge, run the authenticated no-keys browser pass, or start go-live hardening from §7 of the handover).
