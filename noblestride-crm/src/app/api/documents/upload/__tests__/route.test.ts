import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted so the storage-provider mock factory (and tests) can share and
// reconfigure the same put/delete spies across a single request.
const { putMock, deleteMock } = vi.hoisted(() => ({
  putMock: vi.fn(async () => {}),
  deleteMock: vi.fn(async () => {}),
}));

vi.mock("@/server/viewpoint", () => ({ getViewpoint: vi.fn() }));
vi.mock("@/server/storage/provider", async (orig) => {
  const actual = await orig<typeof import("@/server/storage/provider")>();
  return { ...actual, getStorageProvider: () => ({ put: putMock, get: vi.fn(), delete: deleteMock }) };
});
vi.mock("@/server/services/documents", () => ({
  createDocumentWithFile: vi.fn(async () => ({ id: "doc1" })),
  logDocumentAccess: vi.fn(async () => {}),
  deleteDocument: vi.fn(async () => {}),
}));
// Route calls prisma.document.update (finalize storageKey) and prisma.document.delete
// (rollback on storage failure) directly — mock the DB so this stays a pure unit test.
vi.mock("@/lib/db", () => ({
  prisma: { document: { update: vi.fn(async () => ({})), delete: vi.fn(async () => ({})) } },
}));

import { POST } from "../route";
import { getViewpoint } from "@/server/viewpoint";
import { prisma } from "@/lib/db";
import { logDocumentAccess } from "@/server/services/documents";

function form(fields: Record<string, string>, file?: { name: string; type: string; bytes: Buffer }) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  if (file) fd.set("file", new File([new Uint8Array(file.bytes)], file.name, { type: file.type }));
  return new Request("http://localhost/api/documents/upload", { method: "POST", body: fd });
}
const PDF = Buffer.from("%PDF-1.7\n");

beforeEach(() => vi.clearAllMocks());

describe("POST /api/documents/upload", () => {
  it("403 when not internal staff", async () => {
    vi.mocked(getViewpoint).mockResolvedValue({ role: "investor", recordId: "i1" });
    const res = await POST(form({ name: "IM", type: "IM" }, { name: "im.pdf", type: "application/pdf", bytes: PDF }));
    expect(res.status).toBe(403);
  });

  it("400 when the file fails validation", async () => {
    vi.mocked(getViewpoint).mockResolvedValue({ role: "admin", orgRole: "Admin" });
    const res = await POST(form({ name: "x", type: "IM" }, { name: "x.exe", type: "application/x-msdownload", bytes: PDF }));
    expect(res.status).toBe(400);
  });

  it("201 and returns the new id on success", async () => {
    vi.mocked(getViewpoint).mockResolvedValue({ role: "admin", orgRole: "Admin" });
    const res = await POST(form({ name: "IM", type: "IM" }, { name: "im.pdf", type: "application/pdf", bytes: PDF }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "doc1" });
  });

  it("502 and rolls back the created row when provider.put fails (I1)", async () => {
    vi.mocked(getViewpoint).mockResolvedValue({ role: "admin", orgRole: "Admin" });
    putMock.mockRejectedValueOnce(new Error("disk full"));
    const res = await POST(form({ name: "IM", type: "IM" }, { name: "im.pdf", type: "application/pdf", bytes: PDF }));
    expect(res.status).toBe(502);
    expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: "doc1" } });
    // put failed before a key was ever recorded as stored, so there is
    // nothing on disk/SharePoint to clean up.
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("502 and cleans up stored bytes when finalizing the row fails after a successful put (I1)", async () => {
    vi.mocked(getViewpoint).mockResolvedValue({ role: "admin", orgRole: "Admin" });
    vi.mocked(prisma.document.update).mockRejectedValueOnce(new Error("db down"));
    const res = await POST(form({ name: "IM", type: "IM" }, { name: "im.pdf", type: "application/pdf", bytes: PDF }));
    expect(res.status).toBe(502);
    expect(deleteMock).toHaveBeenCalled();
    expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: "doc1" } });
  });

  it("still returns 201 when the audit log insert fails (I1)", async () => {
    vi.mocked(getViewpoint).mockResolvedValue({ role: "admin", orgRole: "Admin" });
    vi.mocked(logDocumentAccess).mockRejectedValueOnce(new Error("audit db down"));
    const res = await POST(form({ name: "IM", type: "IM" }, { name: "im.pdf", type: "application/pdf", bytes: PDF }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "doc1" });
    expect(prisma.document.delete).not.toHaveBeenCalled();
  });
});
