import { describe, it, expect, vi, beforeEach } from "vitest";

// The bug this suite pins: production inbound `from` is the full RFC-5322 header
// ("Display Name <email@host>"), but the self-view identity match needs a bare,
// normalized email. parseEmailAddress is the single source of truth for that.
import { parseEmailAddress } from "../request-sender";

describe("parseEmailAddress", () => {
  it("extracts the bare address from a display-name header", () => {
    expect(parseEmailAddress("Shaurya Dabral <shaurya@luaimplementation.ai>")).toBe(
      "shaurya@luaimplementation.ai",
    );
  });

  it("lowercases and trims", () => {
    expect(parseEmailAddress("  JO@Acme.Fund  ")).toBe("jo@acme.fund");
    expect(parseEmailAddress('"Jo Bloggs" <JO@Acme.Fund>')).toBe("jo@acme.fund");
  });

  it("passes a bare address through", () => {
    expect(parseEmailAddress("jo@acme.fund")).toBe("jo@acme.fund");
  });

  it("returns undefined for empty / non-string / address-less input", () => {
    expect(parseEmailAddress("")).toBeUndefined();
    expect(parseEmailAddress("   ")).toBeUndefined();
    expect(parseEmailAddress(undefined)).toBeUndefined();
    expect(parseEmailAddress("Display Name Only")).toBeUndefined();
  });
});

// senderFromRequest reads Lua.request.webhook.payload — mock the platform surface.
const requestMock: { channel?: string; webhook?: { payload?: unknown } } = {};
vi.mock("lua-cli", () => ({
  Lua: {
    get request() {
      return requestMock;
    },
  },
}));

describe("senderFromRequest", () => {
  beforeEach(() => {
    requestMock.webhook = undefined;
  });

  it("returns the bare email from a header-form `from`", async () => {
    const { senderFromRequest } = await import("../request-sender");
    requestMock.webhook = { payload: { from: "Shaurya Dabral <shaurya@luaimplementation.ai>" } };
    expect(senderFromRequest()).toBe("shaurya@luaimplementation.ai");
  });

  it("reads a nested {address} / {email} object", async () => {
    const { senderFromRequest } = await import("../request-sender");
    requestMock.webhook = { payload: { from: { address: "Jo <JO@Acme.Fund>" } } };
    expect(senderFromRequest()).toBe("jo@acme.fund");
  });

  it("returns undefined outside an email webhook", async () => {
    const { senderFromRequest } = await import("../request-sender");
    requestMock.webhook = undefined;
    expect(senderFromRequest()).toBeUndefined();
  });
});

describe("verifiedSender", () => {
  beforeEach(() => {
    requestMock.channel = undefined;
    requestMock.webhook = undefined;
  });

  it("returns the parsed From on the email channel", async () => {
    const { verifiedSender } = await import("../request-sender");
    requestMock.channel = "email";
    requestMock.webhook = { payload: { from: "Jo <jo@acme.fund>" } };
    expect(verifiedSender()).toBe("jo@acme.fund");
  });

  it("returns undefined on webchat EVEN WHEN the payload carries a from field (the bypass)", async () => {
    // A webchat payload can carry a visitor-typed from/email — a parseable address alone
    // must never be treated as transport-verified. This is the 2026-07-21 CRITICAL's
    // would-be regression path.
    const { verifiedSender } = await import("../request-sender");
    requestMock.channel = "web";
    requestMock.webhook = { payload: { from: "victim@rivalfund.com" } };
    expect(verifiedSender()).toBeUndefined();
  });

  it("returns undefined on the dev channel (sandbox lua chat)", async () => {
    const { verifiedSender } = await import("../request-sender");
    requestMock.channel = "dev";
    requestMock.webhook = { payload: { from: "someone@somewhere.com" } };
    expect(verifiedSender()).toBeUndefined();
  });

  it("returns undefined when the channel is missing (fail closed)", async () => {
    const { verifiedSender } = await import("../request-sender");
    requestMock.webhook = { payload: { from: "jo@acme.fund" } };
    expect(verifiedSender()).toBeUndefined();
  });
});
