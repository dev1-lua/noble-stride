# Client Agent Self-Service Status (OTP Data-Out) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a web-chat visitor who proves control of a registered contact email (6-digit email OTP) see a hard-whitelisted, server-computed status of their own application/deal.

**Architecture:** Three automation-gated GraphQL ops on the CRM (`requestClientStatusOtp` — silent send, anti-enumeration; `verifyClientStatusOtp` — single-use challenge → 15-min signed JWT; `clientStatus` — whitelist payload derived from Mandate/Transaction stages + Activity logging), plus three new Lua tools and skill-context/persona updates on the existing client agent.

**Tech Stack:** Next.js/Pothos GraphQL + Prisma + jose (existing) + Resend mailer/dev-otp-sink (existing), lua-cli client_agent, vitest.

**Spec:** `docs/superpowers/specs/2026-07-14-client-agent-status-design.md` — read it before starting any task.

## Global Constraints

- **NO git commits.** Leave the working tree dirty; commits only on explicit user go-ahead.
- Stop any running dev server before `npx prisma generate`/`migrate dev` (Windows DLL lock).
- Pre-existing lint failures exist — do not chase ones you didn't introduce.
- **Anti-enumeration invariant is absolute:** no response — success, failure, timing-visible work, or wording — may differ based on whether a company/email exists. Every test of a "no match" path asserts the response is byte-identical in shape to the "match" path.
- The whitelist payload type must contain ONLY the fields in spec §5.3. Adding a field = spec violation.
- All three ops `assertAutomation`-gated (same as existing client-agent surface).
- No new npm dependencies (jose, Resend plumbing, dev sink all exist).
- CRM dir: `noblestride-crm/`. Agent dir: `client_agent/`.

---

### Task 1: Prisma — `ClientOtpChallenge`

**Files:**
- Modify: `noblestride-crm/prisma/schema.prisma`
- Migration: `npx prisma migrate dev --name client_otp_challenge`

**Interfaces:**
- Produces: `prisma.clientOtpChallenge` with fields exactly as spec §5.1 (id, clientId, personId, codeHash, destination, attempts, maxAttempts=5, expiresAt, consumedAt?, createdAt) + `client`/`person` relations `onDelete: Cascade` + indexes `@@index([personId])`, `@@index([destination, createdAt])`. Add matching back-relations on `Client` and `Person` models.

- [ ] **Step 1:** Add the model (copy field-for-field from spec §5.1; comment header: `/// Public web-chat status OTP (spec 2026-07-14). Mirrors AuthOtpChallenge but keyed to a matched Person, not an AuthAccount.`).
- [ ] **Step 2:** Stop dev server; `npx prisma migrate dev --name client_otp_challenge`. Run `npx vitest run src/server/services/__tests__/client-intake.smoke.test.ts` → still green.
- [ ] **Step 3: Leave in tree.**

---

### Task 2: `requestClientStatusOtp` service

**Files:**
- Create: `noblestride-crm/src/server/services/client-status.ts`
- Modify: `noblestride-crm/src/server/auth/otp.ts` — ONLY if `generateOtpCode`/`hashOtpCode` are not already exported (research says they are; verify, export if needed)
- Test: `noblestride-crm/src/server/services/__tests__/client-status.smoke.test.ts` (DB-backed; fixture: ZZTest client + Person contact `zztest.contact@zzco.example`, second ZZTest client for cross-checks — reuse the fixture style of `client-intake.smoke.test.ts`)

**Interfaces:**
- Consumes: `matchClients`/`emailMatchesContact` — these are module-private in `client-intake.ts`; EXPORT them from there (no behavior change) and import here. `generateOtpCode`, `hashOtpCode`, `OTP_TTL_MS` from `@/server/auth/otp`; `recordDevOtp` from `@/server/auth/dev-otp-sink`; `sendMail` from `@/server/auth/mailer`.
- Produces: `requestClientStatusOtp(companyName: string, contactEmail: string): Promise<{ ok: true }>` — ALWAYS `{ ok: true }`.

- [ ] **Step 1: Failing tests:**

```ts
it("match: creates one challenge, hashes the code, sends mail", async () => {
  const res = await requestClientStatusOtp("ZZTest Co", "zztest.contact@zzco.example");
  expect(res).toEqual({ ok: true });
  const rows = await prisma.clientOtpChallenge.findMany({ where: { destination: "zztest.contact@zzco.example" } });
  expect(rows).toHaveLength(1);
  expect(rows[0].codeHash).toMatch(/^[0-9a-f]{64}$/);           // sha256, never the raw code
  expect(rows[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
});
it("no company match: identical {ok:true}, NO challenge row", ...);
it("email not a registered contact of the matched company: {ok:true}, NO row", ...);
it("empty companyName: {ok:true}, NO client query at all (spy on prisma like client-intake's oracle-guard test)", ...);
it("60s cooldown: second request within 60s → {ok:true}, still ONE row", ...);
it("hourly cap: 5 rows exist within the hour → 6th request {ok:true}, still 5 rows", ...);
it("re-request after cooldown invalidates the previous challenge (one active per person)", ...);  // prior row consumedAt set or superseded per otp.ts convention
it("mailer failure still returns {ok:true} and logs", ...);      // inject failing sendMail via deps param
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** (deps-injectable for the mailer, defaulting to real `sendMail`):

```ts
const RESEND_COOLDOWN_MS = 60_000;
const HOURLY_CAP = 5;

export async function requestClientStatusOtp(
  companyName: string, contactEmail: string,
  deps: { send: typeof sendMail } = { send: sendMail },
): Promise<{ ok: true }> {
  if (!companyName.trim() || !contactEmail.trim()) return { ok: true };          // oracle guard
  const clients = await matchClients(companyName);
  if (clients.length === 0) return { ok: true };
  const match = await emailMatchesContact(clients.map(c => c.id), contactEmail);
  if (!match) return { ok: true };

  const dest = contactEmail.trim().toLowerCase();
  const hourAgo = new Date(Date.now() - 3_600_000);
  const recent = await prisma.clientOtpChallenge.findMany({
    where: { destination: dest, createdAt: { gte: hourAgo } }, orderBy: { createdAt: "desc" },
  });
  if (recent.length >= HOURLY_CAP) return { ok: true };
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) return { ok: true };

  await prisma.clientOtpChallenge.updateMany({                                   // one active challenge per person
    where: { personId: match.id, consumedAt: null }, data: { consumedAt: new Date() },
  });
  const code = generateOtpCode();
  await prisma.clientOtpChallenge.create({ data: {
    clientId: match.clientId!, personId: match.id, codeHash: hashOtpCode(code),
    destination: dest, expiresAt: new Date(Date.now() + OTP_TTL_MS),
  }});
  recordDevOtp(dest, code);
  try {
    await deps.send({ to: dest, subject: "Your NobleStride verification code",
      text: `Your NobleStride verification code is ${code}. It expires in 10 minutes.\n\nIf you did not request this, you can ignore this email.` });
  } catch (err) { console.error("requestClientStatusOtp: send failed", err); }    // still {ok:true}
  return { ok: true };
}
```

(Export `matchClients`/`emailMatchesContact` from `client-intake.ts` — add `export` keywords only; run its existing smoke tests to confirm no regression.)
- [ ] **Step 4: Run → PASS (incl. client-intake suite).**
- [ ] **Step 5: Leave in tree.**

---

### Task 3: `verifyClientStatusOtp` + status token

**Files:**
- Modify: `noblestride-crm/src/server/services/client-status.ts`
- Test: extend `client-status.smoke.test.ts`

**Interfaces:**
- Produces: `verifyClientStatusOtp(companyName, contactEmail, code): Promise<{ status: "ok"; token: string } | { status: "failed" }>`; `verifyStatusToken(token: string): Promise<{ clientId: string; personId: string } | null>` (exported for Task 4). Token: HS256 JWT over `process.env.AUTH_SECRET` (jose — copy the sign/verify structure from `two-factor.ts` `signPending`/`verifyPending`), payload `{ clientId, personId, purpose: "client-status" }`, TTL 15 min (`STATUS_TOKEN_TTL_S = 900`).

- [ ] **Step 1: Failing tests:**
  - happy: request → read code from dev sink (`readDevOtp(dest)`) → verify → `{ status: "ok", token }`; `verifyStatusToken(token)` → `{ clientId, personId }`; challenge row `consumedAt` set;
  - wrong code → `{ status: "failed" }`, attempts incremented; 5 wrong → locked; correct code AFTER lock → still failed;
  - replay: verify same correct code twice → second `{ status: "failed" }` (single-use claim via `updateMany({ where: { consumedAt: null } })`);
  - expired challenge (backdate expiresAt) → failed;
  - no match / no challenge / garbage inputs → `{ status: "failed" }` — assert the object is deep-equal to the wrong-code result (single failure shape);
  - token expiry: sign with 0 TTL (test helper) → `verifyStatusToken` → null; tampered token → null; wrong purpose → null.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** (single `FAILED = { status: "failed" as const }` constant returned on every non-ok path; correct-code path mirrors `otp.ts::verifyOtpChallenge` semantics — attempts, expiry, atomic claim — but against `clientOtpChallenge`).
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Leave in tree.**

---

### Task 4: `getClientStatus` — derivation + whitelist payload + Activity log

**Files:**
- Modify: `noblestride-crm/src/server/services/client-status.ts`
- Test: extend `client-status.smoke.test.ts`

**Interfaces:**
- Produces:

```ts
export interface ClientStatusPayload {
  companyName: string;
  applicationState: "received" | "under_review" | "engaged" | "in_execution" | "completed" | "with_team";
  coarseStage: "docs_prep" | "investor_outreach" | "due_diligence" | "term_sheet" | "closing" | null;
  stageMessage: string;
  ndaStatus: "not_sent" | "sent" | "signed" | null;
  engagementAgreementStatus: "not_sent" | "sent" | "signed" | null;
  preparedDocuments: string[];       // subset of ["Teaser","Information Memorandum","Financial Model","Valuation Report","Business Plan"]
  submittedRaise: string | null;     // e.g. "USD 2,000,000" from Mandate.dealSize+currency (verify the intake mapping in submit-intake.ts; if dealSize isn't populated there, take the amount from the intake Activity? NO — then return null. Only ever their own stored dealSize.)
  nextStep: string;
  lastUpdated: string;               // ISO date
}
export async function getClientStatus(token: string): Promise<ClientStatusPayload>  // throws CrudError("Verification expired — please verify again.") on bad token
```

- [ ] **Step 1: Failing tests** — one fixture per derivation row of spec §5.3 (create ZZTest client + mandate/transaction in the target stage, call the full request→verify→status chain or call `getClientStatus` with a directly-signed test token):
  - Mandate NewLead → `received`, coarseStage null;
  - Mandate Qualification (no txn) → `under_review`;
  - Mandate Signed (no txn) → `engaged`;
  - Transaction DealPreparation / InvestorOutreach / DueDiligence / TermSheet / Closing → `in_execution` + matching coarseStage;
  - Transaction ClosedWon → `completed`;
  - Mandate Lost → `with_team` and stageMessage matches /with our team/i (NEVER contains lost/reject/deprioritiz);
  - most-advanced-open-transaction wins over mandate when both exist;
  - ndaStatus/eaStatus mapping (`NotSent→not_sent` etc.); preparedDocuments: create Document rows (Teaser Approved, IM Draft) → payload contains "Teaser" only;
  - **whitelist key assertion:** `expect(Object.keys(payload).sort()).toEqual([...exact spec key list].sort())` — the payload NEVER gains keys;
  - forbidden-content probe: with an Engagement + investor attached to the txn, `JSON.stringify(payload)` does NOT contain the investor's name;
  - Activity logged: after a status call, the client has an Activity `subject: "Client checked status via web chat"`, `channel: "WebChat"`, `createdSource: "AGENT"`;
  - bad/expired token → throws /verification expired/i.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.** Load client with newest mandate (`orderBy: { createdAt: "desc" }, take: 1`), open transactions (stage not in Closed*, dealStatus not Dropped), documents of the five types. Transaction precedence: `["DealPreparation","InvestorOutreach","DueDiligence","TermSheet","Closing"]` — pick the highest-index open one; ClosedWon anywhere → completed; else ClosedLost/Lost/Dropped/OnHold → with_team. Static `STAGE_MESSAGES` and `NEXT_STEPS` maps (write friendly one-liners per state; with_team: "Your application is with our team — they'll contact you with any updates."). `submittedRaise`: `mandate.dealSize ? \`${mandate.currency ?? "USD"} ${Number(mandate.dealSize).toLocaleString("en-US")}\` : null`. Activity via `prisma.activity.create` in a try/catch that never sinks the answer.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Leave in tree.**

---

### Task 5: GraphQL surface

**Files:**
- Modify: `noblestride-crm/src/graphql/mutations.ts` (Client Agent section): `requestClientStatusOtp(companyName: String!, contactEmail: String!)` → `AgentAckRef`-style `{ ok }`; `verifyClientStatusOtp(companyName: String!, contactEmail: String!, code: String!)` → new `ClientOtpVerifyRef { status: String!, token: String }`
- Modify: `noblestride-crm/src/graphql/queries.ts`: `clientStatus(token: String!)` → new `ClientStatusPayloadRef` (fields EXACTLY the interface in Task 4 — arrays as `[String!]!`)
- Modify: `noblestride-crm/src/graphql/types.ts` (the two objectRefs)
- Test: `src/graphql/__tests__/schema.smoke.test.ts` — new fields present; `ClientStatusPayload` type's field list asserted exactly (use `schema.getType("ClientStatusPayload")` field names) so a future field addition fails the suite.

- [ ] **Step 1: Failing schema test → run → FAIL.**
- [ ] **Step 2: Implement** — copy the `checkCompany`/`submitClientIntake` resolver pattern verbatim: `assertAutomation(ctx.actor)` then service call. `clientStatus` resolver also wraps `getClientStatus` — CrudError passthrough is already handled by mask-error.
- [ ] **Step 3: Run schema smoke + full graphql test dir → PASS.**
- [ ] **Step 4: Leave in tree.**

---

### Task 6: Lua tools — `request_status_code`, `verify_status_code`, `get_client_status`

**Files:**
- Create: `client_agent/src/skills/tools/RequestStatusCodeTool.ts`, `VerifyStatusCodeTool.ts`, `GetClientStatusTool.ts`
- Modify: `client_agent/src/lib/queries.ts` (three documents: `REQUEST_STATUS_OTP`, `VERIFY_STATUS_OTP`, `CLIENT_STATUS` — select exactly the payload fields)
- Modify: `client_agent/src/skills/intake.skill.ts` (add tools to the `tools:` array — context text is Task 7)
- Test: `client_agent/src/skills/tools/__tests__/status-tools.test.ts`

**Interfaces:**
- Consumes: Task 5 GraphQL ops via the existing `CrmClient`.
- Produces: `request_status_code(companyName, contactEmail)` → `{ status: "ok" }` always; `verify_status_code(companyName, contactEmail, code)` → `{ status: "ok", token } | { status: "failed" }`; `get_client_status(token)` → `{ status: "ok", ...payload } | { status: "verification_expired" }`.

- [ ] **Step 1: Failing tests** (fake crm injection, existing tool-test style):
  - request: returns `{status:"ok"}` and passes exact variables; description string contains "Never" + "exists" (invariant text present);
  - verify ok → token relayed; verify failed → `{status:"failed"}` with NO other keys;
  - get_client_status ok → payload spread through untouched (assert a known field), token never included in the RESULT object;
  - get_client_status when CRM rejects with /verification expired/i → `{ status: "verification_expired" }` (tool maps it; model restarts the flow);
  - transport failure → CrmError rethrown (all three).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — standard `LuaTool` classes (deps-injectable). `GetClientStatusTool.execute` catches `CrmError` where `message` matches /verification expired/i → `{ status: "verification_expired" as const }`; rethrows others. Tool descriptions (model-facing contracts):
  - request: `"Silently trigger a verification code email IF the company+email match our records. ALWAYS returns ok — never reveals whether they matched. Tell the visitor: 'if those details match our records, a code is on its way.'"`
  - verify: `"Check the 6-digit code the visitor received. Returns a short-lived token on success. On 'failed' tell them the code didn't work and offer ONE fresh code."`
  - get: `"Fetch the verified client's own status summary. Present ONLY what this returns — never elaborate beyond it. Never show the token."`
- [ ] **Step 4: Run → PASS. Full `npx vitest run` in client_agent green.**
- [ ] **Step 5: Leave in tree.**

---

### Task 7: Skill context + persona carve-out

**Files:**
- Modify: `client_agent/src/skills/intake.skill.ts` (context string)
- Modify: `client_agent/src/index.ts` (persona Hard rules)

- [ ] **Step 1:** Append to the skill context, after the "Existing relationship (log flow)" block:

```
Status request (verified flow):
- When an existing-relationship visitor asks how their application or deal is going, offer to verify them: collect the company name and THEIR email (you may already have both), then call request_status_code and say: "If those details match our records, a verification code is on its way to that email — tell me the 6-digit code when you have it."
- When they give the code, call verify_status_code. On "ok", call get_client_status with the token and answer warmly using ONLY the returned fields. On "failed": "That code didn't work — it may have expired." Offer ONE fresh code (request_status_code again); if that fails too, take a message instead (log_client_message).
- If get_client_status returns verification_expired, apologize and restart the code flow.
- Never say whether the company or email is in our records — verification failing and details not matching must sound identical.
- If they ask for anything beyond what the status tool returned (investors, valuations, feedback, timelines), say their deal lead can share more and offer to pass the request on via log_client_message.
- Leaving a message never requires verification.
```

- [ ] **Step 2:** In the persona, extend the reveal-nothing hard rule with:

```
  The ONE exception: a visitor who completes email verification (status tools) may be told exactly what the status tool returns — nothing more. The verification process itself never confirms whether a company is in our records.
```

- [ ] **Step 3:** `npx tsc --noEmit` + `npx vitest run` in client_agent → green (context/persona are strings; tests unaffected).
- [ ] **Step 4: Leave in tree.**

---

### Task 8: End-to-end smoke script

**Files:**
- Modify: `client_agent/scripts/smoke.ts` (append a "status flow" section) — or create `scripts/status-smoke.ts` if smoke.ts is tightly structured; prefer extending.

- [ ] **Step 1:** Against a running local CRM: submit a ZZTest intake (existing smoke helper) → `requestClientStatusOtp` with the intake's contact email → read code from the dev sink file (`%TMP%/ns-dev-otp-sink.json` — import `readDevOtp` is server-side; from the script just re-request via a tiny local read of the JSON file) → `verifyClientStatusOtp` → `clientStatus(token)` → assert `applicationState === "received"` and the payload keys match the spec list → impostor probe: `requestClientStatusOtp("ZZTest Co", "wrong@nowhere.example")` returns `{ok:true}` and a follow-up verify with any code fails.
- [ ] **Step 2:** Run; all PASS; keep output for the verification log. (Browser-level Playwright verification of /talk-to-us happens once, after BOTH plans finish, per `playwright-verify-at-end`.)
- [ ] **Step 3: Leave in tree.**

---

## Self-Review (done at plan-writing time)

- **Spec coverage:** §5.1→Task 1; §5.2 request→Task 2, verify/token→Task 3, status/Activity→Task 4; §5.3 whitelist→Task 4 (+schema-level lock in Task 5); §5.4→Task 5; §6.1→Task 6; §6.2/6.3→Task 7; §7→tests throughout + Task 8. Gap check: spec's "notify team" consideration was resolved as Activity-only (spec §5.2 point 3) — covered in Task 4. None open.
- **Placeholders:** none — every step has code or exact edit text; the one open data question (submittedRaise source) is pinned with an explicit verification instruction and a safe fallback (null).
- **Type consistency:** `{ status: "failed" }` single failure shape used in Task 3 service, Task 5 GraphQL (`ClientOtpVerifyRef.status`), Task 6 tool; token param name `token` everywhere; payload interface field names identical in Task 4 service, Task 5 objectRef, Task 6 query selection.
