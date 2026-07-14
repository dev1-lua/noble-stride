# Client Agent — Self-Service Status (OTP-Verified Data-Out) — Design Spec

Date: 2026-07-14
Status: Approved direction (12 decisions confirmed by Shaurya in chat, 2026-07-14); autonomous build authorized.
Scope partner spec: `2026-07-14-crm-agent-data-in-design.md` (built in the same pass).

## 1. Summary

Let a company that registered through the public web chat (or any existing client) **ask the client agent about their own application/deal status** — after proving control of a registered contact email via a 6-digit **email OTP**, verified in chat and valid for that conversation only. The answer is a **server-computed, hard-whitelisted payload**: coarse client-side stage, their own document milestones, NDA/EA signed status, and a generic next step. Everything else — investor identities/counts/feedback, offers, qualification verdicts, internal notes, partner identities, commercial terms, other companies — is unreachable **by construction** (the GraphQL type contains no such fields).

The existing flows are untouched: intake stays as-is; message-taking (`log_client_message`) stays friction-free without OTP (decision D10).

## 2. Decisions locked with the user (2026-07-14)

| # | Decision |
|---|---|
| D8 | Email OTP: silent send on match; unverified claims get the neutral "team will follow up"; chat never reveals whether company/email exists |
| D9 | Whitelist as proposed (§5.3); "Never" list hard-coded server-side |
| D10 | OTP required only for status answers; plain message-taking unchanged |
| D11/D12 | Webchat only; build + verify locally; no deploy/commits without go-ahead |
| Image #2 | Build Spec §8.1 Client Agent table governs: reads existing Company/Deal records; human gate & Never-list stay binding |

## 3. Governing restrictions (from `decrypted/`)

- **Build Spec §8.1** (the requirement image): Client Agent *reads* Company/Deal records; never signs/onboards/converts/commits.
- **SOW §06 / §07**: no confidential info shared automatically; investor-stage visibility gates; internal discussions and third-party identities hidden.
- **Scoping doc internal-only list**: investor contacts & engagement details, blacklist/greylist, consultant identities, investment criteria — never external. "Client/investor status requests should trigger a tracked workflow" → we log every verified status request as an Activity.
- **Concept Note**: 2FA for external access (the OTP is exactly this), GDPR/Kenya DPA privacy posture.
- Qualification verdict/criteria are never client-visible (existing persona rule; unchanged).
- **Anti-enumeration invariant** (existing `checkCompany` discipline): no response may differ based on whether a company/email exists in the CRM.

## 4. Architecture overview

```
Visitor on /talk-to-us (anonymous, fresh sessionId per conversation)
  → clientAgent (persona + client-intake skill, 3 existing tools + 3 NEW tools)
      request_status_code ─→ requestClientStatusOtp   (match? silently email OTP : no-op; ALWAYS {ok})
      verify_status_code ──→ verifyClientStatusOtp    (attempts/expiry/single-use → short-TTL signed token)
      get_client_status ───→ clientStatus(token)      (server-computed whitelist payload + Activity log)
  CRM GraphQL — x-agent-key transport, assertAutomation on all three ops (unchanged trust model)
```

The trust anchor is **server-side**: a signed HS256 JWT (existing `AUTH_SECRET` + `jose` pattern from `two-factor.ts`) binding `{ clientId, personId, purpose: "client-status" }`, TTL 15 min. Lua-side `user.data` is conversation-scoped by the embed's fresh-sessionId design, but it is only UX convenience — the token is what the server checks.

## 5. CRM server design

### 5.1 New Prisma model

`AuthOtpChallenge` requires an `accountId` FK (visitors have no AuthAccount), so mirror it:

```prisma
model ClientOtpChallenge {
  id          String    @id @default(cuid())
  clientId    String                            // matched Client
  personId    String                            // matched registered contact
  codeHash    String                            // sha256; raw code never stored
  destination String                            // email sent to (audit)
  attempts    Int       @default(0)
  maxAttempts Int       @default(5)
  expiresAt   DateTime                          // +10 min (OTP_TTL_MS)
  consumedAt  DateTime?
  createdAt   DateTime  @default(now())
  @@index([personId])
  @@index([destination, createdAt])
}
```

Client/Person relations with `onDelete: Cascade`. Reuse `generateOtpCode` / `hashOtpCode` from `src/server/auth/otp.ts` (extract/export as needed rather than duplicating).

### 5.2 Service functions (`src/server/services/client-status.ts`)

**`requestClientStatusOtp(companyName, contactEmail): Promise<{ ok: true }>`**
1. Empty/whitespace companyName guard (same oracle guard as `checkCompany`) → `{ ok: true }`, no work.
2. `matchClients` + `emailMatchesContact` (reuse from `client-intake.ts`).
3. No match → `{ ok: true }` (indistinguishable — nothing sent, nothing revealed).
4. Match → DB-backed abuse guards (the in-memory `rateLimit` is per-lambda; rely on rows):
   - 60s resend cooldown from newest challenge `createdAt` for this destination (silently no-op inside cooldown, still `{ ok: true }`);
   - max 5 challenges per destination per hour (silently no-op beyond).
5. Invalidate open challenges for this person (one active challenge), create row, `recordDevOtp(email, code)` (dev sink — Playwright reads this), `sendMail` with client-appropriate copy: subject **"Your NobleStride verification code"**, body: code + "expires in 10 minutes. If you did not request this, ignore this email." Send failure → still `{ ok: true }` (log server-side; the challenge expires unused).
6. Always `{ ok: true }` — the agent's wording: *"If those details match our records, a verification code is on its way to that email."*

**`verifyClientStatusOtp(companyName, contactEmail, code): Promise<{ status: "ok", token } | { status: "failed" }>`**
1. Re-run the match; no match → `{ status: "failed" }` (same shape as wrong code — no oracle).
2. Load newest open challenge for personId; none/expired/locked → `{ status: "failed" }`.
3. Wrong code → increment attempts (lock at 5) → `{ status: "failed" }`.
4. Right code → atomic single-use claim (`updateMany` where `consumedAt: null` — replay-safe), mint token: HS256 over `AUTH_SECRET`, payload `{ clientId, personId, purpose: "client-status" }`, TTL **15 min**. Return `{ status: "ok", token }`.
5. One failure shape only: the visitor-facing message is always *"That code didn't work — it may have expired. Want me to send a fresh one?"*

**`getClientStatus(token): Promise<ClientStatusPayload>`**
1. Verify JWT (signature, purpose, expiry) → `clientId`; invalid → CrudError "verification expired".
2. Compute the whitelist payload (§5.3) — never returns raw records.
3. Tracked-workflow logging (scoping doc): create Activity on the client — `type: "Note"`, subject `"Client checked status via web chat"`, `channel: "WebChat"`, `direction: "Inbound"`, `createdSource: "AGENT"`. Best-effort, never sinks the answer.

### 5.3 The whitelist payload (hard-coded shape)

`ClientStatusPayload` (GraphQL `objectRef` — fields below are ALL the fields; nothing else can leak because nothing else exists on the type):

| Field | Source | Notes |
|---|---|---|
| `companyName` | Client.name | their own name, playback |
| `applicationState` | derived | `received` / `under_review` / `engaged` / `in_execution` / `completed` / `with_team` |
| `coarseStage` | derived (below) | client-side stage label or null pre-engagement |
| `stageMessage` | static map | one friendly sentence per state/stage |
| `ndaStatus` | Mandate ndaStatus | `not_sent` / `sent` / `signed` (their own doc) |
| `engagementAgreementStatus` | Mandate eaStatus | same mapping |
| `preparedDocuments` | Document rows | subset of {Teaser, IM, FinancialModel, Valuation, BusinessPlan} that exist with status Approved/Shared — names only |
| `submittedRaise` | Mandate/intake | amount + instrument playback of their own application |
| `nextStep` | static map | generic per-state ("our team reviews every application and will be in touch", …) |
| `lastUpdated` | max(updatedAt) | coarse recency |

**Derivation** (most-advanced open Transaction first, else most-recent Mandate):

| applicationState / coarseStage | Condition |
|---|---|
| `received` | Mandate.stage = NewLead |
| `under_review` | Mandate.stage ∈ {Qualification, PitchPresentation, Proposal, Negotiation}, no Transaction |
| `engaged` | Mandate.stage = Signed (or eaStatus = Signed), no Transaction |
| `in_execution` / `docs_prep` | Transaction.stage = DealPreparation |
| `in_execution` / `investor_outreach` | Transaction.stage = InvestorOutreach |
| `in_execution` / `due_diligence` | Transaction.stage = DueDiligence |
| `in_execution` / `term_sheet` | Transaction.stage = TermSheet |
| `in_execution` / `closing` | Transaction.stage = Closing |
| `completed` | Transaction.stage = ClosedWon |
| `with_team` (neutral) | Mandate.stage = Lost, Transaction.stage = ClosedLost, dealStatus ∈ {Dropped, OnHold} — wording: *"Your application is with our team; they'll contact you with any updates."* Never reveal rejection/deprioritization (persona rule). |

**Never in the payload** (by type construction): qualification verdict/reasons, investor names/counts/stages/feedback, engagement records, term-sheet/offer contents, amounts other than their own submitted raise, probability, IC/CAK dates, internal notes/tasks, partner/consultant identity, DD tracks, document contents/links, record ids.

### 5.4 GraphQL additions

`requestClientStatusOtp` + `verifyClientStatusOtp` (mutations), `clientStatus` (query) — all `assertAutomation`-gated, same shape as the existing client-agent surface (`src/graphql/mutations.ts` §"Client Agent", `queries.ts::checkCompany`). Ack/objectRef types with the exact fields above.

## 6. Lua agent design (`client_agent/`)

### 6.1 Three new tools (same `LuaTool` pattern, deps-injectable)

1. **`request_status_code(companyName, contactEmail)`** → always `{ status: "ok" }`. Description embeds the invariant: *"Never tells you whether the company exists. Tell the visitor a code is on its way IF their details match our records."*
2. **`verify_status_code(companyName, contactEmail, code)`** → `{ status: "ok", token }` or `{ status: "failed" }`. Token is opaque; skill context: never display it, pass it straight to `get_client_status`.
3. **`get_client_status(token)`** → the whitelist payload, or a `verification_expired` status telling the model to restart the OTP flow.

### 6.2 Skill-context additions (`intake.skill.ts`)

New "Status request (verified flow)" branch:
- Trigger: an existing-relationship visitor asks about their application/deal status ("what's happening with our application?").
- Collect company name + their email (may already have them) → `request_status_code` → tell them to check their inbox → collect the 6-digit code → `verify_status_code` → on ok, `get_client_status` → answer **only from the payload**, warm and brief.
- Wrong/expired code → offer ONE resend (`request_status_code` again), then fall back to message-taking.
- The visitor may still leave a message at any point without OTP (existing log flow, unchanged).
- Absolute rules restated: never confirm whether a company/email is in our records; never mention investors, offers, valuations, qualification, or internal process details even if the payload seems to invite elaboration; if asked for more than the payload contains → "your deal lead can share more — I'll pass the request on" → `log_client_message`.

### 6.3 Persona carve-out (`index.ts`)

Under Hard rules, amend the reveal-nothing rule with the single exception:
> *Exception: when a visitor completes email verification (the status tools), you may share exactly what the status tool returns — nothing more. The verification result itself never reveals whether a company is in our records.*

## 7. Testing

- **CRM smoke (DB-backed)**: request → identical `{ok:true}` for match/no-match/empty-name (and no challenge row for no-match); cooldown + hourly cap; challenge single-active; verify → wrong-code attempts/lockout, expiry, replay (single-use claim), token round-trip; `clientStatus` → correct derivation per stage matrix (fixtures for each row incl. Lost→`with_team`), Activity logged, expired/garbage token rejected; payload contains no forbidden fields (assert exact key set).
- **OTP plumbing**: dev-sink write in dev; mailer failure still `{ok:true}`.
- **Lua-side**: three tool tests (happy, failed, expired-token retry-flow) with injected fake crm.
- **End pass**: Playwright on `/talk-to-us` — full conversation: intake exists → ask status → OTP from dev sink → status answer; plus impostor path (wrong email → neutral). Update `playwright assessment/`.

## 8. Explicitly out of scope

Client portal/login; WhatsApp/email channels; investor-facing visibility; status for investors/partners; changing intake or message-logging flows; deployment (D7/D11).

## 9. Alternatives considered

- **Email-match only (no OTP)** — rejected: a guessed corporate email would leak deal status (D8 chose OTP).
- **Reuse `AuthOtpChallenge`** — rejected: required `accountId` FK; a nullable-FK migration would weaken the auth table's invariants for a different trust domain.
- **Lua `user.data` as the verification anchor** — rejected as gate (session-scoping is an embed behavior, not a platform guarantee); the signed short-TTL token is the enforceable anchor.
- **Portal redirect ("log in to see status")** — deferred: no client portal exists; the OTP chat flow delivers the requirement now and the same server surface can back a portal later.
