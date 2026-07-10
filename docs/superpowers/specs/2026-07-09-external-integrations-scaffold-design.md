# External Integrations Scaffold — Design (code now, drop in client keys later)

**Date:** 2026-07-09
**Status:** Approved (brainstorming) — ready for implementation plan
**Component:** `noblestride-crm` — external service integrations
**Branch / worktree:** `feat/external-integrations-scaffold` @ `.claude/worktrees/external-integrations` (branched from `integration/all-features` HEAD; merged only on explicit instruction)

---

## 1. Problem & context

The client's concept note (`docs/GMAIL-request.md`; `decrypted/Noblestride-CRM-Concept-Note-decrypted.pdf`) names a set of external services the platform should use. Four of them are being **fully coded now** so that the moment the client provisions credentials, they work with no further code — while **every current workflow keeps behaving exactly as it does today** when no credentials are present:

| Capability | Vendor (this build) | Current manual behavior that MUST keep working |
|---|---|---|
| E-signature | **DocuSign** | "Record Open NDA" / "Record Closed NDA" buttons (`src/components/crm/nda-actions.tsx` → `recordOpenNda`/`recordClosedNda`) |
| Secure document sharing (watermark + tracking) | **Box** | Free-text `Document.fileUrl` + the existing `src/server/storage/` upload/download seam |
| Meeting scheduling | **Microsoft Teams** (MS Graph) | Manual meeting logging as an `Activity` of `InteractionType.Meeting` |
| Email correspondence tracking | **Office 365 / Outlook** (MS Graph) | "Email" as a manual `CommChannel` / `InteractionType` |

**Explicitly deferred (not touched in this build):** Intralinks, Ansarada, Read.ai. These are concept-note asks narrowed out of committed scope (`docs/CRM-TECH-INTEGRATIONS-REQUIRED.md` §D); their capability seams (docshare, meetings) leave room to add them as alternate providers later, but no code is written for them now.

This design mirrors the **already-approved, already-partly-built** file-storage pattern (`docs/superpowers/specs/2026-07-09-file-storage-integration-design.md`; `src/server/storage/{provider,local,sharepoint}.ts`): a provider interface + a factory that selects the real backend only when env credentials are present, defaulting otherwise to a no-credential implementation that preserves current behavior.

## 2. Goals / non-goals

**Goals**
- One coherent integration framework under `src/server/integrations/`, one **capability** seam each for e-sign, docshare, meetings, mailsync.
- **Zero behavior change with no keys.** Every current workflow (manual NDA record, free-text documents, manual meeting/email logging) is byte-for-byte unchanged. New UI controls are **not rendered at all** until that integration is configured.
- **Real, correct, working-on-key-drop code** for DocuSign, Box, and MS Graph (Teams + Outlook), each unit-tested against mocked HTTP.
- New integration UI, webhooks, and sync are **inert and unreachable** until configured (webhook routes 404 when their integration is off — no new attack surface).
- Additive, back-compatible data model only (nullable/defaulted columns + new tables); no existing row, query, or migration is altered.
- A per-integration **"what to request from the client"** checklist so go-live is unambiguous.

**Non-goals (deferred)**
- Intralinks, Ansarada, Read.ai providers (no code).
- Teams call **recording/transcript** ingestion (Graph hook noted only).
- Investor self-upload of their own document versions.
- Rewriting the existing SharePoint storage seam — Box does **not** replace it (see §5).
- Outbound campaign email / mail *sending* beyond the existing Resend OTP mailer (`src/server/auth/mailer.ts`) — mailsync is **read/track** only.

## 3. Architecture — capability seams (Approach A)

```
src/server/integrations/
  config.ts              # isConfigured(id) + typed env accessors; the ONLY env reader
  msgraph/
    auth.ts              # shared client-credentials token (Teams + Outlook). Cached in-memory.
    __tests__/
  esign/
    provider.ts          # ESignProvider interface + getESignProvider() + docusignConfigured()
    docusign.ts          # DocuSignProvider  — real (JWT grant via `jose`, Envelopes API)
    manual.ts            # ManualESignProvider — no-op; current manual NDA path is authoritative
    __tests__/
  docshare/
    provider.ts          # DocShareProvider interface + getDocShareProvider() + boxConfigured()
    box.ts               # BoxProvider — real (CCG, upload, watermark, shared link, events)
    null.ts              # NullDocShareProvider — "not configured"; nothing shared externally
    __tests__/
  meetings/
    provider.ts          # MeetingProvider interface + getMeetingProvider() + teamsConfigured()
    teams.ts             # TeamsMeetingProvider — real (Graph event + isOnlineMeeting)
    manual.ts            # ManualMeetingProvider — no-op; manual Activity logging is authoritative
    __tests__/
  mailsync/
    provider.ts          # MailSyncProvider interface + getMailSyncProvider() + outlookConfigured()
    outlook.ts           # OutlookMailProvider — real (Graph mail read + subscriptions/delta)
    off.ts               # OffMailProvider — disabled; no capture
    __tests__/
```

**The factory pattern (identical to `storage/provider.ts`):** each `getXProvider()` returns the real provider **iff** `xConfigured()` (all required env vars present) **and** the provider is switched on; otherwise it returns the manual/null implementation. `config.ts` is the single source that reads `process.env`. A shared `IntegrationError extends Error { status }` (mirrors `StorageError`) maps provider failures to HTTP codes.

**No heavy SDKs.** All clients are raw `fetch` — the house style (`mailer.ts`, `storage/sharepoint.ts`). DocuSign's RS256 JWT assertion is signed with **`jose`**, already a dependency. No new runtime dependencies are required. (The official `docusign-esign` / `@microsoft/microsoft-graph-client` / `box-node-sdk` remain options but are not adopted, to match house style and avoid dependency surface.)

**"Hidden until configured" enforcement.** New controls live in **React Server Components**, which call `isConfigured(id)` server-side and render nothing when false. No secret or vendor flag ever reaches the client bundle. Client components that perform an integration action are only mounted by a server parent that has already checked `isConfigured`.

## 4. E-signature — DocuSign (wraps NDA + term sheets)

**Auth:** OAuth2 **JWT Grant** (server-to-server, no user present). Sign an RS256 JWT with `jose` (`iss`=integration key, `sub`=impersonated user id, `aud`=auth server, `scope="signature impersonation"`, `exp` ≤ 1h) → `POST https://{auth_server}/oauth/token` (`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`). Cache the ~1h bearer. Discover the account REST base via `GET /oauth/userinfo` (do not hardcode). One-time admin consent for `signature impersonation` is a client provisioning step.

**Interface**
```ts
interface ESignProvider {
  sendEnvelope(input: {
    kind: "OpenNda" | "ClosedNda" | "TermSheet";
    documentBase64: string; documentName: string;
    signer: { email: string; name: string };
    subject: string;
    linkRecord: { investorId?: string; engagementId?: string; transactionId?: string };
  }): Promise<{ externalId: string; status: string }>;
  getEnvelope(externalId: string): Promise<{ status: string; completedAt?: Date }>;
}
```

**Envelope create:** `POST {basePath}/v2.1/accounts/{accountId}/envelopes` with `documents[]` (base64), `recipients.signers[]` (email/name/recipientId + `signHereTabs` anchor `"/sig1/"`), `status:"sent"`. Store the returned `envelopeId`.

**Status:** DocuSign **Connect** webhook → `POST /api/integrations/docusign/connect` (HMAC-verified via `DOCUSIGN_WEBHOOK_HMAC_KEY`). On `envelope-completed`: update the `ESignEnvelope` row **and call the existing `recordOpenNda`/`recordClosedNda`** so the signed path converges on the exact same state the manual button produces. Polling (`GET .../envelopes/{id}`) is the fallback. (Embedded iframe signing via `clientUserId` + `createRecipientView` is designed-in but the default flow is remote email signing.)

**Env**
```
DOCUSIGN_ENABLED=false            # explicit switch; real provider requires this true AND vars below
DOCUSIGN_INTEGRATION_KEY=
DOCUSIGN_USER_ID=
DOCUSIGN_ACCOUNT_ID=
DOCUSIGN_RSA_PRIVATE_KEY=         # PEM (base64-encode if the env store dislikes newlines)
DOCUSIGN_AUTH_SERVER=account-d.docusign.com   # demo; account.docusign.com in prod
DOCUSIGN_WEBHOOK_HMAC_KEY=
```

**Unchanged path:** `RecordOpenNdaButton` / `RecordClosedNdaButton` are untouched and remain the only NDA control when DocuSign is off. The "Send for e-signature" control renders only when `docusignConfigured()`.

**Client checklist:** production integration key; RSA keypair registered to it; API account id; service user id (GUID) to impersonate; admin consent for `signature impersonation`; Go-Live promotion; prod auth host; (optional) Connect HMAC key + webhook URL allowlisted.

## 5. Secure document sharing — Box (watermark + tracking)

**Positioning:** Box is a **docshare capability**, *not* a storage backend. Bytes of record stay exactly where they are today (`Document.fileUrl` and/or the `storage/` seam). Box's only job is the external-facing act: upload a copy → apply watermark → mint a permissioned, expiring, password-protected shared link → track previews/downloads. The existing storage/SharePoint work is untouched.

**Auth:** **Client Credentials Grant** (service account): `POST https://api.box.com/oauth2/token` (`grant_type=client_credentials`, `box_subject_type=enterprise`, `box_subject_id=<enterprise id>`). Cache the ~1h bearer.

**Interface**
```ts
interface DocShareProvider {
  shareDocument(input: {
    documentId: string; bytes: Buffer; filename: string; contentType: string;
    watermark: boolean; password?: string; expiresAt?: Date; allowDownload: boolean;
  }): Promise<{ externalFileId: string; sharedUrl: string; watermarkApplied: boolean }>;
  revokeShare(externalFileId: string): Promise<void>;
}
```

**Calls:** upload `POST https://upload.box.com/api/2.0/files/content` (multipart, `attributes` part first); watermark `PUT /files/{id}/watermark {"watermark":{"imprint":"default"}}`; shared link `PUT /files/{id}?fields=shared_link` with `access`, `password`, `unshared_at`, `permissions.can_download`. Tracking via webhook `POST /api/integrations/box/webhook` (triggers `FILE.PREVIEWED`, `FILE.DOWNLOADED`; signature-verified) with the admin-events API as a backfill.

**Data model (additive):**
- `Document` gains nullable `boxFileId`, `boxSharedLinkUrl`, `boxWatermarkApplied Boolean?`.
- Existing `DocumentAccessLog` gains nullable `source String? @default("internal")` (`internal` | `box`); Box preview/download events are written here — reusing the audit table already built for file-storage. `action` accepts `PREVIEW` in addition to the existing `UPLOAD|DOWNLOAD|DELETE`.

**Env**
```
BOX_ENABLED=false
BOX_CLIENT_ID=
BOX_CLIENT_SECRET=
BOX_SUBJECT_TYPE=enterprise        # enterprise | user
BOX_SUBJECT_ID=
BOX_ENTERPRISE_ID=
BOX_ROOT_FOLDER_ID=0
BOX_WEBHOOK_SIGNATURE_PRIMARY=
BOX_WEBHOOK_SIGNATURE_SECONDARY=
```

**Unchanged path:** all current documents (`fileUrl`, storage uploads/downloads) work as-is. The "Share via Box" control renders only when `boxConfigured()`.

**Client checklist:** confirm Business/Enterprise+ plan (watermark + admin events require it); create a Platform App with CCG enabled; client id + secret + enterprise id; authorize the app in Admin Console; scopes (read/write files, manage webhooks, reporting for events); admin 2FA; storage root folder + owning account decision.

## 6. Meetings — Microsoft Teams (MS Graph)

**Approach:** create a **calendar event with an online meeting** (`POST /users/{organizer}/events` with `isOnlineMeeting:true`, `onlineMeetingProvider:"teamsForBusiness"`). This auto-invites attendees, lands on the organizer's calendar, and returns `onlineMeeting.joinUrl` — needing only `Calendars.ReadWrite` and **no Teams application access policy** (the friction of the `/onlineMeetings` API). Documented alternate: `POST /users/{id}/onlineMeetings` (`OnlineMeetings.ReadWrite.All` + access policy).

**Auth:** shared `msgraph/auth.ts` — client credentials (`POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`, `scope=https://graph.microsoft.com/.default`). Same Azure AD app as Outlook.

**Interface**
```ts
interface MeetingProvider {
  scheduleMeeting(input: {
    subject: string; startAt: Date; endAt: Date;
    attendees: { email: string; name?: string }[];
    linkRecord: { engagementId?: string; transactionId?: string; investorId?: string };
  }): Promise<{ externalId: string; joinUrl: string }>;
  cancelMeeting(externalId: string): Promise<void>;
}
```

**Data model (additive):** new `Meeting` model — `id`, `provider`, `externalId`, `joinUrl`, `subject`, `startAt`, `endAt`, `organizerUserId`, nullable FKs `engagementId?`/`transactionId?`/`investorId?`, `createdSource`, timestamps. Scheduling also writes an `Activity` of `InteractionType.Meeting` (same shape manual logging produces).

**Env**
```
TEAMS_ENABLED=false
MSGRAPH_TENANT_ID=                 # SHARED with Outlook
MSGRAPH_CLIENT_ID=                 # SHARED with Outlook
MSGRAPH_CLIENT_SECRET=             # SHARED with Outlook
MSGRAPH_ORGANIZER_ID=              # UPN/GUID whose calendar hosts the meeting (Teams-licensed)
```

**Unchanged path:** manual meeting logging (`Activity` type `Meeting`) is untouched. "Schedule Teams call" renders only when `teamsConfigured()`.

**Client checklist:** Entra app registration (tenant id + client id + secret); admin-consented `Calendars.ReadWrite` (Application); designated Teams-licensed organizer user (UPN + object id). Recording/transcript is a noted future hook (`/onlineMeetings/{id}/recordings|transcripts`, extra permissions) — not built.

## 7. Email correspondence tracking — Office 365 / Outlook (MS Graph)

**Auth:** shared `msgraph/auth.ts` (app-only). **`Mail.Read` (Application)** scoped by an **Exchange Application Access Policy** to only the deal-team mailboxes — the privacy guarantee (app cannot read arbitrary mailboxes).

**Interface**
```ts
interface MailSyncProvider {
  listMessages(mailbox: string, since?: Date): Promise<TrackedMessage[]>;
  ensureSubscription(mailbox: string, notificationUrl: string): Promise<{ subscriptionId: string; expiresAt: Date }>;
  renewSubscription(subscriptionId: string): Promise<{ expiresAt: Date }>;
}
```

**Calls:** `GET /users/{upn}/messages?$select=subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,conversationId,bodyPreview,isRead&$top=50` (+ `@odata.nextLink`). Near-real-time via `POST /subscriptions` on `/users/{id}/messages` → webhook `POST /api/integrations/msgraph/notifications` (echoes `validationToken` on setup, verifies `clientState`); mail subscriptions live ~3 days, so a `GraphSubscription` row drives renewal, with a `/messages/delta` poll as the safety net.

**Matching to deals:** intersect `from`/`to`/`cc` against known investor/contact emails; reinforce with `conversationId` (once one message in a thread matches, attach the rest); optional subject deal-token. "No reply pending" = latest matched message is outbound with no newer inbound after N days.

**Data model (additive):**
- New `EmailMessage` — `id`, `provider`, `externalId`, `conversationId`, `subject`, `fromAddress`, `toAddresses String[]`, `direction`, `receivedAt`, `sentAt`, `bodyPreview`, nullable FKs `investorId?`/`transactionId?`/`engagementId?`, `matchedBy`, timestamps. `@@unique([provider, externalId])`.
- New `GraphSubscription` — `id`, `subscriptionId`, `resource`, `mailbox`, `expiresAt`, `clientState`.

**Env**
```
OUTLOOK_ENABLED=false
# MSGRAPH_* shared with Teams (above)
OUTLOOK_MAILBOXES=                 # comma-separated UPNs the CRM may read (must match the access policy)
```

**Unchanged path:** with no keys there is no capture; "Email" remains a manual comm channel exactly as today.

**Client checklist:** Entra app registration (shared with Teams); admin-consented `Mail.Read` (Application); mail-enabled security group of allowed mailboxes; `New-ApplicationAccessPolicy -AccessRight RestrictAccess` against that group (+ `Test-ApplicationAccessPolicy`); reachable public HTTPS notification URL; secret rotation owner/expiry.

## 8. Cross-cutting behavior

- **Webhook routes are inert until configured.** `/api/integrations/{docusign|box|msgraph}/...` return **404** when their integration is off, verify signatures when on. No new unauthenticated surface.
- **Config is centralized.** `config.ts` exposes `isConfigured("docusign"|"box"|"teams"|"outlook")`; each is `ENABLED` flag **AND** all required vars present. Nothing else reads these env vars.
- **Additive migrations only.** All new columns nullable/defaulted; all new tables independent. A DB migrated to this schema still serves every existing query unchanged; a pre-migration row is fully valid.
- **`.env.example`** gains one commented block per integration (above). `.gitignore` unaffected.
- **Provenance:** integration-created rows use `createdSource = API` (existing `ActorSource`).

## 9. Error handling

- Provider/auth failures → typed `IntegrationError(status)`; surfaced as `502`/`503` to the action caller, never crashing the page. Auth 401/403 map to "integration not configured / access denied" so a bad app registration is diagnosable.
- A configured-but-failing integration **never breaks the manual path**: e.g. if a DocuSign send fails, the manual Record-NDA button still works and no NDA state is corrupted. Integration writes that are side effects (activity log, tracking) follow the existing best-effort pattern (`notify()`): they never roll back or fail the core mutation.
- Webhook handlers validate signatures before doing work; invalid signature → 401, no state change.
- Token caches fail closed (a refresh error yields "not configured/unavailable", not a stale-token loop).

## 10. Testing & self-verification

- **Unit (mocked HTTP), per provider:** auth/token flow (JWT assertion shape for DocuSign; client-credentials body for Box/Graph); request shaping (envelope body, Box multipart order + watermark + shared-link body, Graph event body, mail `$select`/`$filter`); response parsing; error mapping to `IntegrationError`; webhook signature verification (valid + tampered).
- **Config-gate tests:** with vars absent, each `getXProvider()` returns the manual/null provider; `isConfigured` false; webhook routes 404; no new UI control is rendered.
- **Convergence test:** DocuSign `envelope-completed` webhook drives the same investor/engagement NDA state as the manual button.
- **Data-model tests:** additive columns default correctly; a pre-migration-shaped row round-trips; `EmailMessage`/`Meeting`/`ESignEnvelope` CRUD.
- **Existing suite stays green** — no regression permitted.
- **End-to-end (Playwright, single pass at the very end, no keys set):** confirm the app is visually and functionally identical to today — manual NDA buttons work, documents/meetings/email behave as before, and **none** of the new integration controls appear. (Live vendor calls can't be exercised without credentials; each integration ships a documented manual smoke checklist for when the client provisions keys.)
- **Per-step gate:** every implementation step ends by running `pnpm exec tsc --noEmit` + `pnpm lint` + that step's `vitest` and showing the passing output before the step is considered done.

## 11. SDD process (agreed)

1. **Sonnet implements every step**, each ending with its self-verification gate (typecheck + lint + step tests must pass and be shown).
2. **After all steps complete, Opus performs one full review pass** — walks each step's changes, verifies correctness end-to-end and that nothing existing breaks, and logs every error / bug / mistake with its correct fix.
3. **Sonnet applies all fixes** Opus reported.
4. **Opus re-reviews** and repeats (3)→(4) until clean and nothing regresses.
5. **Playwright** then runs the no-keys confirmation pass (§10). Only after this is the work considered done.
6. The branch is **never merged** except on the user's explicit instruction.

## 12. Files touched (anticipated)

- **New:** `src/server/integrations/config.ts`; `src/server/integrations/msgraph/auth.ts`; `esign/{provider,docusign,manual}.ts`; `docshare/{provider,box,null}.ts`; `meetings/{provider,teams,manual}.ts`; `mailsync/{provider,outlook,off}.ts`; each `__tests__`; webhook routes `src/app/api/integrations/{docusign/connect,box/webhook,msgraph/notifications}/route.ts`; new UI controls (e-sign send button, Box share button, schedule-Teams button) as server-gated components under `src/components/crm/`.
- **Changed (additive):** `prisma/schema.prisma` (+`ESignEnvelope`, `Meeting`, `EmailMessage`, `GraphSubscription`; `Document` box fields; `DocumentAccessLog.source` + `PREVIEW`) + one migration; NDA detail surfaces (`investors/[id]`, `engagement/[id]`) to conditionally render the e-sign button; documents surface to conditionally render Box share; engagement/transaction surfaces for schedule-Teams; `.env.example`; regenerate Pothos types.
- **Untouched:** `nda-actions.tsx`, `nda.ts` (called *by* the webhook, not modified), `storage/*`, existing mutations/services.

## 13. Out-of-scope follow-ups (recorded)

Intralinks / Ansarada / Read.ai providers; Teams recording/transcript ingestion; investor self-upload; outbound campaign email; AI behaviour tracking / predictive matching beyond the existing heuristic stub. Each capability seam leaves room to add these as alternate providers without disturbing this design.
