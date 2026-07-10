import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDocShareProvider } from "../provider";

const VARS = ["BOX_ENABLED"];
let saved: Record<string, string | undefined>;
beforeEach(() => { saved = {}; for (const k of VARS) { saved[k] = process.env[k]; delete process.env[k]; } });
afterEach(() => { for (const k of VARS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

describe("getDocShareProvider", () => {
  it("returns the null provider when Box is unconfigured; sharing refuses", async () => {
    const p = getDocShareProvider();
    await expect(p.shareDocument({
      documentId: "d1", bytes: Buffer.from("x"), filename: "f.pdf", contentType: "application/pdf",
      watermark: true, allowDownload: false,
    })).rejects.toThrow(/not configured/i);
  });

  it("revokeShare on the null provider is a no-op", async () => {
    const p = getDocShareProvider();
    await expect(p.revokeShare("ext-1")).resolves.toBeUndefined();
  });
});
