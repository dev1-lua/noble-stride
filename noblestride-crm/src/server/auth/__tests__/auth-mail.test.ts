import { describe, it, expect, vi } from "vitest";
import {
  sendInviteEmail, sendResetEmail, sendVerifyEmailChange,
  sendEmailChangedNotice, sendPartnerInviteEmail, sendApplicantOtpEmail, appBaseUrl,
} from "../auth-mail";

describe("auth-mail", () => {
  it("returns {sent:true} and passes to/subject/body through", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const r = await sendInviteEmail(
      { to: "a@fund.test", inviteUrl: "https://x/invite/tok", orgName: "Fundxyz", invitedByLabel: "Test Investor" },
      { send },
    );
    expect(r).toEqual({ sent: true });
    const msg = send.mock.calls[0][0];
    expect(msg.to).toBe("a@fund.test");
    expect(msg.subject).toContain("Fundxyz");
    expect(msg.text).toContain("https://x/invite/tok");
    expect(msg.text).toContain("Test Investor");
  });

  it("never throws — a transport failure becomes {sent:false}", async () => {
    const send = vi.fn().mockRejectedValue(new Error("Resend send failed (403)"));
    await expect(sendResetEmail({ to: "a@fund.test", resetUrl: "https://x/r/t" }, { send }))
      .resolves.toEqual({ sent: false });
  });

  it("every helper is failure-safe", async () => {
    const send = vi.fn().mockRejectedValue(new Error("boom"));
    const calls = [
      sendVerifyEmailChange({ to: "n@f.test", verifyUrl: "u", currentEmail: "o@f.test" }, { send }),
      sendEmailChangedNotice({ to: "o@f.test", newEmail: "n@f.test" }, { send }),
      sendPartnerInviteEmail({ to: "p@f.test", inviteUrl: "u", partnerName: "P", invitedByLabel: "Admin" }, { send }),
      sendApplicantOtpEmail({ to: "c@co.test", code: "123456" }, { send }),
    ];
    for (const r of await Promise.all(calls)) expect(r).toEqual({ sent: false });
  });

  it("never puts the raw code in the subject", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    await sendApplicantOtpEmail({ to: "c@co.test", code: "123456" }, { send });
    expect(send.mock.calls[0][0].subject).not.toContain("123456");
    expect(send.mock.calls[0][0].text).toContain("123456");
  });

  it("names the account being changed and the new address in the change flow", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    await sendVerifyEmailChange({ to: "new@f.test", verifyUrl: "https://x/verify-email/t", currentEmail: "old@f.test" }, { send });
    expect(send.mock.calls[0][0].text).toContain("old@f.test");
    expect(send.mock.calls[0][0].text).toContain("https://x/verify-email/t");
    send.mockClear();
    await sendEmailChangedNotice({ to: "old@f.test", newEmail: "new@f.test" }, { send });
    expect(send.mock.calls[0][0].text).toContain("new@f.test");
  });

  it("appBaseUrl falls back to localhost", () => {
    const prev = process.env.APP_BASE_URL; delete process.env.APP_BASE_URL;
    expect(appBaseUrl()).toBe("http://localhost:3000");
    if (prev !== undefined) process.env.APP_BASE_URL = prev;
  });
});
