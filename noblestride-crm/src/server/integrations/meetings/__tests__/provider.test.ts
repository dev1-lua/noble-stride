import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMeetingProvider } from "../provider";

const VARS = ["TEAMS_ENABLED"];
let saved: Record<string, string | undefined>;
beforeEach(() => { saved = {}; for (const k of VARS) { saved[k] = process.env[k]; delete process.env[k]; } });
afterEach(() => { for (const k of VARS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

describe("getMeetingProvider", () => {
  it("returns the manual provider when Teams is unconfigured; scheduling refuses", async () => {
    await expect(getMeetingProvider().scheduleMeeting({
      subject: "s", startAt: new Date(), endAt: new Date(), attendees: [], linkRecord: {},
    })).rejects.toThrow(/not configured/i);
  });
});
