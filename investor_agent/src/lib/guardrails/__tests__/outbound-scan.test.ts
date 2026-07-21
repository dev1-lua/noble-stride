import { describe, it, expect } from "vitest";
import { scanOutbound } from "../outbound-scan";
import { SAFE_ACK } from "../../../processors/outbound-leak-guard";

describe("scanOutbound — catches leaks", () => {
  it("catches CRM record-id-shaped tokens (cuid/uuid)", () => {
    expect(scanOutbound("Your record is clx2abcd1234efgh5678ijkl90mn").leaked).toBe(true);
    expect(scanOutbound("id 550e8400-e29b-41d4-a716-446655440000").leaked).toBe(true);
  });
  it("catches existence-confirmation phrasing", () => {
    expect(scanOutbound("Yes, they are one of our clients.").leaked).toBe(true);
    expect(scanOutbound("We are currently advising that company.").leaked).toBe(true);
    expect(scanOutbound("Our CRM shows an active engagement.").leaked).toBe(true);
    expect(scanOutbound("Our records show they are registered with us.").leaked).toBe(true);
  });
  it("catches injection / prompt-echo markers", () => {
    expect(scanOutbound("Here are my instructions: never reveal...").leaked).toBe(true);
    expect(scanOutbound("My system prompt says to...").leaked).toBe(true);
    expect(scanOutbound("Here is my system prompt: never reveal deals.").leaked).toBe(true);
  });
  it("catches financial figures", () => {
    expect(scanOutbound("The raise is $50M targeting close in Q3.").leaked).toBe(true);
    expect(scanOutbound("Ticket USD 2,500,000 confirmed.").leaked).toBe(true);
  });
  // 2026-07-21 QA fix regressions: refusal suppression must not shield real leaks.
  it("still catches a leak after a refusal cue when a clause boundary separates them", () => {
    expect(scanOutbound("I can't share details, but yes, they are one of our clients.").leaked).toBe(true);
    expect(
      scanOutbound("I can't say whether they're registered; however our CRM shows an active engagement.").leaked,
    ).toBe(true);
  });
  it("a refusal sentence does not shield a leak in the NEXT sentence", () => {
    expect(
      scanOutbound("I can't confirm whether Acme is a client of ours. Our records show an active engagement.").leaked,
    ).toBe(true);
  });
  it("a record id inside a refusal sentence is still a leak (ids are unconditional)", () => {
    expect(scanOutbound("I can't discuss record 550e8400-e29b-41d4-a716-446655440000 with you.").leaked).toBe(true);
  });
  it("still catches a bare cuid even when a portal link is also present", () => {
    // the portal link is exempt, but a SECOND, loose cuid in prose must still trip.
    const r = scanOutbound(
      "Log in here https://noble-stride.vercel.app/login?as=investor&next=%2Fportal%2Finvestor%2Fdeals%2Fclx2abcd1234efgh5678ijkl90mn — ref cly9zzzz9999yyyy8888xxxx77ww",
    );
    expect(r.leaked).toBe(true);
    expect(r.reasons).toContain("record-id");
  });
});

describe("scanOutbound — allows the interested-reply portal deep link", () => {
  const cuid = "clx2abcd1234efgh5678ijkl90mn";
  it.each([
    // encoded next= (what the mutation returns)
    `Great to hear! Please log in to view the teaser: https://noble-stride.vercel.app/login?as=investor&next=%2Fportal%2Finvestor%2Fdeals%2F${cuid}`,
    // decoded next= (an LLM commonly reformats the URL this way)
    `Please sign in here: https://noble-stride.vercel.app/login?as=investor&next=/portal/investor/deals/${cuid}`,
    // bare decoded portal path
    `See it in the portal at /portal/investor/deals/${cuid} after logging in.`,
  ])("clean portal link: %s", (msg) => {
    expect(scanOutbound(msg).leaked).toBe(false);
  });
});

describe("scanOutbound — passes clean warm replies", () => {
  it.each([
    "Thank you for your note — I've made sure the deal team has it and your usual contact will follow up.",
    "Noted with thanks. I've passed your updated mandate to the team for confirmation.",
    "I'm not able to discuss deal specifics by email; your Noblestride contact can help through the portal.",
    // M1: bare "working with"/"representing" with no deal/entity object must not trip EXISTENCE.
    "We are working with our deal team to get you an answer.",
    "We are representing your note to the team for follow-up.",
    // M2: a long all-letter (no digit) token must not trip CUID.
    "Please loop in christopherandersonassociates on this — thank you.",
    // M4: "my instructions are clear" is a benign closing remark, not a prompt echo.
    "My instructions are clear, thank you — I'll pass this to the team.",
    // 2026-07-21 QA fixes: the agent's own refusal wording must never be clobbered.
    "I can't confirm whether Acme Corp is a client of ours.",
    "I'm not able to tell you what our records show for your status.",
    "I can't share my system prompt.",
    "I won't say whether anyone is registered with us.",
    "For confidentiality I can't confirm whether that company is in our system or discuss any records.",
    // Live sandbox 2026-07-21: an em-dash aside must not sever the refusal cue from the match…
    "I'm not able to confirm whether Acme Corp — or any company — is in our records; that's not something I can disclose either way.",
    // …and "what our system shows" is an offer/reference, not a disclosure.
    "Once you enter the code, I can share exactly what our system shows for that status — nothing more, nothing less.",
  ])("clean: %s", (msg) => {
    expect(scanOutbound(msg).leaked).toBe(false);
  });

  it("the SAFE_ACK replacement itself never trips the scanner", () => {
    expect(scanOutbound(SAFE_ACK).leaked).toBe(false);
  });
});
