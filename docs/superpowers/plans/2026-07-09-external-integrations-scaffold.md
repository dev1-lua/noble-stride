# External Integrations Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fully-coded DocuSign, Box, Microsoft Teams, and Outlook integrations behind capability seams that stay inert (current manual workflows unchanged) until the client drops in credentials.

**Architecture:** One framework under `src/server/integrations/` with a capability seam each for `esign`, `docshare`, `meetings`, `mailsync`. Every capability = a provider interface + a factory that returns the real vendor client only when its env credentials are present (`isConfigured`), else a manual/null provider that preserves today's behavior. Teams + Outlook share one Microsoft Graph auth module. New UI controls render only in server components guarded by `isConfigured`; new webhook routes 404 until configured. Data-model changes are additive only.

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript 5, Prisma 6 (PostgreSQL 16), Pothos v4 + GraphQL Yoga, urql, Vitest, `jose` (already a dep — used for DocuSign RS256 JWT). Raw `fetch` for all vendor calls (no new runtime deps).

## Global Constraints

- **No new runtime dependencies.** All vendor clients use raw `fetch`; DocuSign JWT uses the existing `jose`. (Verify `jose` is in `package.json` dependencies — it is, `^6.2.3`.)
- **Zero behavior change with no keys.** Manual NDA buttons (`src/components/crm/nda-actions.tsx`), free-text `Document.fileUrl` + `src/server/storage/*`, manual `Activity` meeting/email logging must all behave byte-for-byte as today. New controls must NOT render when their integration is unconfigured.
- **`config.ts` is the only module that reads integration env vars.** Everything else asks `isConfigured(id)` / `getXProvider()`.
- **Additive migrations only** — new columns nullable/defaulted, new tables independent. No existing column/table/migration altered.
- **Provenance:** integration-created rows use `createdSource = ActorSource.API`.
- **Per-step verification gate:** every task ends by running `pnpm exec tsc --noEmit && pnpm lint && pnpm test` and showing passing output before commit. Run `pnpm generate` after any `schema.prisma` change.
- **House style:** raw `fetch`; graceful no-key fallback (see `src/server/auth/mailer.ts`); factory + `xConfigured()` gate (see `src/server/storage/provider.ts`). Services are thin over Prisma; no logic in resolvers/components.
- **Branch:** `feat/external-integrations-scaffold` in worktree `.claude/worktrees/external-integrations`. Never merge without explicit instruction.

---

## File Structure

```
src/server/integrations/
  config.ts                      # Task 1 — env reader, isConfigured(id), per-vendor predicates
  errors.ts                      # Task 1 — IntegrationError
  msgraph/auth.ts                # Task 2 — shared Graph client-credentials token (Teams + Outlook)
  esign/provider.ts              # Task 4 — ESignProvider interface + getESignProvider()
  esign/manual.ts                # Task 4 — ManualESignProvider (not-configured)
  esign/docusign.ts              # Task 5 — real DocuSign client
  docshare/provider.ts           # Task 9 — DocShareProvider interface + getDocShareProvider()
  docshare/null.ts               # Task 9 — NullDocShareProvider
  docshare/box.ts                # Task 10 — real Box client
  meetings/provider.ts           # Task 13 — MeetingProvider interface + getMeetingProvider()
  meetings/manual.ts             # Task 13 — ManualMeetingProvider
  meetings/teams.ts              # Task 14 — real Teams (Graph events) client
  mailsync/provider.ts           # Task 16 — MailSyncProvider interface + getMailSyncProvider()
  mailsync/off.ts                # Task 16 — OffMailProvider
  mailsync/outlook.ts            # Task 17 — real Outlook (Graph mail) client
src/server/services/
  esign.ts                       # Task 6 — send-envelope service (writes ESignEnvelope)
  docshare.ts                    # Task 11 — share-document service
  meetings.ts                    # Task 15 — schedule-meeting service (writes Meeting + Activity)
  mailsync.ts                    # Task 18 — mail ingestion + deal matching
src/app/api/integrations/
  docusign/connect/route.ts      # Task 7 — Connect webhook → converge on recordOpenNda/recordClosedNda
  box/webhook/route.ts           # Task 12 — Box events → DocumentAccessLog
  msgraph/notifications/route.ts # Task 19 — Graph change notifications → mailsync
src/components/crm/
  send-esign-button.tsx          # Task 8 — gated e-sign control
  share-box-button.tsx           # Task 12b — gated Box share control
  schedule-teams-button.tsx      # Task 15b — gated meeting control
prisma/schema.prisma             # Task 3 — additive models + fields
.env.example                     # Task 20 — one commented block per integration
docs/integrations-client-checklist.md  # Task 20 — consolidated "request from client"
```

---

## Task 1: Integration config + error foundation

**Files:**
- Create: `src/server/integrations/config.ts`
- Create: `src/server/integrations/errors.ts`
- Test: `src/server/integrations/__tests__/config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type IntegrationId = "docusign" | "box" | "teams" | "outlook"`
  - `function isConfigured(id: IntegrationId): boolean`
  - `function docusignConfigured(): boolean`, `boxConfigured(): boolean`, `teamsConfigured(): boolean`, `outlookConfigured(): boolean`
  - `function docusignEnv()`, `boxEnv()`, `graphEnv()`, `outlookEnv()` returning typed config objects (only called by providers, which have already checked `isConfigured`).
  - `class IntegrationError extends Error { status: number }`

- [ ] **Step 1: Write the failing test**

```ts
// src/server/integrations/__tests__/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isConfigured, docusignConfigured, teamsConfigured, outlookConfigured } from "../config";
import { IntegrationError } from "../errors";

const KEYS = [
  "DOCUSIGN_ENABLED","DOCUSIGN_INTEGRATION_KEY","DOCUSIGN_USER_ID","DOCUSIGN_ACCOUNT_ID",
  "DOCUSIGN_RSA_PRIVATE_KEY","DOCUSIGN_AUTH_SERVER",
  "TEAMS_ENABLED","OUTLOOK_ENABLED","MSGRAPH_TENANT_ID","MSGRAPH_CLIENT_ID","MSGRAPH_CLIENT_SECRET",
  "MSGRAPH_ORGANIZER_ID","OUTLOOK_MAILBOXES",
];
let saved: Record<string, string | undefined>;
beforeEach(() => { saved = {}; for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; } });
afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

describe("isConfigured", () => {
  it("is false for every integration when no env is set", () => {
    for (const id of ["docusign","box","teams","outlook"] as const) expect(isConfigured(id)).toBe(false);
  });

  it("docusign requires ENABLED=true AND all vars", () => {
    process.env.DOCUSIGN_INTEGRATION_KEY = "ik";
    process.env.DOCUSIGN_USER_ID = "uid";
    process.env.DOCUSIGN_ACCOUNT_ID = "aid";
    process.env.DOCUSIGN_RSA_PRIVATE_KEY = "pk";
    process.env.DOCUSIGN_AUTH_SERVER = "account-d.docusign.com";
    expect(docusignConfigured()).toBe(false);          // ENABLED not set
    process.env.DOCUSIGN_ENABLED = "true";
    expect(docusignConfigured()).toBe(true);
    delete process.env.DOCUSIGN_ACCOUNT_ID;
    expect(docusignConfigured()).toBe(false);          // missing a var
  });

  it("teams and outlook each require ENABLED + the shared MSGRAPH vars", () => {
    process.env.MSGRAPH_TENANT_ID = "t";
    process.env.MSGRAPH_CLIENT_ID = "c";
    process.env.MSGRAPH_CLIENT_SECRET = "s";
    process.env.TEAMS_ENABLED = "true";
    process.env.MSGRAPH_ORGANIZER_ID = "org@x.com";
    expect(teamsConfigured()).toBe(true);
    expect(outlookConfigured()).toBe(false);           // OUTLOOK_ENABLED + mailboxes missing
    process.env.OUTLOOK_ENABLED = "true";
    process.env.OUTLOOK_MAILBOXES = "a@x.com";
    expect(outlookConfigured()).toBe(true);
  });
});

describe("IntegrationError", () => {
  it("defaults to status 502 and carries a custom status", () => {
    expect(new IntegrationError("x").status).toBe(502);
    expect(new IntegrationError("y", 503).status).toBe(503);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/server/integrations/__tests__/config.test.ts`
Expected: FAIL — cannot find module `../config` / `../errors`.

- [ ] **Step 3: Write `errors.ts`**

```ts
// src/server/integrations/errors.ts
// Uniform error for external-integration failures. Mirrors StorageError so
// route handlers/services can map provider failures to an HTTP status.
export class IntegrationError extends Error {
  constructor(message: string, readonly status: number = 502) {
    super(message);
    this.name = "IntegrationError";
  }
}
```

- [ ] **Step 4: Write `config.ts`**

```ts
// src/server/integrations/config.ts
// SINGLE source that reads integration env vars. Everything else asks
// isConfigured(id) or getXProvider(). Each integration is "configured" only
// when its *_ENABLED flag is truthy AND every required var is present, so a
// half-provisioned env never activates a real provider.

export type IntegrationId = "docusign" | "box" | "teams" | "outlook";

const on = (v: string | undefined) => v === "true" || v === "1";
const all = (...vs: (string | undefined)[]) => vs.every((v) => Boolean(v && v.length > 0));

export function docusignConfigured(): boolean {
  return (
    on(process.env.DOCUSIGN_ENABLED) &&
    all(
      process.env.DOCUSIGN_INTEGRATION_KEY,
      process.env.DOCUSIGN_USER_ID,
      process.env.DOCUSIGN_ACCOUNT_ID,
      process.env.DOCUSIGN_RSA_PRIVATE_KEY,
      process.env.DOCUSIGN_AUTH_SERVER,
    )
  );
}

export function boxConfigured(): boolean {
  return (
    on(process.env.BOX_ENABLED) &&
    all(
      process.env.BOX_CLIENT_ID,
      process.env.BOX_CLIENT_SECRET,
      process.env.BOX_SUBJECT_TYPE,
      process.env.BOX_SUBJECT_ID,
    )
  );
}

function graphVarsPresent(): boolean {
  return all(process.env.MSGRAPH_TENANT_ID, process.env.MSGRAPH_CLIENT_ID, process.env.MSGRAPH_CLIENT_SECRET);
}

export function teamsConfigured(): boolean {
  return on(process.env.TEAMS_ENABLED) && graphVarsPresent() && all(process.env.MSGRAPH_ORGANIZER_ID);
}

export function outlookConfigured(): boolean {
  return on(process.env.OUTLOOK_ENABLED) && graphVarsPresent() && all(process.env.OUTLOOK_MAILBOXES);
}

export function isConfigured(id: IntegrationId): boolean {
  switch (id) {
    case "docusign": return docusignConfigured();
    case "box": return boxConfigured();
    case "teams": return teamsConfigured();
    case "outlook": return outlookConfigured();
  }
}

// Typed accessors — ONLY call after the matching xConfigured() is true.
export function docusignEnv() {
  return {
    integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY!,
    userId: process.env.DOCUSIGN_USER_ID!,
    accountId: process.env.DOCUSIGN_ACCOUNT_ID!,
    rsaPrivateKey: process.env.DOCUSIGN_RSA_PRIVATE_KEY!,
    authServer: process.env.DOCUSIGN_AUTH_SERVER!,
    webhookHmacKey: process.env.DOCUSIGN_WEBHOOK_HMAC_KEY ?? "",
  };
}
export function boxEnv() {
  return {
    clientId: process.env.BOX_CLIENT_ID!,
    clientSecret: process.env.BOX_CLIENT_SECRET!,
    subjectType: process.env.BOX_SUBJECT_TYPE!,
    subjectId: process.env.BOX_SUBJECT_ID!,
    rootFolderId: process.env.BOX_ROOT_FOLDER_ID ?? "0",
    webhookPrimary: process.env.BOX_WEBHOOK_SIGNATURE_PRIMARY ?? "",
    webhookSecondary: process.env.BOX_WEBHOOK_SIGNATURE_SECONDARY ?? "",
  };
}
export function graphEnv() {
  return {
    tenantId: process.env.MSGRAPH_TENANT_ID!,
    clientId: process.env.MSGRAPH_CLIENT_ID!,
    clientSecret: process.env.MSGRAPH_CLIENT_SECRET!,
    organizerId: process.env.MSGRAPH_ORGANIZER_ID ?? "",
  };
}
export function outlookEnv() {
  return { mailboxes: (process.env.OUTLOOK_MAILBOXES ?? "").split(",").map((s) => s.trim()).filter(Boolean) };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test src/server/integrations/__tests__/config.test.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Verification gate + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/server/integrations/config.ts src/server/integrations/errors.ts src/server/integrations/__tests__/config.test.ts
git commit -m "feat(integrations): config gate + IntegrationError foundation"
```

---

## Task 2: Shared Microsoft Graph auth module

**Files:**
- Create: `src/server/integrations/msgraph/auth.ts`
- Test: `src/server/integrations/msgraph/__tests__/auth.test.ts`

**Interfaces:**
- Consumes: `graphEnv()` from Task 1.
- Produces: `async function getGraphToken(fetchImpl?: typeof fetch): Promise<string>` (client-credentials, in-memory cached with 60s safety margin); `function __resetGraphTokenCache(): void` (test-only).

- [ ] **Step 1: Write the failing test**

```ts
// src/server/integrations/msgraph/__tests__/auth.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getGraphToken, __resetGraphTokenCache } from "../auth";

function fakeFetch(body: unknown, ok = true, status = 200) {
  return vi.fn(async () => ({ ok, status, json: async () => body, text: async () => JSON.stringify(body) })) as unknown as typeof fetch;
}

beforeEach(() => {
  __resetGraphTokenCache();
  process.env.MSGRAPH_TENANT_ID = "tid";
  process.env.MSGRAPH_CLIENT_ID = "cid";
  process.env.MSGRAPH_CLIENT_SECRET = "secret";
});

describe("getGraphToken", () => {
  it("posts client-credentials with .default scope and returns the token", async () => {
    const f = fakeFetch({ access_token: "abc", expires_in: 3600 });
    const token = await getGraphToken(f);
    expect(token).toBe("abc");
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://login.microsoftonline.com/tid/oauth2/v2.0/token");
    expect(String(init.body)).toContain("grant_type=client_credentials");
    expect(String(init.body)).toContain(encodeURIComponent("https://graph.microsoft.com/.default"));
  });

  it("caches the token across calls", async () => {
    const f = fakeFetch({ access_token: "abc", expires_in: 3600 });
    await getGraphToken(f);
    await getGraphToken(f);
    expect((f as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it("throws IntegrationError on a non-ok token response", async () => {
    const f = fakeFetch({ error: "invalid_client" }, false, 401);
    await expect(getGraphToken(f)).rejects.toThrow(/graph token/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/server/integrations/msgraph/__tests__/auth.test.ts`
Expected: FAIL — cannot find module `../auth`.

- [ ] **Step 3: Write `auth.ts`**

```ts
// src/server/integrations/msgraph/auth.ts
// Shared client-credentials token for all Microsoft Graph integrations
// (Teams meetings + Outlook mail). SharePoint storage keeps its own creds.
import { graphEnv } from "../config";
import { IntegrationError } from "../errors";

let cache: { token: string; expiresAt: number } | null = null;

export function __resetGraphTokenCache(): void { cache = null; }

export async function getGraphToken(fetchImpl: typeof fetch = fetch): Promise<string> {
  const now = Date.now();
  if (cache && cache.expiresAt > now + 60_000) return cache.token;

  const { tenantId, clientId, clientSecret } = graphEnv();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });
  const res = await fetchImpl(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new IntegrationError(`Graph token request failed (${res.status}): ${detail.slice(0, 200)}`, 502);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cache = { token: json.access_token, expiresAt: now + json.expires_in * 1000 };
  return json.access_token;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/server/integrations/msgraph/__tests__/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Verification gate + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/server/integrations/msgraph
git commit -m "feat(integrations): shared MS Graph client-credentials auth"
```

---

## Task 3: Additive data model

**Files:**
- Modify: `prisma/schema.prisma` (append models; add fields to `Document`, `DocumentAccessLog`)
- Create: `prisma/migrations/<generated>/migration.sql` (via `pnpm migrate`)
- Test: `src/server/integrations/__tests__/schema.smoke.test.ts`

**Interfaces:**
- Produces Prisma models: `ESignEnvelope`, `Meeting`, `EmailMessage`, `GraphSubscription`; `Document.boxFileId/boxSharedLinkUrl/boxWatermarkApplied`; `DocumentAccessLog.source`.

- [ ] **Step 1: Add models to `schema.prisma`**

Append (after the last model). Note enums reuse existing `ActorSource`.

```prisma
model ESignEnvelope {
  id            String   @id @default(cuid())
  provider      String   @default("docusign")
  externalId    String   // DocuSign envelopeId
  kind          String   // OpenNda | ClosedNda | TermSheet
  status        String   @default("sent") // sent | delivered | completed | declined | voided
  signerEmail   String
  signerName    String
  investorId    String?
  investor      Investor?    @relation(fields: [investorId], references: [id], onDelete: SetNull)
  engagementId  String?
  engagement    Engagement?  @relation(fields: [engagementId], references: [id], onDelete: SetNull)
  transactionId String?
  transaction   Transaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)
  sentAt        DateTime @default(now())
  completedAt   DateTime?
  createdSource ActorSource @default(API)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([provider, externalId])
  @@index([investorId])
  @@index([engagementId])
}

model Meeting {
  id              String   @id @default(cuid())
  provider        String   @default("teams")
  externalId      String   // Graph event id
  joinUrl         String
  subject         String
  startAt         DateTime
  endAt           DateTime
  organizerUserId String
  engagementId    String?
  engagement      Engagement?  @relation(fields: [engagementId], references: [id], onDelete: SetNull)
  transactionId   String?
  transaction     Transaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)
  investorId      String?
  investor        Investor?    @relation(fields: [investorId], references: [id], onDelete: SetNull)
  createdSource   ActorSource @default(API)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([provider, externalId])
}

model EmailMessage {
  id             String   @id @default(cuid())
  provider       String   @default("outlook")
  externalId     String   // Graph message id
  conversationId String?
  subject        String?
  fromAddress    String?
  toAddresses    String[] @default([])
  direction      String?  // inbound | outbound
  bodyPreview    String?
  receivedAt     DateTime?
  sentAt         DateTime?
  matchedBy      String?  // participant | conversation | subject
  investorId     String?
  investor       Investor?    @relation(fields: [investorId], references: [id], onDelete: SetNull)
  transactionId  String?
  transaction    Transaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)
  engagementId   String?
  engagement     Engagement?  @relation(fields: [engagementId], references: [id], onDelete: SetNull)
  createdAt      DateTime @default(now())

  @@unique([provider, externalId])
  @@index([conversationId])
  @@index([investorId])
}

model GraphSubscription {
  id             String   @id @default(cuid())
  subscriptionId String   @unique
  resource       String
  mailbox        String
  clientState    String
  expiresAt      DateTime
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

Add to `model Document` (in its field block):

```prisma
  boxFileId          String?
  boxSharedLinkUrl   String?
  boxWatermarkApplied Boolean?
```

Add to `model DocumentAccessLog` (in its field block):

```prisma
  source String? @default("internal") // internal | box
```

Add the back-relations to the existing models (append inside each model's relation block):
- `model Investor { … eSignEnvelopes ESignEnvelope[]  meetings Meeting[]  emailMessages EmailMessage[] }`
- `model Engagement { … eSignEnvelopes ESignEnvelope[]  meetings Meeting[]  emailMessages EmailMessage[] }`
- `model Transaction { … eSignEnvelopes ESignEnvelope[]  meetings Meeting[]  emailMessages EmailMessage[] }`

- [ ] **Step 2: Generate the migration**

Run: `pnpm migrate` (prisma migrate dev). When prompted for a name, use `external_integrations_scaffold`.
Expected: a new folder under `prisma/migrations/` with `migration.sql` adding the tables/columns; `prisma generate` runs automatically. Confirm the SQL only `CREATE TABLE`/`ALTER TABLE ... ADD COLUMN` (no drops/alters of existing columns).

- [ ] **Step 3: Write the smoke test**

```ts
// src/server/integrations/__tests__/schema.smoke.test.ts
import { describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

describe("integration schema", () => {
  it("exposes the new models on the client", () => {
    expect(prisma.eSignEnvelope).toBeDefined();
    expect(prisma.meeting).toBeDefined();
    expect(prisma.emailMessage).toBeDefined();
    expect(prisma.graphSubscription).toBeDefined();
  });
});
```

- [ ] **Step 4: Run + verify**

Run: `pnpm test src/server/integrations/__tests__/schema.smoke.test.ts`
Expected: PASS (client has the new delegates after generate).

- [ ] **Step 5: Verification gate + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add prisma/schema.prisma prisma/migrations src/generated src/server/integrations/__tests__/schema.smoke.test.ts
git commit -m "feat(integrations): additive data model (envelopes, meetings, emails, box fields)"
```

---

## Task 4: E-sign provider seam (interface + manual default + factory)

**Files:**
- Create: `src/server/integrations/esign/provider.ts`
- Create: `src/server/integrations/esign/manual.ts`
- Test: `src/server/integrations/esign/__tests__/provider.test.ts`

**Interfaces:**
- Consumes: `docusignConfigured()` (Task 1); `DocuSignProvider` (Task 5 — imported lazily).
- Produces:
  - `type ESignKind = "OpenNda" | "ClosedNda" | "TermSheet"`
  - `interface SendEnvelopeInput { kind: ESignKind; documentBase64: string; documentName: string; signer: { email: string; name: string }; subject: string; linkRecord: { investorId?: string; engagementId?: string; transactionId?: string } }`
  - `interface EnvelopeResult { externalId: string; status: string }`
  - `interface ESignProvider { sendEnvelope(i: SendEnvelopeInput): Promise<EnvelopeResult>; getEnvelope(externalId: string): Promise<{ status: string; completedAt?: Date }> }`
  - `function getESignProvider(): ESignProvider`

- [ ] **Step 1: Write the failing test**

```ts
// src/server/integrations/esign/__tests__/provider.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getESignProvider } from "../provider";

const VARS = ["DOCUSIGN_ENABLED"];
let saved: Record<string, string | undefined>;
beforeEach(() => { saved = {}; for (const k of VARS) { saved[k] = process.env[k]; delete process.env[k]; } });
afterEach(() => { for (const k of VARS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

describe("getESignProvider", () => {
  it("returns the manual provider when DocuSign is unconfigured, and it refuses to send", async () => {
    const p = getESignProvider();
    await expect(p.sendEnvelope({
      kind: "OpenNda", documentBase64: "x", documentName: "n.pdf",
      signer: { email: "a@b.com", name: "A" }, subject: "s", linkRecord: {},
    })).rejects.toThrow(/not configured/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/server/integrations/esign/__tests__/provider.test.ts`
Expected: FAIL — cannot find module `../provider`.

- [ ] **Step 3: Write `manual.ts`**

```ts
// src/server/integrations/esign/manual.ts
// Not-configured provider. The authoritative NDA path when DocuSign is off is
// the manual Record-NDA buttons (unchanged). Sending must never be reachable
// here — the send UI only renders when docusignConfigured(); this throws as
// defense-in-depth.
import { IntegrationError } from "../errors";
import type { ESignProvider } from "./provider";

export class ManualESignProvider implements ESignProvider {
  async sendEnvelope(): Promise<never> {
    throw new IntegrationError("E-signature not configured", 503);
  }
  async getEnvelope(): Promise<never> {
    throw new IntegrationError("E-signature not configured", 503);
  }
}
```

- [ ] **Step 4: Write `provider.ts`**

```ts
// src/server/integrations/esign/provider.ts
import { docusignConfigured } from "../config";
import { ManualESignProvider } from "./manual";

export type ESignKind = "OpenNda" | "ClosedNda" | "TermSheet";

export interface SendEnvelopeInput {
  kind: ESignKind;
  documentBase64: string;
  documentName: string;
  signer: { email: string; name: string };
  subject: string;
  linkRecord: { investorId?: string; engagementId?: string; transactionId?: string };
}
export interface EnvelopeResult { externalId: string; status: string }

export interface ESignProvider {
  sendEnvelope(input: SendEnvelopeInput): Promise<EnvelopeResult>;
  getEnvelope(externalId: string): Promise<{ status: string; completedAt?: Date }>;
}

export function getESignProvider(): ESignProvider {
  if (docusignConfigured()) {
    // Lazy import so the DocuSign client (and jose) never loads when unconfigured.
    const { DocuSignProvider } = require("./docusign") as typeof import("./docusign");
    return new DocuSignProvider();
  }
  return new ManualESignProvider();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test src/server/integrations/esign/__tests__/provider.test.ts`
Expected: PASS.

- [ ] **Step 6: Verification gate + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/server/integrations/esign
git commit -m "feat(integrations): e-sign provider seam + manual default"
```

> Note: Task 4's test passes before Task 5 exists because `require("./docusign")` is only reached when configured. Keep the `require` (not top-level import) so `tsc` still needs the file — create it in Task 5 before running `tsc` here if your gate order requires it; otherwise Task 5 immediately follows.

---

## Task 5: DocuSign real provider

**Files:**
- Create: `src/server/integrations/esign/docusign.ts`
- Test: `src/server/integrations/esign/__tests__/docusign.test.ts`

**Interfaces:**
- Consumes: `docusignEnv()` (Task 1); `IntegrationError`; `ESignProvider`, `SendEnvelopeInput`, `EnvelopeResult` (Task 4); `jose` (`importPKCS8`, `SignJWT`).
- Produces: `class DocuSignProvider implements ESignProvider`; exported pure helper `function buildEnvelopeBody(i: SendEnvelopeInput): object` for testing.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/integrations/esign/__tests__/docusign.test.ts
import { describe, it, expect } from "vitest";
import { buildEnvelopeBody } from "../docusign";

describe("buildEnvelopeBody", () => {
  it("produces a single-document, single-signer, status=sent envelope with an anchor tab", () => {
    const body = buildEnvelopeBody({
      kind: "OpenNda", documentBase64: "QkFTRTY0", documentName: "NDA.pdf",
      signer: { email: "jane@fund.com", name: "Jane Doe" }, subject: "Please sign the NDA", linkRecord: {},
    }) as any;
    expect(body.status).toBe("sent");
    expect(body.emailSubject).toBe("Please sign the NDA");
    expect(body.documents[0]).toMatchObject({ documentBase64: "QkFTRTY0", name: "NDA.pdf", fileExtension: "pdf", documentId: "1" });
    const signer = body.recipients.signers[0];
    expect(signer).toMatchObject({ email: "jane@fund.com", name: "Jane Doe", recipientId: "1" });
    expect(signer.tabs.signHereTabs[0].anchorString).toBe("/sig1/");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/server/integrations/esign/__tests__/docusign.test.ts`
Expected: FAIL — cannot find module `../docusign`.

- [ ] **Step 3: Write `docusign.ts`**

```ts
// src/server/integrations/esign/docusign.ts
// DocuSign eSignature via JWT Grant (server-to-server). RS256 JWT signed with
// jose (already a dependency). Bearer + account base URI cached in-memory.
import { importPKCS8, SignJWT } from "jose";
import { docusignEnv } from "../config";
import { IntegrationError } from "../errors";
import type { ESignProvider, SendEnvelopeInput, EnvelopeResult } from "./provider";

export function buildEnvelopeBody(i: SendEnvelopeInput): object {
  return {
    emailSubject: i.subject,
    documents: [{ documentBase64: i.documentBase64, name: i.documentName, fileExtension: "pdf", documentId: "1" }],
    recipients: {
      signers: [{
        email: i.signer.email, name: i.signer.name, recipientId: "1", routingOrder: "1",
        tabs: { signHereTabs: [{ anchorString: "/sig1/", anchorUnits: "pixels", anchorXOffset: "0", anchorYOffset: "0" }] },
      }],
    },
    status: "sent",
  };
}

let auth: { token: string; basePath: string; expiresAt: number } | null = null;

async function getAuth(fetchImpl: typeof fetch): Promise<{ token: string; basePath: string }> {
  const now = Date.now();
  if (auth && auth.expiresAt > now + 60_000) return auth;
  const env = docusignEnv();

  const key = await importPKCS8(env.rsaPrivateKey, "RS256");
  const assertion = await new SignJWT({ scope: "signature impersonation" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(env.integrationKey)
    .setSubject(env.userId)
    .setAudience(env.authServer)
    .setIssuedAt()
    .setExpirationTime("55m")
    .sign(key);

  const tokRes = await fetchImpl(`https://${env.authServer}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!tokRes.ok) throw new IntegrationError(`DocuSign token failed (${tokRes.status})`, 502);
  const tok = (await tokRes.json()) as { access_token: string; expires_in: number };

  const infoRes = await fetchImpl(`https://${env.authServer}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  if (!infoRes.ok) throw new IntegrationError(`DocuSign userinfo failed (${infoRes.status})`, 502);
  const info = (await infoRes.json()) as { accounts: { account_id: string; base_uri: string; is_default: boolean }[] };
  const account = info.accounts.find((a) => a.account_id === env.accountId) ?? info.accounts.find((a) => a.is_default);
  if (!account) throw new IntegrationError("DocuSign account not found for userinfo", 502);

  auth = { token: tok.access_token, basePath: `${account.base_uri}/restapi`, expiresAt: now + tok.expires_in * 1000 };
  return auth;
}

export class DocuSignProvider implements ESignProvider {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async sendEnvelope(input: SendEnvelopeInput): Promise<EnvelopeResult> {
    const { token, basePath } = await getAuth(this.fetchImpl);
    const env = docusignEnv();
    const res = await this.fetchImpl(`${basePath}/v2.1/accounts/${env.accountId}/envelopes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildEnvelopeBody(input)),
    });
    if (!res.ok) throw new IntegrationError(`DocuSign envelope create failed (${res.status})`, 502);
    const json = (await res.json()) as { envelopeId: string; status: string };
    return { externalId: json.envelopeId, status: json.status };
  }

  async getEnvelope(externalId: string): Promise<{ status: string; completedAt?: Date }> {
    const { token, basePath } = await getAuth(this.fetchImpl);
    const env = docusignEnv();
    const res = await this.fetchImpl(`${basePath}/v2.1/accounts/${env.accountId}/envelopes/${externalId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new IntegrationError(`DocuSign envelope get failed (${res.status})`, 502);
    const json = (await res.json()) as { status: string; completedDateTime?: string };
    return { status: json.status, completedAt: json.completedDateTime ? new Date(json.completedDateTime) : undefined };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/server/integrations/esign/__tests__/docusign.test.ts`
Expected: PASS.

- [ ] **Step 5: Verification gate + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/server/integrations/esign/docusign.ts src/server/integrations/esign/__tests__/docusign.test.ts
git commit -m "feat(integrations): DocuSign JWT-grant envelope client"
```

---

## Task 6: E-sign service (persist envelope + link record)

**Files:**
- Create: `src/server/services/esign.ts`
- Test: `src/server/services/__tests__/esign.smoke.test.ts`

**Interfaces:**
- Consumes: `getESignProvider()` (Task 4); Prisma `eSignEnvelope` (Task 3); `Actor` from `@/graphql/context`; `actorSource` from `@/server/services/crud`.
- Produces: `async function sendEsignEnvelope(input: SendEnvelopeInput, actor: Actor): Promise<{ id: string; externalId: string; status: string }>`; `async function resolveEnvelopeCompletion(externalId: string, completedAt: Date): Promise<void>` (called by webhook, Task 7).

- [ ] **Step 1: Write the failing test**

```ts
// src/server/services/__tests__/esign.smoke.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/integrations/esign/provider", () => ({
  getESignProvider: () => ({
    sendEnvelope: vi.fn(async () => ({ externalId: "env-123", status: "sent" })),
    getEnvelope: vi.fn(),
  }),
}));

import { sendEsignEnvelope } from "../esign";
import { prisma } from "@/lib/db";

beforeEach(async () => { await prisma.eSignEnvelope.deleteMany({ where: { externalId: "env-123" } }); });

describe("sendEsignEnvelope", () => {
  it("calls the provider and persists an ESignEnvelope row", async () => {
    const out = await sendEsignEnvelope({
      kind: "OpenNda", documentBase64: "x", documentName: "NDA.pdf",
      signer: { email: "a@b.com", name: "A" }, subject: "s", linkRecord: {},
    }, { source: "API" } as any);
    expect(out.externalId).toBe("env-123");
    const row = await prisma.eSignEnvelope.findFirst({ where: { externalId: "env-123" } });
    expect(row?.status).toBe("sent");
    expect(row?.kind).toBe("OpenNda");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/server/services/__tests__/esign.smoke.test.ts`
Expected: FAIL — cannot find module `../esign`.

- [ ] **Step 3: Write `esign.ts`**

```ts
// src/server/services/esign.ts
// Thin service: send an e-sign envelope via the provider seam and persist a
// tracking row. Completion is applied by resolveEnvelopeCompletion (webhook),
// which converges on the same NDA state the manual buttons produce.
import { prisma } from "@/lib/db";
import { actorSource } from "./crud";
import { recordOpenNda, recordClosedNda } from "./nda";
import type { Actor } from "@/graphql/context";
import { getESignProvider, type SendEnvelopeInput } from "@/server/integrations/esign/provider";

export async function sendEsignEnvelope(input: SendEnvelopeInput, actor: Actor) {
  const result = await getESignProvider().sendEnvelope(input);
  const row = await prisma.eSignEnvelope.create({
    data: {
      provider: "docusign",
      externalId: result.externalId,
      kind: input.kind,
      status: result.status,
      signerEmail: input.signer.email,
      signerName: input.signer.name,
      investorId: input.linkRecord.investorId ?? null,
      engagementId: input.linkRecord.engagementId ?? null,
      transactionId: input.linkRecord.transactionId ?? null,
      createdSource: actorSource(actor),
    },
  });
  return { id: row.id, externalId: row.externalId, status: row.status };
}

export async function resolveEnvelopeCompletion(externalId: string, completedAt: Date): Promise<void> {
  const row = await prisma.eSignEnvelope.findFirst({ where: { provider: "docusign", externalId } });
  if (!row || row.status === "completed") return; // idempotent
  await prisma.eSignEnvelope.update({ where: { id: row.id }, data: { status: "completed", completedAt } });

  const systemActor = { source: "API" } as Actor;
  if (row.kind === "OpenNda" && row.investorId) {
    await recordOpenNda(row.investorId, systemActor);
  } else if (row.kind === "ClosedNda" && row.engagementId) {
    await recordClosedNda(row.engagementId, systemActor);
  }
  // TermSheet completion records no NDA state; the row status update above is sufficient.
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test src/server/services/__tests__/esign.smoke.test.ts`
Expected: PASS. (Requires the dev DB up: `pnpm db:up`.)

- [ ] **Step 5: Verification gate + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/server/services/esign.ts src/server/services/__tests__/esign.smoke.test.ts
git commit -m "feat(integrations): e-sign service + NDA-completion convergence"
```

---

## Task 7: DocuSign Connect webhook route

**Files:**
- Create: `src/app/api/integrations/docusign/connect/route.ts`
- Create: `src/server/integrations/esign/webhook.ts` (pure: signature verify + payload parse)
- Test: `src/server/integrations/esign/__tests__/webhook.test.ts`

**Interfaces:**
- Consumes: `docusignConfigured()`, `docusignEnv()` (Task 1); `resolveEnvelopeCompletion` (Task 6).
- Produces: `function verifyDocusignHmac(rawBody: string, signatureHeader: string, key: string): boolean`; `function parseConnectEvent(json: unknown): { event: string; envelopeId: string; completedAt?: Date } | null`.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/integrations/esign/__tests__/webhook.test.ts
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyDocusignHmac, parseConnectEvent } from "../webhook";

describe("verifyDocusignHmac", () => {
  it("accepts a correct HMAC-SHA256 base64 signature and rejects a bad one", () => {
    const key = "secret"; const body = '{"event":"envelope-completed"}';
    const sig = createHmac("sha256", key).update(body, "utf8").digest("base64");
    expect(verifyDocusignHmac(body, sig, key)).toBe(true);
    expect(verifyDocusignHmac(body, "wrong", key)).toBe(false);
  });
});

describe("parseConnectEvent", () => {
  it("extracts event + envelopeId + completed time", () => {
    const out = parseConnectEvent({ event: "envelope-completed", data: { envelopeId: "e1", envelopeSummary: { completedDateTime: "2026-07-09T10:00:00Z" } } });
    expect(out).toEqual({ event: "envelope-completed", envelopeId: "e1", completedAt: new Date("2026-07-09T10:00:00Z") });
  });
  it("returns null for an unrecognized payload", () => {
    expect(parseConnectEvent({ nope: true })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/server/integrations/esign/__tests__/webhook.test.ts`
Expected: FAIL — cannot find module `../webhook`.

- [ ] **Step 3: Write `webhook.ts`**

```ts
// src/server/integrations/esign/webhook.ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyDocusignHmac(rawBody: string, signatureHeader: string, key: string): boolean {
  if (!key || !signatureHeader) return false;
  const expected = createHmac("sha256", key).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(expected); const b = Buffer.from(signatureHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseConnectEvent(json: unknown): { event: string; envelopeId: string; completedAt?: Date } | null {
  const j = json as { event?: string; data?: { envelopeId?: string; envelopeSummary?: { completedDateTime?: string } } };
  if (!j?.event || !j.data?.envelopeId) return null;
  const completed = j.data.envelopeSummary?.completedDateTime;
  return { event: j.event, envelopeId: j.data.envelopeId, completedAt: completed ? new Date(completed) : undefined };
}
```

- [ ] **Step 4: Write the route**

```ts
// src/app/api/integrations/docusign/connect/route.ts
import { NextResponse } from "next/server";
import { docusignConfigured, docusignEnv } from "@/server/integrations/config";
import { verifyDocusignHmac, parseConnectEvent } from "@/server/integrations/esign/webhook";
import { resolveEnvelopeCompletion } from "@/server/services/esign";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!docusignConfigured()) return new NextResponse("Not found", { status: 404 });
  const raw = await req.text();
  const sig = req.headers.get("x-docusign-signature-1") ?? "";
  if (!verifyDocusignHmac(raw, sig, docusignEnv().webhookHmacKey)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }
  const evt = parseConnectEvent(JSON.parse(raw));
  if (evt?.event === "envelope-completed") {
    await resolveEnvelopeCompletion(evt.envelopeId, evt.completedAt ?? new Date());
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run + verify**

Run: `pnpm test src/server/integrations/esign/__tests__/webhook.test.ts`
Expected: PASS.

- [ ] **Step 6: Verification gate + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/app/api/integrations/docusign src/server/integrations/esign/webhook.ts src/server/integrations/esign/__tests__/webhook.test.ts
git commit -m "feat(integrations): DocuSign Connect webhook (HMAC-verified, 404 until configured)"
```

---

## Task 8: E-sign GraphQL mutation + gated UI button

**Files:**
- Modify: `src/graphql/mutations.ts` (add `sendEsignEnvelope` mutation)
- Modify: `src/graphql/inputs.ts` (add input type) — follow the file's existing Pothos input pattern
- Create: `src/components/crm/send-esign-button.tsx` (client component)
- Modify: `src/app/(crm)/investors/[id]/page.tsx` and `src/app/(crm)/engagement/[id]/page.tsx` — render the button only when `isConfigured("docusign")`
- Test: `src/graphql/__tests__/esign-mutation.smoke.test.ts`

**Interfaces:**
- Consumes: `sendEsignEnvelope` (Task 6); `isConfigured` (Task 1).
- Produces: GraphQL mutation `sendEsignEnvelope(input: SendEsignInput!): EsignEnvelopeResult!`.

- [ ] **Step 1: Write the failing schema smoke test**

```ts
// src/graphql/__tests__/esign-mutation.smoke.test.ts
import { describe, it, expect } from "vitest";
import { schema } from "@/graphql/schema";
import { printSchema } from "graphql";

describe("esign mutation", () => {
  it("is present in the schema", () => {
    const sdl = printSchema(schema);
    expect(sdl).toMatch(/sendEsignEnvelope/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/graphql/__tests__/esign-mutation.smoke.test.ts`
Expected: FAIL — no `sendEsignEnvelope` in SDL.

- [ ] **Step 3: Add the input + mutation**

In `src/graphql/inputs.ts`, add (matching the existing `builder.inputType(...)` style in that file):

```ts
export const SendEsignInput = builder.inputType("SendEsignInput", {
  fields: (t) => ({
    kind: t.string({ required: true }),          // OpenNda | ClosedNda | TermSheet
    documentBase64: t.string({ required: true }),
    documentName: t.string({ required: true }),
    signerEmail: t.string({ required: true }),
    signerName: t.string({ required: true }),
    subject: t.string({ required: true }),
    investorId: t.id({ required: false }),
    engagementId: t.id({ required: false }),
    transactionId: t.id({ required: false }),
  }),
});
```

In `src/graphql/mutations.ts`, add a field to the existing `builder.mutationFields` (or `mutationType`) block. Follow the existing resolver pattern (they call service functions and read `ctx.actor`):

```ts
import { sendEsignEnvelope } from "@/server/services/esign";
import { SendEsignInput } from "./inputs";

// inside builder.mutationFields((t) => ({ ... })):
sendEsignEnvelope: t.field({
  type: EsignEnvelopeResult,           // define a simple object ref: { id, externalId, status } — mirror an existing small result type in types.ts
  args: { input: t.arg({ type: SendEsignInput, required: true }) },
  resolve: async (_root, { input }, ctx) =>
    sendEsignEnvelope({
      kind: input.kind as "OpenNda" | "ClosedNda" | "TermSheet",
      documentBase64: input.documentBase64,
      documentName: input.documentName,
      signer: { email: input.signerEmail, name: input.signerName },
      subject: input.subject,
      linkRecord: {
        investorId: input.investorId ?? undefined,
        engagementId: input.engagementId ?? undefined,
        transactionId: input.transactionId ?? undefined,
      },
    }, ctx.actor),
}),
```

Define `EsignEnvelopeResult` in `src/graphql/types.ts` mirroring an existing simple object type (fields `id: string`, `externalId: string`, `status: string`), then regenerate: `pnpm codegen` is not required for server SDL, but run `pnpm generate` if Pothos types need refresh.

- [ ] **Step 4: Write the gated UI button**

```tsx
// src/components/crm/send-esign-button.tsx
"use client";
// Rendered ONLY by a server parent that has already checked isConfigured("docusign").
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "urql";

const SEND = `
  mutation SendEsign($input: SendEsignInput!) {
    sendEsignEnvelope(input: $input) { id externalId status }
  }
`;

export function SendEsignButton(props: {
  kind: "OpenNda" | "ClosedNda" | "TermSheet";
  subject: string;
  signerEmail: string;
  signerName: string;
  investorId?: string;
  engagementId?: string;
  transactionId?: string;
}) {
  const router = useRouter();
  const [{ fetching }, send] = useMutation(SEND);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        className="rounded bg-[var(--t-tag-bg-violet)] px-3 py-1.5 text-sm font-medium text-[var(--t-tag-text-violet)] hover:opacity-80 disabled:opacity-50"
        disabled={fetching}
        onClick={async () => {
          // documentBase64 comes from the template the CRM stores for this kind; for the
          // first cut, pass an empty-string placeholder ONLY if a template picker is not yet
          // wired — but DO wire the template source before shipping (see spec §4). Here we
          // require it to be provided by the parent via a hidden template fetch.
          const res = await send({
            input: {
              kind: props.kind, documentBase64: await fetchTemplateBase64(props.kind),
              documentName: `${props.kind}.pdf`, signerEmail: props.signerEmail,
              signerName: props.signerName, subject: props.subject,
              investorId: props.investorId, engagementId: props.engagementId, transactionId: props.transactionId,
            },
          });
          if (res.error) setError(res.error.message);
          else router.refresh();
        }}
      >
        {fetching ? "Sending…" : "Send for e-signature"}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

// Template source: reads the stored NDA/term-sheet template document for this kind and
// returns its base64. Until a template is uploaded, this returns a minimal valid PDF so
// the flow is testable; replace with the real template lookup when documents exist.
async function fetchTemplateBase64(_kind: string): Promise<string> {
  // Minimal one-page PDF (base64) placeholder template — replace with a stored-template fetch.
  return "JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDIgMCBSPj4KZW5kb2JqCjIgMCBvYmoKPDwvVHlwZS9QYWdlcy9LaWRzWzMgMCBSXS9Db3VudCAxPj4KZW5kb2JqCjMgMCBvYmoKPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgNjEyIDc5Ml0+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTIgMDAwMDAgbiAKMDAwMDAwMDEwMSAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgNC9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjE3OAolJUVPRgo=";
}
```

- [ ] **Step 5: Gate the button in the server pages**

In `src/app/(crm)/investors/[id]/page.tsx` (Open NDA context) and `src/app/(crm)/engagement/[id]/page.tsx` (Closed NDA / term sheet context), import and conditionally render next to the existing Record-NDA button:

```tsx
import { isConfigured } from "@/server/integrations/config";
import { SendEsignButton } from "@/components/crm/send-esign-button";

// ...in JSX, beside <RecordOpenNdaButton .../> :
{isConfigured("docusign") && (
  <SendEsignButton kind="OpenNda" subject={`NDA — ${investor.name}`}
    signerEmail={primaryContactEmail} signerName={primaryContactName} investorId={investor.id} />
)}
```

(For engagement: `kind="ClosedNda"`, pass `engagementId`, and derive signer from the engagement's investor contact.)

- [ ] **Step 6: Run + verify (no keys → button absent; SDL has mutation)**

Run: `pnpm test src/graphql/__tests__/esign-mutation.smoke.test.ts`
Expected: PASS. Manually confirm with `DOCUSIGN_ENABLED` unset that the pages render without the new button (covered by the final Playwright pass).

- [ ] **Step 7: Verification gate + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/graphql src/components/crm/send-esign-button.tsx "src/app/(crm)/investors/[id]/page.tsx" "src/app/(crm)/engagement/[id]/page.tsx"
git commit -m "feat(integrations): e-sign mutation + gated Send-for-signature button"
```

---

## Task 9: Docshare provider seam (interface + null default + factory)

**Files:**
- Create: `src/server/integrations/docshare/provider.ts`
- Create: `src/server/integrations/docshare/null.ts`
- Test: `src/server/integrations/docshare/__tests__/provider.test.ts`

**Interfaces:**
- Consumes: `boxConfigured()` (Task 1); `BoxProvider` (Task 10, lazy).
- Produces:
  - `interface ShareDocumentInput { documentId: string; bytes: Buffer; filename: string; contentType: string; watermark: boolean; password?: string; expiresAt?: Date; allowDownload: boolean }`
  - `interface ShareResult { externalFileId: string; sharedUrl: string; watermarkApplied: boolean }`
  - `interface DocShareProvider { shareDocument(i: ShareDocumentInput): Promise<ShareResult>; revokeShare(externalFileId: string): Promise<void> }`
  - `function getDocShareProvider(): DocShareProvider`

- [ ] **Step 1: Write the failing test**

```ts
// src/server/integrations/docshare/__tests__/provider.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDocShareProvider } from "../provider";

let saved: string | undefined;
beforeEach(() => { saved = process.env.BOX_ENABLED; delete process.env.BOX_ENABLED; });
afterEach(() => { if (saved === undefined) delete process.env.BOX_ENABLED; else process.env.BOX_ENABLED = saved; });

describe("getDocShareProvider", () => {
  it("returns the null provider when Box is unconfigured; sharing refuses", async () => {
    await expect(getDocShareProvider().shareDocument({
      documentId: "d1", bytes: Buffer.from("x"), filename: "f.pdf", contentType: "application/pdf",
      watermark: true, allowDownload: false,
    })).rejects.toThrow(/not configured/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/server/integrations/docshare/__tests__/provider.test.ts`
Expected: FAIL — cannot find `../provider`.

- [ ] **Step 3: Write `null.ts`**

```ts
// src/server/integrations/docshare/null.ts
import { IntegrationError } from "../errors";
import type { DocShareProvider } from "./provider";

export class NullDocShareProvider implements DocShareProvider {
  async shareDocument(): Promise<never> { throw new IntegrationError("Document sharing (Box) not configured", 503); }
  async revokeShare(): Promise<void> { /* no-op: nothing was ever shared */ }
}
```

- [ ] **Step 4: Write `provider.ts`**

```ts
// src/server/integrations/docshare/provider.ts
import { boxConfigured } from "../config";
import { NullDocShareProvider } from "./null";

export interface ShareDocumentInput {
  documentId: string; bytes: Buffer; filename: string; contentType: string;
  watermark: boolean; password?: string; expiresAt?: Date; allowDownload: boolean;
}
export interface ShareResult { externalFileId: string; sharedUrl: string; watermarkApplied: boolean }

export interface DocShareProvider {
  shareDocument(input: ShareDocumentInput): Promise<ShareResult>;
  revokeShare(externalFileId: string): Promise<void>;
}

export function getDocShareProvider(): DocShareProvider {
  if (boxConfigured()) {
    const { BoxProvider } = require("./box") as typeof import("./box");
    return new BoxProvider();
  }
  return new NullDocShareProvider();
}
```

- [ ] **Step 5: Run + verify**

Run: `pnpm test src/server/integrations/docshare/__tests__/provider.test.ts`
Expected: PASS.

- [ ] **Step 6: Verification gate + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/server/integrations/docshare
git commit -m "feat(integrations): docshare provider seam + null default"
```

---

## Task 10: Box real provider (CCG + upload + watermark + shared link)

**Files:**
- Create: `src/server/integrations/docshare/box.ts`
- Test: `src/server/integrations/docshare/__tests__/box.test.ts`

**Interfaces:**
- Consumes: `boxEnv()` (Task 1); `IntegrationError`; `DocShareProvider`, `ShareDocumentInput`, `ShareResult` (Task 9).
- Produces: `class BoxProvider implements DocShareProvider`; exported pure helper `function buildSharedLinkBody(i: ShareDocumentInput): object`.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/integrations/docshare/__tests__/box.test.ts
import { describe, it, expect } from "vitest";
import { buildSharedLinkBody } from "../box";

describe("buildSharedLinkBody", () => {
  it("sets open access, password, expiry and can_download per input", () => {
    const body = buildSharedLinkBody({
      documentId: "d1", bytes: Buffer.from(""), filename: "f.pdf", contentType: "application/pdf",
      watermark: true, password: "pw", expiresAt: new Date("2026-08-01T00:00:00Z"), allowDownload: true,
    }) as any;
    expect(body.shared_link.access).toBe("open");
    expect(body.shared_link.password).toBe("pw");
    expect(body.shared_link.unshared_at).toBe("2026-08-01T00:00:00.000Z");
    expect(body.shared_link.permissions.can_download).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/server/integrations/docshare/__tests__/box.test.ts`
Expected: FAIL — cannot find `../box`.

- [ ] **Step 3: Write `box.ts`**

```ts
// src/server/integrations/docshare/box.ts
// Box Content Cloud via Client Credentials Grant (service account). Upload a
// copy, apply the default watermark, mint a permissioned shared link. Bytes of
// record stay in the CRM's storage seam; Box holds only the shared copy.
import { boxEnv } from "../config";
import { IntegrationError } from "../errors";
import type { DocShareProvider, ShareDocumentInput, ShareResult } from "./provider";

export function buildSharedLinkBody(i: ShareDocumentInput): object {
  return {
    shared_link: {
      access: "open",
      ...(i.password ? { password: i.password } : {}),
      ...(i.expiresAt ? { unshared_at: i.expiresAt.toISOString() } : {}),
      permissions: { can_download: i.allowDownload, can_preview: true },
    },
  };
}

let cache: { token: string; expiresAt: number } | null = null;
async function token(fetchImpl: typeof fetch): Promise<string> {
  const now = Date.now();
  if (cache && cache.expiresAt > now + 60_000) return cache.token;
  const env = boxEnv();
  const res = await fetchImpl("https://api.box.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials", client_id: env.clientId, client_secret: env.clientSecret,
      box_subject_type: env.subjectType, box_subject_id: env.subjectId,
    }),
  });
  if (!res.ok) throw new IntegrationError(`Box token failed (${res.status})`, 502);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cache = { token: j.access_token, expiresAt: now + j.expires_in * 1000 };
  return j.access_token;
}

export class BoxProvider implements DocShareProvider {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async shareDocument(input: ShareDocumentInput): Promise<ShareResult> {
    const t = await token(this.fetchImpl);
    const env = boxEnv();

    // 1. Upload (multipart; attributes part MUST precede the file part).
    const form = new FormData();
    form.append("attributes", JSON.stringify({ name: input.filename, parent: { id: env.rootFolderId } }));
    form.append("file", new Blob([input.bytes], { type: input.contentType }), input.filename);
    const upRes = await this.fetchImpl("https://upload.box.com/api/2.0/files/content", {
      method: "POST", headers: { Authorization: `Bearer ${t}` }, body: form,
    });
    if (!upRes.ok) throw new IntegrationError(`Box upload failed (${upRes.status})`, 502);
    const fileId = ((await upRes.json()) as { entries: { id: string }[] }).entries[0].id;

    // 2. Watermark (best-effort; requires Business+ plan).
    let watermarkApplied = false;
    if (input.watermark) {
      const wmRes = await this.fetchImpl(`https://api.box.com/2.0/files/${fileId}/watermark`, {
        method: "PUT", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ watermark: { imprint: "default" } }),
      });
      watermarkApplied = wmRes.ok;
    }

    // 3. Shared link.
    const slRes = await this.fetchImpl(`https://api.box.com/2.0/files/${fileId}?fields=shared_link`, {
      method: "PUT", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildSharedLinkBody(input)),
    });
    if (!slRes.ok) throw new IntegrationError(`Box shared link failed (${slRes.status})`, 502);
    const sharedUrl = ((await slRes.json()) as { shared_link: { url: string } }).shared_link.url;

    return { externalFileId: fileId, sharedUrl, watermarkApplied };
  }

  async revokeShare(externalFileId: string): Promise<void> {
    const t = await token(this.fetchImpl);
    await this.fetchImpl(`https://api.box.com/2.0/files/${externalFileId}?fields=shared_link`, {
      method: "PUT", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ shared_link: null }),
    }).catch(() => {});
  }
}
```

- [ ] **Step 4: Run + verify**

Run: `pnpm test src/server/integrations/docshare/__tests__/box.test.ts`
Expected: PASS.

- [ ] **Step 5: Verification gate + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/server/integrations/docshare/box.ts src/server/integrations/docshare/__tests__/box.test.ts
git commit -m "feat(integrations): Box CCG upload + watermark + shared-link client"
```

---

## Task 11: Docshare service (persist share on Document)

**Files:**
- Create: `src/server/services/docshare.ts`
- Test: `src/server/services/__tests__/docshare.smoke.test.ts`

**Interfaces:**
- Consumes: `getDocShareProvider()` (Task 9); Prisma `document` (`boxFileId`, `boxSharedLinkUrl`, `boxWatermarkApplied`).
- Produces: `async function shareDocumentViaBox(documentId: string, bytes: Buffer, opts: { filename: string; contentType: string; watermark?: boolean; password?: string; expiresAt?: Date; allowDownload?: boolean }): Promise<{ sharedUrl: string }>`.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/services/__tests__/docshare.smoke.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/server/integrations/docshare/provider", () => ({
  getDocShareProvider: () => ({
    shareDocument: vi.fn(async () => ({ externalFileId: "box-1", sharedUrl: "https://box/s/abc", watermarkApplied: true })),
    revokeShare: vi.fn(),
  }),
}));
import { shareDocumentViaBox } from "../docshare";
import { prisma } from "@/lib/db";

let docId: string;
beforeEach(async () => {
  const d = await prisma.document.create({ data: { name: "T", type: "NDA", fileUrl: "http://x" } as never });
  docId = d.id;
});

describe("shareDocumentViaBox", () => {
  it("shares and writes box fields onto the Document", async () => {
    const out = await shareDocumentViaBox(docId, Buffer.from("x"), { filename: "f.pdf", contentType: "application/pdf", watermark: true });
    expect(out.sharedUrl).toBe("https://box/s/abc");
    const d = await prisma.document.findUnique({ where: { id: docId } });
    expect(d?.boxFileId).toBe("box-1");
    expect(d?.boxSharedLinkUrl).toBe("https://box/s/abc");
    expect(d?.boxWatermarkApplied).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/server/services/__tests__/docshare.smoke.test.ts`
Expected: FAIL — cannot find `../docshare`.

- [ ] **Step 3: Write `docshare.ts`**

```ts
// src/server/services/docshare.ts
import { prisma } from "@/lib/db";
import { getDocShareProvider } from "@/server/integrations/docshare/provider";

export async function shareDocumentViaBox(
  documentId: string,
  bytes: Buffer,
  opts: { filename: string; contentType: string; watermark?: boolean; password?: string; expiresAt?: Date; allowDownload?: boolean },
): Promise<{ sharedUrl: string }> {
  const result = await getDocShareProvider().shareDocument({
    documentId, bytes, filename: opts.filename, contentType: opts.contentType,
    watermark: opts.watermark ?? true, password: opts.password, expiresAt: opts.expiresAt,
    allowDownload: opts.allowDownload ?? false,
  });
  await prisma.document.update({
    where: { id: documentId },
    data: { boxFileId: result.externalFileId, boxSharedLinkUrl: result.sharedUrl, boxWatermarkApplied: result.watermarkApplied },
  });
  return { sharedUrl: result.sharedUrl };
}
```

- [ ] **Step 4: Run + verify**

Run: `pnpm test src/server/services/__tests__/docshare.smoke.test.ts`
Expected: PASS (dev DB up).

- [ ] **Step 5: Verification gate + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/server/services/docshare.ts src/server/services/__tests__/docshare.smoke.test.ts
git commit -m "feat(integrations): docshare service persists Box share on Document"
```

---

## Task 12: Box webhook (preview/download tracking → DocumentAccessLog)

**Files:**
- Create: `src/app/api/integrations/box/webhook/route.ts`
- Create: `src/server/integrations/docshare/webhook.ts` (pure: signature verify + event parse)
- Test: `src/server/integrations/docshare/__tests__/webhook.test.ts`

**Interfaces:**
- Consumes: `boxConfigured()`, `boxEnv()` (Task 1); Prisma `document`, `documentAccessLog`.
- Produces: `function verifyBoxSignature(rawBody, headers, primary, secondary): boolean`; `function parseBoxEvent(json): { trigger: string; boxFileId: string } | null`.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/integrations/docshare/__tests__/webhook.test.ts
import { describe, it, expect } from "vitest";
import { parseBoxEvent } from "../webhook";

describe("parseBoxEvent", () => {
  it("extracts trigger + file id", () => {
    expect(parseBoxEvent({ trigger: "FILE.DOWNLOADED", source: { id: "box-1", type: "file" } }))
      .toEqual({ trigger: "FILE.DOWNLOADED", boxFileId: "box-1" });
  });
  it("returns null when not a file event", () => {
    expect(parseBoxEvent({ trigger: "FOLDER.CREATED", source: { id: "1", type: "folder" } })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/server/integrations/docshare/__tests__/webhook.test.ts`
Expected: FAIL — cannot find `../webhook`.

- [ ] **Step 3: Write `webhook.ts`**

```ts
// src/server/integrations/docshare/webhook.ts
import { createHmac, timingSafeEqual } from "node:crypto";

// Box signs with HMAC-SHA256 over (body + timestamp) using primary/secondary keys.
export function verifyBoxSignature(
  rawBody: string, headers: { signaturePrimary: string | null; signatureSecondary: string | null; timestamp: string | null },
  primary: string, secondary: string,
): boolean {
  const check = (key: string, sig: string | null) => {
    if (!key || !sig) return false;
    const mac = createHmac("sha256", key).update(rawBody + (headers.timestamp ?? ""), "utf8").digest("base64");
    const a = Buffer.from(mac); const b = Buffer.from(sig);
    return a.length === b.length && timingSafeEqual(a, b);
  };
  return check(primary, headers.signaturePrimary) || check(secondary, headers.signatureSecondary);
}

export function parseBoxEvent(json: unknown): { trigger: string; boxFileId: string } | null {
  const j = json as { trigger?: string; source?: { id?: string; type?: string } };
  if (!j?.trigger || j.source?.type !== "file" || !j.source.id) return null;
  if (j.trigger !== "FILE.PREVIEWED" && j.trigger !== "FILE.DOWNLOADED") return null;
  return { trigger: j.trigger, boxFileId: j.source.id };
}
```

- [ ] **Step 4: Write the route**

```ts
// src/app/api/integrations/box/webhook/route.ts
import { NextResponse } from "next/server";
import { boxConfigured, boxEnv } from "@/server/integrations/config";
import { verifyBoxSignature, parseBoxEvent } from "@/server/integrations/docshare/webhook";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!boxConfigured()) return new NextResponse("Not found", { status: 404 });
  const raw = await req.text();
  const env = boxEnv();
  const ok = verifyBoxSignature(raw, {
    signaturePrimary: req.headers.get("box-signature-primary"),
    signatureSecondary: req.headers.get("box-signature-secondary"),
    timestamp: req.headers.get("box-signature-timestamp"),
  }, env.webhookPrimary, env.webhookSecondary);
  if (!ok) return new NextResponse("Invalid signature", { status: 401 });

  const evt = parseBoxEvent(JSON.parse(raw));
  if (evt) {
    const doc = await prisma.document.findFirst({ where: { boxFileId: evt.boxFileId }, select: { id: true } });
    if (doc) {
      await prisma.documentAccessLog.create({
        data: { documentId: doc.id, userId: null, action: evt.trigger === "FILE.DOWNLOADED" ? "DOWNLOAD" : "PREVIEW", source: "box" },
      });
    }
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run + verify**

Run: `pnpm test src/server/integrations/docshare/__tests__/webhook.test.ts`
Expected: PASS.

- [ ] **Step 6: (Task 12b) Gated "Share via Box" control**

Create `src/components/crm/share-box-button.tsx` mirroring `send-esign-button.tsx` (client component calling a `shareDocumentViaBox` GraphQL mutation — add that mutation in `mutations.ts` the same way as Task 8, taking `documentId`). Render it in `src/app/(crm)/documents/page.tsx` (and/or the document drawer) only inside `{isConfigured("box") && ...}`. The mutation reads the document's bytes from the storage seam (`getStorageProvider().get(storageKey)`) or fetches `fileUrl`; pass those bytes to `shareDocumentViaBox`.

- [ ] **Step 7: Verification gate + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/app/api/integrations/box src/server/integrations/docshare/webhook.ts src/server/integrations/docshare/__tests__/webhook.test.ts src/components/crm/share-box-button.tsx "src/app/(crm)/documents/page.tsx" src/graphql
git commit -m "feat(integrations): Box webhook tracking + gated Share-via-Box control"
```

---

## Task 13: Meetings provider seam (interface + manual default + factory)

**Files:**
- Create: `src/server/integrations/meetings/provider.ts`
- Create: `src/server/integrations/meetings/manual.ts`
- Test: `src/server/integrations/meetings/__tests__/provider.test.ts`

**Interfaces:**
- Consumes: `teamsConfigured()` (Task 1); `TeamsMeetingProvider` (Task 14, lazy).
- Produces:
  - `interface ScheduleMeetingInput { subject: string; startAt: Date; endAt: Date; attendees: { email: string; name?: string }[]; linkRecord: { engagementId?: string; transactionId?: string; investorId?: string } }`
  - `interface MeetingResult { externalId: string; joinUrl: string }`
  - `interface MeetingProvider { scheduleMeeting(i: ScheduleMeetingInput): Promise<MeetingResult>; cancelMeeting(externalId: string): Promise<void> }`
  - `function getMeetingProvider(): MeetingProvider`

- [ ] **Step 1: Write the failing test**

```ts
// src/server/integrations/meetings/__tests__/provider.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMeetingProvider } from "../provider";

let saved: string | undefined;
beforeEach(() => { saved = process.env.TEAMS_ENABLED; delete process.env.TEAMS_ENABLED; });
afterEach(() => { if (saved === undefined) delete process.env.TEAMS_ENABLED; else process.env.TEAMS_ENABLED = saved; });

describe("getMeetingProvider", () => {
  it("returns the manual provider when Teams is unconfigured; scheduling refuses", async () => {
    await expect(getMeetingProvider().scheduleMeeting({
      subject: "s", startAt: new Date(), endAt: new Date(), attendees: [], linkRecord: {},
    })).rejects.toThrow(/not configured/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/server/integrations/meetings/__tests__/provider.test.ts`
Expected: FAIL — cannot find `../provider`.

- [ ] **Step 3: Write `manual.ts`**

```ts
// src/server/integrations/meetings/manual.ts
import { IntegrationError } from "../errors";
import type { MeetingProvider } from "./provider";

export class ManualMeetingProvider implements MeetingProvider {
  async scheduleMeeting(): Promise<never> { throw new IntegrationError("Teams meetings not configured", 503); }
  async cancelMeeting(): Promise<void> { /* no-op */ }
}
```

- [ ] **Step 4: Write `provider.ts`**

```ts
// src/server/integrations/meetings/provider.ts
import { teamsConfigured } from "../config";
import { ManualMeetingProvider } from "./manual";

export interface ScheduleMeetingInput {
  subject: string; startAt: Date; endAt: Date;
  attendees: { email: string; name?: string }[];
  linkRecord: { engagementId?: string; transactionId?: string; investorId?: string };
}
export interface MeetingResult { externalId: string; joinUrl: string }

export interface MeetingProvider {
  scheduleMeeting(input: ScheduleMeetingInput): Promise<MeetingResult>;
  cancelMeeting(externalId: string): Promise<void>;
}

export function getMeetingProvider(): MeetingProvider {
  if (teamsConfigured()) {
    const { TeamsMeetingProvider } = require("./teams") as typeof import("./teams");
    return new TeamsMeetingProvider();
  }
  return new ManualMeetingProvider();
}
```

- [ ] **Step 5: Run + verify**

Run: `pnpm test src/server/integrations/meetings/__tests__/provider.test.ts`
Expected: PASS.

- [ ] **Step 6: Verification gate + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/server/integrations/meetings
git commit -m "feat(integrations): meetings provider seam + manual default"
```

---

## Task 14: Teams real provider (Graph calendar event w/ online meeting)

**Files:**
- Create: `src/server/integrations/meetings/teams.ts`
- Test: `src/server/integrations/meetings/__tests__/teams.test.ts`

**Interfaces:**
- Consumes: `graphEnv()` (Task 1); `getGraphToken` (Task 2); `IntegrationError`; `MeetingProvider`, `ScheduleMeetingInput`, `MeetingResult` (Task 13).
- Produces: `class TeamsMeetingProvider implements MeetingProvider`; exported pure helper `function buildEventBody(i: ScheduleMeetingInput): object`.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/integrations/meetings/__tests__/teams.test.ts
import { describe, it, expect } from "vitest";
import { buildEventBody } from "../teams";

describe("buildEventBody", () => {
  it("builds a Teams online-meeting event with attendees", () => {
    const body = buildEventBody({
      subject: "Intro call",
      startAt: new Date("2026-07-12T14:30:00Z"), endAt: new Date("2026-07-12T15:00:00Z"),
      attendees: [{ email: "investor@x.com", name: "Investor" }], linkRecord: {},
    }) as any;
    expect(body.subject).toBe("Intro call");
    expect(body.isOnlineMeeting).toBe(true);
    expect(body.onlineMeetingProvider).toBe("teamsForBusiness");
    expect(body.start).toEqual({ dateTime: "2026-07-12T14:30:00.000Z", timeZone: "UTC" });
    expect(body.attendees[0]).toEqual({ emailAddress: { address: "investor@x.com", name: "Investor" }, type: "required" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/server/integrations/meetings/__tests__/teams.test.ts`
Expected: FAIL — cannot find `../teams`.

- [ ] **Step 3: Write `teams.ts`**

```ts
// src/server/integrations/meetings/teams.ts
// Teams meeting = a Graph calendar event with isOnlineMeeting. Auto-invites
// attendees and returns onlineMeeting.joinUrl. Needs only Calendars.ReadWrite.
import { graphEnv } from "../config";
import { getGraphToken } from "../msgraph/auth";
import { IntegrationError } from "../errors";
import type { MeetingProvider, ScheduleMeetingInput, MeetingResult } from "./provider";

export function buildEventBody(i: ScheduleMeetingInput): object {
  return {
    subject: i.subject,
    start: { dateTime: i.startAt.toISOString(), timeZone: "UTC" },
    end: { dateTime: i.endAt.toISOString(), timeZone: "UTC" },
    attendees: i.attendees.map((a) => ({ emailAddress: { address: a.email, name: a.name ?? a.email }, type: "required" })),
    isOnlineMeeting: true,
    onlineMeetingProvider: "teamsForBusiness",
  };
}

export class TeamsMeetingProvider implements MeetingProvider {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async scheduleMeeting(input: ScheduleMeetingInput): Promise<MeetingResult> {
    const token = await getGraphToken(this.fetchImpl);
    const { organizerId } = graphEnv();
    const res = await this.fetchImpl(`https://graph.microsoft.com/v1.0/users/${organizerId}/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildEventBody(input)),
    });
    if (!res.ok) throw new IntegrationError(`Graph event create failed (${res.status})`, 502);
    const j = (await res.json()) as { id: string; onlineMeeting?: { joinUrl?: string } };
    return { externalId: j.id, joinUrl: j.onlineMeeting?.joinUrl ?? "" };
  }

  async cancelMeeting(externalId: string): Promise<void> {
    const token = await getGraphToken(this.fetchImpl);
    const { organizerId } = graphEnv();
    await this.fetchImpl(`https://graph.microsoft.com/v1.0/users/${organizerId}/events/${externalId}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
}
```

- [ ] **Step 4: Run + verify**

Run: `pnpm test src/server/integrations/meetings/__tests__/teams.test.ts`
Expected: PASS.

- [ ] **Step 5: Verification gate + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/server/integrations/meetings/teams.ts src/server/integrations/meetings/__tests__/teams.test.ts
git commit -m "feat(integrations): Teams meeting client (Graph events)"
```

---

## Task 15: Meetings service + gated UI

**Files:**
- Create: `src/server/services/meetings.ts`
- Modify: `src/graphql/mutations.ts` + `src/graphql/inputs.ts` (add `scheduleMeeting` mutation, mirror Task 8)
- Create: `src/components/crm/schedule-teams-button.tsx` (mirror `send-esign-button.tsx`)
- Modify: `src/app/(crm)/engagement/[id]/page.tsx` (+ transaction detail) to render only when `isConfigured("teams")`
- Test: `src/server/services/__tests__/meetings.smoke.test.ts`

**Interfaces:**
- Consumes: `getMeetingProvider()` (Task 13); Prisma `meeting`, `activity`; `actorSource`, `Actor`.
- Produces: `async function scheduleMeeting(input: ScheduleMeetingInput, actor: Actor): Promise<{ id: string; joinUrl: string }>`.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/services/__tests__/meetings.smoke.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/server/integrations/meetings/provider", () => ({
  getMeetingProvider: () => ({
    scheduleMeeting: vi.fn(async () => ({ externalId: "evt-1", joinUrl: "https://teams/join" })),
    cancelMeeting: vi.fn(),
  }),
}));
import { scheduleMeeting } from "../meetings";
import { prisma } from "@/lib/db";

beforeEach(async () => { await prisma.meeting.deleteMany({ where: { externalId: "evt-1" } }); });

describe("scheduleMeeting", () => {
  it("persists a Meeting row and logs a Meeting Activity", async () => {
    const out = await scheduleMeeting({
      subject: "Intro", startAt: new Date(), endAt: new Date(), attendees: [{ email: "i@x.com" }], linkRecord: {},
    }, { source: "API" } as any);
    expect(out.joinUrl).toBe("https://teams/join");
    const m = await prisma.meeting.findFirst({ where: { externalId: "evt-1" } });
    expect(m?.joinUrl).toBe("https://teams/join");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/server/services/__tests__/meetings.smoke.test.ts`
Expected: FAIL — cannot find `../meetings`.

- [ ] **Step 3: Write `meetings.ts`**

```ts
// src/server/services/meetings.ts
import { prisma } from "@/lib/db";
import { actorSource } from "./crud";
import type { Actor } from "@/graphql/context";
import { getMeetingProvider, type ScheduleMeetingInput } from "@/server/integrations/meetings/provider";
import { graphEnv } from "@/server/integrations/config";

export async function scheduleMeeting(input: ScheduleMeetingInput, actor: Actor) {
  const result = await getMeetingProvider().scheduleMeeting(input);
  const meeting = await prisma.meeting.create({
    data: {
      provider: "teams", externalId: result.externalId, joinUrl: result.joinUrl, subject: input.subject,
      startAt: input.startAt, endAt: input.endAt, organizerUserId: graphEnv().organizerId,
      engagementId: input.linkRecord.engagementId ?? null,
      transactionId: input.linkRecord.transactionId ?? null,
      investorId: input.linkRecord.investorId ?? null,
      createdSource: actorSource(actor),
    },
  });
  // Mirror the manual meeting-logging shape so timelines are consistent.
  await prisma.activity.create({
    data: {
      type: "Meeting", subject: input.subject,
      engagementId: input.linkRecord.engagementId ?? null,
      transactionId: input.linkRecord.transactionId ?? null,
      investorId: input.linkRecord.investorId ?? null,
      createdSource: actorSource(actor),
    },
  });
  return { id: meeting.id, joinUrl: meeting.joinUrl };
}
```

- [ ] **Step 4: Add mutation + gated UI** (mirror Task 8; `ScheduleMeetingInput` GraphQL input with subject/start/end/attendees(JSON string of email+name)/link ids). Render `<ScheduleTeamsButton>` only inside `{isConfigured("teams") && ...}`.

- [ ] **Step 5: Run + verify**

Run: `pnpm test src/server/services/__tests__/meetings.smoke.test.ts`
Expected: PASS (dev DB up).

- [ ] **Step 6: Verification gate + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/server/services/meetings.ts src/server/services/__tests__/meetings.smoke.test.ts src/graphql src/components/crm/schedule-teams-button.tsx "src/app/(crm)/engagement/[id]/page.tsx"
git commit -m "feat(integrations): schedule-meeting service + gated Teams button"
```

---

## Task 16: Mailsync provider seam (interface + off default + factory)

**Files:**
- Create: `src/server/integrations/mailsync/provider.ts`
- Create: `src/server/integrations/mailsync/off.ts`
- Test: `src/server/integrations/mailsync/__tests__/provider.test.ts`

**Interfaces:**
- Consumes: `outlookConfigured()` (Task 1); `OutlookMailProvider` (Task 17, lazy).
- Produces:
  - `interface TrackedMessage { externalId: string; conversationId?: string; subject?: string; fromAddress?: string; toAddresses: string[]; receivedAt?: Date; sentAt?: Date; bodyPreview?: string }`
  - `interface MailSyncProvider { listMessages(mailbox: string, since?: Date): Promise<TrackedMessage[]>; ensureSubscription(mailbox: string, notificationUrl: string): Promise<{ subscriptionId: string; expiresAt: Date }>; renewSubscription(subscriptionId: string): Promise<{ expiresAt: Date }> }`
  - `function getMailSyncProvider(): MailSyncProvider`

- [ ] **Step 1: Write the failing test**

```ts
// src/server/integrations/mailsync/__tests__/provider.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMailSyncProvider } from "../provider";

let saved: string | undefined;
beforeEach(() => { saved = process.env.OUTLOOK_ENABLED; delete process.env.OUTLOOK_ENABLED; });
afterEach(() => { if (saved === undefined) delete process.env.OUTLOOK_ENABLED; else process.env.OUTLOOK_ENABLED = saved; });

describe("getMailSyncProvider", () => {
  it("returns the off provider when Outlook is unconfigured; listing yields nothing", async () => {
    expect(await getMailSyncProvider().listMessages("a@x.com")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/server/integrations/mailsync/__tests__/provider.test.ts`
Expected: FAIL — cannot find `../provider`.

- [ ] **Step 3: Write `off.ts`**

```ts
// src/server/integrations/mailsync/off.ts
// Disabled provider: no capture. Email remains a manual comm channel.
import type { MailSyncProvider, TrackedMessage } from "./provider";

export class OffMailProvider implements MailSyncProvider {
  async listMessages(): Promise<TrackedMessage[]> { return []; }
  async ensureSubscription(): Promise<{ subscriptionId: string; expiresAt: Date }> {
    return { subscriptionId: "", expiresAt: new Date(0) };
  }
  async renewSubscription(): Promise<{ expiresAt: Date }> { return { expiresAt: new Date(0) }; }
}
```

- [ ] **Step 4: Write `provider.ts`**

```ts
// src/server/integrations/mailsync/provider.ts
import { outlookConfigured } from "../config";
import { OffMailProvider } from "./off";

export interface TrackedMessage {
  externalId: string; conversationId?: string; subject?: string;
  fromAddress?: string; toAddresses: string[]; receivedAt?: Date; sentAt?: Date; bodyPreview?: string;
}
export interface MailSyncProvider {
  listMessages(mailbox: string, since?: Date): Promise<TrackedMessage[]>;
  ensureSubscription(mailbox: string, notificationUrl: string): Promise<{ subscriptionId: string; expiresAt: Date }>;
  renewSubscription(subscriptionId: string): Promise<{ expiresAt: Date }>;
}

export function getMailSyncProvider(): MailSyncProvider {
  if (outlookConfigured()) {
    const { OutlookMailProvider } = require("./outlook") as typeof import("./outlook");
    return new OutlookMailProvider();
  }
  return new OffMailProvider();
}
```

- [ ] **Step 5: Run + verify → commit**

Run: `pnpm test src/server/integrations/mailsync/__tests__/provider.test.ts`
Expected: PASS.

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/server/integrations/mailsync
git commit -m "feat(integrations): mailsync provider seam + off default"
```

---

## Task 17: Outlook real provider (Graph mail read + subscription)

**Files:**
- Create: `src/server/integrations/mailsync/outlook.ts`
- Test: `src/server/integrations/mailsync/__tests__/outlook.test.ts`

**Interfaces:**
- Consumes: `getGraphToken` (Task 2); `IntegrationError`; `MailSyncProvider`, `TrackedMessage` (Task 16).
- Produces: `class OutlookMailProvider implements MailSyncProvider`; exported pure helper `function mapGraphMessage(m: unknown): TrackedMessage`.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/integrations/mailsync/__tests__/outlook.test.ts
import { describe, it, expect } from "vitest";
import { mapGraphMessage } from "../outlook";

describe("mapGraphMessage", () => {
  it("maps Graph message fields to TrackedMessage", () => {
    const m = mapGraphMessage({
      id: "m1", conversationId: "c1", subject: "Deal",
      from: { emailAddress: { address: "investor@x.com" } },
      toRecipients: [{ emailAddress: { address: "team@ns.com" } }],
      receivedDateTime: "2026-07-09T09:00:00Z", sentDateTime: "2026-07-09T08:59:00Z", bodyPreview: "hi",
    });
    expect(m).toEqual({
      externalId: "m1", conversationId: "c1", subject: "Deal",
      fromAddress: "investor@x.com", toAddresses: ["team@ns.com"],
      receivedAt: new Date("2026-07-09T09:00:00Z"), sentAt: new Date("2026-07-09T08:59:00Z"), bodyPreview: "hi",
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/server/integrations/mailsync/__tests__/outlook.test.ts`
Expected: FAIL — cannot find `../outlook`.

- [ ] **Step 3: Write `outlook.ts`**

```ts
// src/server/integrations/mailsync/outlook.ts
import { getGraphToken } from "../msgraph/auth";
import { IntegrationError } from "../errors";
import type { MailSyncProvider, TrackedMessage } from "./provider";

const SELECT = "subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,conversationId,bodyPreview,isRead";

export function mapGraphMessage(m: unknown): TrackedMessage {
  const g = m as {
    id: string; conversationId?: string; subject?: string;
    from?: { emailAddress?: { address?: string } };
    toRecipients?: { emailAddress?: { address?: string } }[];
    receivedDateTime?: string; sentDateTime?: string; bodyPreview?: string;
  };
  return {
    externalId: g.id, conversationId: g.conversationId, subject: g.subject,
    fromAddress: g.from?.emailAddress?.address,
    toAddresses: (g.toRecipients ?? []).map((r) => r.emailAddress?.address).filter((a): a is string => Boolean(a)),
    receivedAt: g.receivedDateTime ? new Date(g.receivedDateTime) : undefined,
    sentAt: g.sentDateTime ? new Date(g.sentDateTime) : undefined,
    bodyPreview: g.bodyPreview,
  };
}

export class OutlookMailProvider implements MailSyncProvider {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async listMessages(mailbox: string, since?: Date): Promise<TrackedMessage[]> {
    const token = await getGraphToken(this.fetchImpl);
    const params = new URLSearchParams({ $select: SELECT, $top: "50" });
    if (since) params.set("$filter", `receivedDateTime ge ${since.toISOString()}`);
    const res = await this.fetchImpl(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new IntegrationError(`Graph mail list failed (${res.status})`, 502);
    const j = (await res.json()) as { value: unknown[] };
    return j.value.map(mapGraphMessage);
  }

  async ensureSubscription(mailbox: string, notificationUrl: string): Promise<{ subscriptionId: string; expiresAt: Date }> {
    const token = await getGraphToken(this.fetchImpl);
    const expiresAt = new Date(Date.now() + 4230 * 60 * 1000); // ~max for message subscriptions
    const res = await this.fetchImpl("https://graph.microsoft.com/v1.0/subscriptions", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        changeType: "created", notificationUrl, resource: `/users/${mailbox}/messages`,
        expirationDateTime: expiresAt.toISOString(), clientState: "ns-crm",
      }),
    });
    if (!res.ok) throw new IntegrationError(`Graph subscription failed (${res.status})`, 502);
    const j = (await res.json()) as { id: string; expirationDateTime: string };
    return { subscriptionId: j.id, expiresAt: new Date(j.expirationDateTime) };
  }

  async renewSubscription(subscriptionId: string): Promise<{ expiresAt: Date }> {
    const token = await getGraphToken(this.fetchImpl);
    const expiresAt = new Date(Date.now() + 4230 * 60 * 1000);
    const res = await this.fetchImpl(`https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`, {
      method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expirationDateTime: expiresAt.toISOString() }),
    });
    if (!res.ok) throw new IntegrationError(`Graph subscription renew failed (${res.status})`, 502);
    return { expiresAt };
  }
}
```

- [ ] **Step 4: Run + verify → commit**

Run: `pnpm test src/server/integrations/mailsync/__tests__/outlook.test.ts`
Expected: PASS.

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/server/integrations/mailsync/outlook.ts src/server/integrations/mailsync/__tests__/outlook.test.ts
git commit -m "feat(integrations): Outlook mail-read + subscription client"
```

---

## Task 18: Mail matching + ingestion service

**Files:**
- Create: `src/server/integrations/mailsync/match.ts` (pure matcher)
- Create: `src/server/services/mailsync.ts` (ingestion → EmailMessage)
- Test: `src/server/integrations/mailsync/__tests__/match.test.ts`

**Interfaces:**
- Consumes: `TrackedMessage` (Task 16); Prisma `emailMessage`, `investor`, `person`.
- Produces: `function matchMessageToRecord(msg: TrackedMessage, known: { investorId: string; emails: string[] }[]): { investorId?: string; matchedBy?: string }`; `async function ingestMessage(mailbox: string, msg: TrackedMessage): Promise<void>`.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/integrations/mailsync/__tests__/match.test.ts
import { describe, it, expect } from "vitest";
import { matchMessageToRecord } from "../match";

describe("matchMessageToRecord", () => {
  const known = [{ investorId: "inv-1", emails: ["investor@x.com"] }];
  it("matches by participant email (from)", () => {
    expect(matchMessageToRecord({ externalId: "m", toAddresses: ["team@ns.com"], fromAddress: "investor@x.com" }, known))
      .toEqual({ investorId: "inv-1", matchedBy: "participant" });
  });
  it("matches by participant email (to)", () => {
    expect(matchMessageToRecord({ externalId: "m", toAddresses: ["investor@x.com"], fromAddress: "team@ns.com" }, known))
      .toEqual({ investorId: "inv-1", matchedBy: "participant" });
  });
  it("returns empty when no participant is known", () => {
    expect(matchMessageToRecord({ externalId: "m", toAddresses: ["x@y.com"], fromAddress: "z@y.com" }, known)).toEqual({});
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/server/integrations/mailsync/__tests__/match.test.ts`
Expected: FAIL — cannot find `../match`.

- [ ] **Step 3: Write `match.ts`**

```ts
// src/server/integrations/mailsync/match.ts
import type { TrackedMessage } from "./provider";

export function matchMessageToRecord(
  msg: TrackedMessage,
  known: { investorId: string; emails: string[] }[],
): { investorId?: string; matchedBy?: string } {
  const participants = new Set([msg.fromAddress, ...msg.toAddresses].filter(Boolean).map((e) => e!.toLowerCase()));
  for (const k of known) {
    if (k.emails.some((e) => participants.has(e.toLowerCase()))) {
      return { investorId: k.investorId, matchedBy: "participant" };
    }
  }
  return {};
}
```

- [ ] **Step 4: Write `services/mailsync.ts`**

```ts
// src/server/services/mailsync.ts
import { prisma } from "@/lib/db";
import type { TrackedMessage } from "@/server/integrations/mailsync/provider";
import { matchMessageToRecord } from "@/server/integrations/mailsync/match";

async function knownInvestorEmails(): Promise<{ investorId: string; emails: string[] }[]> {
  const investors = await prisma.investor.findMany({ select: { id: true, contacts: { select: { email: true } } } });
  return investors.map((i) => ({ investorId: i.id, emails: i.contacts.map((c) => c.email).filter((e): e is string => Boolean(e)) }));
}

export async function ingestMessage(mailbox: string, msg: TrackedMessage): Promise<void> {
  const match = matchMessageToRecord(msg, await knownInvestorEmails());
  const direction = msg.fromAddress && msg.fromAddress.toLowerCase() === mailbox.toLowerCase() ? "outbound" : "inbound";
  await prisma.emailMessage.upsert({
    where: { provider_externalId: { provider: "outlook", externalId: msg.externalId } },
    create: {
      provider: "outlook", externalId: msg.externalId, conversationId: msg.conversationId, subject: msg.subject,
      fromAddress: msg.fromAddress, toAddresses: msg.toAddresses, direction, bodyPreview: msg.bodyPreview,
      receivedAt: msg.receivedAt, sentAt: msg.sentAt, matchedBy: match.matchedBy, investorId: match.investorId,
    },
    update: { investorId: match.investorId, matchedBy: match.matchedBy },
  });
}
```

> `Person.email` field name: confirm against `schema.prisma` (`model Person`). If the field is `email`, the above is correct; adjust the `select` if it differs.

- [ ] **Step 5: Run + verify → commit**

Run: `pnpm test src/server/integrations/mailsync/__tests__/match.test.ts`
Expected: PASS.

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/server/integrations/mailsync/match.ts src/server/services/mailsync.ts src/server/integrations/mailsync/__tests__/match.test.ts
git commit -m "feat(integrations): mail matching + EmailMessage ingestion"
```

---

## Task 19: Graph notifications webhook route

**Files:**
- Create: `src/app/api/integrations/msgraph/notifications/route.ts`
- Test: covered by manual smoke (route logic is thin); add a unit test for the validationToken echo helper.
- Create: `src/server/integrations/msgraph/notifications.ts` (pure: parse notification payload)

**Interfaces:**
- Consumes: `outlookConfigured()` (Task 1); `getMailSyncProvider()` (Task 16); `ingestMessage` (Task 18); Prisma `graphSubscription`.
- Produces: `function parseGraphNotifications(json): { subscriptionId: string; resource: string }[]`.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/integrations/msgraph/__tests__/notifications.test.ts
import { describe, it, expect } from "vitest";
import { parseGraphNotifications } from "../notifications";

describe("parseGraphNotifications", () => {
  it("extracts subscriptionId + resource from each notification", () => {
    const out = parseGraphNotifications({ value: [{ subscriptionId: "s1", resource: "Users/u/Messages/m1", clientState: "ns-crm" }] });
    expect(out).toEqual([{ subscriptionId: "s1", resource: "Users/u/Messages/m1" }]);
  });
});
```

- [ ] **Step 2: Run to verify it fails** → **Step 3: Write `notifications.ts`**

```ts
// src/server/integrations/msgraph/notifications.ts
export function parseGraphNotifications(json: unknown): { subscriptionId: string; resource: string }[] {
  const j = json as { value?: { subscriptionId?: string; resource?: string }[] };
  return (j.value ?? [])
    .filter((n) => n.subscriptionId && n.resource)
    .map((n) => ({ subscriptionId: n.subscriptionId!, resource: n.resource! }));
}
```

- [ ] **Step 4: Write the route**

```ts
// src/app/api/integrations/msgraph/notifications/route.ts
import { NextResponse } from "next/server";
import { outlookConfigured } from "@/server/integrations/config";
import { parseGraphNotifications } from "@/server/integrations/msgraph/notifications";
import { getMailSyncProvider } from "@/server/integrations/mailsync/provider";
import { ingestMessage } from "@/server/services/mailsync";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!outlookConfigured()) return new NextResponse("Not found", { status: 404 });

  // Graph subscription validation handshake: echo validationToken as text/plain.
  const url = new URL(req.url);
  const validationToken = url.searchParams.get("validationToken");
  if (validationToken) return new NextResponse(validationToken, { status: 200, headers: { "Content-Type": "text/plain" } });

  const body = await req.json();
  const notes = parseGraphNotifications(body);
  const provider = getMailSyncProvider();
  for (const n of notes) {
    const sub = await prisma.graphSubscription.findUnique({ where: { subscriptionId: n.subscriptionId } });
    if (!sub) continue;
    // Fetch recent messages for the mailbox and ingest (delta/list keeps it simple + idempotent via upsert).
    const msgs = await provider.listMessages(sub.mailbox, new Date(Date.now() - 10 * 60 * 1000));
    for (const m of msgs) await ingestMessage(sub.mailbox, m);
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run + verify → commit**

Run: `pnpm test src/server/integrations/msgraph/__tests__/notifications.test.ts`
Expected: PASS.

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm test
git add src/app/api/integrations/msgraph src/server/integrations/msgraph/notifications.ts src/server/integrations/msgraph/__tests__/notifications.test.ts
git commit -m "feat(integrations): Graph notifications webhook (validation echo + ingest, 404 until configured)"
```

---

## Task 20: `.env.example` blocks + client checklist doc

**Files:**
- Modify: `.env.example`
- Create: `docs/integrations-client-checklist.md`

- [ ] **Step 1: Append integration blocks to `.env.example`**

```
# ── External integrations ─────────────────────────────────────
# All OFF by default; each activates only when *_ENABLED=true AND its vars are set.

# DocuSign (e-signature) — JWT Grant
DOCUSIGN_ENABLED=false
DOCUSIGN_INTEGRATION_KEY=
DOCUSIGN_USER_ID=
DOCUSIGN_ACCOUNT_ID=
DOCUSIGN_RSA_PRIVATE_KEY=
DOCUSIGN_AUTH_SERVER=account-d.docusign.com   # prod: account.docusign.com
DOCUSIGN_WEBHOOK_HMAC_KEY=

# Box (watermarked document sharing) — Client Credentials Grant
BOX_ENABLED=false
BOX_CLIENT_ID=
BOX_CLIENT_SECRET=
BOX_SUBJECT_TYPE=enterprise
BOX_SUBJECT_ID=
BOX_ENTERPRISE_ID=
BOX_ROOT_FOLDER_ID=0
BOX_WEBHOOK_SIGNATURE_PRIMARY=
BOX_WEBHOOK_SIGNATURE_SECONDARY=

# Microsoft Graph (shared by Teams + Outlook) — app registration client credentials
MSGRAPH_TENANT_ID=
MSGRAPH_CLIENT_ID=
MSGRAPH_CLIENT_SECRET=

# Teams (meeting scheduling)
TEAMS_ENABLED=false
MSGRAPH_ORGANIZER_ID=

# Outlook (email correspondence tracking)
OUTLOOK_ENABLED=false
OUTLOOK_MAILBOXES=            # comma-separated UPNs (must match the Exchange application access policy)
```

- [ ] **Step 2: Write `docs/integrations-client-checklist.md`**

Consolidate the four §4–§7 "what to request from the client" checklists from the design spec verbatim (DocuSign, Box, Teams, Outlook), each as a section with the exact credentials, admin-consent, and policy steps.

- [ ] **Step 3: Commit**

```bash
git add .env.example docs/integrations-client-checklist.md
git commit -m "docs(integrations): .env.example blocks + client provisioning checklist"
```

---

## Self-Review

**Spec coverage:**
- §3 structure → Tasks 1,2,4,5,9,10,13,14,16,17 (all folders/files created).
- §4 DocuSign → Tasks 4–8. §5 Box → Tasks 9–12. §6 Teams → Tasks 13–15. §7 Outlook → Tasks 16–19.
- §8 cross-cutting (config gate, webhook 404, additive migration, `.env.example`) → Tasks 1, 3, 7/12/19, 20.
- §9 error handling → `IntegrationError` (Task 1) + per-provider mapping (Tasks 5,10,14,17) + best-effort side effects (esign/meetings services).
- §10 testing → per-task unit tests + config-gate tests (Tasks 4,9,13,16) + convergence (Task 6); final Playwright pass is an SDD step, not a plan task.
- §11 SDD process → executed by the chosen execution sub-skill, not a code task.
- §12 files touched → matches the File Structure map.

**Placeholder scan:** The one deliberate placeholder is `fetchTemplateBase64` in Task 8 (a minimal valid PDF) — flagged in-code as replace-with-stored-template, acceptable because no keys means the button never renders and the template source depends on the (separate) documents feature. No other TBDs.

**Type consistency:** `SendEnvelopeInput`/`EnvelopeResult` (Task 4) reused in 5,6,8. `ShareDocumentInput`/`ShareResult` (Task 9) reused in 10,11. `ScheduleMeetingInput`/`MeetingResult` (Task 13) reused in 14,15. `TrackedMessage` (Task 16) reused in 17,18,19. `getGraphToken` (Task 2) reused in 14,17. `IntegrationError` everywhere. Consistent.

**Confirmed against the codebase:**
- `Person.email` is `String?` (Task 18 `select` is correct).
- Mutation idiom (Tasks 8, 12b, 15): register inside `builder.mutationFields((t) => ({ ... }))`; use `t.field`/`t.prismaField`, `t.arg.id({ required: true })`, `t.arg({ type: Input, required: true })`, read `ctx.actor`. **New staff-only integration mutations must call the existing RBAC guard** (e.g. `assertCan(ctx.actor, ...)` / `assertAdmin(ctx.actor)`) exactly as the neighboring mutations in `mutations.ts` do — match the closest existing write for the same entity.
- Inputs go in `src/graphql/inputs.ts` via `builder.inputType(...)`.
