# File Storage Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-grade file system (upload, gated download, delete, versioning) to the NobleStride CRM behind a storage-provider seam that runs on local disk today and switches to SharePoint by config alone.

**Architecture:** A `StorageProvider` interface with two implementations — `LocalDiskProvider` (default, zero-config) and `SharePointProvider` (Microsoft Graph). Files stream through Next.js route handlers (no presigned URLs, since local disk and SharePoint don't share a presign model). Document *metadata* stays in Postgres via Prisma; only the bytes move to the provider. Every download reuses the existing visibility engine to enforce access-level + NDA + VDR gating. Uploads are immutable objects; re-uploads create a new `Document` version linked to its predecessor.

**Tech Stack:** Next.js 16 (App Router, route handlers, `runtime = "nodejs"`), Prisma 6 + Postgres, Pothos GraphQL, Zod 4, Vitest 4, Playwright. Node built-ins: `node:crypto` (sha256), `node:fs/promises`, `node:path`, `node:stream` (`Readable.toWeb`). Graph access via `fetch` (no new dependency).

## Global Constraints

- **Project root for all paths below:** `noblestride-crm/` (e.g. `src/server/storage/…` means `noblestride-crm/src/server/storage/…`).
- **Test runner:** `npm run test` (vitest run) — from `noblestride-crm/`. Tests colocate in `__tests__/` dirs next to source, matching the repo.
- **Typecheck:** `npx tsc --noEmit`. **Lint:** `npm run lint`.
- **No direct commits** (user standing rule + `[[no-direct-commits]]`): do NOT commit per task. Each task ends with a **self-verification gate** (typecheck + lint + that task's tests, output shown). Staging is fine; the single commit happens only on the user's explicit go-ahead after the full SDD review cycle.
- **SDD review flow (agreed):** Sonnet implements every task with its self-verification gate → after all tasks, Opus does one full review pass logging every bug with its fix → Sonnet applies fixes → Opus re-reviews once → Playwright e2e confirmation (Task 13). Only then is the work done.
- **Prisma DLL lock quirk** (`[[noblestride-dev-quirks]]`): if `prisma generate` fails with a Windows file lock (EPERM on `query_engine-*.dll.node`), stop the dev server / any `next` process, then retry.
- **No new runtime dependency** for SharePoint — use `fetch`. Implement providers so `fetch` and the token fetch are injectable for tests.
- **Max upload size:** 50 MB. **MIME allowlist:** PDF, DOCX, XLSX, PPTX, PNG, JPEG, plain text, CSV (exact list in Task 3).
- **Access model (grounded in spec):** staff (internal `admin` viewpoint) upload & download everything; investors download only what the visibility engine projects to them; partners download documents whose `partnerId` matches their record. There is no client portal login (`AuthAccount.kind` is only `INTERNAL | INVESTOR`), so `ClientShared` docs are staff-download-only. Investor self-upload and watermarking are out of scope (deferred).

---

### Task 1: Schema — Document file fields, version chain, and access log

**Files:**
- Modify: `prisma/schema.prisma` (model `Document`, ~line 1047; add new model `DocumentAccessLog`)
- Create: `prisma/migrations/<generated>/migration.sql` (via `prisma migrate dev`)
- Test: `src/server/storage/__tests__/schema-fields.test.ts`

**Interfaces:**
- Produces: `Document` gains `storageProvider`, `storageKey`, `mimeType`, `sizeBytes`, `checksum`, `originalFilename`, `previousVersionId` (self-relation `DocumentVersions`), `supersededBy Document[]`, `isCurrent Boolean @default(true)`. New model `DocumentAccessLog { id, documentId, document, userId?, action, at }`.

- [ ] **Step 1: Add fields to `model Document`**

In `prisma/schema.prisma`, inside `model Document` (after the `fileUrl` line at ~1054), add:

```prisma
  storageProvider   String?   @default("local")
  storageKey        String?
  mimeType          String?
  sizeBytes         Int?
  checksum          String?
  originalFilename  String?
  previousVersionId String?
  previousVersion   Document?  @relation("DocumentVersions", fields: [previousVersionId], references: [id], onDelete: SetNull)
  supersededBy      Document[] @relation("DocumentVersions")
  isCurrent         Boolean    @default(true)
  accessLogs        DocumentAccessLog[]
```

Add an index near the existing `@@index` block:

```prisma
  @@index([isCurrent])
```

- [ ] **Step 2: Add the `DocumentAccessLog` model**

Immediately after `model Document { … }` closes (before `model StageChange`), add:

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

- [ ] **Step 3: Generate the migration + client**

Run (requires the dev DB — `npm run db:up` first if needed):
```bash
cd noblestride-crm && npm run db:up && npx prisma migrate dev --name document_file_storage
```
Expected: migration created and applied; `prisma generate` runs; no errors. (If EPERM DLL lock — see Global Constraints.)

- [ ] **Step 4: Write the failing test**

`src/server/storage/__tests__/schema-fields.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";

describe("Document storage schema", () => {
  it("exposes the new file + version fields on Document", () => {
    const fields = Prisma.dmmf.datamodel.models.find((m) => m.name === "Document")!.fields.map((f) => f.name);
    for (const f of ["storageProvider", "storageKey", "mimeType", "sizeBytes", "checksum", "originalFilename", "previousVersionId", "isCurrent"]) {
      expect(fields).toContain(f);
    }
  });

  it("defines the DocumentAccessLog model", () => {
    const model = Prisma.dmmf.datamodel.models.find((m) => m.name === "DocumentAccessLog");
    expect(model).toBeDefined();
    expect(model!.fields.map((f) => f.name)).toEqual(expect.arrayContaining(["documentId", "userId", "action", "at"]));
  });
});
```

- [ ] **Step 5: Run the test**

Run: `cd noblestride-crm && npx vitest run src/server/storage/__tests__/schema-fields.test.ts`
Expected: PASS (fails before Steps 1–3, passes after).

- [ ] **Step 6: Self-verification gate**

Run: `cd noblestride-crm && npx tsc --noEmit && npm run lint && npx vitest run src/server/storage/__tests__/schema-fields.test.ts`
Expected: all green. Stage changes (do not commit).

---

### Task 2: Object-key builder

**Files:**
- Create: `src/server/storage/keys.ts`
- Test: `src/server/storage/__tests__/keys.test.ts`

**Interfaces:**
- Produces: `buildObjectKey(parts: { entityType: string; entityId: string; documentId: string; version: string; filename: string }): string` and `sanitizeFilename(name: string): string`.

- [ ] **Step 1: Write the failing test**

`src/server/storage/__tests__/keys.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildObjectKey, sanitizeFilename } from "../keys";

describe("sanitizeFilename", () => {
  it("keeps a plain filename", () => {
    expect(sanitizeFilename("Teaser v2.pdf")).toBe("Teaser v2.pdf");
  });
  it("strips path separators and traversal", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("a\\b\\c.docx")).toBe("c.docx");
  });
  it("falls back to 'file' when empty after stripping", () => {
    expect(sanitizeFilename("../")).toBe("file");
  });
});

describe("buildObjectKey", () => {
  it("builds a deterministic key with a version prefix", () => {
    expect(
      buildObjectKey({ entityType: "transaction", entityId: "txn1", documentId: "doc1", version: "v1", filename: "IM.pdf" }),
    ).toBe("transaction/txn1/doc1/v1-IM.pdf");
  });
  it("sanitizes the filename inside the key", () => {
    expect(
      buildObjectKey({ entityType: "client", entityId: "c1", documentId: "d1", version: "v1", filename: "../x.pdf" }),
    ).toBe("client/c1/d1/v1-x.pdf");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd noblestride-crm && npx vitest run src/server/storage/__tests__/keys.test.ts`
Expected: FAIL — cannot find module `../keys`.

- [ ] **Step 3: Implement `keys.ts`**

`src/server/storage/keys.ts`:
```ts
// Deterministic object keys for stored files. Keys are the ONLY thing that
// reaches a provider path, so filename sanitization happens here.

export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[^\w.\- ]+/g, "").trim();
  return cleaned.length > 0 ? cleaned : "file";
}

export function buildObjectKey(parts: {
  entityType: string;
  entityId: string;
  documentId: string;
  version: string;
  filename: string;
}): string {
  const file = sanitizeFilename(parts.filename);
  return `${parts.entityType}/${parts.entityId}/${parts.documentId}/${parts.version}-${file}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd noblestride-crm && npx vitest run src/server/storage/__tests__/keys.test.ts`
Expected: PASS.

- [ ] **Step 5: Self-verification gate**

Run: `cd noblestride-crm && npx tsc --noEmit && npm run lint && npx vitest run src/server/storage/__tests__/keys.test.ts`
Expected: all green. Stage changes.

---

### Task 3: Upload validation (MIME allowlist, size, magic-byte sniff, checksum)

**Files:**
- Create: `src/server/storage/validation.ts`
- Test: `src/server/storage/__tests__/validation.test.ts`

**Interfaces:**
- Produces:
  - `MAX_FILE_BYTES: number`
  - `sha256(bytes: Buffer): string`
  - `sniffMime(bytes: Buffer): string | null`
  - `validateUpload(filename: string, declaredMime: string, bytes: Buffer): { ok: true; mime: string; checksum: string } | { ok: false; reason: string }`

- [ ] **Step 1: Write the failing test**

`src/server/storage/__tests__/validation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validateUpload, sha256, sniffMime, MAX_FILE_BYTES } from "../validation";

const PDF = Buffer.from("%PDF-1.7\n...", "utf8");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]); // docx/xlsx/pptx container

describe("sha256", () => {
  it("is stable and hex", () => {
    expect(sha256(Buffer.from("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("sniffMime", () => {
  it("detects pdf, png, zip-container", () => {
    expect(sniffMime(PDF)).toBe("application/pdf");
    expect(sniffMime(PNG)).toBe("image/png");
    expect(sniffMime(ZIP)).toBe("application/zip");
    expect(sniffMime(Buffer.from("nope"))).toBeNull();
  });
});

describe("validateUpload", () => {
  it("accepts a pdf whose bytes match", () => {
    const r = validateUpload("IM.pdf", "application/pdf", PDF);
    expect(r.ok).toBe(true);
  });
  it("accepts a docx (zip container) declared as office type", () => {
    const r = validateUpload("model.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ZIP);
    expect(r.ok).toBe(true);
  });
  it("rejects a disallowed mime", () => {
    const r = validateUpload("x.exe", "application/x-msdownload", PDF);
    expect(r).toEqual({ ok: false, reason: expect.stringContaining("not allowed") });
  });
  it("rejects a spoofed content type (declared pdf, bytes png)", () => {
    const r = validateUpload("x.pdf", "application/pdf", PNG);
    expect(r).toEqual({ ok: false, reason: expect.stringContaining("content") });
  });
  it("rejects an oversize file", () => {
    const big = Buffer.alloc(MAX_FILE_BYTES + 1);
    const r = validateUpload("big.pdf", "application/pdf", big);
    expect(r).toEqual({ ok: false, reason: expect.stringContaining("large") });
  });
  it("rejects an empty file", () => {
    const r = validateUpload("empty.pdf", "application/pdf", Buffer.alloc(0));
    expect(r).toEqual({ ok: false, reason: expect.stringContaining("empty") });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd noblestride-crm && npx vitest run src/server/storage/__tests__/validation.test.ts`
Expected: FAIL — cannot find module `../validation`.

- [ ] **Step 3: Implement `validation.ts`**

`src/server/storage/validation.ts`:
```ts
import { createHash } from "node:crypto";

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

// Office formats (docx/xlsx/pptx) are ZIP containers; we accept them when the
// declared type is an office type and the bytes are a ZIP container.
const OFFICE_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const ALLOWED_MIMES = new Set<string>([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "text/csv",
  ...OFFICE_MIMES,
]);

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sniffMime(bytes: Buffer): string | null {
  if (bytes.length >= 5 && bytes.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return "application/zip";
  return null;
}

export function validateUpload(
  filename: string,
  declaredMime: string,
  bytes: Buffer,
): { ok: true; mime: string; checksum: string } | { ok: false; reason: string } {
  if (bytes.length === 0) return { ok: false, reason: "File is empty." };
  if (bytes.length > MAX_FILE_BYTES) return { ok: false, reason: `File is too large (max ${MAX_FILE_BYTES / (1024 * 1024)} MB).` };
  if (!ALLOWED_MIMES.has(declaredMime)) return { ok: false, reason: `File type not allowed: ${declaredMime}` };

  const sniffed = sniffMime(bytes);
  const contentOk =
    (declaredMime === "application/pdf" && sniffed === "application/pdf") ||
    (declaredMime === "image/png" && sniffed === "image/png") ||
    (declaredMime === "image/jpeg" && sniffed === "image/jpeg") ||
    (OFFICE_MIMES.has(declaredMime) && sniffed === "application/zip") ||
    (declaredMime === "text/plain" || declaredMime === "text/csv"); // text has no reliable magic bytes

  if (!contentOk) return { ok: false, reason: "File content does not match its declared type." };

  return { ok: true, mime: declaredMime, checksum: sha256(bytes) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd noblestride-crm && npx vitest run src/server/storage/__tests__/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Self-verification gate**

Run: `cd noblestride-crm && npx tsc --noEmit && npm run lint && npx vitest run src/server/storage/__tests__/validation.test.ts`
Expected: all green. Stage changes.

---

### Task 4: `StorageProvider` interface, `StorageError`, and factory

**Files:**
- Create: `src/server/storage/provider.ts`
- Test: `src/server/storage/__tests__/provider.test.ts`

**Interfaces:**
- Produces:
  - `interface StoredObject { stream: Readable; contentType: string; size: number }`
  - `interface StorageProvider { put(key, bytes: Buffer, contentType: string): Promise<void>; get(key): Promise<StoredObject>; delete(key): Promise<void> }`
  - `class StorageError extends Error { status: number }`
  - `getStorageProvider(): StorageProvider`
  - `sharePointConfigured(): boolean`
- Consumes: `LocalDiskProvider` (Task 5) and `SharePointProvider` (Task 6). **Write Task 4 to import both**; those files are created in Tasks 5–6, so this task's own test stubs the env to force the local branch and does not exercise SharePoint.

- [ ] **Step 1: Write the failing test**

`src/server/storage/__tests__/provider.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getStorageProvider, sharePointConfigured, StorageError } from "../provider";
import { LocalDiskProvider } from "../local";

const ENV = { ...process.env };
afterEach(() => { process.env = { ...ENV }; });

describe("getStorageProvider", () => {
  it("returns LocalDiskProvider by default", () => {
    delete process.env.STORAGE_PROVIDER;
    expect(getStorageProvider()).toBeInstanceOf(LocalDiskProvider);
  });
  it("returns LocalDiskProvider when STORAGE_PROVIDER=sharepoint but creds missing", () => {
    process.env.STORAGE_PROVIDER = "sharepoint";
    delete process.env.SHAREPOINT_TENANT_ID;
    expect(sharePointConfigured()).toBe(false);
    expect(getStorageProvider()).toBeInstanceOf(LocalDiskProvider);
  });
});

describe("StorageError", () => {
  it("carries an http status", () => {
    expect(new StorageError("x", 502).status).toBe(502);
    expect(new StorageError("y").status).toBe(502);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd noblestride-crm && npx vitest run src/server/storage/__tests__/provider.test.ts`
Expected: FAIL — cannot find module `../provider` (and `../local`, created in Task 5). If run before Task 5, it fails to import; that is acceptable within this task's TDD loop since Step 3 references `./local`. Implement Step 3, then Task 5 makes it pass fully. To keep this task self-contained, temporarily create an empty `src/server/storage/local.ts` exporting a stub `LocalDiskProvider` class, which Task 5 fills in.

- [ ] **Step 3: Implement `provider.ts` (and a stub `local.ts` if not yet present)**

`src/server/storage/provider.ts`:
```ts
import type { Readable } from "node:stream";
import { LocalDiskProvider } from "./local";
import { SharePointProvider } from "./sharepoint";

export interface StoredObject {
  stream: Readable;
  contentType: string;
  size: number;
}

export interface StorageProvider {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
}

export class StorageError extends Error {
  constructor(message: string, readonly status: number = 502) {
    super(message);
    this.name = "StorageError";
  }
}

export function sharePointConfigured(): boolean {
  return Boolean(
    process.env.SHAREPOINT_TENANT_ID &&
      process.env.SHAREPOINT_CLIENT_ID &&
      process.env.SHAREPOINT_CLIENT_SECRET &&
      process.env.SHAREPOINT_SITE_ID &&
      process.env.SHAREPOINT_DRIVE_ID,
  );
}

export function getStorageProvider(): StorageProvider {
  if ((process.env.STORAGE_PROVIDER ?? "local") === "sharepoint" && sharePointConfigured()) {
    return new SharePointProvider({
      tenantId: process.env.SHAREPOINT_TENANT_ID!,
      clientId: process.env.SHAREPOINT_CLIENT_ID!,
      clientSecret: process.env.SHAREPOINT_CLIENT_SECRET!,
      siteId: process.env.SHAREPOINT_SITE_ID!,
      driveId: process.env.SHAREPOINT_DRIVE_ID!,
    });
  }
  return new LocalDiskProvider(process.env.STORAGE_LOCAL_DIR ?? "./.storage");
}
```

If `local.ts`/`sharepoint.ts` don't exist yet, create minimal stubs so this compiles; Tasks 5–6 replace them.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd noblestride-crm && npx vitest run src/server/storage/__tests__/provider.test.ts`
Expected: PASS (after Task 5's real `LocalDiskProvider` exists; if using the stub, `toBeInstanceOf(LocalDiskProvider)` still passes).

- [ ] **Step 5: Self-verification gate**

Run: `cd noblestride-crm && npx tsc --noEmit && npm run lint && npx vitest run src/server/storage/__tests__/provider.test.ts`
Expected: all green. Stage changes.

---

### Task 5: `LocalDiskProvider`

**Files:**
- Create/replace: `src/server/storage/local.ts`
- Test: `src/server/storage/__tests__/local.test.ts`

**Interfaces:**
- Produces: `class LocalDiskProvider implements StorageProvider` — constructor `(root: string)`. Stores bytes at `join(root, key)` and content type in a sibling `<path>.meta` file. Guards against keys escaping `root`.

- [ ] **Step 1: Write the failing test**

`src/server/storage/__tests__/local.test.ts`:
```ts
import { describe, it, expect, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalDiskProvider } from "../local";
import { StorageError } from "../provider";

async function collect(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
}

const dirs: string[] = [];
async function freshRoot() {
  const d = await mkdtemp(join(tmpdir(), "nsstore-"));
  dirs.push(d);
  return d;
}
afterAll(async () => { for (const d of dirs) await rm(d, { recursive: true, force: true }); });

describe("LocalDiskProvider", () => {
  it("round-trips bytes and content type", async () => {
    const p = new LocalDiskProvider(await freshRoot());
    const bytes = Buffer.from("hello pdf");
    await p.put("a/b/c/v1-x.pdf", bytes, "application/pdf");
    const got = await p.get("a/b/c/v1-x.pdf");
    expect(got.contentType).toBe("application/pdf");
    expect(got.size).toBe(bytes.length);
    expect((await collect(got.stream)).equals(bytes)).toBe(true);
  });

  it("delete removes the object", async () => {
    const p = new LocalDiskProvider(await freshRoot());
    await p.put("k/v1-x.pdf", Buffer.from("z"), "application/pdf");
    await p.delete("k/v1-x.pdf");
    await expect(p.get("k/v1-x.pdf")).rejects.toBeInstanceOf(StorageError);
  });

  it("get on a missing key throws StorageError(410)", async () => {
    const p = new LocalDiskProvider(await freshRoot());
    await expect(p.get("nope")).rejects.toMatchObject({ status: 410 });
  });

  it("rejects a key that escapes the root", async () => {
    const p = new LocalDiskProvider(await freshRoot());
    await expect(p.put("../escape.pdf", Buffer.from("z"), "application/pdf")).rejects.toBeInstanceOf(StorageError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd noblestride-crm && npx vitest run src/server/storage/__tests__/local.test.ts`
Expected: FAIL — stub has no behavior.

- [ ] **Step 3: Implement `local.ts`**

`src/server/storage/local.ts`:
```ts
import { createReadStream } from "node:fs";
import { mkdir, writeFile, stat, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { StorageProvider, StoredObject } from "./provider";
import { StorageError } from "./provider";

export class LocalDiskProvider implements StorageProvider {
  private readonly root: string;
  constructor(root: string) {
    this.root = resolve(root);
  }

  private resolveKey(key: string): string {
    const full = resolve(this.root, key);
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new StorageError(`Invalid storage key: ${key}`, 400);
    }
    return full;
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    const full = this.resolveKey(key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, bytes);
    await writeFile(full + ".meta", contentType, "utf8");
  }

  async get(key: string): Promise<StoredObject> {
    const full = this.resolveKey(key);
    let size: number;
    try {
      size = (await stat(full)).size;
    } catch {
      throw new StorageError(`Object not found: ${key}`, 410);
    }
    let contentType = "application/octet-stream";
    try {
      contentType = (await readFile(full + ".meta", "utf8")).trim() || contentType;
    } catch {
      /* meta optional */
    }
    return { stream: createReadStream(full), contentType, size };
  }

  async delete(key: string): Promise<void> {
    const full = this.resolveKey(key);
    await rm(full, { force: true });
    await rm(full + ".meta", { force: true });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd noblestride-crm && npx vitest run src/server/storage/__tests__/local.test.ts`
Expected: PASS.

- [ ] **Step 5: Self-verification gate**

Run: `cd noblestride-crm && npx tsc --noEmit && npm run lint && npx vitest run "src/server/storage/**"`
Expected: all green. Stage changes.

---

### Task 6: `SharePointProvider` (Microsoft Graph, injectable fetch)

**Files:**
- Create/replace: `src/server/storage/sharepoint.ts`
- Test: `src/server/storage/__tests__/sharepoint.test.ts`

**Interfaces:**
- Produces: `interface SharePointConfig { tenantId; clientId; clientSecret; siteId; driveId }` and `class SharePointProvider implements StorageProvider`, constructor `(config: SharePointConfig, deps?: { fetchImpl?: typeof fetch })`. Uses OAuth2 client-credentials (token cached in-memory) and Graph driveItem content endpoints. Maps non-OK Graph responses to `StorageError`.

- [ ] **Step 1: Write the failing test** (mocked fetch — no live Graph)

`src/server/storage/__tests__/sharepoint.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { SharePointProvider } from "../sharepoint";
import { StorageError } from "../provider";

const config = { tenantId: "t", clientId: "c", clientSecret: "s", siteId: "site", driveId: "drive" };

function tokenResponse() {
  return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), {
    status: 200, headers: { "content-type": "application/json" },
  });
}

describe("SharePointProvider", () => {
  it("puts via the driveItem content endpoint with a bearer token", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: any, init?: any) => {
      calls.push({ url: String(url), init });
      if (String(url).includes("/oauth2/v2.0/token")) return tokenResponse();
      return new Response("{}", { status: 201 });
    }) as unknown as typeof fetch;

    const p = new SharePointProvider(config, { fetchImpl });
    await p.put("a/b/v1-x.pdf", Buffer.from("z"), "application/pdf");

    const putCall = calls.find((c) => c.url.includes("/content"))!;
    expect(putCall.url).toContain("/sites/site/drives/drive/root:/a/b/v1-x.pdf:/content");
    expect((putCall.init!.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("maps a Graph 403 on get to StorageError", async () => {
    const fetchImpl = vi.fn(async (url: any) => {
      if (String(url).includes("/oauth2/v2.0/token")) return tokenResponse();
      return new Response("denied", { status: 403 });
    }) as unknown as typeof fetch;
    const p = new SharePointProvider(config, { fetchImpl });
    await expect(p.get("k")).rejects.toBeInstanceOf(StorageError);
  });

  it("deletes via the driveItem path", async () => {
    const seen: string[] = [];
    const fetchImpl = vi.fn(async (url: any, init?: any) => {
      seen.push(`${init?.method ?? "GET"} ${String(url)}`);
      if (String(url).includes("/oauth2/v2.0/token")) return tokenResponse();
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    const p = new SharePointProvider(config, { fetchImpl });
    await p.delete("a/b/v1-x.pdf");
    expect(seen.some((s) => s.startsWith("DELETE") && s.includes("/root:/a/b/v1-x.pdf"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd noblestride-crm && npx vitest run src/server/storage/__tests__/sharepoint.test.ts`
Expected: FAIL — stub has no behavior.

- [ ] **Step 3: Implement `sharepoint.ts`**

`src/server/storage/sharepoint.ts`:
```ts
import { Readable } from "node:stream";
import type { StorageProvider, StoredObject } from "./provider";
import { StorageError } from "./provider";

export interface SharePointConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  siteId: string;
  driveId: string;
}

const GRAPH = "https://graph.microsoft.com/v1.0";

export class SharePointProvider implements StorageProvider {
  private readonly fetchImpl: typeof fetch;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: SharePointConfig, deps?: { fetchImpl?: typeof fetch }) {
    this.fetchImpl = deps?.fetchImpl ?? fetch;
  }

  private async accessToken(): Promise<string> {
    const now = Date.now();
    if (this.token && this.token.expiresAt > now + 60_000) return this.token.value;
    const url = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new StorageError(`SharePoint auth failed (${res.status})`, 502);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: json.access_token, expiresAt: now + json.expires_in * 1000 };
    return json.access_token;
  }

  private itemUrl(key: string, suffix = ""): string {
    const { siteId, driveId } = this.config;
    return `${GRAPH}/sites/${siteId}/drives/${driveId}/root:/${key}${suffix}`;
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    const token = await this.accessToken();
    const res = await this.fetchImpl(this.itemUrl(key, ":/content"), {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "content-type": contentType },
      body: bytes,
    });
    if (!res.ok) throw new StorageError(`SharePoint upload failed (${res.status})`, 502);
  }

  async get(key: string): Promise<StoredObject> {
    const token = await this.accessToken();
    const res = await this.fetchImpl(this.itemUrl(key, ":/content"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) throw new StorageError(`Object not found: ${key}`, 410);
    if (!res.ok || !res.body) throw new StorageError(`SharePoint download failed (${res.status})`, 502);
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const size = Number(res.headers.get("content-length") ?? 0);
    return { stream: Readable.fromWeb(res.body as unknown as import("node:stream/web").ReadableStream), contentType, size };
  }

  async delete(key: string): Promise<void> {
    const token = await this.accessToken();
    const res = await this.fetchImpl(this.itemUrl(key), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404) throw new StorageError(`SharePoint delete failed (${res.status})`, 502);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd noblestride-crm && npx vitest run src/server/storage/__tests__/sharepoint.test.ts`
Expected: PASS.

- [ ] **Step 5: Self-verification gate**

Run: `cd noblestride-crm && npx tsc --noEmit && npm run lint && npx vitest run "src/server/storage/**"`
Expected: all green. Stage changes.

---

### Task 7: Document service — create-with-file, versioning, access log, delete

**Files:**
- Modify: `src/server/services/documents.ts`
- Modify: `src/lib/schemas/document.ts` (add optional `supersedesId`)
- Test: `src/server/services/__tests__/documents-storage.test.ts` (integration — requires dev DB)

**Interfaces:**
- Produces:
  - `createDocumentWithFile(meta: DocumentCreateInput & { supersedesId?: string }, file: { storageKey: string; storageProvider: string; mimeType: string; sizeBytes: number; checksum: string; originalFilename: string }, actor: Actor): Promise<Document>`
  - `logDocumentAccess(documentId: string, userId: string | null, action: "UPLOAD" | "DOWNLOAD" | "DELETE"): Promise<void>`
  - `deleteDocumentVersion(id: string): Promise<Document>` (promotes immediate predecessor to `isCurrent` when the deleted row was current)
- Consumes: `actorSource` from `./crud`.

- [ ] **Step 1: Add `supersedesId` to the create schema**

In `src/lib/schemas/document.ts`, add to `documentCreateSchema`:
```ts
  supersedesId: z.string().trim().optional(),
```

- [ ] **Step 2: Write the failing test**

`src/server/services/__tests__/documents-storage.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { createDocumentWithFile, deleteDocumentVersion, logDocumentAccess } from "../documents";

const FILE = { storageKey: "k/v1-x.pdf", storageProvider: "local", mimeType: "application/pdf", sizeBytes: 3, checksum: "abc", originalFilename: "x.pdf" };
const ids: string[] = [];
afterEach(async () => {
  await prisma.documentAccessLog.deleteMany({ where: { documentId: { in: ids } } });
  await prisma.document.deleteMany({ where: { id: { in: ids } } });
  ids.length = 0;
});

describe("createDocumentWithFile", () => {
  it("stores file metadata and marks the row current", async () => {
    const doc = await createDocumentWithFile({ name: "IM", type: "InformationMemorandum" }, FILE, { type: "HUMAN" });
    ids.push(doc.id);
    expect(doc.storageKey).toBe("k/v1-x.pdf");
    expect(doc.isCurrent).toBe(true);
    expect(doc.checksum).toBe("abc");
  });

  it("supersedes a prior version (new row current, old row not, linked)", async () => {
    const v1 = await createDocumentWithFile({ name: "IM", type: "InformationMemorandum" }, FILE, { type: "HUMAN" });
    ids.push(v1.id);
    const v2 = await createDocumentWithFile(
      { name: "IM", type: "InformationMemorandum", supersedesId: v1.id },
      { ...FILE, storageKey: "k/v2-x.pdf" },
      { type: "HUMAN" },
    );
    ids.push(v2.id);
    const v1After = await prisma.document.findUniqueOrThrow({ where: { id: v1.id } });
    expect(v1After.isCurrent).toBe(false);
    expect(v2.previousVersionId).toBe(v1.id);
    expect(v2.isCurrent).toBe(true);
  });
});

describe("deleteDocumentVersion", () => {
  it("promotes the predecessor when a current version is deleted", async () => {
    const v1 = await createDocumentWithFile({ name: "IM", type: "InformationMemorandum" }, FILE, { type: "HUMAN" });
    ids.push(v1.id);
    const v2 = await createDocumentWithFile(
      { name: "IM", type: "InformationMemorandum", supersedesId: v1.id },
      { ...FILE, storageKey: "k/v2-x.pdf" }, { type: "HUMAN" },
    );
    ids.push(v2.id);
    await deleteDocumentVersion(v2.id);
    const v1After = await prisma.document.findUniqueOrThrow({ where: { id: v1.id } });
    expect(v1After.isCurrent).toBe(true);
  });
});

describe("logDocumentAccess", () => {
  it("appends an access log row", async () => {
    const doc = await createDocumentWithFile({ name: "IM", type: "InformationMemorandum" }, FILE, { type: "HUMAN" });
    ids.push(doc.id);
    await logDocumentAccess(doc.id, null, "DOWNLOAD");
    const logs = await prisma.documentAccessLog.findMany({ where: { documentId: doc.id } });
    expect(logs.map((l) => l.action)).toContain("DOWNLOAD");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd noblestride-crm && npm run db:up && npx vitest run src/server/services/__tests__/documents-storage.test.ts`
Expected: FAIL — the three functions don't exist.

- [ ] **Step 4: Implement the service functions**

Append to `src/server/services/documents.ts` (imports already include `prisma`, `actorSource`):
```ts
export async function createDocumentWithFile(
  meta: import("@/lib/schemas/document").DocumentCreateInput & { supersedesId?: string },
  file: {
    storageKey: string;
    storageProvider: string;
    mimeType: string;
    sizeBytes: number;
    checksum: string;
    originalFilename: string;
  },
  actor: Actor,
) {
  const { supersedesId, ...rest } = meta;
  return prisma.$transaction(async (tx) => {
    if (supersedesId) {
      await tx.document.update({ where: { id: supersedesId }, data: { isCurrent: false } });
    }
    return tx.document.create({
      data: {
        ...rest,
        ...file,
        previousVersionId: supersedesId ?? null,
        isCurrent: true,
        createdSource: actorSource(actor),
      } as never,
    });
  });
}

export async function logDocumentAccess(
  documentId: string,
  userId: string | null,
  action: "UPLOAD" | "DOWNLOAD" | "DELETE",
): Promise<void> {
  await prisma.documentAccessLog.create({ data: { documentId, userId, action } });
}

export async function deleteDocumentVersion(id: string) {
  return prisma.$transaction(async (tx) => {
    const doc = await tx.document.findUnique({ where: { id } });
    if (!doc) throw new CrudError("Document not found");
    if (doc.isCurrent && doc.previousVersionId) {
      await tx.document.update({ where: { id: doc.previousVersionId }, data: { isCurrent: true } });
    }
    return tx.document.delete({ where: { id } });
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd noblestride-crm && npx vitest run src/server/services/__tests__/documents-storage.test.ts`
Expected: PASS.

- [ ] **Step 6: Self-verification gate**

Run: `cd noblestride-crm && npx tsc --noEmit && npm run lint && npx vitest run src/server/services/__tests__/documents-storage.test.ts`
Expected: all green. Stage changes.

---

### Task 8: Download authorization (reuse the visibility engine)

**Files:**
- Create: `src/server/documents/authz.ts`
- Test: `src/server/documents/__tests__/authz.test.ts`

**Interfaces:**
- Produces:
  - `isDocDownloadable(viewpoint: Viewpoint, doc: { id: string; partnerId: string | null }, investorVisibleDocIds: Set<string>): boolean` (pure)
  - `canDownloadDocument(prisma: PrismaClient, viewpoint: Viewpoint, documentId: string): Promise<boolean>` (loads investor-visible doc ids via `loadInvestorPortalData` + `loadInvestorPipeline`, then calls the pure helper)
- Consumes: `Viewpoint` from `@/lib/viewpoint`; `loadInvestorPortalData`, `loadInvestorPipeline` from `@/server/visibility`.

**Rationale:** membership-by-projected-id reuses ALL tier/NDA/VDR gating in `project.ts` with zero duplication — an investor may download a document iff the engine already projects it to them.

- [ ] **Step 1: Write the failing test** (pure helper — no DB)

`src/server/documents/__tests__/authz.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { isDocDownloadable } from "../authz";
import type { Viewpoint } from "@/lib/viewpoint";

const admin: Viewpoint = { role: "admin", orgRole: "Admin" };
const investor: Viewpoint = { role: "investor", recordId: "inv1" };
const partner: Viewpoint = { role: "partner", recordId: "p1" } as Viewpoint;

describe("isDocDownloadable", () => {
  it("admin (internal) can download anything", () => {
    expect(isDocDownloadable(admin, { id: "d1", partnerId: null }, new Set())).toBe(true);
  });
  it("investor can download a doc the engine projects to them", () => {
    expect(isDocDownloadable(investor, { id: "d1", partnerId: null }, new Set(["d1"]))).toBe(true);
  });
  it("investor cannot download a doc not in their projection", () => {
    expect(isDocDownloadable(investor, { id: "d2", partnerId: null }, new Set(["d1"]))).toBe(false);
  });
  it("partner can download only their own referred docs", () => {
    expect(isDocDownloadable(partner, { id: "d1", partnerId: "p1" }, new Set())).toBe(true);
    expect(isDocDownloadable(partner, { id: "d1", partnerId: "pX" }, new Set())).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd noblestride-crm && npx vitest run src/server/documents/__tests__/authz.test.ts`
Expected: FAIL — cannot find module `../authz`.

- [ ] **Step 3: Implement `authz.ts`**

`src/server/documents/authz.ts`:
```ts
import type { PrismaClient } from "@prisma/client";
import type { Viewpoint } from "@/lib/viewpoint";
import { loadInvestorPortalData, loadInvestorPipeline } from "@/server/visibility";

export function isDocDownloadable(
  viewpoint: Viewpoint,
  doc: { id: string; partnerId: string | null },
  investorVisibleDocIds: Set<string>,
): boolean {
  if (viewpoint.role === "admin") return true; // internal staff
  if (viewpoint.role === "investor") return investorVisibleDocIds.has(doc.id);
  if (viewpoint.role === "partner") return doc.partnerId != null && doc.partnerId === viewpoint.recordId;
  return false;
}

export async function canDownloadDocument(
  prisma: PrismaClient,
  viewpoint: Viewpoint,
  documentId: string,
): Promise<boolean> {
  const doc = await prisma.document.findUnique({ where: { id: documentId }, select: { id: true, partnerId: true } });
  if (!doc) return false;

  let visibleIds = new Set<string>();
  if (viewpoint.role === "investor" && viewpoint.recordId) {
    const [portal, pipeline] = await Promise.all([
      loadInvestorPortalData(prisma, viewpoint.recordId),
      loadInvestorPipeline(prisma, viewpoint.recordId),
    ]);
    visibleIds = new Set<string>([
      ...portal.deals.flatMap((d) => d.documents.map((doc) => doc.id)),
      ...pipeline.flatMap((item) => item.deal.documents.map((doc) => doc.id)),
    ]);
  }
  return isDocDownloadable(viewpoint, doc, visibleIds);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd noblestride-crm && npx vitest run src/server/documents/__tests__/authz.test.ts`
Expected: PASS.

- [ ] **Step 5: Self-verification gate**

Run: `cd noblestride-crm && npx tsc --noEmit && npm run lint && npx vitest run src/server/documents/__tests__/authz.test.ts`
Expected: all green. Stage changes.

---

### Task 9: Upload route handler (`POST /api/documents/upload`)

**Files:**
- Create: `src/app/api/documents/upload/route.ts`
- Test: `src/app/api/documents/upload/__tests__/route.test.ts`

**Interfaces:**
- Produces: `POST(request: Request): Promise<Response>`. Staff-only. Multipart form: `file` (Blob) + metadata fields (`name`, `type`, `accessLevel?`, `version?`, `transactionId?`, `clientId?`, `investorId?`, `mandateId?`, `partnerId?`, `supersedesId?`). Returns `{ id }` (201) or an error status.
- Consumes: `getViewpoint` from `@/server/viewpoint`; `validateUpload`, `getStorageProvider`, `StorageError`; `buildObjectKey`; `createDocumentWithFile`, `logDocumentAccess`, `deleteDocument`; `prisma`.

- [ ] **Step 1: Write the failing test** (mock viewpoint + provider)

`src/app/api/documents/upload/__tests__/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/viewpoint", () => ({ getViewpoint: vi.fn() }));
vi.mock("@/server/storage/provider", async (orig) => {
  const actual = await orig<typeof import("@/server/storage/provider")>();
  return { ...actual, getStorageProvider: () => ({ put: vi.fn(async () => {}), get: vi.fn(), delete: vi.fn(async () => {}) }) };
});
vi.mock("@/server/services/documents", () => ({
  createDocumentWithFile: vi.fn(async () => ({ id: "doc1" })),
  logDocumentAccess: vi.fn(async () => {}),
  deleteDocument: vi.fn(async () => {}),
}));

import { POST } from "../route";
import { getViewpoint } from "@/server/viewpoint";

function form(fields: Record<string, string>, file?: { name: string; type: string; bytes: Buffer }) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  if (file) fd.set("file", new File([file.bytes], file.name, { type: file.type }));
  return new Request("http://localhost/api/documents/upload", { method: "POST", body: fd });
}
const PDF = Buffer.from("%PDF-1.7\n");

beforeEach(() => vi.clearAllMocks());

describe("POST /api/documents/upload", () => {
  it("403 when not internal staff", async () => {
    (getViewpoint as any).mockResolvedValue({ role: "investor", recordId: "i1" });
    const res = await POST(form({ name: "IM", type: "InformationMemorandum" }, { name: "im.pdf", type: "application/pdf", bytes: PDF }));
    expect(res.status).toBe(403);
  });

  it("400 when the file fails validation", async () => {
    (getViewpoint as any).mockResolvedValue({ role: "admin", orgRole: "Admin" });
    const res = await POST(form({ name: "x", type: "InformationMemorandum" }, { name: "x.exe", type: "application/x-msdownload", bytes: PDF }));
    expect(res.status).toBe(400);
  });

  it("201 and returns the new id on success", async () => {
    (getViewpoint as any).mockResolvedValue({ role: "admin", orgRole: "Admin" });
    const res = await POST(form({ name: "IM", type: "InformationMemorandum" }, { name: "im.pdf", type: "application/pdf", bytes: PDF }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "doc1" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd noblestride-crm && npx vitest run src/app/api/documents/upload/__tests__/route.test.ts`
Expected: FAIL — cannot find `../route`.

- [ ] **Step 3: Implement the route**

`src/app/api/documents/upload/route.ts`:
```ts
import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";
import { validateUpload } from "@/server/storage/validation";
import { getStorageProvider, StorageError } from "@/server/storage/provider";
import { buildObjectKey } from "@/server/storage/keys";
import { createDocumentWithFile, logDocumentAccess } from "@/server/services/documents";
import { documentCreateSchema } from "@/lib/schemas/document";

export const runtime = "nodejs";

function entityRef(meta: Record<string, string | undefined>): { entityType: string; entityId: string } {
  if (meta.transactionId) return { entityType: "transaction", entityId: meta.transactionId };
  if (meta.mandateId) return { entityType: "mandate", entityId: meta.mandateId };
  if (meta.clientId) return { entityType: "client", entityId: meta.clientId };
  if (meta.investorId) return { entityType: "investor", entityId: meta.investorId };
  if (meta.partnerId) return { entityType: "partner", entityId: meta.partnerId };
  return { entityType: "unfiled", entityId: "unfiled" };
}

export async function POST(request: Request): Promise<Response> {
  const vp = await getViewpoint();
  if (!vp) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (vp.role !== "admin") return Response.json({ error: "Upload is staff-only" }, { status: 403 });

  const fd = await request.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Missing file" }, { status: 400 });

  const raw: Record<string, string | undefined> = {};
  for (const k of ["name", "type", "accessLevel", "status", "version", "transactionId", "clientId", "investorId", "mandateId", "partnerId", "supersedesId"]) {
    const val = fd.get(k);
    if (typeof val === "string" && val.length > 0) raw[k] = val;
  }

  const parsed = documentCreateSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid metadata" }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const check = validateUpload(file.name, file.type, bytes);
  if (!check.ok) return Response.json({ error: check.reason }, { status: 400 });

  // Create the row first to obtain an id for the key, then store bytes, then finalize.
  const { entityType, entityId } = entityRef(raw);
  const version = raw.version ?? "v1";
  const provider = getStorageProvider();

  let created;
  try {
    // Placeholder key; updated once we know the id.
    created = await createDocumentWithFile(
      { ...parsed.data },
      { storageKey: "pending", storageProvider: process.env.STORAGE_PROVIDER ?? "local", mimeType: check.mime, sizeBytes: bytes.length, checksum: check.checksum, originalFilename: file.name },
      { type: "HUMAN", userId: vp.userId },
    );
    const key = buildObjectKey({ entityType, entityId, documentId: created.id, version, filename: file.name });
    await provider.put(key, bytes, check.mime);
    await prisma.document.update({ where: { id: created.id }, data: { storageKey: key } });
    await logDocumentAccess(created.id, vp.userId ?? null, "UPLOAD");
  } catch (err) {
    if (created) await prisma.document.delete({ where: { id: created.id } }).catch(() => {});
    const status = err instanceof StorageError ? err.status : 502;
    return Response.json({ error: "Failed to store file" }, { status });
  }

  return Response.json({ id: created.id }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd noblestride-crm && npx vitest run src/app/api/documents/upload/__tests__/route.test.ts`
Expected: PASS. (The success-path test mocks `createDocumentWithFile`/provider/prisma-free path via the doc-service mock; the `prisma.document.update` call is exercised in the Task 13 e2e, not this unit test — if the unit test needs it mocked, add `vi.mock("@/lib/db", () => ({ prisma: { document: { update: vi.fn(async () => ({})) } } }))`.)

- [ ] **Step 5: Self-verification gate**

Run: `cd noblestride-crm && npx tsc --noEmit && npm run lint && npx vitest run src/app/api/documents/upload/__tests__/route.test.ts`
Expected: all green. Stage changes.

---

### Task 10: Download route handler (`GET /api/documents/[id]/download`)

**Files:**
- Create: `src/app/api/documents/[id]/download/route.ts`
- Test: `src/app/api/documents/[id]/download/__tests__/route.test.ts`

**Interfaces:**
- Produces: `GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response>`. 401 unauth, 403 denied, 404 no stored file, 410 object gone, 502 storage error, 200 stream with `Content-Disposition: attachment`.
- Consumes: `getViewpoint`; `canDownloadDocument`; `getStorageProvider`, `StorageError`; `logDocumentAccess`; `prisma`; `Readable.toWeb`.

- [ ] **Step 1: Write the failing test**

`src/app/api/documents/[id]/download/__tests__/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";

vi.mock("@/server/viewpoint", () => ({ getViewpoint: vi.fn() }));
vi.mock("@/server/documents/authz", () => ({ canDownloadDocument: vi.fn() }));
vi.mock("@/server/services/documents", () => ({ logDocumentAccess: vi.fn(async () => {}) }));
vi.mock("@/lib/db", () => ({ prisma: { document: { findUnique: vi.fn() } } }));
vi.mock("@/server/storage/provider", async (orig) => {
  const actual = await orig<typeof import("@/server/storage/provider")>();
  return { ...actual, getStorageProvider: vi.fn() };
});

import { GET } from "../route";
import { getViewpoint } from "@/server/viewpoint";
import { canDownloadDocument } from "@/server/documents/authz";
import { getStorageProvider } from "@/server/storage/provider";
import { prisma } from "@/lib/db";

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new Request("http://localhost/api/documents/d1/download");
beforeEach(() => vi.clearAllMocks());

describe("GET download", () => {
  it("401 when unauthenticated", async () => {
    (getViewpoint as any).mockResolvedValue(null);
    expect((await GET(req(), params("d1"))).status).toBe(401);
  });
  it("403 when not authorized", async () => {
    (getViewpoint as any).mockResolvedValue({ role: "investor", recordId: "i1" });
    (canDownloadDocument as any).mockResolvedValue(false);
    expect((await GET(req(), params("d1"))).status).toBe(403);
  });
  it("404 when the doc has no stored file", async () => {
    (getViewpoint as any).mockResolvedValue({ role: "admin", orgRole: "Admin" });
    (canDownloadDocument as any).mockResolvedValue(true);
    (prisma.document.findUnique as any).mockResolvedValue({ id: "d1", storageKey: null, originalFilename: null, mimeType: null });
    expect((await GET(req(), params("d1"))).status).toBe(404);
  });
  it("200 streams bytes with attachment disposition", async () => {
    (getViewpoint as any).mockResolvedValue({ role: "admin", orgRole: "Admin" });
    (canDownloadDocument as any).mockResolvedValue(true);
    (prisma.document.findUnique as any).mockResolvedValue({ id: "d1", storageKey: "k/v1-x.pdf", originalFilename: "x.pdf", mimeType: "application/pdf" });
    (getStorageProvider as any).mockReturnValue({ get: async () => ({ stream: Readable.from([Buffer.from("hi")]), contentType: "application/pdf", size: 2 }) });
    const res = await GET(req(), params("d1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("x.pdf");
    expect(await res.text()).toBe("hi");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd noblestride-crm && npx vitest run "src/app/api/documents/[id]/download/__tests__/route.test.ts"`
Expected: FAIL — cannot find `../route`.

- [ ] **Step 3: Implement the route**

`src/app/api/documents/[id]/download/route.ts`:
```ts
import { Readable } from "node:stream";
import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";
import { canDownloadDocument } from "@/server/documents/authz";
import { getStorageProvider, StorageError } from "@/server/storage/provider";
import { logDocumentAccess } from "@/server/services/documents";

export const runtime = "nodejs";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const vp = await getViewpoint();
  if (!vp) return Response.json({ error: "Not authenticated" }, { status: 401 });

  if (!(await canDownloadDocument(prisma, vp, id))) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, storageKey: true, mimeType: true, originalFilename: true },
  });
  if (!doc || !doc.storageKey) return Response.json({ error: "No stored file" }, { status: 404 });

  let object;
  try {
    object = await getStorageProvider().get(doc.storageKey);
  } catch (err) {
    const status = err instanceof StorageError ? err.status : 502;
    return Response.json({ error: "Storage error" }, { status });
  }

  await logDocumentAccess(doc.id, vp.userId ?? null, "DOWNLOAD");

  const filename = (doc.originalFilename ?? "document").replace(/"/g, "");
  return new Response(Readable.toWeb(object.stream) as unknown as ReadableStream, {
    status: 200,
    headers: {
      "content-type": doc.mimeType ?? object.contentType,
      "content-disposition": `attachment; filename="${filename}"`,
      "content-length": String(object.size),
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd noblestride-crm && npx vitest run "src/app/api/documents/[id]/download/__tests__/route.test.ts"`
Expected: PASS.

- [ ] **Step 5: Self-verification gate**

Run: `cd noblestride-crm && npx tsc --noEmit && npm run lint && npx vitest run "src/app/api/documents/**"`
Expected: all green. Stage changes.

---

### Task 11: Expose file fields on the GraphQL `Document` type

**Files:**
- Modify: `src/graphql/types.ts` (`DocumentRef`, ~line 489)
- Test: `src/graphql/__tests__/document-fields.smoke.test.ts`

**Interfaces:**
- Produces: `Document` GraphQL type gains `mimeType`, `sizeBytes`, `originalFilename`, `isCurrent`, and a computed `downloadHref` (`/api/documents/{id}/download` when `storageKey` is set, else null).

- [ ] **Step 1: Write the failing test**

`src/graphql/__tests__/document-fields.smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { printSchema } from "graphql";
import { schema } from "@/graphql/schema";

describe("Document GraphQL type", () => {
  it("exposes the new file fields", () => {
    const sdl = printSchema(schema);
    for (const f of ["mimeType", "sizeBytes", "originalFilename", "isCurrent", "downloadHref"]) {
      expect(sdl).toContain(f);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd noblestride-crm && npx vitest run src/graphql/__tests__/document-fields.smoke.test.ts`
Expected: FAIL — fields absent from SDL.

- [ ] **Step 3: Add the fields**

In `src/graphql/types.ts`, inside `DocumentRef` `fields`, after the `fileUrl` line (~497), add:
```ts
    mimeType: t.exposeString("mimeType", { nullable: true }),
    sizeBytes: t.exposeInt("sizeBytes", { nullable: true }),
    originalFilename: t.exposeString("originalFilename", { nullable: true }),
    isCurrent: t.exposeBoolean("isCurrent"),
    downloadHref: t.string({
      nullable: true,
      resolve: (d) => (d.storageKey ? `/api/documents/${d.id}/download` : null),
    }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd noblestride-crm && npx vitest run src/graphql/__tests__/document-fields.smoke.test.ts`
Expected: PASS.

- [ ] **Step 5: Self-verification gate**

Run: `cd noblestride-crm && npx tsc --noEmit && npm run lint && npx vitest run src/graphql/__tests__/document-fields.smoke.test.ts`
Expected: all green. Stage changes. (If Pothos output types are checked in — `src/generated/pothos-types.ts` — run `npm run generate` and stage it too.)

---

### Task 12: UI wiring — upload in the drawer, download links in the register; env + docs

**Files:**
- Modify: `src/components/crm/document-form-drawer.tsx`
- Modify: `src/app/(crm)/documents/page.tsx` (~lines 108–123, the Document cell)
- Modify: `.env.example`, `.gitignore`
- Create: `docs/SHAREPOINT-PROVISIONING.md`

**Interfaces:**
- Consumes: `POST /api/documents/upload` (Task 9), `downloadHref` (Task 11).

- [ ] **Step 1: Add a file input + multipart submit to the create drawer**

In `src/components/crm/document-form-drawer.tsx`, add file state after `const v = f.values;`:
```tsx
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function submitWithFile() {
    if (!file) return f.submit();
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      for (const k of ["name", "type", "accessLevel", "status", "version", "transactionId", "clientId", "investorId", "mandateId", "partnerId"]) {
        const val = v[k];
        if (typeof val === "string" && val.length > 0) fd.set(k, val);
      }
      const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      setOpen(false);
      window.location.reload();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }
```
Replace the File URL `TextField` (line ~68) with a file picker (create mode) that keeps the URL field for edit/legacy:
```tsx
          {mode === "create" ? (
            <div className="space-y-1">
              <label className="text-sm text-[var(--text-secondary)]">File</label>
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
              <p className="text-xs text-[var(--text-tertiary)]">Or leave empty and paste a link below.</p>
            </div>
          ) : null}
          <TextField label="File URL (optional link)" value={v.fileUrl as string} onChange={(x) => f.setValue("fileUrl", x)} placeholder="https://…" />
```
Point the Save button at `submitWithFile` and surface `uploadError`:
```tsx
            <Button variant="primary" size="sm" onClick={submitWithFile} disabled={f.pending || uploading}>{uploading || f.pending ? "Saving…" : "Save"}</Button>
```
Add near `f.formError`:
```tsx
          {uploadError && <p className="text-xs text-rose-600">{uploadError}</p>}
```

- [ ] **Step 2: Make the register link to the download route when a file exists**

In `src/app/(crm)/documents/page.tsx`, extend `listDocuments`' `include`/fields are unaffected (server service already returns full rows). Replace the Document name cell (lines ~110–122) so a stored file links to the download route:
```tsx
                  <Td>
                    {doc.storageKey ? (
                      <a
                        href={`/api/documents/${doc.id}/download`}
                        className="font-medium text-[var(--text-primary)] hover:text-accent transition-colors"
                        title={doc.originalFilename ?? doc.name}
                      >
                        {doc.name}
                      </a>
                    ) : doc.fileUrl ? (
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--text-primary)] hover:text-accent transition-colors" title={doc.fileUrl}>
                        {doc.name}
                      </a>
                    ) : (
                      <span className="font-medium text-[var(--text-primary)]">{doc.name}</span>
                    )}
                  </Td>
```

- [ ] **Step 3: Env + gitignore + provisioning doc**

Append to `.env.example`:
```
# ── File storage ──────────────────────────────────────────────
STORAGE_PROVIDER=local            # local | sharepoint
STORAGE_LOCAL_DIR=./.storage
# SharePoint (Microsoft Graph) — fill when the client provisions the app registration:
SHAREPOINT_TENANT_ID=
SHAREPOINT_CLIENT_ID=
SHAREPOINT_CLIENT_SECRET=
SHAREPOINT_SITE_ID=
SHAREPOINT_DRIVE_ID=
```
Add to `.gitignore` (project root and/or `noblestride-crm/.gitignore`):
```
.storage/
```
Create `docs/SHAREPOINT-PROVISIONING.md`:
```markdown
# SharePoint provisioning — what to request from the client

The CRM's file storage runs on local disk by default and switches to SharePoint
with no code change. To enable SharePoint, the client (M365 admin) must create an
Azure AD app registration and provide:

| Value | Env var | Where the admin finds it |
|---|---|---|
| Directory (tenant) ID | `SHAREPOINT_TENANT_ID` | Entra ID → Overview |
| Application (client) ID | `SHAREPOINT_CLIENT_ID` | App registration → Overview |
| Client secret | `SHAREPOINT_CLIENT_SECRET` | App registration → Certificates & secrets |
| Site ID | `SHAREPOINT_SITE_ID` | Graph: `GET /sites/{hostname}:/sites/{path}` |
| Drive ID | `SHAREPOINT_DRIVE_ID` | Graph: `GET /sites/{siteId}/drives` |

Required **application** permissions (admin consent): `Files.ReadWrite.All`, `Sites.ReadWrite.All`.

To go live: fill the five vars, set `STORAGE_PROVIDER=sharepoint`, redeploy.
Run the manual smoke checklist in the file-storage plan (Task 13) against a test document library first.
```

- [ ] **Step 4: Verify build + typecheck**

Run: `cd noblestride-crm && npx tsc --noEmit && npm run lint`
Expected: all green. (UI behavior is verified end-to-end in Task 13.) Stage changes.

---

### Task 13: End-to-end verification (Playwright) + SharePoint manual smoke checklist

**Files:**
- Create: `playwright assessment/file-storage-e2e.md` (log of the run, per `[[playwright-assessment-log]]` / `[[playwright-verify-at-end]]`)

**This is the final gate — run only after the Opus review → fix → re-review cycle.**

- [ ] **Step 1: Start the app**

Run: `cd noblestride-crm && npm run db:up && npm run dev` (see `[[noblestride-dev-quirks]]` if Prisma DLL lock). App at `http://localhost:3000`.

- [ ] **Step 2: Staff upload + download round-trip** (Playwright MCP)

- Log in at `/login` as `jane@noblestride.co` (any password).
- Go to `/documents` → **+ New Document** → fill Name + Type, choose a small local PDF, Save.
- Assert the row appears and its name links to `/api/documents/{id}/download`.
- Click it; assert the response is the same PDF (200, `content-disposition: attachment`). Verify bytes/size match what was uploaded.

- [ ] **Step 3: Investor gate** (Playwright MCP)

- Switch to a greylisted / pre-NDA investor lens (viewpoint URL per `[[noblestride-dev-quirks]]`).
- Attempt `GET /api/documents/{id}/download` for an `Internal`/`ClientShared` doc → assert **403**.
- For a VDR doc without a satisfied NDA → assert **403**; after NDA satisfied at DD tier → assert **200** (use an existing seeded engagement or note the gap).

- [ ] **Step 4: Record results**

Write pass/fail for each step into `playwright assessment/file-storage-e2e.md` with screenshots. Any failure → back to Sonnet fix (do not mark done).

- [ ] **Step 5: SharePoint manual smoke checklist (documented, runs when creds arrive)**

Record in `docs/SHAREPOINT-PROVISIONING.md` (or the e2e log) the steps to run once the client provides credentials: set the five env vars + `STORAGE_PROVIDER=sharepoint`; upload a test doc; confirm it appears in the SharePoint library; download it back byte-identical; delete it and confirm removal. Until then, SharePoint is covered by the mocked unit tests in Task 6.

---

## Self-Review

**1. Spec coverage:**
- StorageProvider seam + factory → Tasks 4–6. ✅
- Local-disk default, SharePoint drop-in by config → Tasks 4–6, 12 (env). ✅
- "API key" = Azure AD app registration → Task 12 (`SHAREPOINT-PROVISIONING.md`). ✅
- Immutable objects + linear supersession (`previousVersionId`/`isCurrent`) → Tasks 1, 7. ✅
- Download reuses visibility engine; append-only `DocumentAccessLog` → Tasks 1, 8, 10. ✅
- Validation (MIME/size/magic bytes) → Task 3, enforced in Task 9. ✅
- Staff upload; investor/partner gated download; ClientShared staff-only → Tasks 8–10 + Global Constraints. ✅
- Delete promotes predecessor → Task 7. ✅
- Error handling (400/401/403/404/410/502; no orphan row) → Tasks 9, 10. ✅
- Testing + per-step self-verification; SDD flow → every task's gate + Task 13. ✅
- Out-of-scope (investor upload, watermarking, e-sign, AV) → not built; noted. ✅

**2. Placeholder scan:** No TBD/TODO. The upload route's `storageKey: "pending"` is a deliberate two-phase write (create row → store bytes → update key), not a placeholder; its finalize + rollback are shown.

**3. Type consistency:** `StorageProvider.put/get/delete`, `StoredObject`, `StorageError.status`, `buildObjectKey` args, `validateUpload` return shape, `createDocumentWithFile(meta, file, actor)`, `canDownloadDocument(prisma, vp, id)` / `isDocDownloadable(vp, doc, ids)`, and `downloadHref` are used identically across Tasks 4–12.

**Note (verify during implementation):** Task 8 assumes `Viewpoint` has a `"partner"` role variant with `recordId`. Confirm against `src/lib/viewpoint.ts`; if partner viewpoints differ, adjust `isDocDownloadable`'s partner branch (the investor and admin branches are unaffected).
