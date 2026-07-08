import { afterEach, describe, expect, it } from "vitest";
import { readDevOtp, recordDevOtp } from "../dev-otp-sink";

afterEach(() => {
  delete process.env.RESEND_API_KEY;
});

describe("dev otp sink", () => {
  it("records and reads a code when console fallback is active", () => {
    const dest = `zz-test-sink-${Date.now()}@example.com`;
    recordDevOtp(dest, "654321");
    expect(readDevOtp(dest)).toBe("654321");
  });
  it("is inert when RESEND_API_KEY is set", () => {
    process.env.RESEND_API_KEY = "re_test";
    const dest = `zz-test-sink-off-${Date.now()}@example.com`;
    recordDevOtp(dest, "111111");
    expect(readDevOtp(dest)).toBeNull();
  });
});
