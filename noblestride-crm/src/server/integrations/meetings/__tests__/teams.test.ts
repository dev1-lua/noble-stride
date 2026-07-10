import { describe, it, expect } from "vitest";
import { buildEventBody } from "../teams";

describe("buildEventBody", () => {
  it("builds a Teams online-meeting event with attendees", () => {
    const body = buildEventBody({
      subject: "Intro call",
      startAt: new Date("2026-07-12T14:30:00Z"), endAt: new Date("2026-07-12T15:00:00Z"),
      attendees: [{ email: "investor@x.com", name: "Investor" }], linkRecord: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
    expect(body.subject).toBe("Intro call");
    expect(body.isOnlineMeeting).toBe(true);
    expect(body.onlineMeetingProvider).toBe("teamsForBusiness");
    expect(body.start).toEqual({ dateTime: "2026-07-12T14:30:00.000Z", timeZone: "UTC" });
    expect(body.attendees[0]).toEqual({ emailAddress: { address: "investor@x.com", name: "Investor" }, type: "required" });
  });
});
