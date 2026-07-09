import { afterEach, describe, expect, it, vi } from "vitest";
import { buildResendPayload, mailProvider, sendMail } from "../mailer";

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("mailer provider selection", () => {
  it("uses console when no key", () => {
    expect(mailProvider()).toBe("console");
  });
  it("uses resend when key present", () => {
    process.env.RESEND_API_KEY = "re_test";
    expect(mailProvider()).toBe("resend");
  });
  it("builds a resend payload", () => {
    expect(buildResendPayload({ to: "a@b.com", subject: "S", text: "T" }, "F")).toEqual({
      from: "F", to: ["a@b.com"], subject: "S", text: "T",
    });
  });
  it("console path does not throw and logs", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(sendMail({ to: "a@b.com", subject: "S", text: "T" })).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
  });
  it("resend path posts and throws on non-2xx", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const fetchMock = vi.fn(async () => new Response("bad", { status: 422 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendMail({ to: "a@b.com", subject: "S", text: "T" })).rejects.toThrow(/Resend send failed/);
    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST" }));
  });
});
