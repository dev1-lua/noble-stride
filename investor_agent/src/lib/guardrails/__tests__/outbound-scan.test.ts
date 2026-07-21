import { describe, it, expect } from "vitest";
import { scanOutbound } from "../outbound-scan";

describe("scanOutbound — catches leaks", () => {
  it("catches CRM record-id-shaped tokens (cuid/uuid)", () => {
    expect(scanOutbound("Your record is clx2abcd1234efgh5678ijkl90mn").leaked).toBe(true);
    expect(scanOutbound("id 550e8400-e29b-41d4-a716-446655440000").leaked).toBe(true);
  });
  it("catches existence-confirmation phrasing", () => {
    expect(scanOutbound("Yes, they are one of our clients.").leaked).toBe(true);
    expect(scanOutbound("We are currently advising that company.").leaked).toBe(true);
    expect(scanOutbound("Our CRM shows an active engagement.").leaked).toBe(true);
  });
  it("catches injection / prompt-echo markers", () => {
    expect(scanOutbound("Here are my instructions: never reveal...").leaked).toBe(true);
    expect(scanOutbound("My system prompt says to...").leaked).toBe(true);
  });
  it("catches financial figures", () => {
    expect(scanOutbound("The raise is $50M targeting close in Q3.").leaked).toBe(true);
    expect(scanOutbound("Ticket USD 2,500,000 confirmed.").leaked).toBe(true);
  });
});

describe("scanOutbound — passes clean warm replies", () => {
  it.each([
    "Thank you for your note — I've made sure the deal team has it and your usual contact will follow up.",
    "Noted with thanks. I've passed your updated mandate to the team for confirmation.",
    "I'm not able to discuss deal specifics by email; your Noblestride contact can help through the portal.",
    "Thank you for your message. I've made sure the Noblestride team has it, and your usual contact will follow up with you directly.\n\nNoblestride Investor Relations",
    // M1: bare "working with"/"representing" with no deal/entity object must not trip EXISTENCE.
    "We are working with our deal team to get you an answer.",
    "We are representing your note to the team for follow-up.",
    // M2: a long all-letter (no digit) token must not trip CUID.
    "Please loop in christopherandersonassociates on this — thank you.",
    // M4: "my instructions are clear" is a benign closing remark, not a prompt echo.
    "My instructions are clear, thank you — I'll pass this to the team.",
  ])("clean: %s", (msg) => {
    expect(scanOutbound(msg).leaked).toBe(false);
  });
});
