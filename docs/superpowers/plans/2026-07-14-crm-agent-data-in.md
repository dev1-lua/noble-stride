# crmAgent Data-In (Attributed, Confirmed CRU Writes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename summarizerAgent → crmAgent and add server-enforced, staff-attributed, preview-confirmed create/update writes to the CRM (no deletes).

**Architecture:** A delegated-actor model (agent key + verified staff email → real org role → existing RBAC), a two-phase write protocol (`agentPrepareWrite` stores a validated pending op + returns a preview; `agentCommitWrite` atomically claims and executes it via the existing service layer), and a declarative operation registry that IS the allowlist. Lua side: extended passphrase gate (staff email identify step) + a new `crm-write` skill with 4 tools.

**Tech Stack:** Next.js/Pothos GraphQL + Prisma (noblestride-crm), lua-cli TypeScript agent (crm_agent), vitest both sides.

**Spec:** `docs/superpowers/specs/2026-07-14-crm-agent-data-in-design.md` — read it before starting any task.

## Global Constraints

- **NO git commits anywhere in this plan.** Standing user rule: leave the working tree dirty; commits happen only on explicit user go-ahead. Every "commit" step in normal TDD flow is replaced by "leave changes in tree".
- Windows dev quirk: stop any running `next dev` server before `npx prisma generate`/`migrate dev` (DLL lock on query engine — see memory `noblestride-dev-quirks`).
- Pre-existing lint failures exist in noblestride-crm — do not chase lint errors you did not introduce.
- CRM repo root: `D:\LuaWork\NobleStride\noble-stride\noblestride-crm`. Agent repo root after Task 8: `D:\LuaWork\NobleStride\noble-stride\crm_agent` (formerly `summariser_agent`).
- CRM tests: `npx vitest run <file>` from the noblestride-crm dir. Agent tests: `npx vitest run <file>` from the agent dir.
- Never weaken existing guards. `assertAutomation` semantics for the existing client-agent ops must not change.
- No new npm dependencies. The generic write payload travels as a **JSON-encoded String** GraphQL arg (no JSON scalar dependency).
- All new GraphQL ops are `assertAutomation`-gated at transport, then `resolveDelegatedActor` inside.

---

### Task 1: Delegated actor — `Actor.delegated`, `isAutomation` exclusion, `resolveDelegatedActor`

**Files:**
- Modify: `noblestride-crm/src/graphql/context.ts` (Actor interface, ~L9-33)
- Modify: `noblestride-crm/src/server/rbac/enforce.ts` (isAutomation, L13-15)
- Create: `noblestride-crm/src/server/services/agent-delegation.ts`
- Test: `noblestride-crm/src/server/services/__tests__/agent-delegation.smoke.test.ts`
- Test: `noblestride-crm/src/graphql/__tests__/auth-gate.test.ts` (extend — delegated actor does not bypass RBAC)

**Interfaces:**
- Produces: `Actor.delegated?: boolean`; `resolveDelegatedActor(email: string): Promise<Actor>` (throws `CrudError` on unknown/inactive/blank email). Later tasks import from `@/server/services/agent-delegation`.

- [ ] **Step 1: Write failing tests** (DB-backed smoke, follow the setup pattern of `src/server/services/__tests__/client-intake.smoke.test.ts` — same imports, same beforeAll/afterAll DB hygiene, `ZZTest`-prefixed fixture rows):

```ts
// agent-delegation.smoke.test.ts (shape — flesh out with the repo's existing smoke-test scaffolding)
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resolveDelegatedActor } from "@/server/services/agent-delegation";
import { assertCan } from "@/server/rbac/enforce";

describe("resolveDelegatedActor", () => {
  let adminId: string, memberId: string;
  beforeAll(async () => {
    adminId = (await prisma.user.create({ data: { name: "ZZTest Admin", email: "zztest.admin@noblestride.co.ke", role: "Admin" } })).id;
    memberId = (await prisma.user.create({ data: { name: "ZZTest Member", email: "zztest.member@noblestride.co.ke", role: "TeamMember" } })).id;
    await prisma.user.create({ data: { name: "ZZTest Gone", email: "zztest.gone@noblestride.co.ke", role: "Admin", isActive: false } });
  });
  afterAll(async () => { await prisma.user.deleteMany({ where: { email: { startsWith: "zztest." } } }); });

  it("resolves an active user case-insensitively with real role", async () => {
    const actor = await resolveDelegatedActor("ZZTEST.ADMIN@noblestride.co.ke");
    expect(actor).toMatchObject({ type: "AGENT", authenticated: true, delegated: true, userId: adminId, orgRole: "Admin", accountKind: "INTERNAL" });
  });
  it("rejects unknown email", async () => { await expect(resolveDelegatedActor("zztest.nobody@x.com")).rejects.toThrow(/no active crm user/i); });
  it("rejects inactive user", async () => { await expect(resolveDelegatedActor("zztest.gone@noblestride.co.ke")).rejects.toThrow(/no active crm user/i); });
  it("rejects blank email", async () => { await expect(resolveDelegatedActor("  ")).rejects.toThrow(); });
  it("delegated actor does NOT get the automation RBAC bypass", async () => {
    const member = await resolveDelegatedActor("zztest.member@noblestride.co.ke");
    expect(() => assertCan(member, "Clients", "U")).toThrow(/not authorized/i);   // TeamMember can't update Clients
    const nonDelegated = { type: "AGENT" as const, authenticated: true };
    expect(() => assertCan(nonDelegated, "Clients", "U")).not.toThrow();          // existing bypass unchanged
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/server/services/__tests__/agent-delegation.smoke.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement.** `context.ts` — add to the `Actor` interface (with doc comment):

```ts
/** True when an automation credential (x-agent-key) acts on behalf of a resolved
 *  staff user. RBAC treats the actor as that user (no automation bypass);
 *  provenance still stamps AGENT via actorSource(). */
delegated?: boolean;
```

`enforce.ts` — change `isAutomation` only:

```ts
function isAutomation(actor: Actor): boolean {
  return actor.authenticated === true && (actor.type === "API" || actor.type === "AGENT") && actor.delegated !== true;
}
```

`agent-delegation.ts`:

```ts
// Delegation for the crmAgent write surface: the agent key authenticates the
// TRANSPORT; this resolves the human the agent acts for. RBAC then runs with
// that user's real role (spec §5.1).
import { prisma } from "@/lib/db";
import type { Actor } from "@/graphql/context";
import { CrudError } from "./crud";

export async function resolveDelegatedActor(email: string): Promise<Actor> {
  const normalized = email.trim();
  if (!normalized) throw new CrudError("actorEmail is required.");
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" }, isActive: true },
    select: { id: true, role: true, email: true },
  });
  if (!user) throw new CrudError("No active CRM user matches this email.");
  return {
    type: "AGENT", authenticated: true, delegated: true,
    userId: user.id, orgRole: user.role, accountKind: "INTERNAL",
    label: `crm-agent:${user.email}`,
  };
}
```

- [ ] **Step 4: Run tests** → all PASS. Also run the FULL existing suites touching enforce/context to prove no regression: `npx vitest run src/graphql/__tests__ src/server/__tests__ src/server/services/__tests__` — pre-existing pass/fail status must be unchanged except your new file.
- [ ] **Step 5: Leave changes in tree (NO commit).**

---

### Task 2: `resolveStaffUser` automation query

**Files:**
- Modify: `noblestride-crm/src/graphql/queries.ts` (append near `checkCompany`, ~L584)
- Modify: `noblestride-crm/src/graphql/types.ts` (objectRef near `AgentAckRef`)
- Test: `noblestride-crm/src/graphql/__tests__/schema.smoke.test.ts` (extend field list)
- Test: `noblestride-crm/src/server/services/__tests__/agent-delegation.smoke.test.ts` (extend)

**Interfaces:**
- Produces: GraphQL `resolveStaffUser(email: String!): StaffResolveResult` → `{ ok: Boolean!, firstName: String }`. Consumed by the Lua gate (Task 9).

- [ ] **Step 1: Failing test.** In schema smoke: `expect(queryFields).toContain("resolveStaffUser");`. In the delegation smoke file add a service-level test for the resolver's backing function `resolveStaffUserSummary(email)` (add it to `agent-delegation.ts`): returns `{ ok: true, firstName: "ZZTest" }` for the active admin (firstName = first word of `User.name`), `{ ok: false, firstName: null }` for unknown AND inactive (identical shape — no enumeration).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.** In `agent-delegation.ts`:

```ts
export async function resolveStaffUserSummary(email: string): Promise<{ ok: boolean; firstName: string | null }> {
  try {
    const actor = await resolveDelegatedActor(email);
    const user = await prisma.user.findUnique({ where: { id: actor.userId! }, select: { name: true } });
    return { ok: true, firstName: user?.name?.split(/\s+/)[0] ?? null };
  } catch { return { ok: false, firstName: null }; }
}
```

In `types.ts` add `StaffResolveResultRef` objectRef (`ok: Boolean!`, `firstName: String`), copying the `AgentAckRef` implement-pattern exactly. In `queries.ts` add the field with `assertAutomation(ctx.actor)` first line of resolve (mirror `checkCompany` at L586-597 exactly).
- [ ] **Step 4: Run both test files → PASS.**
- [ ] **Step 5: Leave in tree.**

---

### Task 3: Prisma — `AgentPendingWrite` + `AgentWriteStatus` + `Task.createdSource`

**Files:**
- Modify: `noblestride-crm/prisma/schema.prisma`
- Migration: `npx prisma migrate dev --name agent_write_ledger`

**Interfaces:**
- Produces: `prisma.agentPendingWrite` client; `Task.createdSource: ActorSource @default(HUMAN)`. Consumed by Tasks 5–7.

- [ ] **Step 1:** Add to schema (place near the auth models):

```prisma
enum AgentWriteStatus {
  Pending
  Committing
  Committed
  Failed
  Cancelled
}

/// Two-phase agent write: pending op + preview + audit ledger (spec §5.2).
/// Rows are never deleted — this table IS the agent-write audit trail.
model AgentPendingWrite {
  id          String           @id @default(cuid())
  operation   String
  targetId    String?
  payload     Json
  actorEmail  String
  actorUserId String
  preview     String
  status      AgentWriteStatus @default(Pending)
  error       String?
  resultId    String?
  createdAt   DateTime         @default(now())
  expiresAt   DateTime
  committedAt DateTime?

  @@index([status, expiresAt])
  @@index([actorUserId, createdAt])
}
```

And on `model Task` (L995-1024) add: `createdSource ActorSource @default(HUMAN)` (comment: `/// Provenance for agent-created tasks (spec §5.4).`).

- [ ] **Step 2:** Stop any dev server, run `npx prisma migrate dev --name agent_write_ledger` → migration applied, client regenerated. Run `npx vitest run src/server/services/__tests__/client-intake.smoke.test.ts` → still passes (schema back-compat).
- [ ] **Step 3: Leave in tree** (schema + generated migration folder).

---

### Task 4: Attribution gap fixes (tasks actor param, updateDocument actor, logEngagement provenance)

**Files:**
- Modify: `noblestride-crm/src/server/services/tasks.ts` (createTask L17, updateTask L31)
- Modify: `noblestride-crm/src/server/services/documents.ts` (updateDocument L40)
- Modify: `noblestride-crm/src/server/services/engagements.ts` (logEngagement L176, L196 — hardcoded `createdSource: "HUMAN"`)
- Modify: call sites — find with `grep -rn "createTask(\|updateTask(\|updateDocument(" src/` and keep existing behavior by passing nothing (params optional).
- Test: `noblestride-crm/src/server/__tests__/tasks-attribution.smoke.test.ts` (new)

**Interfaces:**
- Produces: `createTask(input, actor?: Actor)`, `updateTask(id, input, actor?: Actor)`, `updateDocument(id, raw, actor?: Actor)` — all default to prior behavior when actor omitted. Consumed by Task 5's registry.

- [ ] **Step 1: Failing test:** create a task via `createTask({...}, { type: "AGENT", authenticated: true, delegated: true, userId: <fixture user id> })` → row has `createdSource: "AGENT"`; omit actor → `createdSource: "HUMAN"`. For `logEngagement`: call with an AGENT actor → created Activity + Engagement rows have `createdSource: "AGENT"` (currently hardcoded HUMAN → test fails).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement:** thread `actor?: Actor` through; stamp `createdSource: actorSource(actor ?? { type: "HUMAN" })` on Task create (import `actorSource` from `./crud`); replace both hardcoded `"HUMAN"` literals in `logEngagement` with `actorSource(actor)`. `updateDocument` accepts and ignores-for-now except passing to nothing (parity only; no column) — but stamp nothing new; the param exists so the registry compiles uniformly.
- [ ] **Step 4: Run new test + existing tasks/engagements/documents suites → PASS, no regressions.**
- [ ] **Step 5: Leave in tree.**

---

### Task 5: Operation registry + preview builder

**Files:**
- Create: `noblestride-crm/src/server/services/agent-write-registry.ts`
- Create: `noblestride-crm/src/server/services/agent-write-preview.ts`
- Test: `noblestride-crm/src/server/services/__tests__/agent-write-preview.test.ts` (pure, no DB)
- Test: `noblestride-crm/src/server/services/__tests__/agent-write-registry.test.ts` (pure shape checks)

**Interfaces:**
- Produces:
```ts
// agent-write-registry.ts
export interface AgentWriteOp {
  entity: RbacEntity; perm: "C" | "U"; kind: "create" | "update";
  /** zod schema the matching UI mutation/service validates with — import the SAME one (see the service file's imports). safeParse at prepare. */
  schema: z.ZodTypeAny;
  /** fields that must not change once set — mirror service-level CrudError rules */
  lockedFields?: string[];
  /** update ops: load current record for preview/no-op/locked-field checks + own-scoped RBAC */
  loadCurrent?: (id: string) => Promise<Record<string, unknown> | null>;
  execute: (actor: Actor, targetId: string | null, payload: Record<string, unknown>) => Promise<{ id: string }>;
  href?: (id: string) => string;   // deep link, mirror globalSearch conventions
}
export const AGENT_WRITE_REGISTRY: Record<string, AgentWriteOp>;
// agent-write-preview.ts
export function buildCreatePreview(operation: string, payload: Record<string, unknown>): string;
export function buildUpdatePreview(operation: string, current: Record<string, unknown>, payload: Record<string, unknown>): { preview: string; changedKeys: string[] };
```

- [ ] **Step 1: Failing preview tests** (pure):

```ts
it("update preview lists only actually-changing fields", () => {
  const { preview, changedKeys } = buildUpdatePreview("updateMandate",
    { name: "Acme Fundraising", stage: "Qualification", dealSize: 1000000 },
    { stage: "Proposal", dealSize: 1000000 });
  expect(changedKeys).toEqual(["stage"]);
  expect(preview).toContain("stage: Qualification → Proposal");
  expect(preview).not.toContain("dealSize");
});
it("create preview lists provided fields and skips undefined", () => {
  const p = buildCreatePreview("createTask", { title: "Call Acme", dueAt: "2026-07-20", assigneeId: undefined });
  expect(p).toContain("Create task");
  expect(p).toContain("title: Call Acme");
  expect(p).not.toContain("assigneeId");
});
```

Registry shape test: every entry has entity/perm/kind/execute; `perm` is only C or U; NO entry name contains `delete`; update entries have `loadCurrent`; the registry contains exactly the operation set from spec §5.3 (assert the sorted key list).

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.** Preview builder: iterate payload keys; skip `undefined`; for updates compare against `current` with normalization (Date/Decimal → string via `String()`, arrays → `join(", ")`, dates compared on ISO date part like `sameCalendarDate`); render one `- key: old → new` line per change (creates: `- key: value`). Registry: one entry per spec §5.3 operation delegating to the existing service functions (import each from its service file; signatures per the research map — e.g.):

```ts
createClient:      { entity: "Clients", perm: "C", kind: "create", schema: clientSchema, execute: async (a, _t, p) => ({ id: (await createClient(p as never, a)).id }) },
updateClient:      { entity: "Clients", perm: "U", kind: "update", schema: clientSchema.partial(), loadCurrent: (id) => prisma.client.findUnique({ where: { id } }) as never, execute: async (a, t, p) => ({ id: (await updateClient(t!, p as never, a)).id }), href: (id) => `/clients/${id}` },
setMandateStage:   { entity: "Mandates", perm: "U", kind: "update", schema: z.object({ stage: z.nativeEnum(MandateStage) }), loadCurrent: (id) => prisma.mandate.findUnique({ where: { id } }) as never, execute: async (a, t, p) => ({ id: (await setMandateStage(t!, (p as { stage: MandateStage }).stage, a)).id }), href: (id) => `/mandates/${id}` },
updateMandate:     { ..., lockedFields: ["dateOpened", "source"], ... },
updateTransaction: { ..., lockedFields: ["dateOpened"], ... },
// ...all remaining spec §5.3 entries: createMandate, createTransaction, setTransactionStage,
// createEngagement, updateEngagement, logActivity, createInvestor, updateInvestor,
// createPerson, updatePerson, createPartner, updatePartner, createTask, updateTask,
// createDocument, updateDocument, recordMilestone, unrecordMilestone, recordOpenNda, recordClosedNda
```

IMPORTANT implementer notes: (a) import the same zod schema each service/mutation already validates with — open `src/lib/schemas/<entity>.ts` and the service file to get the exact export name; use `.partial()` for updates only if the UI's update path does; (b) `updateDocument` schema must `.omit()`/reject `accessLevel` values `InvestorShared`/`VDR` (spec §5.3 note) — add a `.superRefine` producing "Document access level changes are made in the CRM UI."; (c) hrefs mirror the paths `globalSearch` returns (check `src/server/search/global-search.ts` for the exact route strings); (d) `recordOpenNda` payload `{ investorId }` with targetId null is fine — model it as kind "update" on entity "Investors" with `loadCurrent` on investorId from payload.
- [ ] **Step 4: Run both test files → PASS. Run `npx tsc --noEmit` → no new type errors.**
- [ ] **Step 5: Leave in tree.**

---

### Task 6: `prepareAgentWrite` service

**Files:**
- Create: `noblestride-crm/src/server/services/agent-write.ts`
- Test: `noblestride-crm/src/server/services/__tests__/agent-write.smoke.test.ts` (DB-backed)

**Interfaces:**
- Produces: `prepareAgentWrite(input: { operation: string; targetId?: string | null; payloadJson: string; actorEmail: string }): Promise<{ writeToken: string; preview: string; warnings: string[] }>` — throws `CrudError` with actionable messages on every rejection.

- [ ] **Step 1: Failing tests** (fixtures: ZZTest admin/dealLead/teamMember users; one ZZTest client+mandate with `leadId` = dealLead):
  - happy path: admin prepares `updateClient` name change → row in `agentPendingWrite` with status Pending, preview contains `name: <old> → <new>`, expiresAt ≈ now+10min, actorUserId = admin id;
  - unknown operation → throws /unknown operation/i; malformed payloadJson → /invalid json/i;
  - zod failure (e.g. `createTask` without title) → throws with the zod message;
  - RBAC at prepare: teamMember + `updateClient` → /not authorized/i; dealLead + `updateMandate` on a mandate they do NOT lead → /not authorized/i (own-scoped); dealLead + `createPartner` → /not authorized/i (R-only per matrix);
  - locked field: `updateMandate` changing `dateOpened` on a mandate that has one → /cannot be changed/i (match the service's existing CrudError copy);
  - no-op: update payload equal to current values → /nothing to change/i;
  - update on missing record → /not found/i.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement:**

```ts
const PREPARE_TTL_MS = 10 * 60 * 1000;

export async function prepareAgentWrite(input: { operation: string; targetId?: string | null; payloadJson: string; actorEmail: string }) {
  const actor = await resolveDelegatedActor(input.actorEmail);
  const op = AGENT_WRITE_REGISTRY[input.operation];
  if (!op) throw new CrudError(`Unknown operation "${input.operation}".`);
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(input.payloadJson); } catch { throw new CrudError("Invalid JSON payload."); }
  const parsed = op.schema.safeParse(payload);
  if (!parsed.success) throw new CrudError(`Invalid fields: ${parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  payload = parsed.data;

  let preview: string; const warnings: string[] = [];
  if (op.kind === "update") {
    const targetId = input.targetId ?? (payload.investorId as string) ?? (payload.engagementId as string);
    if (!targetId) throw new CrudError("targetId is required for updates.");
    const current = await op.loadCurrent!(targetId);
    if (!current) throw new CrudError("Record not found.");
    // RBAC with the record for own-scoping:
    await assertCanUpdateOwnScoped(actor, op.entity, async () => current as never);
    for (const f of op.lockedFields ?? []) {
      if (payload[f] !== undefined && current[f] != null && String(payload[f]) !== String(current[f]))
        throw new CrudError(`${f} cannot be changed once set.`);
    }
    const built = buildUpdatePreview(input.operation, current, payload);
    if (built.changedKeys.length === 0) throw new CrudError("Nothing to change — the record already has these values.");
    preview = built.preview;
  } else {
    assertCan(actor, op.entity, "C");
    preview = buildCreatePreview(input.operation, payload);
  }
  const row = await prisma.agentPendingWrite.create({ data: {
    operation: input.operation, targetId: input.targetId ?? null, payload: payload as never,
    actorEmail: input.actorEmail.trim(), actorUserId: actor.userId!, preview,
    expiresAt: new Date(Date.now() + PREPARE_TTL_MS),
  }});
  return { writeToken: row.id, preview, warnings };
}
```

(Implementer: for lockedFields date values compare with `sameCalendarDate` from `crud.ts` when both sides are dates, mirroring `mandates.ts` L150-155.)
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Leave in tree.**

---

### Task 7: `commitAgentWrite` + `cancelAgentWrite` + the three GraphQL mutations

**Files:**
- Modify: `noblestride-crm/src/server/services/agent-write.ts`
- Modify: `noblestride-crm/src/graphql/mutations.ts` (append in the Client-Agent section, after L630)
- Modify: `noblestride-crm/src/graphql/types.ts` (objectRefs: `AgentWritePreviewRef { writeToken, preview, warnings }`, `AgentWriteResultRef { ok, summary, recordId, href }`)
- Test: extend `agent-write.smoke.test.ts`; extend `src/graphql/__tests__/schema.smoke.test.ts` (mutation names present; count bump)

**Interfaces:**
- Produces: `commitAgentWrite(writeToken: string, actorEmail: string): Promise<{ ok: true; summary: string; recordId: string; href: string | null }>`; `cancelAgentWrite(writeToken, actorEmail): Promise<{ ok: true }>`; GraphQL `agentPrepareWrite(operation: String!, targetId: String, payloadJson: String!, actorEmail: String!)`, `agentCommitWrite(writeToken: String!, actorEmail: String!)`, `agentCancelWrite(writeToken: String!, actorEmail: String!)`.

- [ ] **Step 1: Failing tests:**
  - commit happy path: prepare updateClient → commit → client row updated, ledger row `status: "Committed"`, `resultId` set, StageChange row exists for the name change with `changedById` = actor user id and `createdSource: "AGENT"`;
  - replay: second commit of same token → /already processed|expired|cancelled/i, record not double-updated;
  - expiry: prepare, then `prisma.agentPendingWrite.update({ data: { expiresAt: new Date(Date.now() - 1000) } })`, commit → rejection, status still Pending;
  - cross-user: prepare as admin, commit with dealLead email → /this change was prepared by/i;
  - service failure surfaces: prepare a `setMandateStage` then delete the mandate row → commit → ledger `status: "Failed"` with `error` set, and the CrudError propagates;
  - cancel: Pending → Cancelled; committing a cancelled token rejects;
  - schema smoke: `agentPrepareWrite/agentCommitWrite/agentCancelWrite` in mutationFields; still NO `agentDelete*` anything.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement:**

```ts
export async function commitAgentWrite(writeToken: string, actorEmail: string) {
  const actor = await resolveDelegatedActor(actorEmail);
  const claimed = await prisma.agentPendingWrite.updateMany({
    where: { id: writeToken, status: "Pending", expiresAt: { gt: new Date() } },
    data: { status: "Committing" },
  });
  if (claimed.count === 0) throw new CrudError("This change is expired, already processed, or cancelled — please propose it again.");
  const row = (await prisma.agentPendingWrite.findUnique({ where: { id: writeToken } }))!;
  if (row.actorUserId !== actor.userId) {
    await prisma.agentPendingWrite.update({ where: { id: writeToken }, data: { status: "Pending" } }); // release claim
    throw new CrudError("This change was prepared by a different user.");
  }
  const op = AGENT_WRITE_REGISTRY[row.operation];
  try {
    const result = await op.execute(actor, row.targetId, row.payload as Record<string, unknown>);
    await prisma.agentPendingWrite.update({ where: { id: writeToken }, data: { status: "Committed", resultId: result.id, committedAt: new Date() } });
    return { ok: true as const, summary: `Done — ${row.operation} applied.`, recordId: result.id, href: op.href ? op.href(result.id) : null };
  } catch (err) {
    await prisma.agentPendingWrite.update({ where: { id: writeToken }, data: { status: "Failed", error: err instanceof Error ? err.message : String(err) } });
    throw err;
  }
}

export async function cancelAgentWrite(writeToken: string, actorEmail: string) {
  const actor = await resolveDelegatedActor(actorEmail);
  const n = await prisma.agentPendingWrite.updateMany({ where: { id: writeToken, status: "Pending", actorUserId: actor.userId! }, data: { status: "Cancelled" } });
  if (n.count === 0) throw new CrudError("No pending change to cancel.");
  return { ok: true as const };
}
```

Mutations: copy the `submitClientIntake` resolver structure exactly — `assertAutomation(ctx.actor)` then delegate; comment block `// ── crmAgent write surface (spec 2026-07-14) — automation transport + delegated RBAC ──`.
- [ ] **Step 4: Run all new tests + schema smoke + `npx tsc --noEmit` → PASS.**
- [ ] **Step 5: Leave in tree.**

---

### Task 8: Rename `summariser_agent/` → `crm_agent/` + agent identity

**Files:**
- Rename dir: `summariser_agent` → `crm_agent` (plain `mv`; git will detect the rename at commit time later)
- Modify: `crm_agent/src/index.ts` (name + persona), `crm_agent/package.json` (`"name": "crm-agent"`), `crm_agent/README.md` + `QUICKSTART.md` headings
- Modify: `noblestride-crm/src/components/shell/lua-pop-widget.tsx` (chatTitle → "NobleStride CRM Assistant")
- DO NOT touch: `crm_agent/lua.skill.yaml` ids (agentId/skillId/jobId/preprocessorId pins stay), `.lua/backup-manifest.json`, `dist-v2/` (stale build output; regenerates on next push)

**Interfaces:**
- Produces: `new LuaAgent({ name: "crmAgent", ... })`; persona titled "NobleStride CRM Assistant". Tasks 9–10 work inside `crm_agent/`.

- [ ] **Step 1:** `mv summariser_agent crm_agent` from repo root.
- [ ] **Step 2:** In `src/index.ts`: `name: "crmAgent"`; persona heading `# NobleStride CRM Assistant`; under **Capabilities** add: `- Create and update CRM records on a staff member's instruction — always proposing the exact change and waiting for their confirmation first.`; under **Boundaries** replace the read-only line with: `- Writes happen ONLY through the propose→confirm tools, attributed to the verified staff member. You never delete records — deletions are done in the CRM UI. You never change qualification verdicts, onboarding/greylist status, grant document or VDR access, or send anything to an external party.`
- [ ] **Step 3:** Update widget chatTitle in `lua-pop-widget.tsx`.
- [ ] **Step 4:** From `crm_agent/`: `npx vitest run` → full existing suite passes unchanged; `npx tsc --noEmit` clean.
- [ ] **Step 5: Leave in tree.**

---

### Task 9: Staff-identify gate (passphrase gate v2)

**Files:**
- Modify: `crm_agent/src/processors/passphrase-gate.ts`
- Modify: `crm_agent/src/lib/queries.ts` (add `RESOLVE_STAFF_USER`)
- Test: `crm_agent/src/processors/__tests__/passphrase-gate.test.ts` (extend)

**Interfaces:**
- Consumes: GraphQL `resolveStaffUser` (Task 2).
- Produces: `gateDecision(state: { verified: boolean; staffEmail?: string }, lastText: string | undefined, passphrase: string | undefined): "proceed" | "verify" | "challenge" | "unconfigured" | "ask_email" | "try_identify"`; on successful identify, `user.data` gains `{ staffEmail, staffName }`. Task 10's tools read `user.data.staffEmail`.

- [ ] **Step 1: Failing tests** (pure `gateDecision` + execute-level with fake crm/user):
  - verified + staffEmail → proceed;
  - verified + no staffEmail + non-email text → ask_email; + email-looking text → try_identify;
  - passphrase states unchanged (regression: all existing cases still pass);
  - execute: try_identify with fake crm returning `{ok:true, firstName:"Evans"}` → `user.update({ staffEmail, staffName })` called, block-response contains "Evans"; `{ok:false}` → block-response contains /doesn't match an active CRM user/i and no update;
  - crm transport failure → block-response /can't verify right now/i.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.** Email detection: `/^\S+@\S+\.\S+$/` on trimmed lastText. New copy:
  - ASK_EMAIL: `"✅ Passphrase accepted. To act on your behalf in the CRM I need your CRM email — what is it?"`
  - IDENTIFY_OK: `` `✅ Thanks ${firstName} — you're set. Ask me for summaries, digests, or tell me what to update in the CRM.` ``
  - IDENTIFY_FAIL: `"That email doesn't match an active CRM user — please check the spelling (it must be your CRM login email)."`
  - IDENTIFY_ERROR: `"I can't verify your email right now — please try again shortly."`
  The CRM call uses `crmClientFromEnv()` + `RESOLVE_STAFF_USER` (`query($email: String!) { resolveStaffUser(email: $email) { ok firstName } }`). Keep the staff_users Data-collection registration exactly as-is (it feeds the weekly digest).
- [ ] **Step 4: Run → PASS (all old + new).**
- [ ] **Step 5: Leave in tree.**

---

### Task 10: `crm-write` skill + 4 tools

**Files:**
- Create: `crm_agent/src/skills/write.skill.ts`
- Create: `crm_agent/src/skills/tools/LookupRecordTool.ts`, `ProposeChangeTool.ts`, `CommitChangeTool.ts`, `CancelChangeTool.ts`
- Modify: `crm_agent/src/lib/queries.ts` (AGENT_PREPARE_WRITE / AGENT_COMMIT_WRITE / AGENT_CANCEL_WRITE documents)
- Modify: `crm_agent/src/index.ts` (`skills: [summarySkill, writeSkill]`)
- Test: `crm_agent/src/skills/tools/__tests__/write-tools.test.ts`

**Interfaces:**
- Consumes: Task 7 mutations; `resolveRecord`/`GLOBAL_SEARCH` from `lib/resolve.ts`/`lib/queries.ts`; lua-cli `User.get()` → `user.data.staffEmail`.
- Produces: tools `lookup_record(recordType, query)`, `propose_change(operation, targetId?, fields)`, `commit_change(writeToken)`, `cancel_change(writeToken)`.

- [ ] **Step 1: Failing tests** (inject fake crm + fake user-getter dep `{ getUser: () => Promise<{ staffEmail?: string }> }`):
  - lookup: match/ambiguous/none (reuse resolve.ts semantics — same cases as SummarizeRecordTool tests);
  - propose happy: sends `payloadJson: JSON.stringify(fields)` + actorEmail from deps; returns `{ status: "preview", writeToken, preview, warnings }`;
  - propose with CRM "rejected" error → `{ status: "rejected", message }` (SubmitIntakeTool pattern — startsWith "The CRM rejected", not "Unexpected error"); transport error rethrows;
  - propose with no staffEmail → `{ status: "not_identified", message }` and NO crm call;
  - commit happy → `{ status: "ok", summary, link }` (link = crm.baseUrl + href when href non-null); commit rejected → `{ status: "rejected", message }`;
  - cancel happy → `{ status: "ok" }`.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.** Tool skeleton (all four follow this; deps injectable like every existing tool):

```ts
const OPERATIONS = ["createClient","updateClient","createMandate","updateMandate","setMandateStage","createTransaction","updateTransaction","setTransactionStage","createEngagement","updateEngagement","logActivity","createInvestor","updateInvestor","createPerson","updatePerson","createPartner","updatePartner","createTask","updateTask","createDocument","updateDocument","recordMilestone","unrecordMilestone","recordOpenNda","recordClosedNda"] as const;

const inputSchema = z.object({
  operation: z.enum(OPERATIONS).describe("What to do — create<Entity>, update<Entity>, set<Entity>Stage, logActivity, record/unrecordMilestone, recordOpen/ClosedNda"),
  targetId: z.string().optional().describe("Record id from lookup_record — REQUIRED for updates, omit for creates"),
  fields: z.record(z.unknown()).describe("The fields to set, exactly as the user stated them"),
});

export class ProposeChangeTool implements LuaTool {
  name = "propose_change";
  description = "Prepare a CRM change and get back a human-readable preview + writeToken. NEVER commits anything. Show the preview to the user verbatim and ask them to confirm before calling commit_change.";
  inputSchema = inputSchema;
  constructor(private deps?: { crm: CrmClient; getUser: () => Promise<{ staffEmail?: string } | undefined> }) {}
  private async staffEmail(): Promise<string | undefined> {
    if (this.deps) return (await this.deps.getUser())?.staffEmail;
    const u = await User.get();                       // lua-cli
    return (u?.data as { staffEmail?: string } | undefined)?.staffEmail;
  }
  async execute(input: z.infer<typeof inputSchema>) {
    const email = await this.staffEmail();
    if (!email) return { status: "not_identified" as const, message: "The user must complete staff verification (CRM email) before any change." };
    const crm = this.deps?.crm ?? crmClientFromEnv();
    try {
      const data = await crm.query<{ agentPrepareWrite: { writeToken: string; preview: string; warnings: string[] } }>(AGENT_PREPARE_WRITE, {
        operation: input.operation, targetId: input.targetId ?? null, payloadJson: JSON.stringify(input.fields), actorEmail: email,
      });
      return { status: "preview" as const, ...data.agentPrepareWrite };
    } catch (err) {
      if (err instanceof CrmError && err.message.startsWith("The CRM rejected") && !err.message.includes("Unexpected error"))
        return { status: "rejected" as const, message: err.message };
      throw err;
    }
  }
}
```

`LookupRecordTool` = SummarizeRecordTool's search/resolve stage only (returns `{status, id?, title?, candidates?}` — copy its test semantics). `CommitChangeTool`/`CancelChangeTool` mirror propose (email from user.data, rejected-pattern handling); commit returns `{ status: "ok", summary, link: href ? crm.baseUrl + href : null }`.

Skill context (`write.skill.ts`) — the behavioral contract:

```
This skill makes CRM changes for VERIFIED STAFF ONLY, on their explicit instruction.
- Always lookup_record first when the user names a record; on "ambiguous" ask them to pick; never guess ids and never display raw ids.
- Flow per change: propose_change → show the returned preview VERBATIM → ask "Shall I apply this?" → only on an explicit yes call commit_change. Anything other than a clear yes: ask, revise (new propose_change), or cancel_change.
- One pending change at a time. For multi-part requests, do them one after another, each with its own preview + confirmation.
- Never delete anything — deletions happen in the CRM UI. Never change qualification, onboarding/greylist status, document access levels, or send anything to external parties; these are human-UI actions.
- If propose/commit returns status "rejected", read the message, fix the field with the user, and propose again. If the CRM is unreachable, say so — never pretend a change was made.
- After a successful commit, relay the summary and the link.
```

- [ ] **Step 4: Run → PASS. `npx tsc --noEmit` clean. Full `npx vitest run` in crm_agent → all green.**
- [ ] **Step 5: Leave in tree.**

---

### Task 11: End-to-end smoke script

**Files:**
- Create: `crm_agent/scripts/write-smoke.ts` (mirror `client_agent/scripts/smoke.ts` structure)

**Interfaces:** Consumes everything above against a RUNNING local CRM (`npm run dev` in noblestride-crm) with `CRM_API_URL=http://localhost:3000/api/graphql` + the dev `AGENT_API_KEY`.

- [ ] **Step 1:** Script drives: `resolveStaffUser` (real admin email from the seeded DB — look one up via prisma studio or the seed file) → `agentPrepareWrite` createTask `{title: "ZZTest agent smoke task"}` → `agentCommitWrite` → verify via a read query the task exists → `agentPrepareWrite` updateTask title change → commit → prepare + CANCEL a second change → attempt commit of the cancelled token (expect rejection) → prepare with a TeamMember email on updateClient (expect not-authorized at prepare). Print PASS/FAIL per step, exit non-zero on failure.
- [ ] **Step 2:** Run it; all steps PASS. Record output for the verification log (Task 8 of the run — final Playwright pass happens after BOTH plans complete, per user preference `playwright-verify-at-end`).
- [ ] **Step 3: Leave in tree.**

---

## Self-Review (done at plan-writing time)

- **Spec coverage:** §5.1→Task 1-2; §5.2→Tasks 3,6,7; §5.3→Task 5; §5.4→Task 4; §5.5→Tasks 2,7; §6.1→Task 8; §6.2→Task 9; §6.3/6.4→Task 10; §7→tests in every task + Task 11. Gaps: none.
- **Placeholders:** registry entry list is enumerated (not "etc."); schema-name lookups are explicit implementer instructions with file locations, not TBDs.
- **Type consistency:** `payloadJson: String!` used consistently (GraphQL arg, service param, tool JSON.stringify); `writeToken` = `AgentPendingWrite.id` everywhere; `resolveDelegatedActor` signature identical across Tasks 1/2/6/7.
