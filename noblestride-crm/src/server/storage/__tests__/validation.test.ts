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

// The ceiling is not an arbitrary number: past
// next.config.ts::experimental.proxyClientMaxBodySize, Next truncates the request
// body and the multipart parse throws, which surfaces as an opaque 500 instead of
// a size error. This file advertised 50 MB while the proxy allowed 16, so a 20 MB
// staff upload was promised and then failed without a usable message.
describe("MAX_FILE_BYTES matches the proxy ceiling", () => {
  it("is 16 MB", () => {
    expect(MAX_FILE_BYTES).toBe(16 * 1024 * 1024);
  });

  it("is the number next.config.ts allows through the proxy", async () => {
    const { readFileSync } = await import("node:fs");
    const config = readFileSync(new URL("../../../../next.config.ts", import.meta.url), "utf8");
    const match = config.match(/proxyClientMaxBodySize:\s*(\d+)\s*\*\s*1024\s*\*\s*1024/);
    expect(match, "proxyClientMaxBodySize not found in next.config.ts").not.toBeNull();
    expect(Number(match![1]) * 1024 * 1024).toBe(MAX_FILE_BYTES);
  });

  it("reports the real limit in its refusal", () => {
    const result = validateUpload("big.pdf", "application/pdf", Buffer.alloc(MAX_FILE_BYTES + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("16 MB");
  });
});
