# Client Agent — Design Spec (SOW §8.1)

**Date:** 2026-07-14
**Status:** Approved by Shaurya (design walkthrough + AskUserQuestion answers, 2026-07-14 early AM)
**Reference implementation:** `summariser_agent/` (working end-to-end; same API structure reused)
**Lua platform docs:** https://docs.heylua.ai/llms.txt

---

## 1. What we're building

The **Client Agent** from SOW §8.1: a client-facing Lua agent that handles inbound
prospect/client correspondence over **web chat**, structures it, and feeds NobleStride's
intake pipeline.

- **Chat user:** the prospect/client themselves (NOT staff). The chat is public.
- **Surface:** a public full-page chat at **`/talk-to-us`** in the Next.js CRM app
  (Sucafina-style embedded LuaPop in an iframe-srcdoc).
- **Write path:** reuses the existing tested `submitIntake()` pipeline (Client +
  NewLead Mandate + qualification verdict §10.2 + admin notification) plus
  Communication (Activity), Task, and Document writes.
- **Existing companies:** detect + verify (contact-email match) + log + task — **never
  reveal or update** existing data to an anonymous web visitor.
- **Out of scope:** WhatsApp and email channels (integration projects; the agent's
  tools are channel-agnostic so they bolt on later). No changes to the summariser agent.

### SOW §8.1 compliance map

| SOW aspect | This design |
|---|---|
| Purpose: handle inbound correspondence, structure it, feed intake | Conversational intake → `submitClientIntake` → existing intake queue |
| Channels: WhatsApp, email, web chat | Web chat now (public page); others later, tools channel-agnostic |
| Trigger: inbound message from prospect/client | Prospect opens /talk-to-us and chats |
| Reads: message content, attachments, existing Company/Deal records | Message + attachments in conversation; existence-only probe of Client records (`check_company`) |
| Does: classifies; extracts intake fields vs checklist (§10.1); drafts summary + next steps; flags qualification signals | Persona classifies intent; skill collects §10.1 checklist; conversationSummary + nextSteps written into Activity/Task; qualification verdict computed server-side by `qualifyIntake` (§10.2) |
| Writes: creates/updates Company & Communication records; Tasks for deal lead; attaches Documents | Client + Mandate + Activity + Task + Document(s) via 2 mutations |
| Human gate: deal lead reviews/progresses | Intake lands in NewLead queue (§10.3); Tasks unassigned for triage; admin notified; agent tells prospect "team will be in touch" |
| Never: sign/accept NDAs/contracts; onboard; convert lead; commit the firm | Hard-coded persona guardrails + tools structurally cannot do any of these |

---

## 2. Architecture

```
Prospect ──► /talk-to-us (public Next.js page; LuaPop embedded via iframe srcdoc)
                 │  Lua webchat channel
                 ▼
        clientAgent (Lua cloud) — client_agent/
          persona + client-intake skill + 3 tools
                 │  POST {CRM_API_URL}  header: x-agent-key {CRM_AGENT_KEY}
                 ▼
        noblestride-crm /api/graphql
          1 query + 2 mutations, automation-gated (AGENT/API + authenticated)
          └─► src/server/services/client-intake.ts
                └─► existing submitIntake() core + Activity/Task/Document writes
```

Identical API structure to summariserAgent: GraphQL over fetch, `x-agent-key` header,
`AGENT_API_KEY` constant-time compare in `context.ts` → `Actor {type:"AGENT",
authenticated:true}` → full automation access via `rbac/enforce.ts::isAutomation`.
`crm-client.ts` is the same module pattern (CrmError, CRM_DOWN_MESSAGE, env()).

### Agent identity (already provisioned)

- Folder: `client_agent/` (lua init done; work ONLY here for agent code)
- agentId: `baseAgent_agent_1783981692495_we70afz23`
- org: Lua Implementation `1e5359cc-c465-44cb-b040-44e338433411`
  (work account **shaurya@luaimplementation.ai** — never the Gmail account)
- Model: `anthropic/claude-sonnet-5` (same as summariser)
- No preprocessor (public chat — no passphrase gate), no jobs, no webhooks.

---

## 3. Agent design (`client_agent/`)

Mirror `summariser_agent/` layout:

```
client_agent/
  src/index.ts                      LuaAgent: persona, skill
  src/skills/intake.skill.ts        LuaSkill "client-intake": context + 3 tools
  src/skills/tools/CheckCompanyTool.ts
  src/skills/tools/SubmitIntakeTool.ts
  src/skills/tools/LogClientMessageTool.ts
  src/skills/tools/__tests__/*.test.ts
  src/lib/crm-client.ts             copied pattern from summariser (env CRM_API_URL, CRM_AGENT_KEY)
  src/lib/queries.ts                the 3 GraphQL documents
  vitest.config.ts, package.json, tsconfig.json, env.example
```

### Persona (index.ts) — client-facing, inverse of summariser's internal persona

Identity: NobleStride Capital's front-desk assistant for companies exploring
fundraising/advisory support. Audience: external prospects and clients — NEVER staff.
Tone: warm, professional, concise; one question at a time when collecting fields.

Behavior:
- Classify each conversation: **new fundraising inquiry** / **existing relationship** /
  **other** (route to tools accordingly; for "other", answer politely from public info
  about NobleStride's services and offer the intake conversation).
- New inquiry: conversationally collect the §10.1 checklist (required fields are
  mandatory; optional opportunistic), invite a pitch-deck upload, then call
  `submit_intake` ONCE, then give a neutral "the team will review and be in touch"
  close. Never restate a full data dump back; confirm key facts naturally.
- Existing relationship: `check_company` first; then `log_client_message`; tell them
  the team will follow up. If unverified, still accept the message politely.

Hard guardrails (persona "Never" section, SOW §8.1):
- Never sign/accept NDAs or contracts, onboard anyone, convert a lead to a deal,
  agree fees/terms, or commit the firm to anything.
- Never reveal CRM data, whether a company exists in the system, qualification
  verdicts/criteria outcomes, internal processes, or other clients/investors.
- Never state or hint at the qualification outcome; the confirmation is always neutral
  (same rule as the /intake wizard).
- No legal, tax, or investment advice.
- If a tool reports the CRM unreachable, apologize and point to the /intake form.

### Skill context (intake.skill.ts)

Instructs: intent classification; §10.1 field collection order (required first);
attachment handling (pass any uploaded file URLs to `submit_intake.attachmentUrls`;
if uploads aren't available, ask for a link, but NEVER block submission on it);
one `submit_intake` per conversation; `check_company` before `log_client_message`;
relay only neutral acks.

### Tools

**1. `check_company`** — dedupe + verify probe.
- Input: `{ companyName: string, contactEmail?: string }`
- Calls query `checkCompany(name, contactEmail)`.
- Returns to LLM ONLY: `{ status: "new" | "known_verified" | "known_unverified" }`.
- Used to route new-vs-existing; never surfaces record data/ids.

**2. `submit_intake`** — the §10.1 checklist submission.
- Input (zod mirror of `noblestride-crm/src/lib/schemas/intake.ts::intakeSubmitSchema`
  fields, flattened for the LLM, `.describe()` on every field) plus:
  - `conversationSummary: string` — agent-drafted summary + next steps (§8.1 "drafts a summary and next steps")
  - `qualificationNotes?: string` — signals the agent noticed (§8.1 "flags qualification signals"); informational only, verdict is computed server-side
  - `attachmentUrls?: string[]`
- Calls mutation `submitClientIntake(input)`.
- Returns `{ ok: true }` only. On CrmError → rethrows friendly message.

**3. `log_client_message`** — existing-company inbound message.
- Input: `{ companyName: string, contactEmail: string, messageSummary: string,
  requestType: "status_update" | "question" | "document" | "other" }`
- Calls mutation `logInboundClientMessage(input)`; server re-resolves + re-verifies
  (tool never holds a record id).
- Returns `{ ok: true, verified: boolean }`.

### Env

- `env.example` / worktree `.env` for `lua test`: `CRM_API_URL=http://localhost:3000/api/graphql`,
  `CRM_AGENT_KEY=dev-agent-key-change-me`.
- Production env (after deploy): `CRM_API_URL=<cloudflared tunnel>/api/graphql`,
  `CRM_AGENT_KEY=dev-agent-key-change-me` via `lua env production -k ... -v ...`.

---

## 4. CRM additions (`noblestride-crm/`)

New service `src/server/services/client-intake.ts` + GraphQL wiring. All three
operations gate on `actor.authenticated === true && (actor.type === "AGENT" || "API")`
— humans and anonymous callers get `forbidden()`. All return **minimal payloads**
(plain object types, NOT prismaField) so no record data can reach the LLM.

**1. Query `checkCompany(name: String!, contactEmail: String): CheckCompanyResult!`**
- `{ status: "new" | "known_verified" | "known_unverified" }`
- Match: case-insensitive `contains` on `Client.name` (plus exact-ish normalization);
  verified = provided email case-insensitively equals any `Person.email` of that
  client's contacts.
- Multiple name matches: verified if the email matches ANY of them; else known_unverified.

**2. Mutation `submitClientIntake(input: ClientIntakeInput!): AgentAck!`** → `{ ok: Boolean! }`
- Validates via the existing `intakeSubmitSchema` (source of truth stays in one place).
- Extends `submitIntake()` with an `opts` param (defaults preserve wizard behavior 1:1):
  - `channel: "WebChat"` on the intake Activity; body = conversationSummary
    (+ qualificationNotes appended)
  - creates a **Task** in the same transaction: title `Review web-chat intake: <legal name>`,
    `source: Other` (TaskSource has no agent/webchat value — confirmed against schema),
    unassigned, linked clientId + mandateId, body = summary + next steps
  - each `attachmentUrls[i]` → **Document** row: `type: PitchDeck` (enum confirmed),
    `accessLevel: Internal`, `fileUrl`, `createdSource: AGENT`, clientId + mandateId;
    first URL also stored as `Client.pitchDeckUrl` (existing behavior parity)
- Existing admin `notify()` (new_intake) fires as today.
- **Soft dedupe:** same legal name + contact email with a Mandate created in the last
  24h → return `{ ok: true }` without creating anything (idempotent for double calls).

**3. Mutation `logInboundClientMessage(input: LogClientMessageInput!): LogMessageAck!`**
→ `{ ok: Boolean!, verified: Boolean! }`
- Resolves Client by name (same matcher as checkCompany), verifies email.
- Verified: Activity `{type: Note (InteractionType confirmed; no Message value),
  channel: WebChat, direction: Inbound, clientId, subject: "Inbound web chat — <requestType>",
  body: messageSummary, createdSource: AGENT}` + Task
  `Follow up web-chat message from <company>` (unassigned, clientId, activityId) +
  admin notify.
- Unverified (or no client match): NO Activity on any record; Task only:
  `Unverified web-chat claim: <companyName>` with the summary in the body. Returns
  `verified: false` (ok: true either way).

No Prisma schema changes. No changes to existing mutations/queries other than adding
the `opts` parameter to `submitIntake()` (backwards-compatible; wizard call site untouched).

Smoke tests follow the existing patterns in `src/graphql/__tests__/` and
`src/server/__tests__/`.

---

## 5. Web surface: `/talk-to-us`

- `src/app/talk-to-us/page.tsx` — public (outside the `(crm)` group, like `/intake`).
  NobleStride-branded header + one-line blurb ("Tell us about your company and what
  you're raising — our team reviews every inquiry.") + **New chat** button.
- Client component hosting `<iframe srcdoc>` (Sucafina pattern — isolates LuaPop
  CSS/JS from Next.js; no dev-domain shim needed):
  - srcdoc: transparent body, `#lua-chat-embedded-root`, LuaPop UMD from
    `https://lua-ai-global.github.io/lua-pop/lua-pop.umd.js`, `LuaPop.init({...})`
  - init: `agentId: process.env.NEXT_PUBLIC_LUA_CLIENT_AGENT_ID`, `environment:
    "production"`, `displayMode: "embedded"`, `embeddedDisplayConfig:
    { targetContainerId, useContainerHeight: true, conversationStarters: [
    "We're raising capital and want NobleStride's help",
    "I'd like to tell you about our company",
    "We're an existing client with an update" ] }`,
    `attachmentsEnabled: true`, `chatTitle: "NobleStride"`, `welcomeMessage` (warm
    intro + what to expect), `chatInputPlaceholder`.
  - iframe `allow="microphone; clipboard-write"`, `class="h-full w-full border-0"`.
  - **New chat** = remount iframe (React key bump).
- NO postMessage deep-link bridge (prospects must never get CRM links; persona also
  forbids links).
- Cross-links: small "Prefer a structured form? → /intake" note on /talk-to-us, and a
  "Prefer to chat? → /talk-to-us" note on /intake.
- `.env`: add `NEXT_PUBLIC_LUA_CLIENT_AGENT_ID="baseAgent_agent_1783981692495_we70afz23"`.

---

## 6. Error handling & edge cases

- CRM down → CrmError with friendly message; persona apologizes + offers /intake.
- Attachment mechanics (how LuaPop uploads surface to the agent) verified during
  implementation via `lua test`/live chat; fallback: ask for a link. Submission never
  blocks on attachments.
- Double submit → mutation-side 24h soft dedupe + skill-side "once per conversation".
- Data pumping ("am I qualified?", "do you know X company?") → persona refuses;
  tools structurally can't return data.
- Prompt injection in prospect messages: tools only ever write; the only read returns
  a 3-value enum, so worst case is a junk intake record for human triage.

## 7. Testing & verification plan

1. **Agent unit tests** (vitest, `client_agent/`): each tool — happy path, ambiguity,
   CRM-down, minimal-ack shape (mirror `summariser_agent` test style).
2. **CRM tests** (vitest, `noblestride-crm/`): service + gating — anonymous/HUMAN
   rejected, AGENT accepted; dedupe; verified vs unverified; wizard behavior unchanged
   (submitIntake default-opts parity).
3. **Local E2E:** `lua test skill` from `client_agent/` against localhost CRM.
4. **Release** (work account only): `lua push all --force` → `lua deploy all --force`
   → `lua version create -m "..."` → `lua version promote <n>` → set production env
   vars (tunnel URL) → sanity `lua chat -e production`.
5. **Browser E2E (one pass at end, per QA convention):** cloudflared tunnel up; dev
   server up; Playwright drives `/talk-to-us`: full intake conversation → verify in
   dashboard (Client created, NewLead mandate w/ verdict, Activity, Task, admin
   notification), existing-client flow (verified + unverified), guardrail probes.
   Results + screenshots → `playwright assessment/`.
6. **Lua dashboard check** (admin.heylua.ai, work account): agent live, skill/version
   promoted, test chat.
7. **Deliverable for Shaurya:** manual end-to-end test checklist for the Lua dashboard.

## 8. Constraints

- Nothing committed (standing rule) — all work stays in the dirty working tree.
- No git push / PR / merge without explicit go-ahead.
- Don't touch other sessions' dirty files (`noblestride-crm` dashboard/widget edits,
  `summariser_agent/`, `lua_agent` deletions).
- Tunnel is short-lived and must be documented in the handover (URL changes per restart;
  re-run `lua env production -k CRM_API_URL` after restarts).
- All `lua` CLI runs from `client_agent/` (it has its own `.lua` state; needs
  `npm install` first — package.json exists).
