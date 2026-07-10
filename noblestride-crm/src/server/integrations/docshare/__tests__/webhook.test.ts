// src/server/integrations/docshare/__tests__/webhook.test.ts
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyBoxSignature, parseBoxEvent } from "../webhook";

describe("verifyBoxSignature", () => {
  it("accepts a correct HMAC-SHA256 base64 signature over body+timestamp using the primary key", () => {
    const primary = "primary-secret";
    const secondary = "secondary-secret";
    const body = '{"trigger":"FILE.DOWNLOADED"}';
    const timestamp = "2026-07-09T10:00:00Z";
    const sig = createHmac("sha256", primary).update(body + timestamp, "utf8").digest("base64");
    expect(
      verifyBoxSignature(
        body,
        { signaturePrimary: sig, signatureSecondary: null, timestamp },
        primary,
        secondary,
      ),
    ).toBe(true);
  });

  it("accepts a correct signature under the secondary key", () => {
    const primary = "primary-secret";
    const secondary = "secondary-secret";
    const body = '{"trigger":"FILE.DOWNLOADED"}';
    const timestamp = "2026-07-09T10:00:00Z";
    const sig = createHmac("sha256", secondary).update(body + timestamp, "utf8").digest("base64");
    expect(
      verifyBoxSignature(
        body,
        { signaturePrimary: null, signatureSecondary: sig, timestamp },
        primary,
        secondary,
      ),
    ).toBe(true);
  });

  it("rejects a bad signature and missing signatures", () => {
    const body = '{"trigger":"FILE.DOWNLOADED"}';
    expect(
      verifyBoxSignature(
        body,
        { signaturePrimary: "wrong", signatureSecondary: null, timestamp: "t" },
        "primary-secret",
        "secondary-secret",
      ),
    ).toBe(false);
    expect(
      verifyBoxSignature(
        body,
        { signaturePrimary: null, signatureSecondary: null, timestamp: "t" },
        "primary-secret",
        "secondary-secret",
      ),
    ).toBe(false);
  });
});

describe("parseBoxEvent", () => {
  it("extracts trigger + file id", () => {
    expect(parseBoxEvent({ trigger: "FILE.DOWNLOADED", source: { id: "box-1", type: "file" } }))
      .toEqual({ trigger: "FILE.DOWNLOADED", boxFileId: "box-1" });
  });
  it("returns null when not a file event", () => {
    expect(parseBoxEvent({ trigger: "FOLDER.CREATED", source: { id: "1", type: "folder" } })).toBeNull();
  });
  it("returns null for an unrecognized trigger on a file source", () => {
    expect(parseBoxEvent({ trigger: "FILE.UPLOADED", source: { id: "1", type: "file" } })).toBeNull();
  });
  it("returns null for a malformed payload", () => {
    expect(parseBoxEvent({})).toBeNull();
    expect(parseBoxEvent(null)).toBeNull();
  });
});
