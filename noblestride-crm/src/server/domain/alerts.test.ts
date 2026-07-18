import { describe, it, expect } from "vitest";
import { stalledEngagementAlert, stuckDealAlert, overdueTaskAlert, dedupeAlerts } from "./alerts";

const NOW = new Date("2026-07-17T06:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const eng = (over: Partial<Parameters<typeof stalledEngagementAlert>[0]> = {}) => ({
  id: "e1",
  status: "InConversation",
  lastContact: daysAgo(20),
  investorName: "Vantage Capital",
  transactionName: "Busoga Raise",
  ownerId: "u1",
  transactionOwnerId: "u2",
  ...over,
});

describe("stalledEngagementAlert", () => {
  it("alerts an in-flight engagement past the threshold, addressed to the engagement owner", () => {
    const a = stalledEngagementAlert(eng(), NOW);
    expect(a).toMatchObject({ kind: "stalled_engagement", recipientIds: ["u1"], href: "/engagement/e1" });
    expect(a?.title).toContain("20 days");
  });
  it("treats never-contacted as stalled and falls back to the transaction owner", () => {
    const a = stalledEngagementAlert(eng({ lastContact: null, ownerId: null }), NOW);
    expect(a).toMatchObject({ recipientIds: ["u2"] });
    expect(a?.title).toContain("never contacted");
  });
  it("skips fresh contact, terminal statuses, and recipient-less engagements", () => {
    expect(stalledEngagementAlert(eng({ lastContact: daysAgo(3) }), NOW)).toBeNull();
    expect(stalledEngagementAlert(eng({ status: "Passed" }), NOW)).toBeNull();
    expect(stalledEngagementAlert(eng({ status: "Committed" }), NOW)).toBeNull();
    expect(stalledEngagementAlert(eng({ status: "NotContacted" }), NOW)).toBeNull();
    expect(stalledEngagementAlert(eng({ ownerId: null, transactionOwnerId: null }), NOW)).toBeNull();
  });
});

describe("stuckDealAlert", () => {
  const deal = (over: Partial<Parameters<typeof stuckDealAlert>[0]> = {}) => ({
    id: "d1",
    kind: "transaction" as const,
    name: "Kigali Raise",
    stageLabel: "Due Diligence",
    stageEnteredAt: daysAgo(45),
    leadId: "u1",
    assistIds: ["u3"],
    ...over,
  });
  it("alerts lead + assists after the stuck threshold with a kind-specific href", () => {
    const a = stuckDealAlert(deal(), NOW);
    expect(a).toMatchObject({ kind: "deal_stuck", recipientIds: ["u1", "u3"], href: "/transactions/d1" });
    expect(stuckDealAlert(deal({ kind: "advisory" }), NOW)?.href).toBe("/advisory/d1");
    expect(stuckDealAlert(deal({ kind: "mandate" }), NOW)?.href).toBe("/mandates/d1");
  });
  it("skips recently-moved deals and unowned deals", () => {
    expect(stuckDealAlert(deal({ stageEnteredAt: daysAgo(10) }), NOW)).toBeNull();
    expect(stuckDealAlert(deal({ leadId: null, assistIds: [] }), NOW)).toBeNull();
  });
});

describe("overdueTaskAlert", () => {
  it("alerts the assignee once a due date has passed", () => {
    expect(overdueTaskAlert({ id: "t1", title: "Send IM", dueAt: daysAgo(2), assigneeId: "u1" }, NOW))
      .toMatchObject({ kind: "task_overdue", recipientIds: ["u1"] });
    expect(overdueTaskAlert({ id: "t1", title: "x", dueAt: daysAgo(-1), assigneeId: "u1" }, NOW)).toBeNull();
    expect(overdueTaskAlert({ id: "t1", title: "x", dueAt: daysAgo(2), assigneeId: null }, NOW)).toBeNull();
  });
});

describe("dedupeAlerts", () => {
  const cand = { kind: "deal_stuck" as const, title: "x", href: "/transactions/d1", recipientIds: ["u1"] };
  it("suppresses when the same (kind, href) is unread or inside the repeat window", () => {
    expect(dedupeAlerts([cand], [{ kind: "deal_stuck", href: "/transactions/d1", readAt: null, createdAt: daysAgo(30) }], NOW)).toEqual([]);
    expect(dedupeAlerts([cand], [{ kind: "deal_stuck", href: "/transactions/d1", readAt: daysAgo(1), createdAt: daysAgo(2) }], NOW)).toEqual([]);
  });
  it("re-alerts once the prior notification is read and the window elapsed", () => {
    expect(dedupeAlerts([cand], [{ kind: "deal_stuck", href: "/transactions/d1", readAt: daysAgo(8), createdAt: daysAgo(9) }], NOW)).toEqual([cand]);
  });
  it("does not suppress across kinds or hrefs", () => {
    expect(dedupeAlerts([cand], [{ kind: "stalled_engagement", href: "/transactions/d1", readAt: null, createdAt: NOW }], NOW)).toEqual([cand]);
    expect(dedupeAlerts([cand], [{ kind: "deal_stuck", href: "/transactions/other", readAt: null, createdAt: NOW }], NOW)).toEqual([cand]);
  });
});
