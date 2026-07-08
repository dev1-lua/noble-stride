import { describe, it, expect, afterEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createDocumentWithFile, deleteDocumentVersion, logDocumentAccess } from "../documents";
import { CrudError } from "../crud";

// Hoisted so deleteDocumentVersion's internal getStorageProvider() calls (real
// DB, mocked storage) resolve to the same spy the tests assert against.
const { deleteStorageMock } = vi.hoisted(() => ({ deleteStorageMock: vi.fn(async () => {}) }));
vi.mock("@/server/storage/provider", async (orig) => {
  const actual = await orig<typeof import("@/server/storage/provider")>();
  return { ...actual, getStorageProvider: () => ({ put: vi.fn(), get: vi.fn(), delete: deleteStorageMock }) };
});

const FILE = { storageKey: "k/v1-x.pdf", storageProvider: "local", mimeType: "application/pdf", sizeBytes: 3, checksum: "abc", originalFilename: "x.pdf" };
const ids: string[] = [];
afterEach(async () => {
  await prisma.documentAccessLog.deleteMany({ where: { documentId: { in: ids } } });
  await prisma.document.deleteMany({ where: { id: { in: ids } } });
  ids.length = 0;
});

describe("createDocumentWithFile", () => {
  it("stores file metadata and marks the row current", async () => {
    const doc = await createDocumentWithFile({ name: "IM", type: "IM" }, FILE, { type: "HUMAN" });
    ids.push(doc.id);
    expect(doc.storageKey).toBe("k/v1-x.pdf");
    expect(doc.isCurrent).toBe(true);
    expect(doc.checksum).toBe("abc");
  });

  it("supersedes a prior version (new row current, old row not, linked)", async () => {
    const v1 = await createDocumentWithFile({ name: "IM", type: "IM" }, FILE, { type: "HUMAN" });
    ids.push(v1.id);
    const v2 = await createDocumentWithFile(
      { name: "IM", type: "IM", supersedesId: v1.id },
      { ...FILE, storageKey: "k/v2-x.pdf" },
      { type: "HUMAN" },
    );
    ids.push(v2.id);
    const v1After = await prisma.document.findUniqueOrThrow({ where: { id: v1.id } });
    expect(v1After.isCurrent).toBe(false);
    expect(v2.previousVersionId).toBe(v1.id);
    expect(v2.isCurrent).toBe(true);
  });

  it("rejects superseding a non-current (stale) version (M1)", async () => {
    const v1 = await createDocumentWithFile({ name: "IM", type: "IM" }, FILE, { type: "HUMAN" });
    ids.push(v1.id);
    const v2 = await createDocumentWithFile(
      { name: "IM", type: "IM", supersedesId: v1.id },
      { ...FILE, storageKey: "k/v2-x.pdf" },
      { type: "HUMAN" },
    );
    ids.push(v2.id);
    // v1 is now stale (isCurrent: false) — attempting to supersede it again
    // (instead of the actual head, v2) must be rejected rather than silently
    // leaving v2 as an orphaned second "current" row.
    await expect(
      createDocumentWithFile(
        { name: "IM", type: "IM", supersedesId: v1.id },
        { ...FILE, storageKey: "k/v3-x.pdf" },
        { type: "HUMAN" },
      ),
    ).rejects.toThrow(CrudError);
    const v2After = await prisma.document.findUniqueOrThrow({ where: { id: v2.id } });
    expect(v2After.isCurrent).toBe(true);
  });
});

describe("deleteDocumentVersion", () => {
  it("promotes the predecessor when a current version is deleted", async () => {
    const v1 = await createDocumentWithFile({ name: "IM", type: "IM" }, FILE, { type: "HUMAN" });
    ids.push(v1.id);
    const v2 = await createDocumentWithFile(
      { name: "IM", type: "IM", supersedesId: v1.id },
      { ...FILE, storageKey: "k/v2-x.pdf" }, { type: "HUMAN" },
    );
    ids.push(v2.id);
    await deleteDocumentVersion(v2.id);
    const v1After = await prisma.document.findUniqueOrThrow({ where: { id: v1.id } });
    expect(v1After.isCurrent).toBe(true);
  });

  it("cleans up the stored bytes via the storage provider after the row is deleted (I4a)", async () => {
    const v1 = await createDocumentWithFile({ name: "IM", type: "IM" }, FILE, { type: "HUMAN" });
    ids.push(v1.id);
    await deleteDocumentVersion(v1.id);
    expect(deleteStorageMock).toHaveBeenCalledWith(FILE.storageKey);
  });
});

describe("logDocumentAccess", () => {
  it("appends an access log row", async () => {
    const doc = await createDocumentWithFile({ name: "IM", type: "IM" }, FILE, { type: "HUMAN" });
    ids.push(doc.id);
    await logDocumentAccess(doc.id, null, "DOWNLOAD");
    const logs = await prisma.documentAccessLog.findMany({ where: { documentId: doc.id } });
    expect(logs.map((l) => l.action)).toContain("DOWNLOAD");
  });
});
