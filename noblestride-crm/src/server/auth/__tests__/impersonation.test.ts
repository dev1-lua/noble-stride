import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long!!";
});

describe("impersonation lens JWT", () => {
  it("signs and verifies a viewpoint round-trip", async () => {
    const { signImpersonation, verifyImpersonation } = await import("../impersonation");
    const jwt = await signImpersonation({ role: "investor", recordId: "inv_1", impersonating: true });
    const vp = await verifyImpersonation(jwt);
    expect(vp).toEqual({ role: "investor", recordId: "inv_1", impersonating: true });
  });
  it("rejects tampered and unsigned values", async () => {
    const { verifyImpersonation } = await import("../impersonation");
    expect(await verifyImpersonation(undefined)).toBeNull();
    expect(await verifyImpersonation("garbage")).toBeNull();
    expect(await verifyImpersonation(JSON.stringify({ role: "admin" }))).toBeNull(); // old unsigned format
  });
});
