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
