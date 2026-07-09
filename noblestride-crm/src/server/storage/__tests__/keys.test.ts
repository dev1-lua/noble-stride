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
  it("cannot be tricked into path traversal via entityId or version", () => {
    const key = buildObjectKey({
      entityType: "transaction",
      entityId: "../../etc",
      documentId: "doc1",
      version: "../..",
      filename: "IM.pdf",
    });
    expect(key).not.toContain("..");
    expect(key.split("/")).toHaveLength(4);
    expect(key).toBe("transaction/etc/doc1/x-IM.pdf");
  });
});
