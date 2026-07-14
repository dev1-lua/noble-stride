# crmAgent — Data-In (Attributed, Confirmed CRU Writes) — Design Spec

Date: 2026-07-14
Status: Approved direction (12 decisions confirmed by Shaurya in chat, 2026-07-14); autonomous build authorized.
Scope partner spec: `2026-07-14-client-agent-status-design.md` (built in the same pass).

## 1. Summary

Rename the internal **summarizerAgent** to **crmAgent** and give it a "data-in" capability: staff can instruct it in chat to create and update CRM records. Every write is:

- **Attributed** to a real CRM staff user (identified once per chat identity via the extended passphrase gate),
- **Confirmed** through a server-enforced two-phase *prepare → preview → commit* protocol (the model physically cannot write without first previewing, and what commits is exactly what was previewed),
- **RBAC-enforced server-side** with the staff user's real org role through the *existing* `assertCan` / own-scoped machinery (the automation bypass is deliberately not used on this surface),
- **No hard deletes** — create/update/archive-status only, per Build Spec §7.2 (CRU-only matrix) and §7.1 (immutability).

Everything the agent already does (summaries, pipeline digests, weekly digest job) is preserved unchanged.

## 2. Decisions locked with the user (2026-07-14)

| # | Decision |
|---|---|
| D1 | No hard deletes; archive/status changes only |
| D2 | Preview → confirm before every write; one confirmation may cover a batch |
| D3 | Staff identity mapping via extended passphrase gate; agent asks for the CRM email if not volunteered |
| D4 | Full internal CRU entity set (see §6.3) |
| D5 | Dedicated agent-write surface, enforced through the existing RBAC machinery with the mapped user's real role |
| D6 | Rename in place: same Lua agentId (`baseAgent_agent_1783976635757_xgvfd9dr3`), channel `4rtza3`; folder `summariser_agent/` → `crm_agent/` |
| D7 | Build + verify locally only; no `lua push/deploy/promote`, no Vercel changes, no commits without explicit go-ahead |

## 3. Governing restrictions (from `decrypted/` — read in full 2026-07-14)

- **Build Spec §7.1** — immutable/audited: legal names, registration details, primary contacts, deal creation date/source/ID, investor interest records, stage history. Where a protected field changes, keep prior value + timestamp + responsible user.
- **Build Spec §7.2** — access matrix is **C/R/U only** (no delete for any role). Admin full; DealLead CRU on core entities but R-only on Partners/Service Providers; TeamMember R + U(own) on Engagements/Tasks. Own-scoping: Mandate.leadId / Transaction.ownerId / Engagement.ownerId / Task.assigneeId.
- **SOW §06 guardrails** — no automatic NDA/contract actions, no auto-onboarding, no auto confidential sharing, **no VDR access grants**, outreach human-released, no commercial commitments, excluded/greylisted investors blocked.
- **Scoping doc** — over-automation is a named risk; sensitive decisions need human review. Kenya Data Protection Act 2019 compliance: access rights, confidentiality, audit.
- The staff user in the chat *is* the human in the loop for their own instructions — but the preview/confirm step (D2) and RBAC-by-real-role (D5) keep the "agent acts, human decides" split intact.

## 4. Architecture overview

```
Staff (CRM shell LuaPop widget, channel 4rtza3)
  → passphrase gate (existing)  → staff-identify gate (NEW: CRM email → resolveStaffUser)
  → crmAgent (persona + crm-summary skill [unchanged] + crm-write skill [NEW])
      lookup_record ──→ globalSearch (existing read surface)
      propose_change ─→ agentPrepareWrite  (validates, RBAC pre-checks, stores pending op, returns preview + writeToken)
      commit_change ──→ agentCommitWrite   (atomically claims token, executes via EXISTING service layer, audit ledger)
      cancel_change ──→ agentCancelWrite
  CRM GraphQL /api/graphql — x-agent-key transport (unchanged) + actorEmail delegation per call
```

## 5. CRM server design

### 5.1 Delegated actor (the enforce/provenance seam)

`src/graphql/context.ts` — add to `Actor`:

```ts
/** True when an automation credential acts on behalf of a resolved staff user.
 *  RBAC must treat this actor as that user (no automation bypass). */
delegated?: boolean;
```

New helper `src/server/services/agent-delegation.ts`:

```ts
resolveDelegatedActor(email: string): Promise<Actor>  // throws CrudError on failure
```

- Case-insensitive lookup on `User.email` (`findFirst`, `mode: "insensitive"`); require `isActive === true`.
- Returns `{ type: "AGENT", authenticated: true, delegated: true, userId, orgRole: user.role, accountKind: "INTERNAL", label: "crm-agent:" + email }`.
- Result: `enforce.ts::internalRole()` sees a real role → the standard asserts bite; `crud.ts::actorSource()` sees `type: "AGENT"` → provenance stamps `AGENT`; services stamp `actor.userId` into `createdById`/`changedById` (existing behavior). Audit story: **AGENT provenance + human attribution**, exactly Build Spec §7.1.

`src/server/rbac/enforce.ts` — one-line change:

```ts
function isAutomation(actor: Actor): boolean {
  return actor.authenticated === true && (actor.type === "API" || actor.type === "AGENT")
    && actor.delegated !== true;   // delegated actors get REAL RBAC, not the bypass
}
```

All existing automation callers (client agent ops, Bearer API) are unaffected (`delegated` unset).

New automation-gated query (for the identify gate):

```graphql
resolveStaffUser(email: String!): StaffResolveResult   # { ok: Boolean!, firstName: String }
```
`assertAutomation`; returns `ok: false` for unknown/inactive (no distinction — no user enumeration beyond staff who already hold the passphrase). Never returns userId/role.

### 5.2 Two-phase write protocol

New Prisma model (also the **agent-write audit ledger**):

```prisma
model AgentPendingWrite {
  id          String   @id @default(cuid())        // the writeToken
  operation   String                               // registry key, e.g. "updateMandate"
  targetId    String?                              // null for creates
  payload     Json                                 // validated input as prepared
  actorEmail  String                               // delegated identity at prepare time
  actorUserId String                               // resolved User.id (attribution survives email changes)
  preview     String                               // exact human-readable diff shown to the user
  status      AgentWriteStatus @default(Pending)   // Pending | Committing | Committed | Failed | Cancelled | Expired
  error       String?
  resultId    String?                              // id of the created/updated record
  createdAt   DateTime @default(now())
  expiresAt   DateTime                             // prepare + 10 min
  committedAt DateTime?
}
```

**`agentPrepareWrite(input: { operation: String!, targetId: String, payload: JSON!, actorEmail: String! })`** → `{ writeToken, preview, warnings: [String!] }`

1. `assertAutomation(ctx.actor)` (transport) → `resolveDelegatedActor(actorEmail)` (delegation).
2. `operation` must exist in the **operation registry** (§5.3) — deletes are unrepresentable by construction.
3. Validate `payload` against the registry entry's zod schema (the same `src/lib/schemas/*` the UI uses).
4. **RBAC pre-check now** with the delegated actor: registry entry declares `(entity, perm)`; run `assertCan` / `assertCanUpdateOwnScoped` (with the entity's own-fetch) so permission failures surface at preview time, not after confirmation.
5. Immutability pre-check: for updates, fetch current record; if payload touches a locked field (mandate `dateOpened`/`source`, transaction `dateOpened`) with a different value → reject with the same `CrudError` message the UI would produce.
6. Build `preview`: creates → "Create <entity> with: field = value…"; updates → per-field "field: <current> → <new>" (only fields actually changing; no-op → reject with "nothing to change").
7. Store the row; return token + preview. The tool relays the preview **verbatim** to the staff user.

**`agentCommitWrite(writeToken: String!, actorEmail: String!)`** → `{ ok, summary, recordId, href }`

1. Transport + delegation checks; the resolved `actorUserId` must equal the row's (no cross-user token use).
2. Atomic claim: `updateMany({ where: { id, status: "Pending", expiresAt: { gt: now } }, data: { status: "Committing" } })` — count 0 → "expired, already processed, or cancelled" (replay-safe).
3. Execute the registry entry's service call with the **delegated actor** (RBAC re-asserted inside the normal resolvers' pattern; services enforce business rules: `stageEnteredAt` reset, `closedAt` stamping, NDA/EA date reconciliation, NDA guard, StageChange rows, notifications).
4. Success → `status: "Committed"`, `resultId`, `committedAt`; failure → `status: "Failed"`, `error` (returned to the agent verbatim via the existing `mask-error` passthrough for `CrudError`/`NdaGuardError`/Zod).
5. Return summary + deep link href (mirror `globalSearch` href conventions).

**`agentCancelWrite(writeToken: String!, actorEmail: String!)`** → `{ ok }` — Pending → Cancelled.

A sweep is unnecessary: expiry is enforced at claim time (`expiresAt` predicate); rows are small and are the audit trail — never deleted.

### 5.3 Operation registry (the write allowlist)

`src/server/services/agent-write-registry.ts` — one declarative table; each entry: `{ operation, entity (RbacEntity), perm: "C" | "U", zod schema, ownFetch?, execute(actor, targetId, payload) }` delegating to the **existing service functions unchanged**:

| Operation | Service call | Notes |
|---|---|---|
| createClient / updateClient | `clients.ts` | name/registrationNo changes already write StageChange |
| createMandate / updateMandate | `mandates.ts` | dateOpened/source immutability, NDA/EA reconciliation |
| setMandateStage | `setMandateStage` | stageEnteredAt reset + StageChange + notify |
| createTransaction / updateTransaction | `transactions.ts` | dateOpened lock; closedAt stamping |
| setTransactionStage | `setTransactionStage` | closedAt stamp/clear on terminal stages |
| createEngagement / updateEngagement | `engagements-crud.ts` | NDA guard enforced |
| logActivity | `engagements.ts::logActivity` | requires ≥1 linked record |
| createInvestor / updateInvestor | `investors.ts` | criteriaVerifiedAt auto-restamp |
| createPerson / updatePerson | `persons.ts` | primary-contact handover + StageChange |
| createPartner / updatePartner | `partners.ts` | RBAC: Partners are Admin-write-only per matrix — DealLead attempts fail at prepare, correctly |
| createTask / updateTask | `tasks.ts` | gains `actor` param (§5.4) |
| createDocument / updateDocument | `documents.ts` | **metadata only** (no file bytes); `updateDocument` gains actor param |
| recordMilestone / unrecordMilestone | `milestones-crud.ts` | investor-side milestone bookkeeping |
| recordOpenNda / recordClosedNda | `nda.ts` | *recording* an already-signed NDA is staff data entry; the agent still never signs/accepts anything |

**Deliberately excluded** (spec-driven): every delete; `setInvestorOnboardingStatus` / `greylistInvestor` (admin governance decisions — UI only); `sendEsignEnvelope`, `shareDocumentViaBox`, `scheduleMeeting` (outward-facing actions — SOW human-release rule); `acceptIntakeMandate` / `deprioritizeIntakeMandate` (lead-conversion decisions stay in the UI queue per SOW §06); DD tracks & SavedViews (out of agreed entity list); any VDR/document-access-level grant.

`documents` access-level note: `updateDocument` payload must reject changes to `accessLevel` toward `Investor-shared`/`VDR` (registry-level strip + warning) — VDR/visibility grants are human-UI actions per SOW.

### 5.4 Attribution gap fixes (small, in passing)

- `Task`: add `createdSource ActorSource @default(HUMAN)` column (migration); `createTask/updateTask` gain optional `actor` param and stamp it. (Attribution beyond that is carried by the AgentPendingWrite ledger.)
- `documents.ts::updateDocument` gains optional `actor` param (parity; currently unused internally).
- `engagements.ts::logEngagement` hardcoded `createdSource: "HUMAN"` → `actorSource(actor)` (pre-existing bug; test it).

### 5.5 GraphQL additions

`mutations.ts`: `agentPrepareWrite`, `agentCommitWrite`, `agentCancelWrite`; `queries.ts`: `resolveStaffUser`. All four `assertAutomation`-gated at transport, then delegation inside. Ack types via `objectRef` (same pattern as `AgentAckRef`), exposing no record data beyond `preview`/`summary`/`href`.

## 6. Lua agent design (`crm_agent/`)

### 6.1 Rename (D6)

- `git mv summariser_agent crm_agent` (history preserved; **no commit** — working tree only: use plain `mv` + let git see it as rename at commit time).
- `src/index.ts`: `name: "crmAgent"`; persona retitled **“NobleStride CRM Assistant”** — keeps all summary capabilities/guardrails, adds write capability text (§6.4). `lua.skill.yaml` agentId/skillId/jobId/preprocessorId pins unchanged.
- CRM shell widget `chatTitle`: “NobleStride Assistant” → “NobleStride CRM Assistant” (`lua-pop-widget.tsx`).
- Deployed `dist-v2` is already stale (pre-rename paths); it is build output and will regenerate on the next `lua push` (not in this build, per D7).

### 6.2 Staff-identify gate (extends `passphrase-gate.ts`)

State machine on `user.data` (persists across staff conversations — the internal widget keeps a stable LuaPop identity):

```
!verified                  → challenge for passphrase (existing behavior, unchanged)
verified && !staffEmail    → "You're verified. To make changes on your behalf I need your CRM email — what is it?"
                             email-looking reply → resolveStaffUser(email)
                               ok → user.update({ staffEmail, staffName }); welcome by name
                               !ok → "That email doesn't match an active CRM user." (stay in this state)
verified && staffEmail     → proceed
```

- Pure decision function extended (`gateDecision` → covers the new states) — unit-testable like today.
- Read-only questions do **not** strictly need identity, but a single linear gate is simpler and matches D3 ("ask for the email"); staff identify once per widget identity, not per conversation.
- Gate failure to reach CRM (`resolveStaffUser` transport error) → block with "can't verify right now, try again shortly" (fail closed for writes).

### 6.3 New skill `crm-write` (tools)

All tools read `staffEmail` via lua-cli `User.get()` → `user.data` (never from model input — the model cannot spoof identity).

1. **`lookup_record(recordType, query)`** — GLOBAL_SEARCH + `resolveRecord` (reuse `lib/resolve.ts`) → `{ status: match|ambiguous|none, candidates }`. Same semantics the summary tool uses; gives the model a record id to target.
2. **`propose_change(operation, targetId?, fields)`** — calls `agentPrepareWrite` with `actorEmail` from user.data → returns `{ writeToken, preview, warnings }`. Skill context: relay preview verbatim, ask for confirmation, never proceed without it.
3. **`commit_change(writeToken)`** — calls `agentCommitWrite` → `{ ok, summary, link }`.
4. **`cancel_change(writeToken)`** — on "no"/changed mind.

Zod input schemas mirror the registry operations (enum of operation names; `fields` as a permissive record — the server's zod is the validation truth; tool passes through and surfaces rejection messages for the model to fix conversationally, same pattern as `submit_intake`'s rejected-flow).

### 6.4 Persona / skill-context rules (write side)

- Always `lookup_record` first when the user names a record; never guess ids; on ambiguity ask.
- Exactly one pending change at a time; propose → show preview verbatim → wait for explicit yes ("yes"/"confirm"/"go ahead"); anything else → cancel or revise.
- A batch request ("update X and create Y") = sequential propose/confirm pairs unless the user pre-confirms the batch, in which case still show each preview before its commit.
- Never delete anything; if asked, explain deletes are done in the CRM UI.
- Never change qualification verdicts, onboarding/greylist status, or grant document/VDR access; never send anything to external parties.
- Immutable-field pushback: relay the server's message and suggest the correct path.
- Keep every existing summary/digest guideline (no invented facts, no raw ids, deep links).

## 7. Testing

- **CRM unit/smoke** (vitest, DB-backed like `client-intake.smoke.test.ts`): `resolveDelegatedActor` (unknown/inactive/case-insensitivity); delegated actor does NOT bypass RBAC (TeamMember blocked from `updateClient`, DealLead blocked from non-own Mandate update and from Partner writes; Admin allowed); prepare validation errors (bad operation, zod failure, immutable field, no-op); commit lifecycle (claim-once/replay, expiry, cross-user token, Failed path surfaces service error); ledger rows recorded; Task `createdSource` stamped AGENT; `logEngagement` provenance fix.
- **Schema smoke**: new ops present; delete ops absent from the agent surface.
- **Lua-side** (vitest): gate state machine incl. email step; each tool's happy/reject/transport-failure paths with injected fake crm + fake `User`.
- **End pass**: single Playwright/browser verification per standing preference + `npx lua chat` sandbox transcript; update `playwright assessment/`.

## 8. Explicitly out of scope

WhatsApp/email channels; Investor/Investor-Tracker/Referral agents; investor-visibility portal; generic field-level audit beyond the existing StageChange keys (+ the ledger); deletes of any kind; deployment (D7).

## 9. Alternatives considered

- **Single-phase writes with prompt-only confirmation** — rejected: guardrail would live in the LLM, not the server; a jailbreak or tool-loop misfire could write immediately.
- **Per-mutation duplicated “agent variants” of all ~30 write mutations** — rejected: 3 generic mutations + a declarative registry give one uniform audit ledger, one preview engine, and a smaller GraphQL surface.
- **Bearer-JWT-per-staff-user instead of actorEmail delegation** — half exists (`sub` → userId) but doesn't carry `orgRole`, would need token minting/rotation UX inside chat; heavier with no security gain over the passphrase+email gate on an already-trusted transport key.
