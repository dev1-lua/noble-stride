# NobleStride Summary Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An internal-only Lua-platform agent that summarizes CRM records on demand and delivers a weekly pipeline digest, reading the deployed CRM exclusively over GraphQL.

**Architecture:** Two codebases in one worktree. The CRM gains an `x-agent-key` service identity + a 401 auth gate on `/api/graphql` (closing the currently-open endpoint) and a LuaPop widget in the staff shell. The Lua agent (`lua_agent/`) gets two tools (`summarize_record`, `pipeline_digest`) built on a small injectable GraphQL client, pure prompt/digest logic (unit-tested with vitest), a passphrase preprocessor gate, and a Monday-9AM-Nairobi cron job.

**Tech Stack:** Next.js 15 App Router + Pothos/GraphQL Yoga + Prisma + vitest (CRM); lua-cli 3.18.0 + zod + tsx + vitest (agent).

**Spec:** `docs/superpowers/specs/2026-07-13-lua-summary-agent-design.md` (approved).

## Global Constraints

- Work happens ONLY in the worktree `D:/LuaWork/NobleStride/noble-stride-lua-agent`, branch `feat/lua-summary-agent`. Commits on this branch are authorized. NEVER push to origin or upstream.
- GraphQL-only: every piece of CRM data the agent reads goes through `/api/graphql`. No REST, no direct DB. Missing fields get added to the Pothos schema, never bypassed.
- `lua_agent/lua.skill.yaml` is machine-managed — never hand-edit anything except the `version` field, and this plan does not require touching it.
- Never commit `.env` files or real secret values. `.env.example` gets placeholder values only.
- lua-cli version is **3.18.0**; all imports come from the package root: `import { LuaAgent, LuaSkill, LuaJob, PreProcessor, Data, AI, User, Channels, env } from "lua-cli"`. The verbatim type signatures cited in tasks below come from `lua_agent/node_modules/lua-cli/dist/api-exports.d.ts` — trust them over docs.
- `lua_agent/tsconfig.json` uses `moduleResolution: "bundler"` — relative imports are extensionless (`./lib/crm-client`).
- Digest schedule is exactly `{ type: "cron", expression: "0 9 * * 1", timezone: "Africa/Nairobi" }` (9 AM Monday, NobleStride's home timezone — do not change).
- Agent model stays `anthropic/claude-sonnet-5`. Agent name stays `summarizerAgent` (registered with the Lua platform at init).
- Env var names (fixed by spec): CRM side `AGENT_API_KEY`, `NEXT_PUBLIC_LUA_AGENT_ID`; Lua side `CRM_API_URL`, `CRM_AGENT_KEY`, `TEAM_PASSPHRASE`.
- `lua push` / `lua deploy` / `lua env` / `lua chat` are interactive and authenticated as the user — they are listed as a user-assisted checklist in Task 13, never run by an implementer.
- Windows note: if `npx prisma generate` fails with EPERM rename on the query-engine DLL, stop running node/dev-server processes and retry (known quirk).

---

### Task 0: Worktree environment setup

The worktree is a fresh checkout: `noblestride-crm/` has no `node_modules` and no `.env`. `lua_agent/node_modules` already exists (it was moved in with the folder).

**Files:**
- Create: `noblestride-crm/.env` (copied, never committed)

- [ ] **Step 1: Install CRM dependencies and generate Prisma client**

Run (from `D:/LuaWork/NobleStride/noble-stride-lua-agent`):
```bash
cd noblestride-crm && npm install && npx prisma generate
```
Expected: install completes; `prisma generate` prints "Generated Prisma Client". (EPERM on the DLL → kill node processes, retry.)

- [ ] **Step 2: Copy local env from the main tree and add the agent key**

```bash
cp ../noble-stride/noblestride-crm/.env noblestride-crm/.env
echo 'AGENT_API_KEY="dev-agent-key-change-me"' >> noblestride-crm/.env
echo 'NEXT_PUBLIC_LUA_AGENT_ID=""' >> noblestride-crm/.env
```
Expected: `noblestride-crm/.env` exists with `DATABASE_URL` plus the two new lines. `git status` must NOT show it (gitignored).

- [ ] **Step 3: Sanity-check the existing test suite runs**

```bash
cd noblestride-crm && npx vitest run src/server/__tests__/metrics.test.ts
```
Expected: PASS (pure unit test, no DB needed). No commit for this task.

---

### Task 1: CRM — `x-agent-key` service identity in the GraphQL context

**Files:**
- Modify: `noblestride-crm/src/graphql/context.ts` (the `createContext` function, currently ~line 60)
- Modify: `noblestride-crm/.env.example` (append)
- Test: `noblestride-crm/src/graphql/__tests__/agent-context.test.ts`

**Interfaces:**
- Consumes: existing `Actor` interface in `context.ts` (`type: "HUMAN" | "AGENT" | "API"`, `authenticated?: boolean`, `label?: string`). `enforce.ts` already grants authenticated `AGENT` actors automation access — no RBAC change needed.
- Produces: a request with header `x-agent-key === process.env.AGENT_API_KEY` yields `{ type: "AGENT", authenticated: true, label: "lua-summary-agent" }`. Task 2's gate and the Lua-side client (Tasks 5+) rely on this exact header name.

- [ ] **Step 1: Write the failing test**

Create `noblestride-crm/src/graphql/__tests__/agent-context.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { createContext } from "@/graphql/context";

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/graphql", { method: "POST", headers });
}

describe("createContext x-agent-key", () => {
  beforeEach(() => {
    process.env.AGENT_API_KEY = "test-agent-key-123";
  });

  it("valid key yields an authenticated AGENT actor", async () => {
    const ctx = await createContext(req({ "x-agent-key": "test-agent-key-123" }));
    expect(ctx.actor).toMatchObject({ type: "AGENT", authenticated: true, label: "lua-summary-agent" });
  });

  it("wrong key yields an unauthenticated actor", async () => {
    const ctx = await createContext(req({ "x-agent-key": "wrong" }));
    expect(ctx.actor.authenticated).toBe(false);
  });

  it("header present but AGENT_API_KEY unset yields unauthenticated (fail closed)", async () => {
    delete process.env.AGENT_API_KEY;
    const ctx = await createContext(req({ "x-agent-key": "test-agent-key-123" }));
    expect(ctx.actor.authenticated).toBe(false);
  });

  it("no header keeps existing anonymous behavior", async () => {
    const ctx = await createContext(req({}));
    expect(ctx.actor).toMatchObject({ type: "HUMAN", authenticated: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd noblestride-crm && npx vitest run src/graphql/__tests__/agent-context.test.ts
```
Expected: FAIL — first two tests fail (actor is `{ type: "HUMAN", authenticated: false }`).

- [ ] **Step 3: Implement the key check in `createContext`**

In `noblestride-crm/src/graphql/context.ts`, add at the top with the other imports:

```ts
import { timingSafeEqual } from "node:crypto";
```

Add above `createContext`:

```ts
/** Constant-time compare of the x-agent-key header against AGENT_API_KEY. Fail closed when unset. */
function agentKeyMatches(provided: string): boolean {
  const expected = process.env.AGENT_API_KEY;
  if (!expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

Inside `createContext`, as the FIRST check (before the Bearer branch):

```ts
  const agentKey = request.headers.get("x-agent-key");
  if (agentKey !== null) {
    if (agentKeyMatches(agentKey)) {
      return { prisma, actor: { type: "AGENT", authenticated: true, label: "lua-summary-agent" } };
    }
    return { prisma, actor: { type: "AGENT", authenticated: false } };
  }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd noblestride-crm && npx vitest run src/graphql/__tests__/agent-context.test.ts
```
Expected: PASS (4/4).

- [ ] **Step 5: Append env documentation**

Append to `noblestride-crm/.env.example`:

```
# Lua summary agent — service key for /api/graphql (header: x-agent-key)
AGENT_API_KEY="dev-agent-key-change-me"
```

- [ ] **Step 6: Commit**

```bash
git add noblestride-crm/src/graphql/context.ts noblestride-crm/src/graphql/__tests__/agent-context.test.ts noblestride-crm/.env.example
git commit -m "feat(graphql): x-agent-key service identity for the Lua summary agent"
```

---

### Task 2: CRM — auth gate: 401 for anonymous data operations

Closes the security hole: today anonymous requests can read all data. After this task: authenticated actors (session, Bearer, agent key) proceed; anonymous requests may ONLY run pure-introspection queries; everything else gets HTTP 401.

**Files:**
- Create: `noblestride-crm/src/graphql/auth-gate.ts`
- Modify: `noblestride-crm/src/app/api/graphql/route.ts`
- Modify: `noblestride-crm/src/graphql/mask-error.ts` (pass-through for the 401 error)
- Test: `noblestride-crm/src/graphql/__tests__/auth-gate.test.ts`

**Interfaces:**
- Consumes: `GraphQLContext` from Task 1 (`ctx.actor.authenticated`).
- Produces: `useAuthGate(): Plugin` (graphql-yoga plugin) and `isIntrospectionOnly(document: DocumentNode, operationName?: string | null): boolean`. The Lua agent (Task 5+) relies on: valid `x-agent-key` → data queries work; no key → 401.

- [ ] **Step 1: Write the failing tests**

Create `noblestride-crm/src/graphql/__tests__/auth-gate.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { parse } from "graphql";
import { isIntrospectionOnly } from "@/graphql/auth-gate";
import { POST } from "@/app/api/graphql/route";

async function gql(body: object, headers: Record<string, string> = {}): Promise<Response> {
  return POST(
    new Request("http://localhost/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

describe("isIntrospectionOnly", () => {
  it("true for __schema-only queries", () => {
    expect(isIntrospectionOnly(parse("{ __schema { queryType { name } } }"))).toBe(true);
    expect(isIntrospectionOnly(parse("{ __typename }"))).toBe(true);
  });
  it("false when any data field is selected", () => {
    expect(isIntrospectionOnly(parse("{ __typename clients { id } }"))).toBe(false);
    expect(isIntrospectionOnly(parse("{ clients { id } }"))).toBe(false);
  });
  it("false for mutations", () => {
    expect(isIntrospectionOnly(parse("mutation { __typename }"))).toBe(false);
  });
});

describe("auth gate (integration via yoga handler)", () => {
  beforeAll(() => {
    process.env.AGENT_API_KEY = "test-agent-key-123";
  });

  it("anonymous data query is rejected with 401", async () => {
    const res = await gql({ query: "{ clients { id } }" });
    expect(res.status).toBe(401);
  });

  it("anonymous introspection is allowed", async () => {
    const res = await gql({ query: "{ __schema { queryType { name } } }" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.__schema.queryType.name).toBe("Query");
  });

  it("x-agent-key request passes the gate (never 401)", async () => {
    const res = await gql(
      { query: "{ pipelineOverview { mandatesByStage { stage count } } }" },
      { "x-agent-key": "test-agent-key-123" },
    );
    // DB may be unavailable in CI — the assertion is only that AUTH passed.
    expect(res.status).not.toBe(401);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd noblestride-crm && npx vitest run src/graphql/__tests__/auth-gate.test.ts
```
Expected: FAIL — `auth-gate` module does not exist.

- [ ] **Step 3: Implement the gate plugin**

Create `noblestride-crm/src/graphql/auth-gate.ts`:

```ts
// Authentication gate for /api/graphql. Anonymous requests may only run
// pure-introspection queries (schema shape, not data). Everything else
// requires an authenticated actor: session cookie, Bearer JWT, or the
// Lua summary agent's x-agent-key (see context.ts).
import { GraphQLError, Kind, type DocumentNode } from "graphql";
import type { Plugin } from "graphql-yoga";
import type { GraphQLContext } from "./context";

export function isIntrospectionOnly(document: DocumentNode, operationName?: string | null): boolean {
  const ops = document.definitions.filter((d) => d.kind === Kind.OPERATION_DEFINITION);
  const op = operationName ? ops.find((o) => o.name?.value === operationName) : ops[0];
  if (!op || op.operation !== "query") return false;
  return op.selectionSet.selections.every(
    (sel) => sel.kind === Kind.FIELD && sel.name.value.startsWith("__"),
  );
}

export const UNAUTHENTICATED_CODE = "UNAUTHENTICATED";

export function useAuthGate(): Plugin {
  return {
    onExecute({ args }) {
      const ctx = args.contextValue as GraphQLContext;
      if (ctx.actor?.authenticated) return;
      if (isIntrospectionOnly(args.document, args.operationName)) return;
      throw new GraphQLError("Unauthorized: authentication required", {
        extensions: { code: UNAUTHENTICATED_CODE, http: { status: 401 } },
      });
    },
  };
}
```

In `noblestride-crm/src/app/api/graphql/route.ts`, import and register the plugin:

```ts
import { useAuthGate } from "@/graphql/auth-gate";
```

and in the `createYoga({ ... })` options add:

```ts
  plugins: [useAuthGate()],
```

- [ ] **Step 4: Let the 401 error through the error mask**

Read `noblestride-crm/src/graphql/mask-error.ts`. At the START of the `maskDomainError` function body, add a pass-through so the gate's error keeps its message, code, and 401 status:

```ts
  if (error instanceof GraphQLError && error.extensions?.code === "UNAUTHENTICATED") {
    return error;
  }
```

(Add `import { GraphQLError } from "graphql";` if not already imported. If the function already surfaces `GraphQLError`s unmasked, this step is a no-op — verify with the test.)

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd noblestride-crm && npx vitest run src/graphql/__tests__/auth-gate.test.ts
```
Expected: PASS (6/6). If "anonymous data query" gets 200: the plugin isn't registered — recheck route.ts. If it gets 500: the mask is eating the error — recheck Step 4.

- [ ] **Step 6: Run the full CRM suite to catch regressions**

```bash
cd noblestride-crm && npm test
```
Expected: all green (DB-dependent smoke tests self-skip without a reachable DB). The urql UI keeps working because session-cookie requests are authenticated and unaffected.

- [ ] **Step 7: Commit**

```bash
git add noblestride-crm/src/graphql/auth-gate.ts noblestride-crm/src/app/api/graphql/route.ts noblestride-crm/src/graphql/mask-error.ts noblestride-crm/src/graphql/__tests__/auth-gate.test.ts
git commit -m "feat(graphql): 401 auth gate on /api/graphql — closes anonymous data access"
```

---

### Task 3: CRM — expose `Engagement.milestones` in the GraphQL schema

The spec's record summaries include engagement milestones; the Prisma relation exists (`Engagement.milestones → EngagementMilestone[]`, schema.prisma line 861) and `EngagementMilestoneRef` is already defined in types.ts (~line 568), but no relation field is exposed on `EngagementRef`.

**Files:**
- Modify: `noblestride-crm/src/graphql/types.ts` (EngagementRef, ~lines 362–397)
- Test: `noblestride-crm/src/graphql/__tests__/engagement-milestones.test.ts`

**Interfaces:**
- Produces: GraphQL field `Engagement.milestones: [EngagementMilestone]` with subfields `id, engagementId, key, completedAt, notes`. Task 6's `ENGAGEMENT_DETAIL` query selects `milestones { key completedAt notes }`.

- [ ] **Step 1: Write the failing test**

Create `noblestride-crm/src/graphql/__tests__/engagement-milestones.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { GraphQLObjectType } from "graphql";
import { schema } from "@/graphql/schema";

describe("Engagement.milestones exposure", () => {
  it("Engagement type exposes a milestones field", () => {
    const engagement = schema.getType("Engagement") as GraphQLObjectType;
    expect(Object.keys(engagement.getFields())).toContain("milestones");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd noblestride-crm && npx vitest run src/graphql/__tests__/engagement-milestones.test.ts
```
Expected: FAIL — "milestones" not in field list.

- [ ] **Step 3: Expose the relation**

In `noblestride-crm/src/graphql/types.ts`, inside `EngagementRef`'s `fields`, next to the existing `activities: t.relation("activities"),` line add:

```ts
    milestones: t.relation("milestones"),
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd noblestride-crm && npx vitest run src/graphql/__tests__/engagement-milestones.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add noblestride-crm/src/graphql/types.ts noblestride-crm/src/graphql/__tests__/engagement-milestones.test.ts
git commit -m "feat(graphql): expose Engagement.milestones relation"
```

---

### Task 4: CRM — LuaPop widget in the staff shell

**Files:**
- Create: `noblestride-crm/src/components/shell/lua-pop-widget.tsx`
- Modify: `noblestride-crm/src/app/(crm)/layout.tsx`
- Modify: `noblestride-crm/.env.example` (append)

**Interfaces:**
- Consumes: `NEXT_PUBLIC_LUA_AGENT_ID` env var (Next.js inlines `NEXT_PUBLIC_*` at build). Widget renders ONLY inside the `(crm)` layout, which already redirects unauthenticated visitors to `/login` server-side — so only logged-in internal staff ever see it.
- Produces: floating chat button bottom-right on every `(crm)/*` page when the env var is set; nothing rendered when unset (safe default for all other devs).

- [ ] **Step 1: Create the client component**

Create `noblestride-crm/src/components/shell/lua-pop-widget.tsx`:

```tsx
"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    LuaPop?: { init: (config: Record<string, unknown>) => void };
  }
}

const SCRIPT_SRC = "https://lua-ai-global.github.io/lua-pop/lua-pop.umd.js";

/**
 * Lua chat widget (summary agent). Rendered only inside the authenticated
 * (crm) shell — the layout redirects anonymous visitors before this mounts.
 */
export function LuaPopWidget({ agentId }: { agentId: string }) {
  useEffect(() => {
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      window.LuaPop?.init({
        agentId,
        position: "bottom-right",
        chatTitle: "NobleStride Assistant",
      });
    };
    document.body.appendChild(script);
  }, [agentId]);
  return null;
}
```

- [ ] **Step 2: Render it from the (crm) layout**

In `noblestride-crm/src/app/(crm)/layout.tsx`: add the import

```tsx
import { LuaPopWidget } from "@/components/shell/lua-pop-widget";
```

and inside the returned root `<div className="flex h-screen ...">` (as the last child, after the content column) add:

```tsx
      {process.env.NEXT_PUBLIC_LUA_AGENT_ID ? (
        <LuaPopWidget agentId={process.env.NEXT_PUBLIC_LUA_AGENT_ID} />
      ) : null}
```

- [ ] **Step 3: Append env documentation**

Append to `noblestride-crm/.env.example`:

```
# Lua chat widget (summary agent) — unset disables the widget entirely
NEXT_PUBLIC_LUA_AGENT_ID=""
```

- [ ] **Step 4: Verify no regressions and the file typechecks**

```bash
cd noblestride-crm && npm test
```
Expected: all green. (Visual verification is the single Playwright pass in Task 13 — do not run it per-task.)

- [ ] **Step 5: Commit**

```bash
git add noblestride-crm/src/components/shell/lua-pop-widget.tsx "noblestride-crm/src/app/(crm)/layout.tsx" noblestride-crm/.env.example
git commit -m "feat(shell): LuaPop summary-agent widget in the staff shell (env-gated)"
```

---

### Task 5: Agent — vitest setup + GraphQL client (`crm-client.ts`)

**Files:**
- Modify: `lua_agent/package.json` (devDep + test script)
- Create: `lua_agent/vitest.config.ts`
- Create: `lua_agent/src/lib/crm-client.ts`
- Test: `lua_agent/src/lib/__tests__/crm-client.test.ts`

**Interfaces:**
- Produces (used by Tasks 6–11):

```ts
export class CrmError extends Error { detail?: string }
export const CRM_DOWN_MESSAGE = "The CRM didn't respond — please try again in a minute.";
export interface CrmClient {
  baseUrl: string; // e.g. https://noble-stride.vercel.app (no /api/graphql suffix)
  query<T>(document: string, variables?: Record<string, unknown>): Promise<T>;
}
export function makeCrmClient(opts: { apiUrl: string; agentKey: string; fetchFn?: typeof fetch }): CrmClient;
export function crmClientFromEnv(): CrmClient; // reads env("CRM_API_URL"), env("CRM_AGENT_KEY")
```

- [ ] **Step 1: Add vitest**

In `lua_agent/`, run:
```bash
cd lua_agent && npm install -D vitest
```
In `lua_agent/package.json` replace the `"test"` script with:
```json
    "test": "vitest run"
```
Create `lua_agent/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```

- [ ] **Step 2: Write the failing tests**

Create `lua_agent/src/lib/__tests__/crm-client.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { makeCrmClient, CrmError, CRM_DOWN_MESSAGE } from "../crm-client";

const OPTS = { apiUrl: "https://crm.example/api/graphql", agentKey: "k-123" };

function fetchReturning(status: number, body: unknown): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  ) as unknown as typeof fetch;
}

describe("makeCrmClient", () => {
  it("derives baseUrl by stripping /api/graphql", () => {
    expect(makeCrmClient(OPTS).baseUrl).toBe("https://crm.example");
  });

  it("POSTs the document with the x-agent-key header and returns data", async () => {
    const fetchFn = fetchReturning(200, { data: { ping: "pong" } });
    const client = makeCrmClient({ ...OPTS, fetchFn });
    const data = await client.query<{ ping: string }>("{ ping }");
    expect(data.ping).toBe("pong");
    const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(OPTS.apiUrl);
    expect(init.method).toBe("POST");
    expect(init.headers["x-agent-key"]).toBe("k-123");
    expect(JSON.parse(init.body).query).toBe("{ ping }");
  });

  it("maps network failure to the friendly CRM-down error", async () => {
    const fetchFn = vi.fn(async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch;
    const client = makeCrmClient({ ...OPTS, fetchFn });
    await expect(client.query("{ ping }")).rejects.toThrow(CRM_DOWN_MESSAGE);
  });

  it("maps non-200 to the friendly CRM-down error with detail", async () => {
    const client = makeCrmClient({ ...OPTS, fetchFn: fetchReturning(502, {}) });
    const err = await client.query("{ ping }").catch((e: CrmError) => e);
    expect(err).toBeInstanceOf(CrmError);
    expect(err.message).toBe(CRM_DOWN_MESSAGE);
    expect(err.detail).toContain("502");
  });

  it("surfaces GraphQL errors distinctly (auth/validation are not 'CRM down')", async () => {
    const client = makeCrmClient({
      ...OPTS,
      fetchFn: fetchReturning(200, { errors: [{ message: "Unauthorized: authentication required" }] }),
    });
    await expect(client.query("{ ping }")).rejects.toThrow(/Unauthorized/);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd lua_agent && npx vitest run src/lib/__tests__/crm-client.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the client**

Create `lua_agent/src/lib/crm-client.ts`:

```ts
import { env } from "lua-cli";

export const CRM_DOWN_MESSAGE = "The CRM didn't respond — please try again in a minute.";

export class CrmError extends Error {
  detail?: string;
  constructor(message: string, detail?: string) {
    super(message);
    this.name = "CrmError";
    this.detail = detail;
  }
}

export interface CrmClient {
  baseUrl: string;
  query<T>(document: string, variables?: Record<string, unknown>): Promise<T>;
}

export function makeCrmClient(opts: { apiUrl: string; agentKey: string; fetchFn?: typeof fetch }): CrmClient {
  const { apiUrl, agentKey } = opts;
  const fetchFn = opts.fetchFn ?? fetch;
  const baseUrl = apiUrl.replace(/\/api\/graphql\/?$/, "");

  return {
    baseUrl,
    async query<T>(document: string, variables?: Record<string, unknown>): Promise<T> {
      let res: Response;
      try {
        res = await fetchFn(apiUrl, {
          method: "POST",
          headers: { "content-type": "application/json", "x-agent-key": agentKey },
          body: JSON.stringify({ query: document, variables }),
        });
      } catch (err) {
        throw new CrmError(CRM_DOWN_MESSAGE, err instanceof Error ? err.message : String(err));
      }
      if (!res.ok) throw new CrmError(CRM_DOWN_MESSAGE, `HTTP ${res.status}`);
      let body: { data?: T; errors?: Array<{ message: string }> };
      try {
        body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
      } catch (err) {
        // A 2xx with a non-JSON body (proxy/login page) must still surface as CrmError.
        throw new CrmError(CRM_DOWN_MESSAGE, `invalid JSON response: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (body.errors?.length) {
        throw new CrmError(`The CRM rejected the request: ${body.errors.map((e) => e.message).join("; ")}`);
      }
      if (body.data === undefined || body.data === null) throw new CrmError(CRM_DOWN_MESSAGE, "empty data");
      return body.data;
    },
  };
}

export function crmClientFromEnv(): CrmClient {
  const apiUrl = env("CRM_API_URL");
  const agentKey = env("CRM_AGENT_KEY");
  if (!apiUrl) throw new CrmError("Agent misconfigured: CRM_API_URL is not set.");
  if (!agentKey) throw new CrmError("Agent misconfigured: CRM_AGENT_KEY is not set.");
  return makeCrmClient({ apiUrl, agentKey });
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd lua_agent && npx vitest run src/lib/__tests__/crm-client.test.ts
```
Expected: PASS (5/5).

- [ ] **Step 6: Commit**

```bash
git add lua_agent/package.json lua_agent/package-lock.json lua_agent/vitest.config.ts lua_agent/src/lib/crm-client.ts lua_agent/src/lib/__tests__/crm-client.test.ts
git commit -m "feat(agent): GraphQL crm-client with friendly error mapping + vitest setup"
```

---

### Task 6: Agent — GraphQL documents + record resolution

**Files:**
- Create: `lua_agent/src/lib/queries.ts`
- Create: `lua_agent/src/lib/resolve.ts`
- Test: `lua_agent/src/lib/__tests__/resolve.test.ts`

**Interfaces:**
- Produces (used by Tasks 8–9):

```ts
// queries.ts — string constants:
//   GLOBAL_SEARCH, PIPELINE_SNAPSHOT, DOCUMENTS_QUERY,
//   DETAIL_QUERIES: Record<RecordType, { document: string; rootField: string }>,
//   DOCUMENT_ARG: Partial<Record<RecordType, string>>  // documents() filter arg per type
// resolve.ts:
export type RecordType = "client" | "investor" | "mandate" | "transaction" | "engagement" | "partner";
export interface SearchResult { id: string; type: string; title: string; subtitle?: string | null; href: string }
export type Resolution =
  | { kind: "match"; result: SearchResult }
  | { kind: "ambiguous"; candidates: SearchResult[] }
  | { kind: "none" };
export function resolveRecord(results: SearchResult[], recordType: RecordType, query: string): Resolution;
export const SEARCH_TYPE: Record<RecordType, string>;
```

Every field below was verified against `noblestride-crm/src/graphql/types.ts` / `queries.ts` — do not add unverified fields.

- [ ] **Step 1: Write the failing resolution tests**

Create `lua_agent/src/lib/__tests__/resolve.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveRecord, type SearchResult } from "../resolve";

const r = (id: string, type: string, title: string): SearchResult => ({ id, type, title, href: `/x/${id}` });

describe("resolveRecord", () => {
  it("matches the single result of the right type", () => {
    const res = resolveRecord([r("1", "Client", "Acme Ltd"), r("2", "Investor", "Acme Fund")], "client", "acme");
    expect(res).toEqual({ kind: "match", result: r("1", "Client", "Acme Ltd") });
  });

  it("prefers an exact case-insensitive title match over ambiguity", () => {
    const res = resolveRecord(
      [r("1", "Investor", "Abraaj Group"), r("2", "Investor", "Abraaj Group II")],
      "investor",
      "abraaj group",
    );
    expect(res).toEqual({ kind: "match", result: r("1", "Investor", "Abraaj Group") });
  });

  it("matches by exact id (agent retry after candidate pick)", () => {
    const res = resolveRecord([r("cm123", "Mandate", "Busoga"), r("cm456", "Mandate", "Busoga II")], "mandate", "cm456");
    expect(res).toEqual({ kind: "match", result: r("cm456", "Mandate", "Busoga II") });
  });

  it("returns up to 5 candidates when ambiguous", () => {
    const many = Array.from({ length: 8 }, (_, i) => r(`${i}`, "Transaction", `Deal ${i}`));
    const res = resolveRecord(many, "transaction", "deal");
    expect(res.kind).toBe("ambiguous");
    if (res.kind === "ambiguous") expect(res.candidates).toHaveLength(5);
  });

  it("returns none when no result matches the type", () => {
    expect(resolveRecord([r("1", "Client", "Acme")], "partner", "acme")).toEqual({ kind: "none" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd lua_agent && npx vitest run src/lib/__tests__/resolve.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `resolve.ts`**

Create `lua_agent/src/lib/resolve.ts`:

```ts
export type RecordType = "client" | "investor" | "mandate" | "transaction" | "engagement" | "partner";

/** globalSearch returns these `type` strings (see CRM global-search.ts). */
export const SEARCH_TYPE: Record<RecordType, string> = {
  client: "Client",
  investor: "Investor",
  mandate: "Mandate",
  transaction: "Transaction",
  engagement: "Engagement",
  partner: "Partner",
};

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle?: string | null;
  href: string;
}

export type Resolution =
  | { kind: "match"; result: SearchResult }
  | { kind: "ambiguous"; candidates: SearchResult[] }
  | { kind: "none" };

export function resolveRecord(results: SearchResult[], recordType: RecordType, query: string): Resolution {
  const wanted = SEARCH_TYPE[recordType];
  const ofType = results.filter((r) => r.type === wanted);
  if (ofType.length === 0) return { kind: "none" };

  const byId = ofType.find((r) => r.id === query);
  if (byId) return { kind: "match", result: byId };

  const q = query.trim().toLowerCase();
  const exact = ofType.filter((r) => r.title.trim().toLowerCase() === q);
  if (exact.length === 1) return { kind: "match", result: exact[0] };

  if (ofType.length === 1) return { kind: "match", result: ofType[0] };
  return { kind: "ambiguous", candidates: ofType.slice(0, 5) };
}
```

- [ ] **Step 4: Implement `queries.ts`**

Create `lua_agent/src/lib/queries.ts`:

```ts
import type { RecordType } from "./resolve";

export const GLOBAL_SEARCH = /* GraphQL */ `
  query AgentGlobalSearch($query: String!, $limit: Int) {
    globalSearch(query: $query, limit: $limit) { id type title subtitle href }
  }
`;

const ACTIVITY_FIELDS = `activities { type subject body occurredAt channel direction }`;

export const DETAIL_QUERIES: Record<RecordType, { document: string; rootField: string }> = {
  client: {
    rootField: "client",
    document: /* GraphQL */ `
      query AgentClient($id: ID!) {
        client(id: $id) {
          id name sector status hqCity hqCountry website description
          revenueLastYear revenueForecast currency profitability existingInvestors staffCount
          createdAt updatedAt
          contacts { firstName lastName email jobTitle isPrimaryContact }
          mandates { id name stage dealSize currency nextAction stageEnteredAt }
          transactions { id name stage targetRaise currency dealStatus stageEnteredAt }
          ${ACTIVITY_FIELDS}
        }
      }
    `,
  },
  investor: {
    rootField: "investor",
    document: /* GraphQL */ `
      query AgentInvestor($id: ID!) {
        investor(id: $id) {
          id name investorType status website sectorFocus geographicFocus instruments
          investmentStages aum ticketMin ticketMax currency esgFocus ndaStatus onboardingStatus
          engagementClassification nextActionDate feedback notes createdAt updatedAt engagementCount
          contacts { firstName lastName email jobTitle isPrimaryContact }
          engagements {
            id name status engagementStage interestLevel lastContact totalAmount probability
            transaction { id name stage }
          }
          ${ACTIVITY_FIELDS}
        }
      }
    `,
  },
  mandate: {
    rootField: "mandate",
    document: /* GraphQL */ `
      query AgentMandate($id: ID!) {
        mandate(id: $id) {
          id name stage stageEnteredAt daysInStage dealStatus dealSize currency sector source
          dateOpened ndaStatus ndaSignedDate eaStatus eaSignedDate nextAction notes
          retainerAmount priority createdAt updatedAt leadId
          client { id name }
          transactions { id name stage }
          ${ACTIVITY_FIELDS}
        }
      }
    `,
  },
  transaction: {
    rootField: "transaction",
    document: /* GraphQL */ `
      query AgentTransaction($id: ID!) {
        transaction(id: $id) {
          id name stage stageEnteredAt dealType instrument targetRaise currency sector
          dateOpened closedAt dealStatus dealMilestone financingType probability notes priority
          investorsContacted activeConversations createdAt updatedAt ownerId
          client { id name }
          mandate { id name stage }
          engagements {
            id name status engagementStage interestLevel lastContact totalAmount termSheetIssued
            investor { id name }
          }
          ${ACTIVITY_FIELDS}
        }
      }
    `,
  },
  engagement: {
    rootField: "engagement",
    document: /* GraphQL */ `
      query AgentEngagement($id: ID!) {
        engagement(id: $id) {
          id name status engagementStage interestLevel ndaType ndaSignedAt termSheetIssued termSheetDate
          totalAmount amountDisbursed amountPending disbursementStatus probability feedback notes
          lastContact createdAt updatedAt
          transaction { id name stage client { id name } }
          investor { id name investorType }
          milestones { key completedAt notes }
          ${ACTIVITY_FIELDS}
        }
      }
    `,
  },
  partner: {
    rootField: "partner",
    document: /* GraphQL */ `
      query AgentPartner($id: ID!) {
        partner(id: $id) {
          id name partnerType status location organization email phone profile
          feeSharingAgreement feeSharingTerms partnerAgreementStatus internalOnly feedbackNotes
          createdAt updatedAt referredMandateCount
          contacts { firstName lastName email }
          referredMandates { id name stage }
        }
      }
    `,
  },
};

export const PIPELINE_SNAPSHOT = /* GraphQL */ `
  query AgentPipelineSnapshot {
    mandatesByStage {
      stage label
      items { id name stageEnteredAt createdAt updatedAt dateOpened currency dealSize }
    }
    transactionsByStage {
      stage label
      items { id name stageEnteredAt createdAt updatedAt dateOpened currency targetRaise }
    }
  }
`;

/** Document METADATA only — never file contents (spec §4.1). */
export const DOCUMENTS_QUERY = /* GraphQL */ `
  query AgentDocuments($clientId: ID, $investorId: ID, $mandateId: ID, $transactionId: ID) {
    documents(clientId: $clientId, investorId: $investorId, mandateId: $mandateId, transactionId: $transactionId) {
      name type status accessLevel uploadedAt isCurrent
    }
  }
`;

/** Which documents() filter arg each summarizable type uses (engagement/partner have none). */
export const DOCUMENT_ARG: Partial<Record<RecordType, string>> = {
  client: "clientId",
  investor: "investorId",
  mandate: "mandateId",
  transaction: "transactionId",
};
```

- [ ] **Step 5: Run resolution tests + typecheck**

```bash
cd lua_agent && npx vitest run src/lib/__tests__/resolve.test.ts && npx tsc --noEmit
```
Expected: tests PASS; tsc clean.

- [ ] **Step 6: Verify the documents against the live schema (one-shot smoke)**

Run (PowerShell, from `lua_agent/`; uses the open introspection — no key needed):
```powershell
$q = '{"query":"query { __type(name: \"Engagement\") { fields { name } } }"}'
Invoke-RestMethod -Method Post -Uri https://noble-stride.vercel.app/api/graphql -ContentType application/json -Body $q | ConvertTo-Json -Depth 6
```
Expected: field list for Engagement. NOTE: `milestones` will appear only after the CRM changes deploy — locally Task 3's test already proves it. All OTHER selected fields must appear in the live introspection; if any is missing, fix the document (do not guess new fields).

- [ ] **Step 7: Commit**

```bash
git add lua_agent/src/lib/queries.ts lua_agent/src/lib/resolve.ts lua_agent/src/lib/__tests__/resolve.test.ts
git commit -m "feat(agent): GraphQL documents + deterministic record resolution"
```

---

### Task 7: Agent — prompt builders, fallbacks, digest computation (`format.ts`)

**Files:**
- Create: `lua_agent/src/lib/format.ts`
- Test: `lua_agent/src/lib/__tests__/format.test.ts`

**Interfaces:**
- Consumes: `RecordType` from `./resolve`.
- Produces (used by Tasks 8–9):

```ts
export function buildRecordPrompt(recordType: RecordType, record: Record<string, unknown>, focus?: string): string;
export function fallbackRecordMarkdown(recordType: RecordType, record: Record<string, unknown>): string;
export interface PipelineItem { id: string; name: string; stageEnteredAt?: string | null; createdAt: string; updatedAt: string; dateOpened?: string | null; currency?: string | null; dealSize?: number | null; targetRaise?: number | null }
export interface StageColumn { stage: string; label: string; items: PipelineItem[] }
export interface DigestSection { moved: Array<{ name: string; stage: string }>; newEntries: Array<{ name: string; stage: string }>; stalled: Array<{ name: string; stage: string; idleDays: number }>; totalsByStage: Array<{ label: string; count: number }> }
export interface DigestData { windowDays: number; generatedAt: string; mandates: DigestSection; transactions: DigestSection }
export function computeDigest(input: { mandateColumns: StageColumn[]; transactionColumns: StageColumn[]; windowDays: number; now: Date }): DigestData;
export function buildDigestPrompt(digest: DigestData, pipeline: "mandates" | "transactions" | "both"): string;
export function fallbackDigestMarkdown(digest: DigestData, pipeline: "mandates" | "transactions" | "both"): string;
```

Digest semantics (fixed): **moved** = `stageEnteredAt` within the window AND `createdAt` older than the window; **newEntries** = `createdAt` (or `dateOpened` if earlier) within the window; **stalled** = `updatedAt` older than the window, with `idleDays` = full days since `updatedAt`.

- [ ] **Step 1: Write the failing tests**

Create `lua_agent/src/lib/__tests__/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeDigest, buildRecordPrompt, fallbackDigestMarkdown, type StageColumn } from "../format";

const NOW = new Date("2026-07-13T09:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const columns: StageColumn[] = [
  {
    stage: "DUE_DILIGENCE",
    label: "Due Diligence",
    items: [
      // moved: entered stage 2 days ago, created 30 days ago
      { id: "a", name: "Deal Moved", stageEnteredAt: daysAgo(2), createdAt: daysAgo(30), updatedAt: daysAgo(2) },
      // new: created 3 days ago
      { id: "b", name: "Deal New", stageEnteredAt: daysAgo(3), createdAt: daysAgo(3), updatedAt: daysAgo(3) },
      // stalled: untouched for 21 days
      { id: "c", name: "Deal Stalled", stageEnteredAt: daysAgo(40), createdAt: daysAgo(60), updatedAt: daysAgo(21) },
    ],
  },
];

describe("computeDigest", () => {
  const digest = computeDigest({ mandateColumns: columns, transactionColumns: [], windowDays: 7, now: NOW });

  it("classifies moved / new / stalled correctly", () => {
    expect(digest.mandates.moved.map((m) => m.name)).toEqual(["Deal Moved"]);
    expect(digest.mandates.newEntries.map((m) => m.name)).toEqual(["Deal New"]);
    expect(digest.mandates.stalled.map((m) => m.name)).toEqual(["Deal Stalled"]);
    expect(digest.mandates.stalled[0].idleDays).toBe(21);
  });

  it("totals per stage", () => {
    expect(digest.mandates.totalsByStage).toEqual([{ label: "Due Diligence", count: 3 }]);
  });

  it("a new record is not also counted as moved", () => {
    expect(digest.mandates.moved.find((m) => m.name === "Deal New")).toBeUndefined();
  });
});

describe("prompts and fallbacks", () => {
  it("record prompt embeds the template sections and the data", () => {
    const p = buildRecordPrompt("client", { name: "Acme" }, "risks");
    for (const section of ["Headline", "Current status", "Recent activity", "Open items", "Risks", "Next steps"]) {
      expect(p).toContain(section);
    }
    expect(p).toContain('"name": "Acme"');
    expect(p).toContain("risks");
    expect(p).toMatch(/never invent|only.*facts/i);
  });

  it("digest fallback renders sections without an LLM", () => {
    const digest = computeDigest({ mandateColumns: columns, transactionColumns: [], windowDays: 7, now: NOW });
    const md = fallbackDigestMarkdown(digest, "mandates");
    expect(md).toContain("Deal Moved");
    expect(md).toContain("Deal Stalled");
    expect(md).toContain("Due Diligence");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd lua_agent && npx vitest run src/lib/__tests__/format.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `format.ts`**

Create `lua_agent/src/lib/format.ts`:

```ts
import type { RecordType } from "./resolve";

const DAY_MS = 86_400_000;

// ── Record summaries ─────────────────────────────────────────────────────────

/** Trim unbounded relations so prompts stay small: keep the 20 most recent activities. */
function trimRecord(record: Record<string, unknown>): Record<string, unknown> {
  const out = { ...record };
  const activities = out.activities;
  if (Array.isArray(activities)) {
    out.activities = [...activities]
      .sort((a, b) => String(b?.occurredAt ?? "").localeCompare(String(a?.occurredAt ?? "")))
      .slice(0, 20);
  }
  return out;
}

export function buildRecordPrompt(recordType: RecordType, record: Record<string, unknown>, focus?: string): string {
  const data = JSON.stringify(trimRecord(record), null, 2);
  return [
    `You are an internal deal-ops analyst at NobleStride Capital. Write a concise briefing on the ${recordType} below.`,
    `Use EXACTLY these markdown sections, each as a "## " heading:`,
    `Headline / Current status / Recent activity / Open items / Risks & stalls / Next steps.`,
    `Rules: use only facts present in the data — never invent numbers, names, or dates. Omit a bullet rather than guess.`,
    `Do not mention raw record IDs. Keep it under 250 words.`,
    focus ? `The reader specifically asked about: ${focus}. Weight the briefing toward that.` : "",
    `DATA:\n${data}`,
  ].filter(Boolean).join("\n\n");
}

export function fallbackRecordMarkdown(recordType: RecordType, record: Record<string, unknown>): string {
  const r = trimRecord(record);
  const lines: string[] = [`## ${String(r.name ?? "(unnamed)")} — ${recordType} (raw facts; AI summary unavailable)`];
  for (const [key, value] of Object.entries(r)) {
    if (value === null || value === undefined || key === "id" || key.endsWith("Id")) continue;
    if (Array.isArray(value)) {
      lines.push(`- **${key}**: ${value.length} item(s)`);
    } else if (typeof value === "object") {
      const name = (value as Record<string, unknown>).name;
      if (name) lines.push(`- **${key}**: ${String(name)}`);
    } else {
      lines.push(`- **${key}**: ${String(value)}`);
    }
  }
  return lines.join("\n");
}

// ── Pipeline digest ──────────────────────────────────────────────────────────

export interface PipelineItem {
  id: string;
  name: string;
  stageEnteredAt?: string | null;
  createdAt: string;
  updatedAt: string;
  dateOpened?: string | null;
  currency?: string | null;
  dealSize?: number | null;
  targetRaise?: number | null;
}

export interface StageColumn { stage: string; label: string; items: PipelineItem[] }

export interface DigestSection {
  moved: Array<{ name: string; stage: string }>;
  newEntries: Array<{ name: string; stage: string }>;
  stalled: Array<{ name: string; stage: string; idleDays: number }>;
  totalsByStage: Array<{ label: string; count: number }>;
}

export interface DigestData {
  windowDays: number;
  generatedAt: string;
  mandates: DigestSection;
  transactions: DigestSection;
}

function computeSection(columns: StageColumn[], windowDays: number, now: Date): DigestSection {
  const cutoff = now.getTime() - windowDays * DAY_MS;
  const section: DigestSection = { moved: [], newEntries: [], stalled: [], totalsByStage: [] };
  for (const col of columns) {
    section.totalsByStage.push({ label: col.label, count: col.items.length });
    for (const item of col.items) {
      const created = Math.min(
        new Date(item.createdAt).getTime(),
        item.dateOpened ? new Date(item.dateOpened).getTime() : Infinity,
      );
      const entered = item.stageEnteredAt ? new Date(item.stageEnteredAt).getTime() : null;
      const updated = new Date(item.updatedAt).getTime();
      if (created >= cutoff) {
        section.newEntries.push({ name: item.name, stage: col.label });
      } else if (entered !== null && entered >= cutoff) {
        section.moved.push({ name: item.name, stage: col.label });
      } else if (updated < cutoff) {
        section.stalled.push({ name: item.name, stage: col.label, idleDays: Math.floor((now.getTime() - updated) / DAY_MS) });
      }
    }
  }
  return section;
}

export function computeDigest(input: {
  mandateColumns: StageColumn[];
  transactionColumns: StageColumn[];
  windowDays: number;
  now: Date;
}): DigestData {
  return {
    windowDays: input.windowDays,
    generatedAt: input.now.toISOString(),
    mandates: computeSection(input.mandateColumns, input.windowDays, input.now),
    transactions: computeSection(input.transactionColumns, input.windowDays, input.now),
  };
}

function sectionsFor(digest: DigestData, pipeline: "mandates" | "transactions" | "both") {
  const parts: Array<[string, DigestSection]> = [];
  if (pipeline !== "transactions") parts.push(["Mandates (client acquisition)", digest.mandates]);
  if (pipeline !== "mandates") parts.push(["Transactions (fundraising execution)", digest.transactions]);
  return parts;
}

export function buildDigestPrompt(digest: DigestData, pipeline: "mandates" | "transactions" | "both"): string {
  const data = JSON.stringify(Object.fromEntries(sectionsFor(digest, pipeline)), null, 2);
  return [
    `You are an internal deal-ops analyst at NobleStride Capital. Write the pipeline digest for the last ${digest.windowDays} days.`,
    `Use EXACTLY these markdown sections, each as a "## " heading: Movement / New entries / Stalled deals / Totals by stage.`,
    `Rules: use only facts in the data — never invent. If a section is empty, write "Nothing this period." Keep it under 300 words.`,
    `DATA:\n${data}`,
  ].join("\n\n");
}

export function fallbackDigestMarkdown(digest: DigestData, pipeline: "mandates" | "transactions" | "both"): string {
  const lines: string[] = [`# Pipeline digest — last ${digest.windowDays} days (raw facts; AI summary unavailable)`];
  for (const [title, s] of sectionsFor(digest, pipeline)) {
    lines.push(`\n## ${title}`);
    lines.push(`**Movement:** ${s.moved.map((m) => `${m.name} → ${m.stage}`).join("; ") || "Nothing this period."}`);
    lines.push(`**New entries:** ${s.newEntries.map((m) => `${m.name} (${m.stage})`).join("; ") || "Nothing this period."}`);
    lines.push(`**Stalled:** ${s.stalled.map((m) => `${m.name} (${m.stage}, ${m.idleDays}d idle)`).join("; ") || "Nothing this period."}`);
    lines.push(`**Totals:** ${s.totalsByStage.map((t) => `${t.label}: ${t.count}`).join(", ")}`);
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd lua_agent && npx vitest run src/lib/__tests__/format.test.ts
```
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add lua_agent/src/lib/format.ts lua_agent/src/lib/__tests__/format.test.ts
git commit -m "feat(agent): briefing/digest prompt builders, fallbacks, digest computation"
```

---

### Task 8: Agent — `SummarizeRecordTool`

**Files:**
- Create: `lua_agent/src/skills/tools/SummarizeRecordTool.ts`
- Test: `lua_agent/src/skills/tools/__tests__/SummarizeRecordTool.test.ts`

**Interfaces:**
- Consumes: `crmClientFromEnv`, `CrmClient`, `CrmError` (Task 5); `GLOBAL_SEARCH`, `DETAIL_QUERIES` (Task 6); `resolveRecord`, `RecordType` (Task 6); `buildRecordPrompt`, `fallbackRecordMarkdown` (Task 7); `AI.generate(prompt: string): Promise<string>` and `LuaTool` from `lua-cli`.
- Produces: class `SummarizeRecordTool implements LuaTool` with `constructor(deps?: SummarizeDeps)` where `SummarizeDeps = { crm: CrmClient; generate: (prompt: string) => Promise<string> }`. `execute` returns one of:
  - `{ status: "ok", summary: string, link: string }`
  - `{ status: "ambiguous", message: string, candidates: Array<{ id, title, subtitle }> }`
  - `{ status: "not_found", message: string }`

- [ ] **Step 1: Write the failing tests**

Create `lua_agent/src/skills/tools/__tests__/SummarizeRecordTool.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { SummarizeRecordTool } from "../SummarizeRecordTool";
import type { CrmClient } from "../../../lib/crm-client";

function crmStub(searchResults: unknown[], detail?: unknown, documents: unknown[] = []): CrmClient {
  return {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string) => {
      if (document.includes("globalSearch")) return { globalSearch: searchResults };
      if (document.includes("AgentDocuments")) return { documents };
      return { client: detail, investor: detail, mandate: detail, transaction: detail, engagement: detail, partner: detail };
    }),
  };
}

const HIT = { id: "c1", type: "Client", title: "Acme Ltd", subtitle: null, href: "/clients/c1" };

describe("SummarizeRecordTool", () => {
  it("summarizes a uniquely-resolved record, embeds document metadata, returns the deep link", async () => {
    let seenPrompt = "";
    const tool = new SummarizeRecordTool({
      crm: crmStub([HIT], { id: "c1", name: "Acme Ltd", status: "Active" }, [
        { name: "NDA.pdf", type: "NDA", status: "APPROVED" },
      ]),
      generate: async (p) => { seenPrompt = p; return "## Headline\nAcme is active."; },
    });
    const out = await tool.execute({ recordType: "client", query: "acme ltd" });
    expect(out).toEqual({ status: "ok", summary: "## Headline\nAcme is active.", link: "https://crm.example/clients/c1" });
    expect(seenPrompt).toContain("NDA.pdf"); // document METADATA reaches the briefing
  });

  it("returns candidates when ambiguous", async () => {
    const two = [HIT, { ...HIT, id: "c2", title: "Acme Ltd Kenya" }];
    const tool = new SummarizeRecordTool({ crm: crmStub(two), generate: async () => "unused" });
    const out = await tool.execute({ recordType: "client", query: "acm" });
    expect(out.status).toBe("ambiguous");
    if (out.status === "ambiguous") expect(out.candidates.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("returns not_found when nothing matches", async () => {
    const tool = new SummarizeRecordTool({ crm: crmStub([]), generate: async () => "unused" });
    const out = await tool.execute({ recordType: "partner", query: "nobody" });
    expect(out.status).toBe("not_found");
  });

  it("falls back to raw facts when AI generation fails", async () => {
    const tool = new SummarizeRecordTool({
      crm: crmStub([HIT], { id: "c1", name: "Acme Ltd", status: "Active" }),
      generate: async () => { throw new Error("model overloaded"); },
    });
    const out = await tool.execute({ recordType: "client", query: "acme ltd" });
    expect(out.status).toBe("ok");
    if (out.status === "ok") expect(out.summary).toContain("Acme Ltd");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd lua_agent && npx vitest run src/skills/tools/__tests__/SummarizeRecordTool.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the tool**

Create `lua_agent/src/skills/tools/SummarizeRecordTool.ts`:

```ts
import { AI, type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { GLOBAL_SEARCH, DETAIL_QUERIES, DOCUMENTS_QUERY, DOCUMENT_ARG } from "../../lib/queries";
import { resolveRecord, type RecordType, type SearchResult } from "../../lib/resolve";
import { buildRecordPrompt, fallbackRecordMarkdown } from "../../lib/format";

export interface SummarizeDeps {
  crm: CrmClient;
  generate: (prompt: string) => Promise<string>;
}

const inputSchema = z.object({
  recordType: z
    .enum(["client", "investor", "mandate", "transaction", "engagement", "partner"])
    .describe("Which kind of CRM record to summarize"),
  query: z.string().min(1).describe("The record's name as the user said it, or an exact record id from a previous candidates list"),
  focus: z.string().optional().describe("Optional angle to weight the briefing toward, e.g. 'risks' or 'next steps'"),
});

export class SummarizeRecordTool implements LuaTool {
  name = "summarize_record";
  description =
    "Summarize one CRM record (client, investor, mandate, transaction, engagement, or partner) into a structured internal briefing with a deep link.";
  inputSchema = inputSchema;

  constructor(private deps?: SummarizeDeps) {}

  private getDeps(): SummarizeDeps {
    return this.deps ?? { crm: crmClientFromEnv(), generate: (p: string) => AI.generate(p) };
  }

  async execute(input: z.infer<typeof inputSchema>) {
    const { crm, generate } = this.getDeps();
    const recordType = input.recordType as RecordType;

    const search = await crm.query<{ globalSearch: SearchResult[] }>(GLOBAL_SEARCH, {
      query: input.query,
      limit: 10,
    });
    const resolution = resolveRecord(search.globalSearch, recordType, input.query);

    if (resolution.kind === "none") {
      return {
        status: "not_found" as const,
        message: `No ${recordType} matching "${input.query}" was found in the CRM.`,
      };
    }
    if (resolution.kind === "ambiguous") {
      return {
        status: "ambiguous" as const,
        message: `Multiple ${recordType}s match "${input.query}" — ask the user to pick one, then call this tool again with the chosen id as query.`,
        candidates: resolution.candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
      };
    }

    const { document, rootField } = DETAIL_QUERIES[recordType];
    const detail = await crm.query<Record<string, Record<string, unknown> | null>>(document, {
      id: resolution.result.id,
    });
    const record = detail[rootField];
    if (!record) {
      return { status: "not_found" as const, message: `The ${recordType} could not be loaded from the CRM.` };
    }

    // Attach document METADATA (never file contents) where the CRM supports it.
    const docArg = DOCUMENT_ARG[recordType];
    if (docArg) {
      const docs = await crm.query<{ documents: Array<Record<string, unknown>> }>(DOCUMENTS_QUERY, {
        [docArg]: resolution.result.id,
      });
      record.documents = docs.documents.slice(0, 10);
    }

    let summary: string;
    try {
      summary = await generate(buildRecordPrompt(recordType, record, input.focus));
    } catch {
      summary = fallbackRecordMarkdown(recordType, record);
    }

    return { status: "ok" as const, summary, link: `${crm.baseUrl}${resolution.result.href}` };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd lua_agent && npx vitest run src/skills/tools/__tests__/SummarizeRecordTool.test.ts && npx tsc --noEmit
```
Expected: PASS (4/4); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add lua_agent/src/skills/tools/SummarizeRecordTool.ts lua_agent/src/skills/tools/__tests__/SummarizeRecordTool.test.ts
git commit -m "feat(agent): summarize_record tool — resolve, fetch, brief, deep-link"
```

---

### Task 9: Agent — digest runner + `PipelineDigestTool`

**Files:**
- Create: `lua_agent/src/lib/digest-runner.ts`
- Create: `lua_agent/src/skills/tools/PipelineDigestTool.ts`
- Test: `lua_agent/src/lib/__tests__/digest-runner.test.ts`

**Interfaces:**
- Consumes: `PIPELINE_SNAPSHOT` (Task 6); `computeDigest`, `buildDigestPrompt`, `fallbackDigestMarkdown`, `StageColumn` (Task 7); `CrmClient` (Task 5); `Data`, `AI` from `lua-cli`.
- Produces (Task 11 reuses `generateDigestMarkdown`):

```ts
// digest-runner.ts
export type PipelineChoice = "mandates" | "transactions" | "both";
export interface DigestRunnerDeps { crm: CrmClient; generate: (prompt: string) => Promise<string>; now?: () => Date }
export async function generateDigestMarkdown(deps: DigestRunnerDeps, windowDays: number, pipeline: PipelineChoice): Promise<string>;
export const DIGESTS_COLLECTION = "digests"; // Data entries: { weekOf: "YYYY-MM-DD", markdown, generatedAt }
export function weekOf(date: Date): string;  // ISO date of that week's Monday
// PipelineDigestTool: class implements LuaTool, name "pipeline_digest",
//   input { days: int 1..90 default 7, pipeline: enum default "both", useStored: boolean default false }
//   returns { status: "ok", digest: string } | { status: "empty", message: string }
```

- [ ] **Step 1: Write the failing tests**

Create `lua_agent/src/lib/__tests__/digest-runner.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateDigestMarkdown, weekOf } from "../digest-runner";
import type { CrmClient } from "../crm-client";

const NOW = new Date("2026-07-13T09:00:00Z"); // a Monday
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const crm: CrmClient = {
  baseUrl: "https://crm.example",
  query: async () => ({
    mandatesByStage: [
      {
        stage: "OUTREACH",
        label: "Outreach",
        items: [{ id: "m1", name: "Busoga Mandate", stageEnteredAt: daysAgo(1), createdAt: daysAgo(20), updatedAt: daysAgo(1) }],
      },
    ],
    transactionsByStage: [],
  }),
};

describe("weekOf", () => {
  it("returns the ISO date of the week's Monday", () => {
    expect(weekOf(new Date("2026-07-13T09:00:00Z"))).toBe("2026-07-13"); // Monday itself
    expect(weekOf(new Date("2026-07-16T22:00:00Z"))).toBe("2026-07-13"); // Thursday
  });
});

describe("generateDigestMarkdown", () => {
  it("feeds computed digest into the generator", async () => {
    let seenPrompt = "";
    const md = await generateDigestMarkdown(
      { crm, generate: async (p) => { seenPrompt = p; return "## Movement\nBusoga moved."; }, now: () => NOW },
      7,
      "both",
    );
    expect(md).toBe("## Movement\nBusoga moved.");
    expect(seenPrompt).toContain("Busoga Mandate");
  });

  it("falls back to raw digest markdown when the generator fails", async () => {
    const md = await generateDigestMarkdown(
      { crm, generate: async () => { throw new Error("boom"); }, now: () => NOW },
      7,
      "both",
    );
    expect(md).toContain("Busoga Mandate");
    expect(md).toContain("Outreach");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd lua_agent && npx vitest run src/lib/__tests__/digest-runner.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the runner**

Create `lua_agent/src/lib/digest-runner.ts`:

```ts
import type { CrmClient } from "./crm-client";
import { PIPELINE_SNAPSHOT } from "./queries";
import { computeDigest, buildDigestPrompt, fallbackDigestMarkdown, type StageColumn } from "./format";

export type PipelineChoice = "mandates" | "transactions" | "both";

export const DIGESTS_COLLECTION = "digests";

/** ISO date (YYYY-MM-DD) of the Monday of the week containing `date` (UTC). */
export function weekOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export interface DigestRunnerDeps {
  crm: CrmClient;
  generate: (prompt: string) => Promise<string>;
  now?: () => Date;
}

export async function generateDigestMarkdown(
  deps: DigestRunnerDeps,
  windowDays: number,
  pipeline: PipelineChoice,
): Promise<string> {
  const now = deps.now ? deps.now() : new Date();
  const snapshot = await deps.crm.query<{
    mandatesByStage: StageColumn[];
    transactionsByStage: StageColumn[];
  }>(PIPELINE_SNAPSHOT);

  const digest = computeDigest({
    mandateColumns: snapshot.mandatesByStage,
    transactionColumns: snapshot.transactionsByStage,
    windowDays,
    now,
  });

  try {
    return await deps.generate(buildDigestPrompt(digest, pipeline));
  } catch {
    return fallbackDigestMarkdown(digest, pipeline);
  }
}
```

- [ ] **Step 4: Implement the tool**

Create `lua_agent/src/skills/tools/PipelineDigestTool.ts`:

```ts
import { AI, Data, type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv } from "../../lib/crm-client";
import {
  generateDigestMarkdown,
  DIGESTS_COLLECTION,
  type DigestRunnerDeps,
  type PipelineChoice,
} from "../../lib/digest-runner";

const inputSchema = z.object({
  days: z.number().int().min(1).max(90).default(7).describe("Lookback window in days"),
  pipeline: z.enum(["mandates", "transactions", "both"]).default("both"),
  useStored: z
    .boolean()
    .default(false)
    .describe("True when the user asks for 'this week's digest' / 'the weekly digest' — returns the most recent stored digest instead of generating fresh"),
});

export class PipelineDigestTool implements LuaTool {
  name = "pipeline_digest";
  description =
    "Pipeline movement digest: what moved stage, what's new, what's stalled, and totals by stage — for mandates, transactions, or both.";
  inputSchema = inputSchema;

  constructor(private deps?: DigestRunnerDeps) {}

  private getDeps(): DigestRunnerDeps {
    return this.deps ?? { crm: crmClientFromEnv(), generate: (p: string) => AI.generate(p) };
  }

  async execute(input: z.infer<typeof inputSchema>) {
    if (input.useStored) {
      const stored = await Data.get(DIGESTS_COLLECTION, {}, 1, 50);
      const latest = [...stored.data].sort((a, b) =>
        String((b as { data?: { generatedAt?: string } }).data?.generatedAt ?? "").localeCompare(
          String((a as { data?: { generatedAt?: string } }).data?.generatedAt ?? ""),
        ),
      )[0] as { data?: { markdown?: string } } | undefined;
      if (latest?.data?.markdown) return { status: "ok" as const, digest: latest.data.markdown };
      return { status: "empty" as const, message: "No stored weekly digest yet — offer to generate a fresh one instead." };
    }

    const digest = await generateDigestMarkdown(this.getDeps(), input.days, input.pipeline as PipelineChoice);
    return { status: "ok" as const, digest };
  }
}
```

- [ ] **Step 5: Run tests + typecheck**

```bash
cd lua_agent && npx vitest run src/lib/__tests__/digest-runner.test.ts && npx tsc --noEmit
```
Expected: PASS (3/3); tsc clean.

- [ ] **Step 6: Commit**

```bash
git add lua_agent/src/lib/digest-runner.ts lua_agent/src/skills/tools/PipelineDigestTool.ts lua_agent/src/lib/__tests__/digest-runner.test.ts
git commit -m "feat(agent): pipeline_digest tool + shared digest runner"
```

---

### Task 10: Agent — passphrase preprocessor gate

**Files:**
- Create: `lua_agent/src/processors/passphrase-gate.ts`
- Test: `lua_agent/src/processors/__tests__/passphrase-gate.test.ts`

**Interfaces:**
- Consumes: `PreProcessor`, `Data`, `env` from `lua-cli`. PreProcessor's exact execute signature (from api-exports.d.ts): `(user: UserDataInstance, messages: ChatMessage[], channel: string) => Promise<PreProcessorResult>` where `ChatMessage = TextMessage | ImageMessage | FileMessage`, `TextMessage = { type: 'text'; text: string }`, and results are `{ action: 'block'; response: string }` or `{ action: 'proceed' }`. Verified user state lives at `user.data.verified`; profile id at `user._luaProfile.userId`.
- Produces:

```ts
export const STAFF_COLLECTION = "staff_users"; // entries: { userId: string } — Task 11 reads this for delivery
export type GateOutcome = "proceed" | "verify" | "challenge" | "unconfigured";
export function gateDecision(verified: boolean, lastText: string | undefined, passphrase: string | undefined): GateOutcome;
export const passphraseGate: PreProcessor; // index.ts wires this instance
```

- [ ] **Step 1: Write the failing tests**

Create `lua_agent/src/processors/__tests__/passphrase-gate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { gateDecision } from "../passphrase-gate";

describe("gateDecision", () => {
  it("verified users always proceed", () => {
    expect(gateDecision(true, "anything", "secret")).toBe("proceed");
    expect(gateDecision(true, undefined, "secret")).toBe("proceed");
  });

  it("correct passphrase (trimmed, case-sensitive) verifies", () => {
    expect(gateDecision(false, "  secret ", "secret")).toBe("verify");
    expect(gateDecision(false, "Secret", "secret")).toBe("challenge");
  });

  it("anything else is challenged", () => {
    expect(gateDecision(false, "summarize acme", "secret")).toBe("challenge");
    expect(gateDecision(false, undefined, "secret")).toBe("challenge");
  });

  it("missing TEAM_PASSPHRASE fails closed", () => {
    expect(gateDecision(false, "secret", undefined)).toBe("unconfigured");
    expect(gateDecision(true, "hi", undefined)).toBe("proceed"); // already-verified users unaffected
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd lua_agent && npx vitest run src/processors/__tests__/passphrase-gate.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the gate**

Create `lua_agent/src/processors/passphrase-gate.ts`:

```ts
import { PreProcessor, Data, env } from "lua-cli";

export const STAFF_COLLECTION = "staff_users";

export type GateOutcome = "proceed" | "verify" | "challenge" | "unconfigured";

export function gateDecision(
  verified: boolean,
  lastText: string | undefined,
  passphrase: string | undefined,
): GateOutcome {
  if (verified) return "proceed";
  if (!passphrase) return "unconfigured";
  if (lastText !== undefined && lastText.trim() === passphrase) return "verify";
  return "challenge";
}

const CHALLENGE =
  "This assistant is for NobleStride staff only. Please reply with the team passphrase to continue.";
const WELCOME =
  "✅ You're verified. Ask me to summarize any client, investor, mandate, transaction, engagement, or partner — or ask \"what moved this week?\" for a pipeline digest.";
const UNCONFIGURED = "The assistant isn't fully configured yet (missing team passphrase). Please contact the NobleStride admin.";

export const passphraseGate = new PreProcessor({
  name: "passphrase-gate",
  description: "Blocks all messages until the user proves staff membership with the team passphrase.",
  priority: 10,
  execute: async (user, messages, _channel) => {
    const verified = (user.data as Record<string, unknown> | undefined)?.verified === true;
    const lastText = [...messages].reverse().find((m) => m.type === "text") as { text: string } | undefined;
    const outcome = gateDecision(verified, lastText?.text, env("TEAM_PASSPHRASE"));

    switch (outcome) {
      case "proceed":
        return { action: "proceed" };
      case "verify": {
        await user.update({ verified: true });
        const userId = user._luaProfile?.userId;
        if (userId) {
          const existing = await Data.get(STAFF_COLLECTION, { userId: { $eq: userId } }, 1, 1);
          if (existing.data.length === 0) await Data.create(STAFF_COLLECTION, { userId });
        }
        return { action: "block", response: WELCOME };
      }
      case "unconfigured":
        return { action: "block", response: UNCONFIGURED };
      case "challenge":
      default:
        return { action: "block", response: CHALLENGE };
    }
  },
});
```

- [ ] **Step 4: Run tests + typecheck**

```bash
cd lua_agent && npx vitest run src/processors/__tests__/passphrase-gate.test.ts && npx tsc --noEmit
```
Expected: PASS (4/4); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add lua_agent/src/processors/passphrase-gate.ts lua_agent/src/processors/__tests__/passphrase-gate.test.ts
git commit -m "feat(agent): passphrase preprocessor gate + staff_users registry"
```

---

### Task 11: Agent — weekly digest job

**Files:**
- Create: `lua_agent/src/jobs/weekly-digest.job.ts`
- Test: `lua_agent/src/jobs/__tests__/weekly-digest.test.ts`

**Interfaces:**
- Consumes: `generateDigestMarkdown`, `DIGESTS_COLLECTION`, `weekOf` (Task 9); `STAFF_COLLECTION` (Task 10); `LuaJob`, `Data`, `Channels`, `AI` from `lua-cli`. `Channels.send({ channel: "webchat", to: { userId }, text })` is the verified proactive-send signature.
- Produces:

```ts
export interface WeeklyDigestDeps {
  generateDigest: (windowDays: number) => Promise<string>;
  data: { create: typeof Data.create; get: typeof Data.get };
  send: (userId: string, text: string) => Promise<unknown>;
  now?: () => Date;
}
export async function runWeeklyDigest(deps: WeeklyDigestDeps): Promise<{ stored: boolean; delivered: number; failed: number }>;
export const weeklyDigestJob: LuaJob; // cron 0 9 * * 1, Africa/Nairobi
```

- [ ] **Step 1: Write the failing tests**

Create `lua_agent/src/jobs/__tests__/weekly-digest.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { runWeeklyDigest } from "../weekly-digest.job";

const NOW = new Date("2026-07-13T06:00:00Z");

function deps(overrides: Partial<Parameters<typeof runWeeklyDigest>[0]> = {}) {
  return {
    generateDigest: vi.fn(async () => "# digest"),
    data: {
      create: vi.fn(async () => ({}) as never),
      get: vi.fn(async () => ({ data: [{ data: { userId: "u1" } }, { data: { userId: "u2" } }], pagination: {} }) as never),
    },
    send: vi.fn(async () => ({})),
    now: () => NOW,
    ...overrides,
  };
}

describe("runWeeklyDigest", () => {
  it("stores the digest with weekOf and delivers to every registered staff user", async () => {
    const d = deps();
    const result = await runWeeklyDigest(d);
    expect(d.data.create).toHaveBeenCalledWith(
      "digests",
      expect.objectContaining({ weekOf: "2026-07-13", markdown: "# digest" }),
      expect.any(String),
    );
    expect(d.send).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ stored: true, delivered: 2, failed: 0 });
  });

  it("one failed delivery does not stop the others", async () => {
    const d = deps({
      send: vi.fn(async (userId: string) => {
        if (userId === "u1") throw new Error("channel closed");
        return {};
      }),
    });
    const result = await runWeeklyDigest(d);
    expect(result).toEqual({ stored: true, delivered: 1, failed: 1 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd lua_agent && npx vitest run src/jobs/__tests__/weekly-digest.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the job**

Create `lua_agent/src/jobs/weekly-digest.job.ts`:

```ts
import { LuaJob, Data, Channels, AI } from "lua-cli";
import { crmClientFromEnv } from "../lib/crm-client";
import { generateDigestMarkdown, DIGESTS_COLLECTION, weekOf } from "../lib/digest-runner";
import { STAFF_COLLECTION } from "../processors/passphrase-gate";

export interface WeeklyDigestDeps {
  generateDigest: (windowDays: number) => Promise<string>;
  data: { create: typeof Data.create; get: typeof Data.get };
  send: (userId: string, text: string) => Promise<unknown>;
  now?: () => Date;
}

export async function runWeeklyDigest(
  deps: WeeklyDigestDeps,
): Promise<{ stored: boolean; delivered: number; failed: number }> {
  const now = deps.now ? deps.now() : new Date();
  const markdown = await deps.generateDigest(7);

  await deps.data.create(
    DIGESTS_COLLECTION,
    { weekOf: weekOf(now), markdown, generatedAt: now.toISOString() },
    `weekly pipeline digest ${weekOf(now)}`,
  );

  const staff = await deps.data.get(STAFF_COLLECTION, {}, 1, 100);
  let delivered = 0;
  let failed = 0;
  for (const entry of staff.data) {
    const userId = (entry as { data?: { userId?: string } }).data?.userId;
    if (!userId) continue;
    try {
      await deps.send(userId, markdown);
      delivered += 1;
    } catch {
      failed += 1; // one bad recipient must not sink the run
    }
  }
  return { stored: true, delivered, failed };
}

export const weeklyDigestJob = new LuaJob({
  name: "weekly-digest",
  description: "Generates the 7-day pipeline digest every Monday 09:00 Nairobi time, stores it, and pushes it to registered staff.",
  schedule: { type: "cron", expression: "0 9 * * 1", timezone: "Africa/Nairobi" },
  timeout: 300,
  retry: { maxAttempts: 3, backoffSeconds: 120 },
  execute: async () =>
    runWeeklyDigest({
      generateDigest: (days) =>
        generateDigestMarkdown({ crm: crmClientFromEnv(), generate: (p) => AI.generate(p) }, days, "both"),
      data: { create: Data.create, get: Data.get },
      send: (userId, text) => Channels.send({ channel: "webchat", to: { userId }, text }),
    }),
});
```

- [ ] **Step 4: Run tests + typecheck**

```bash
cd lua_agent && npx vitest run src/jobs/__tests__/weekly-digest.test.ts && npx tsc --noEmit
```
Expected: PASS (2/2); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add lua_agent/src/jobs/weekly-digest.job.ts lua_agent/src/jobs/__tests__/weekly-digest.test.ts
git commit -m "feat(agent): weekly digest cron job — Mon 09:00 Africa/Nairobi, store + webchat delivery"
```

---

### Task 12: Agent — skill + persona + wire `index.ts`

**Files:**
- Create: `lua_agent/src/skills/summary.skill.ts`
- Modify: `lua_agent/src/index.ts` (replace template persona and empty arrays)
- Modify: `lua_agent/env.example` (document required vars)

**Interfaces:**
- Consumes: `SummarizeRecordTool` (Task 8), `PipelineDigestTool` (Task 9), `passphraseGate` (Task 10), `weeklyDigestJob` (Task 11); `LuaAgent`, `LuaSkill` from `lua-cli` (options verbatim: `skills`, `jobs`, `preProcessors`).
- Produces: the complete agent definition (`summarizerAgent`) the Lua CLI pushes.

- [ ] **Step 1: Create the skill**

Create `lua_agent/src/skills/summary.skill.ts`:

```ts
import { LuaSkill } from "lua-cli";
import { SummarizeRecordTool } from "./tools/SummarizeRecordTool";
import { PipelineDigestTool } from "./tools/PipelineDigestTool";

export const summarySkill = new LuaSkill({
  name: "crm-summary",
  description: "Summaries of NobleStride CRM records and pipeline movement.",
  context: `This skill answers questions about NobleStride's CRM records and pipeline. All data is internal.
- Use summarize_record when the user asks about ONE specific record ("summarize Acme", "brief me on the Busoga transaction", "status of investor X"). Pass recordType and the name exactly as the user said it. Pass focus when they ask for a specific angle (risks, next steps).
- If summarize_record returns status "ambiguous", list the candidates (title + subtitle) and ask the user to pick; then call it again with the chosen candidate's id as query.
- If it returns "not_found", say so plainly and ask for a spelling or more context — never guess.
- Use pipeline_digest when the user asks what changed, moved, is new, or is stalled ("what happened this week?"). Default days=7.
- When the user asks for "this week's digest" or "the weekly digest", call pipeline_digest with useStored=true.
- Relay the tool's summary/digest text as the core of your answer; append the link when present. Never expose raw record ids.`,
  tools: [new SummarizeRecordTool(), new PipelineDigestTool()],
});
```

- [ ] **Step 2: Rewrite `index.ts`**

Replace the contents of `lua_agent/src/index.ts` with:

```ts
import { LuaAgent } from "lua-cli";
import { summarySkill } from "./skills/summary.skill";
import { weeklyDigestJob } from "./jobs/weekly-digest.job";
import { passphraseGate } from "./processors/passphrase-gate";

const PERSONA = `# NobleStride Deal-Ops Analyst

## Identity & Role
You are the NobleStride summary assistant — an internal deal-operations analyst embedded in NobleStride Capital's CRM.

## Business Context
NobleStride Capital is a Kenya-based transactions advisory firm running fundraising mandates for African companies and engaging PE funds, DFIs, and strategic investors worldwide. Mandates track client acquisition; transactions track fundraising execution; engagements track one investor's involvement in one transaction.

## Audience
NobleStride staff only — deal leads, analysts, admins. Never assume you are talking to a client, investor, or partner.

## Tone
Concise, matter-of-fact, briefing style. Lead with the headline. Short bullet sections over prose.

## Capabilities
- Summarize a specific client, investor, mandate, transaction, engagement, or partner.
- Report pipeline movement: what changed, what's new, what's stalled, totals by stage.
- Retrieve the stored Monday weekly digest.

## Guidelines
- Only state facts returned by your tools. Never invent numbers, names, or dates.
- Never show raw CRM record ids; refer to records by name and share the deep link the tool provides.
- If a name is ambiguous, present the candidates and ask which one.
- If a tool reports the CRM is unreachable, say so and suggest trying again shortly — do not answer from memory.

## Boundaries
- Read-only: you cannot create, edit, or delete CRM records.
- Everything you produce is internal. If asked to draft client- or investor-facing material, remind the user this assistant's output is internal-only.
- No legal, tax, or investment advice.`;

const agent = new LuaAgent({
  name: "summarizerAgent",
  persona: PERSONA,
  model: "anthropic/claude-sonnet-5",
  skills: [summarySkill],
  jobs: [weeklyDigestJob],
  preProcessors: [passphraseGate],
});

export default agent;
```

- [ ] **Step 3: Document required env vars**

Append to `lua_agent/env.example`:

```
# NobleStride summary agent
CRM_API_URL=https://noble-stride.vercel.app/api/graphql
CRM_AGENT_KEY=dev-agent-key-change-me
TEAM_PASSPHRASE=pick-a-team-passphrase
```

- [ ] **Step 4: Full agent test suite + typecheck**

```bash
cd lua_agent && npm test && npx tsc --noEmit
```
Expected: all suites PASS (crm-client 5, resolve 5, format 5, SummarizeRecordTool 4, digest-runner 3, passphrase-gate 4, weekly-digest 2); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add lua_agent/src/skills/summary.skill.ts lua_agent/src/index.ts lua_agent/env.example
git commit -m "feat(agent): wire summarizerAgent — persona, crm-summary skill, digest job, gate"
```

---

### Task 13: Verification pass (end-of-build)

**Files:**
- Create: `playwright assessment/2026-07-13-lua-summary-agent-verification.md` (in the MAIN tree `D:/LuaWork/NobleStride/noble-stride` — that's the living QA log)
- Screenshots: `playwright assessment/2026-07-13-lua-widget.png`

- [ ] **Step 1: Full test suites, both codebases**

```bash
cd noblestride-crm && npm test
cd ../lua_agent && npm test && npx tsc --noEmit
```
Expected: all green.

- [ ] **Step 2: Live-endpoint smoke of the agent's exact queries**

From `lua_agent/`, run each DETAIL_QUERIES document and PIPELINE_SNAPSHOT against `https://noble-stride.vercel.app/api/graphql` (currently open; add the `x-agent-key` header once the CRM changes are deployed). A scratch script is fine — do NOT commit it. Expected: every query returns `data` without `errors`, EXCEPT `engagement`'s `milestones` selection, which fails until the CRM changes deploy (verify locally instead via `npx vitest run src/graphql/__tests__/engagement-milestones.test.ts` in noblestride-crm).

- [ ] **Step 3: Single Playwright pass — widget renders**

Start the dev server from the worktree with the widget enabled (set `NEXT_PUBLIC_LUA_AGENT_ID` in `noblestride-crm/.env` to the agentId from `lua_agent/lua.skill.yaml`, i.e. `baseAgent_agent_1783947462006_xzk0qoqdv`), log in with the usual dev staff credentials, and verify on `/dashboard`:
1. The floating chat button renders bottom-right.
2. Clicking it opens the "NobleStride Assistant" panel.
3. No console errors from `lua-pop.umd.js`.
Screenshot → `playwright assessment/2026-07-13-lua-widget.png`. Also verify the auth gate against the LOCAL server: anonymous `curl` of `{ clients { id } }` → 401; with `x-agent-key` from `.env` → 200.

- [ ] **Step 4: Write the QA log entry**

`playwright assessment/2026-07-13-lua-summary-agent-verification.md`: what was built, test counts, gate verification results (local 401/200), widget screenshot reference, and the two known deferred items: (a) live vercel.app endpoint stays OPEN until CRM changes merge upstream and deploy + `AGENT_API_KEY` is set in Vercel; (b) engagement milestones live-query works only after that deploy.

- [ ] **Step 5: User-assisted Lua platform checklist (do not run — hand to Shaurya)**

```
cd lua_agent
lua test          # invoke summarize_record + pipeline_digest interactively (.env is used)
lua chat          # conversation pass: passphrase gate, record summary, digest
lua push          # upload versioned snapshot (staged)
lua env           # set production CRM_API_URL / CRM_AGENT_KEY / TEAM_PASSPHRASE
lua deploy        # activate — ONLY after sandbox chat looks right
```

- [ ] **Step 6: Commit the QA log (main tree — ask first)**

The QA log lives in the main tree where the working tree is dirty with unrelated WIP — per standing rule, do NOT commit there without explicit go-ahead; just leave the files in `playwright assessment/`.
