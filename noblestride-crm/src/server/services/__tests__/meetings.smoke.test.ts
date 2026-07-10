import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/server/integrations/meetings/provider", () => ({
  getMeetingProvider: () => ({
    scheduleMeeting: vi.fn(async () => ({ externalId: "evt-1", joinUrl: "https://teams/join" })),
    cancelMeeting: vi.fn(),
  }),
}));
import { scheduleMeeting } from "../meetings";
import { prisma } from "@/lib/db";
import type { Actor } from "@/graphql/context";

beforeEach(async () => { await prisma.meeting.deleteMany({ where: { externalId: "evt-1" } }); });

describe("scheduleMeeting", () => {
  it("persists a Meeting row and logs a Meeting Activity", async () => {
    const out = await scheduleMeeting({
      subject: "Intro", startAt: new Date(), endAt: new Date(), attendees: [{ email: "i@x.com" }], linkRecord: {},
    }, { type: "API" } as Actor);
    expect(out.joinUrl).toBe("https://teams/join");
    const m = await prisma.meeting.findFirst({ where: { externalId: "evt-1" } });
    expect(m?.joinUrl).toBe("https://teams/join");
  });
});
