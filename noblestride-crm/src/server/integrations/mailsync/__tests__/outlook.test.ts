import { describe, it, expect } from "vitest";
import { mapGraphMessage } from "../outlook";

describe("mapGraphMessage", () => {
  it("maps Graph message fields to TrackedMessage", () => {
    const m = mapGraphMessage({
      id: "m1", conversationId: "c1", subject: "Deal",
      from: { emailAddress: { address: "investor@x.com" } },
      toRecipients: [{ emailAddress: { address: "team@ns.com" } }],
      receivedDateTime: "2026-07-09T09:00:00Z", sentDateTime: "2026-07-09T08:59:00Z", bodyPreview: "hi",
    });
    expect(m).toEqual({
      externalId: "m1", conversationId: "c1", subject: "Deal",
      fromAddress: "investor@x.com", toAddresses: ["team@ns.com"],
      receivedAt: new Date("2026-07-09T09:00:00Z"), sentAt: new Date("2026-07-09T08:59:00Z"), bodyPreview: "hi",
    });
  });
});
