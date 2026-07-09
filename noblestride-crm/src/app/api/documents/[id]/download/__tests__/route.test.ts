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
    vi.mocked(getViewpoint).mockResolvedValue(null);
    expect((await GET(req(), params("d1"))).status).toBe(401);
  });
  it("403 when not authorized", async () => {
    vi.mocked(getViewpoint).mockResolvedValue({ role: "investor", recordId: "i1" });
    vi.mocked(canDownloadDocument).mockResolvedValue(false);
    expect((await GET(req(), params("d1"))).status).toBe(403);
  });
  it("404 when the doc has no stored file", async () => {
    vi.mocked(getViewpoint).mockResolvedValue({ role: "admin", orgRole: "Admin" });
    vi.mocked(canDownloadDocument).mockResolvedValue(true);
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: "d1",
      storageKey: null,
      originalFilename: null,
      mimeType: null,
    } as never);
    expect((await GET(req(), params("d1"))).status).toBe(404);
  });
  it("200 streams bytes with attachment disposition", async () => {
    vi.mocked(getViewpoint).mockResolvedValue({ role: "admin", orgRole: "Admin" });
    vi.mocked(canDownloadDocument).mockResolvedValue(true);
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: "d1",
      storageKey: "k/v1-x.pdf",
      originalFilename: "x.pdf",
      mimeType: "application/pdf",
    } as never);
    vi.mocked(getStorageProvider).mockReturnValue({
      put: vi.fn(),
      delete: vi.fn(),
      get: async () => ({ stream: Readable.from([Buffer.from("hi")]), contentType: "application/pdf", size: 2 }),
    });
    const res = await GET(req(), params("d1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("x.pdf");
    expect(await res.text()).toBe("hi");
  });

  it("omits content-length when the provider reports an unknown (zero) size (I2)", async () => {
    vi.mocked(getViewpoint).mockResolvedValue({ role: "admin", orgRole: "Admin" });
    vi.mocked(canDownloadDocument).mockResolvedValue(true);
    vi.mocked(prisma.document.findUnique).mockResolvedValue({
      id: "d1",
      storageKey: "k/v1-x.pdf",
      originalFilename: "x.pdf",
      mimeType: "application/pdf",
    } as never);
    vi.mocked(getStorageProvider).mockReturnValue({
      put: vi.fn(),
      delete: vi.fn(),
      // Mirrors SharePoint's /content redirect, which often omits Content-Length.
      get: async () => ({ stream: Readable.from([Buffer.from("hello world")]), contentType: "application/pdf", size: 0 }),
    });
    const res = await GET(req(), params("d1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBeNull();
    expect(await res.text()).toBe("hello world");
  });
});
