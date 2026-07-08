# File Storage Integration — Design (local-disk now, SharePoint drop-in later)

**Date:** 2026-07-09
**Status:** Approved (brainstorming) — ready for implementation plan
**Component:** `noblestride-crm` — document storage / file system

---

## 1. Problem & context

Document *metadata* is fully modelled and working (`prisma/schema.prisma` → `model Document`: name, type, version, access level, review chain, and relations to transaction/client/investor/mandate/partner). What is missing is the **bytes layer**: there is no upload, no storage backend, and no secure download. Today `Document.fileUrl` is a free-text URL only (`src/server/services/documents.ts`).

This was a **deliberate deferral**, logged in:
- `docs/CRM-TECH-INTEGRATIONS-REQUIRED.md` (row A, "SharePoint document storage"): committed, not started.
- `walkthrough CRM/14-systems-and-integrations.md`: *"SharePoint / file storage — not started; `Document.fileUrl` is a free-text URL, no upload (deferred by explicit decision pending an infra choice)."*

**Grounding from the decrypted source documents** (`decrypted/`):
- **Staff upload; investors/clients download what is shared to them.** Concept Note: *"enable Noblestride Capital upload client's historical data, NDA, Term sheet templates"* (L28); *"Investors review teasers and other materials uploaded by Noblestride Capital"* (L383). Build Spec: `Pitch deck (upload)` (L882), access level `Internal / Client-shared / Investor-shared / VDR — Enforced by [visibility engine]` (§4.16).
- **VDR gating is committed and strict.** SOW: *"No VDR access is granted without internal approval and the correct signed NDA."* (L175). Spec §10: VDR stays locked until formal interest + signed NDA. Open NDA = multi-data-room; Closed NDA = single-data-room (Workflow L57–58).
- **SharePoint is explicitly conditional.** SOW: *"SharePoint / document — Store or link deal documents, VDR material … Subject to API/admin access."* (L151). Spec: *"Document storage (for example SharePoint), subject to available API and admin access."* (L1021). This is exactly why the design must work fully **before** the client provides credentials, then switch to SharePoint by config alone.

## 2. Goals / non-goals

**Goals**
- A production-grade file system: upload, secure download, delete — behind a provider seam.
- Works end-to-end **today** on a local-disk backend (no external credentials required).
- Drops in to **SharePoint (Microsoft Graph)** by filling env vars and flipping one setting — no code change.
- Enforces the existing access-level + NDA + VDR gate on every download by reusing the visibility engine.
- Immutable file objects with linear version history (never lose the bytes a counterparty was shown).
- Server-side validation (MIME allowlist, size cap, magic-byte sniff) and an append-only access/audit log.

**Non-goals (deferred; concept-note-only, narrowed out by SOW §11 / SPEC §19.2)**
- Investor self-upload of their own document versions (Concept Note L82, L290).
- Watermarked downloads / hosted-VDR activity analytics (Firmex/iDeals/Intralinks/Box, Concept Note L114–120).
- E-signature (DocuSign/HelloSign).
- Antivirus scanning (heavier infra; clean later add — a hook point is left for it).
- Full version-tree UI (branching, diff, restore). Linear supersession only.

## 3. Terminology: what the client's "API key" really is

Microsoft Graph does not use a single-string SharePoint API key. Access is via an **Azure AD app registration** using OAuth2 client-credentials:

| Env var | Meaning |
|---|---|
| `SHAREPOINT_TENANT_ID` | Azure AD tenant (directory) ID |
| `SHAREPOINT_CLIENT_ID` | App registration (client) ID |
| `SHAREPOINT_CLIENT_SECRET` | Client secret (or certificate) |
| `SHAREPOINT_SITE_ID` | Target SharePoint site ID |
| `SHAREPOINT_DRIVE_ID` | Target document library (drive) ID |

Required **application** permissions (admin-consented): `Files.ReadWrite.All`, `Sites.ReadWrite.All`. The spec ships a "what to request from the client" checklist so provisioning is unambiguous.

## 4. Architecture — the `StorageProvider` seam

```
noblestride-crm/src/server/storage/
  provider.ts     # StorageProvider interface + getStorageProvider() factory
  local.ts        # LocalDiskProvider  — writes under STORAGE_LOCAL_DIR (gitignored)
  sharepoint.ts   # SharePointProvider — Graph upload-session + driveItem download
  validation.ts   # MIME allowlist, size cap, magic-byte sniff, sha256
  keys.ts         # deterministic object-key builder
```

Interface (uniform across both backends):

```ts
interface StorageProvider {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ stream: Readable; contentType: string; size: number }>;
  delete(key: string): Promise<void>;
}
```

`getStorageProvider()` selects the implementation from env: **Local** when `STORAGE_PROVIDER=local` or SharePoint credentials are absent; **SharePoint** when `STORAGE_PROVIDER=sharepoint` and credentials are present. The factory is the *only* place that knows which backend is live.

**Uploads/downloads stream through Next.js route handlers, not presigned URLs.** Local disk and SharePoint do not share a presign model, so a uniform server proxy keeps the seam clean. (If an S3-class backend is added later, a `presignedPut/Get` capability can be added to the interface as an optional optimization.)

**Object key** (immutable, one per version): `{entityType}/{entityId}/{documentId}/{versionSuffix}-{filename}`.

## 5. Data model — additive changes

`model Document` gains (all nullable / defaulted → back-compatible; existing rows keep `fileUrl`):

```prisma
storageProvider   String?  @default("local")   // "local" | "sharepoint"
storageKey        String?                       // object key; null = legacy fileUrl link
mimeType          String?
sizeBytes         Int?
checksum          String?                       // sha256 of the stored bytes
originalFilename  String?
previousVersionId String?                       // self-relation → the version this supersedes
previousVersion   Document?  @relation("DocumentVersions", fields: [previousVersionId], references: [id], onDelete: SetNull)
supersededBy      Document[] @relation("DocumentVersions")
isCurrent         Boolean  @default(true)
```

**Versioning = immutable objects + linear supersession.** Files are never overwritten. A re-upload for a logical document creates a **new** `Document` row with a new `storageKey`, sets `previousVersionId` to the prior row, and flips the prior row's `isCurrent = false`. Default listings/portals filter `isCurrent = true`; full history is retained and auditable. This preserves the exact bytes a counterparty was shown at due-diligence time.

New append-only audit table:

```prisma
model DocumentAccessLog {
  id         String   @id @default(cuid())
  documentId String
  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  userId     String?
  action     String   // UPLOAD | DOWNLOAD | DELETE
  at         DateTime @default(now())

  @@index([documentId])
  @@index([userId])
}
```

## 6. Flows

**Upload** — `POST /api/documents/upload` (staff only):
1. Authn (internal user) + authz (upload is staff-only).
2. `validation.ts`: reject on MIME not in allowlist, over size cap, or magic-byte mismatch; compute sha256.
3. `provider.put(key, bytes, contentType)`.
4. Create `Document` row (`storageKey`, `mimeType`, `sizeBytes`, `checksum`, `originalFilename`, `storageProvider`, version linkage if superseding).
5. Write `DocumentAccessLog` `UPLOAD`.
6. UI: wire into `src/components/crm/document-form-drawer.tsx` + `src/app/(crm)/documents/page.tsx`.

**Download** — `GET /api/documents/[id]/download` (staff + portals):
1. Authn (resolve actor/lens).
2. Load document.
3. **Reuse the visibility gate** — a `canDownloadDocument(doc, actor)` helper extracted from the predicate in `src/server/visibility/project.ts:213–217` (Internal/ClientShared never investor-visible; VDR requires DD tier + satisfied NDA; InvestorShared after NDA). Staff bypass per existing internal rules.
4. On allow: `provider.get(key)` → stream with `Content-Disposition: attachment`.
5. Write `DocumentAccessLog` `DOWNLOAD`. On deny: 403, no bytes, no leak of existence beyond current behaviour.

**Delete** — staff only: deletes a single `Document` version row and its backing object (`provider.delete(key)`, best-effort) + writes `DocumentAccessLog` `DELETE`. If the deleted row was `isCurrent` and a `previousVersionId` predecessor exists, that immediate predecessor is re-flagged `isCurrent = true` so the document does not vanish from listings. (No version-tree rebalancing beyond this single promotion in v1.)

## 7. Configuration

`.env` (SharePoint block empty until the client provisions it):

```
STORAGE_PROVIDER=local
STORAGE_LOCAL_DIR=./.storage        # gitignored
SHAREPOINT_TENANT_ID=
SHAREPOINT_CLIENT_ID=
SHAREPOINT_CLIENT_SECRET=
SHAREPOINT_SITE_ID=
SHAREPOINT_DRIVE_ID=
```

Fill the SharePoint block and set `STORAGE_PROVIDER=sharepoint` → the system uses SharePoint with **no code change**. `.env.example` documents all of it; `STORAGE_LOCAL_DIR` is added to `.gitignore`.

## 8. Error handling

- **Validation failures** → 400 with a specific reason (bad type / too large / content mismatch).
- **Provider failures** (disk full, Graph 5xx/401/429) → mapped to a typed `StorageError`; upload returns 502 and writes **no** `Document` row (no orphan metadata). Graph 401/403 surface as "storage not configured / access denied" so a bad app registration is diagnosable.
- **Missing object on download** (row exists, bytes gone) → 410 + logged.
- **Authz denial** → 403, audited, no bytes.
- Local provider guards against path traversal in keys; keys are built only by `keys.ts`.

## 9. Testing & self-verification

- **Unit:** local provider round-trip; validation (reject spoofed MIME / oversize / disallowed type); key builder (no traversal); `canDownloadDocument` across every access level × tier × NDA combination; version supersession logic (new row, `isCurrent` flip, linkage).
- **Integration:** upload→download byte-identical via local provider; investor lens denied on Internal/ClientShared; VDR denied without NDA, allowed with satisfied NDA at DD tier; audit rows written for each action.
- **SharePoint provider:** unit-tested against a **mocked Graph client** (upload-session request shape, download driveItem, error mapping). Live SharePoint cannot be exercised without credentials → a documented manual smoke checklist runs when the client provides them.
- **End-to-end (Playwright, single pass at the very end):** log in as staff → upload a real file → download it → assert byte-identical; switch to a greylisted / pre-NDA investor lens → confirm download is refused (403).
- **Per-step self-verification gate:** each implementation step ends by running `typecheck + lint + that step's tests` and showing the passing output before the step is considered done.

## 10. SDD process (agreed)

1. **Sonnet implements every step**, each ending with its self-verification gate (typecheck + lint + step tests must pass and be shown).
2. **After all steps are complete, Opus performs one full review pass** — walks through each step's changes, verifies correctness end-to-end, and logs every error / bug / mistake it finds, each with the correct fix and solution, then reports them.
3. **Sonnet applies all fixes** Opus reported.
4. **Opus re-reviews once** to confirm the fixes are correct and nothing regressed.
5. **Playwright then runs** the end-to-end confirmation pass (step 9). Only after this is the work considered done.

## 11. Files touched (anticipated)

- **New:** `src/server/storage/{provider,local,sharepoint,validation,keys}.ts`; `src/app/api/documents/upload/route.ts`; `src/app/api/documents/[id]/download/route.ts`; storage + visibility-helper tests.
- **Changed:** `prisma/schema.prisma` (Document fields + `DocumentAccessLog`) + migration; `src/server/services/documents.ts` (create-with-storage, versioning); `src/components/crm/document-form-drawer.tsx` + `src/app/(crm)/documents/page.tsx` (upload/download UI); `src/server/visibility/project.ts` (extract `canDownloadDocument`); `.env.example`, `.gitignore`; regenerate Pothos types.

## 12. Out-of-scope follow-ups (recorded)

Investor self-upload; watermarking + hosted-VDR analytics; e-signature; antivirus scanning; full version-tree UI. Each has a hook point or is additive to this design.
