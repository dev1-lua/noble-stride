import { describe, it, expect } from "vitest";
import { buildSharedLinkBody } from "../box";

describe("buildSharedLinkBody", () => {
  it("sets open access, password, expiry and can_download per input", () => {
    const body = buildSharedLinkBody({
      documentId: "d1", bytes: Buffer.from(""), filename: "f.pdf", contentType: "application/pdf",
      watermark: true, password: "pw", expiresAt: new Date("2026-08-01T00:00:00Z"), allowDownload: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
    expect(body.shared_link.access).toBe("open");
    expect(body.shared_link.password).toBe("pw");
    expect(body.shared_link.unshared_at).toBe("2026-08-01T00:00:00.000Z");
    expect(body.shared_link.permissions.can_download).toBe(true);
  });

  it("omits password and unshared_at when not provided, and reflects can_download=false", () => {
    const body = buildSharedLinkBody({
      documentId: "d1", bytes: Buffer.from(""), filename: "f.pdf", contentType: "application/pdf",
      watermark: false, allowDownload: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
    expect(body.shared_link.access).toBe("open");
    expect(body.shared_link.password).toBeUndefined();
    expect(body.shared_link.unshared_at).toBeUndefined();
    expect(body.shared_link.permissions.can_download).toBe(false);
    expect(body.shared_link.permissions.can_preview).toBe(true);
  });
});
