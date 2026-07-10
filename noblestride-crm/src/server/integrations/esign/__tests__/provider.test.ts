import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getESignProvider } from "../provider";

const VARS = ["DOCUSIGN_ENABLED"];
let saved: Record<string, string | undefined>;
beforeEach(() => { saved = {}; for (const k of VARS) { saved[k] = process.env[k]; delete process.env[k]; } });
afterEach(() => { for (const k of VARS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

describe("getESignProvider", () => {
  it("returns the manual provider when DocuSign is unconfigured, and it refuses to send", async () => {
    const p = getESignProvider();
    await expect(p.sendEnvelope({
      kind: "OpenNda", documentBase64: "x", documentName: "n.pdf",
      signer: { email: "a@b.com", name: "A" }, subject: "s", linkRecord: {},
    })).rejects.toThrow(/not configured/i);
  });
});
