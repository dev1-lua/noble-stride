import { describe, it, expect } from "vitest";
import { isStaffVerified, staffRefusal, STAFF_ONLY_REFUSAL } from "../staff-mode";

describe("isStaffVerified", () => {
  it("is true only when data.verified === true", () => {
    expect(isStaffVerified({ verified: true })).toBe(true);
    expect(isStaffVerified({ verified: false })).toBe(false);
    expect(isStaffVerified({ verified: "true" })).toBe(false);
    expect(isStaffVerified(undefined)).toBe(false);
    expect(isStaffVerified({})).toBe(false);
  });
});

describe("staffRefusal", () => {
  it("returns null for a verified staff caller", async () => {
    expect(await staffRefusal(async () => true)).toBeNull();
  });

  it("returns the refusal for a non-staff caller", async () => {
    expect(await staffRefusal(async () => false)).toEqual(STAFF_ONLY_REFUSAL);
  });

  it("FAILS CLOSED when the check itself throws", async () => {
    // currentUserIsStaff already catches internally, but a custom check must
    // not be able to fail open either.
    const refusal = await staffRefusal(async () => {
      throw new Error("runtime unavailable");
    }).catch(() => STAFF_ONLY_REFUSAL);
    expect(refusal).toEqual(STAFF_ONLY_REFUSAL);
  });
});
