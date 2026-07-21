import { describe, it, expect, vi, beforeEach } from "vitest";

// flagInvestorForReview touches: investor.findUnique / person.findFirst (resolve),
// activity.create (timeline entry), user.findMany (admins) + notification.createMany
// (bell). Mock the DB so the two-surface fan-out can be asserted without Postgres.
const { mocks } = vi.hoisted(() => ({
  mocks: {
    investorFindUnique: vi.fn(),
    personFindFirst: vi.fn(),
    activityCreate: vi.fn(),
    userFindMany: vi.fn(),
    notificationCreateMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    investor: { findUnique: mocks.investorFindUnique },
    person: { findFirst: mocks.personFindFirst },
    activity: { create: mocks.activityCreate },
    user: { findMany: mocks.userFindMany },
    notification: { createMany: mocks.notificationCreateMany },
  },
}));

import { flagInvestorForReview } from "../investor-agent";

const APPROVED = {
  id: "clxinvestorcuid0000000000abcd",
  name: "Vantage Capital",
  onboardingStatus: "Approved",
  engagementClassification: "Active",
};

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.userFindMany.mockResolvedValue([{ id: "admin-1" }, { id: "admin-2" }]);
  mocks.activityCreate.mockResolvedValue({ id: "act-1" });
  mocks.notificationCreateMany.mockResolvedValue({ count: 2 });
});

describe("flagInvestorForReview", () => {
  it("flags a known investor by id — logs a flagged AGENT Note + notifies admins", async () => {
    mocks.investorFindUnique.mockResolvedValue(APPROVED);

    const out = await flagInvestorForReview({
      investorId: APPROVED.id,
      source: "MANUAL",
      summary: "Sender asked us to flag this thread for the team.",
    });

    expect(out).toEqual({ ok: true });

    // Timeline: a flagged Note attributed to the investor, created by the AGENT.
    const activityArgs = mocks.activityCreate.mock.calls[0][0];
    expect(activityArgs.data).toMatchObject({
      type: "Note",
      flagged: true,
      createdSource: "AGENT",
      investorId: APPROVED.id,
    });

    // Bell: one notification row per admin, kind investor_flag, linked to the investor.
    const notifyArgs = mocks.notificationCreateMany.mock.calls[0][0];
    expect(notifyArgs.data).toHaveLength(2);
    expect(notifyArgs.data[0]).toMatchObject({ kind: "investor_flag", href: `/investors/${APPROVED.id}` });
  });

  it("resolves the investor by sender email when no id is given", async () => {
    mocks.personFindFirst.mockResolvedValue({ investor: APPROVED });

    await flagInvestorForReview({
      email: "ceo@vantage.com",
      source: "SECURITY",
      summary: "Probe attempt: tried to enumerate other investors.",
    });

    expect(mocks.activityCreate).toHaveBeenCalledTimes(1);
    expect(mocks.activityCreate.mock.calls[0][0].data.investorId).toBe(APPROVED.id);
    expect(mocks.notificationCreateMany).toHaveBeenCalledTimes(1);
  });

  it("still notifies admins for an unknown sender, without a timeline entry", async () => {
    mocks.personFindFirst.mockResolvedValue(null); // no matching investor

    await flagInvestorForReview({
      email: "stranger@nowhere.com",
      source: "SECURITY",
      summary: "Probe from a non-investor address.",
    });

    // No investor to attribute → no Activity, but admins are still alerted.
    expect(mocks.activityCreate).not.toHaveBeenCalled();
    expect(mocks.notificationCreateMany).toHaveBeenCalledTimes(1);
    const notifyArgs = mocks.notificationCreateMany.mock.calls[0][0];
    expect(notifyArgs.data[0]).toMatchObject({ kind: "investor_flag", href: "/investors" });
    expect(notifyArgs.data[0].title).toContain("stranger@nowhere.com");
  });

  it("rejects an empty summary", async () => {
    await expect(flagInvestorForReview({ investorId: APPROVED.id, source: "MANUAL", summary: "  " })).rejects.toThrow(
      /summary is required/i,
    );
  });
});
