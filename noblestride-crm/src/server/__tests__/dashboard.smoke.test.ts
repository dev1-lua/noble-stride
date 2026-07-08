// Smoke tests for dashboard + AI services.
// Robust to the database being down: if DATABASE_URL is unset or the DB is
// unreachable, the tests are skipped (never fail the suite).

import { describe, it, expect } from "vitest";
import {
  dashboardStats,
  pipelineOverview,
  pipelineBreakdowns,
  dealPipelineTrend,
  disbursementByPeriod,
  teamWorkload,
  taskStatusByOwner,
  overdueTasksCount,
  overdueTasks,
  quietTransactions,
} from "@/server/services/dashboard";
import { aiOverviewInsights, aiAsk, aiMatchInvestors, aiFindProspects } from "@/server/services/ai";
import { prisma } from "@/lib/db";

/** Helper: run `fn`, skip on DB errors, re-throw unexpected errors. */
async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set — skipping smoke test");
    return null;
  }
  try {
    return await fn();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND") ||
      message.includes("connect") ||
      message.includes("Can't reach database") ||
      message.includes("P1001") ||
      message.includes("P1002")
    ) {
      console.log("DB unreachable — skipping smoke test:", message);
      return null;
    }
    throw err;
  }
}

describe("dashboard service (smoke)", () => {
  it("dashboardStats() returns 4 keys each {value:number, delta:number}", async () => {
    const stats = await withDb(() => dashboardStats());
    if (stats === null) return;

    const keys = ["activeMandates", "activeTransactions", "investorsEngagedQtr", "capitalRaisedYtd"] as const;
    expect(Object.keys(stats)).toHaveLength(4);
    for (const key of keys) {
      expect(typeof stats[key].value).toBe("number");
      expect(typeof stats[key].delta).toBe("number");
    }
  });

  it("pipelineOverview() returns mandatesByStage and transactionsByStage arrays", async () => {
    const overview = await withDb(() => pipelineOverview());
    if (overview === null) return;

    expect(Array.isArray(overview.mandatesByStage)).toBe(true);
    expect(Array.isArray(overview.transactionsByStage)).toBe(true);
    // Full vocab coverage
    expect(overview.mandatesByStage).toHaveLength(7);
    expect(overview.transactionsByStage).toHaveLength(7);
    for (const row of [...overview.mandatesByStage, ...overview.transactionsByStage]) {
      expect(typeof row.stage).toBe("string");
      expect(typeof row.label).toBe("string");
      expect(typeof row.count).toBe("number");
    }
  });

  it("dealPipelineTrend() returns exactly 6 months with numeric active/closed", async () => {
    const trend = await withDb(() => dealPipelineTrend());
    if (trend === null) return;

    expect(trend).toHaveLength(6);
    for (const row of trend) {
      expect(typeof row.month).toBe("string");
      expect(typeof row.active).toBe("number");
      expect(typeof row.closed).toBe("number");
    }
  });

  it("aiOverviewInsights() returns an array of Insight objects", async () => {
    const insights = await withDb(() => aiOverviewInsights());
    if (insights === null) return;

    expect(Array.isArray(insights)).toBe(true);
    for (const insight of insights) {
      expect(["convert", "attention", "match"]).toContain(insight.kind);
      expect(typeof insight.title).toBe("string");
      expect(typeof insight.detail).toBe("string");
    }
  });

  it("aiAsk('show me the pipeline') returns {answer:string, sources:string[]}", async () => {
    const result = await withDb(() => aiAsk("show me the pipeline"));
    if (result === null) return;

    expect(typeof result.answer).toBe("string");
    expect(Array.isArray(result.sources)).toBe(true);
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it("aiMatchInvestors(id) returns an array when a transaction exists", async () => {
    const skip = await withDb(async () => {
      const txn = await prisma.transaction.findFirst({ select: { id: true } });
      if (txn == null) {
        console.log("No transactions in DB — skipping aiMatchInvestors assertion");
        return null;
      }
      const result = await aiMatchInvestors(txn.id);
      expect(Array.isArray(result)).toBe(true);
      return true;
    });
    void skip; // result not needed — test body ran above
  });

  it("aiFindProspects(id) returns an array when a mandate exists", async () => {
    const skip = await withDb(async () => {
      const mandate = await prisma.mandate.findFirst({ select: { id: true } });
      if (mandate == null) {
        console.log("No mandates in DB — skipping aiFindProspects assertion");
        return null;
      }
      const result = await aiFindProspects(mandate.id);
      expect(Array.isArray(result)).toBe(true);
      return true;
    });
    void skip;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 7 — dashboard groupings (spec §13). Own-row smoke tests: each test
// creates dedicated Users/Client/Transactions/Mandate/Tasks/Investors/
// Engagements with fresh cuid FKs so counts scoped to those ids are exact —
// no reliance on (or interference with) whatever else is in the dev DB.
// Sector/financingType/ticket-band/year-quarter assertions use a before/after
// delta or a sentinel value, since those dimensions aren't FK-isolated.
// ─────────────────────────────────────────────────────────────────────────────

describe("dashboard groupings (smoke, own rows)", () => {
  it("pipelineBreakdowns() groups active transactions by lead/sector/financingType/ticketBand", async () => {
    const ran = await withDb(async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const before = await pipelineBreakdowns();
      const sectorBefore = before.bySector.find((r) => r.key === "Aviation")?.count ?? 0;
      const financingBefore = before.byFinancingType.find((r) => r.key === "Debt")?.count ?? 0;
      const bandBefore = before.byTicketBand.find((r) => r.key === "1m-5m")?.count ?? 0;

      const leadA = await prisma.user.create({
        data: { name: `ZZ Lead A ${suffix}`, email: `zz-lead-a-${suffix}@test.local` },
      });
      const leadB = await prisma.user.create({
        data: { name: `ZZ Lead B ${suffix}`, email: `zz-lead-b-${suffix}@test.local` },
      });
      const client = await prisma.client.create({ data: { name: `ZZ Grouping Client ${suffix}` } });

      let txnA: Awaited<ReturnType<typeof prisma.transaction.create>> | null = null;
      let txnB: Awaited<ReturnType<typeof prisma.transaction.create>> | null = null;
      try {
        txnA = await prisma.transaction.create({
          data: {
            name: `ZZ Txn A ${suffix}`,
            clientId: client.id,
            ownerId: leadA.id,
            stage: "DealPreparation", // active
            sector: ["Aviation"],
            financingType: "Debt",
            targetRaise: 50_000, // -> "lt100k" band
          },
        });
        txnB = await prisma.transaction.create({
          data: {
            name: `ZZ Txn B ${suffix}`,
            clientId: client.id,
            ownerId: leadB.id,
            stage: "InvestorOutreach", // active
            sector: ["Aviation"],
            financingType: "Debt",
            targetRaise: 2_000_000, // -> "1m-5m" band
          },
        });

        const after = await pipelineBreakdowns();

        // byLead: fresh user ids, so counts are exactly isolated.
        expect(after.byLead.find((r) => r.key === leadA.id)).toEqual({
          key: leadA.id,
          label: leadA.name,
          count: 1,
        });
        expect(after.byLead.find((r) => r.key === leadB.id)).toEqual({
          key: leadB.id,
          label: leadB.name,
          count: 1,
        });

        // bySector/byFinancingType/byTicketBand: assert the delta contributed
        // by our 2 rows (both Aviation/Debt; one lt100k, one 1m-5m).
        const sectorAfter = after.bySector.find((r) => r.key === "Aviation")?.count ?? 0;
        expect(sectorAfter - sectorBefore).toBe(2);

        const financingAfter = after.byFinancingType.find((r) => r.key === "Debt")?.count ?? 0;
        expect(financingAfter - financingBefore).toBe(2);

        const lt100kAfter = after.byTicketBand.find((r) => r.key === "lt100k")?.count ?? 0;
        const lt100kBefore = before.byTicketBand.find((r) => r.key === "lt100k")?.count ?? 0;
        expect(lt100kAfter - lt100kBefore).toBe(1);

        const bandAfter = after.byTicketBand.find((r) => r.key === "1m-5m")?.count ?? 0;
        expect(bandAfter - bandBefore).toBe(1);
      } finally {
        if (txnA) await prisma.transaction.delete({ where: { id: txnA.id } });
        if (txnB) await prisma.transaction.delete({ where: { id: txnB.id } });
        await prisma.client.delete({ where: { id: client.id } });
        await prisma.user.deleteMany({ where: { id: { in: [leadA.id, leadB.id] } } });
      }
      return true;
    });
    if (ran === null) return;
  });

  it("teamWorkload() and taskStatusByOwner() scope open mandates/transactions/tasks per user", async () => {
    const ran = await withDb(async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const lead = await prisma.user.create({
        data: { name: `ZZ Workload Lead ${suffix}`, email: `zz-workload-${suffix}@test.local` },
      });
      const client = await prisma.client.create({ data: { name: `ZZ Workload Client ${suffix}` } });

      let mandate: Awaited<ReturnType<typeof prisma.mandate.create>> | null = null;
      let txn: Awaited<ReturnType<typeof prisma.transaction.create>> | null = null;
      let taskPending: Awaited<ReturnType<typeof prisma.task.create>> | null = null;
      let taskOngoing: Awaited<ReturnType<typeof prisma.task.create>> | null = null;
      try {
        mandate = await prisma.mandate.create({
          data: { name: `ZZ Mandate ${suffix}`, clientId: client.id, leadId: lead.id, stage: "NewLead" },
        });
        txn = await prisma.transaction.create({
          data: {
            name: `ZZ Workload Txn ${suffix}`,
            clientId: client.id,
            ownerId: lead.id,
            stage: "DealPreparation",
          },
        });
        taskPending = await prisma.task.create({ data: { title: `ZZ Task Pending ${suffix}`, assigneeId: lead.id, status: "Pending" } });
        taskOngoing = await prisma.task.create({ data: { title: `ZZ Task Ongoing ${suffix}`, assigneeId: lead.id, status: "Ongoing" } });

        const workload = await teamWorkload();
        expect(workload.find((w) => w.userId === lead.id)).toEqual({
          userId: lead.id,
          name: lead.name,
          openMandates: 1,
          activeTransactions: 1,
        });

        const statusByOwner = await taskStatusByOwner();
        const row = statusByOwner.find((r) => r.userId === lead.id);
        expect(row?.counts.Pending).toBe(1);
        expect(row?.counts.Ongoing).toBe(1);
      } finally {
        if (taskPending) await prisma.task.delete({ where: { id: taskPending.id } });
        if (taskOngoing) await prisma.task.delete({ where: { id: taskOngoing.id } });
        if (txn) await prisma.transaction.delete({ where: { id: txn.id } });
        if (mandate) await prisma.mandate.delete({ where: { id: mandate.id } });
        await prisma.client.delete({ where: { id: client.id } });
        await prisma.user.delete({ where: { id: lead.id } });
      }
      return true;
    });
    if (ran === null) return;
  });

  it("overdueTasksCount()/overdueTasks() surface escalated tasks", async () => {
    const ran = await withDb(async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const countBefore = await overdueTasksCount();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const task = await prisma.task.create({
        data: {
          title: `ZZ Overdue ${suffix}`,
          status: "Pending",
          dueAt: yesterday,
          escalated: true,
        },
      });
      try {
        const countAfter = await overdueTasksCount();
        expect(countAfter - countBefore).toBe(1);

        const list = await overdueTasks(10_000);
        expect(list.some((t) => t.id === task.id)).toBe(true);
      } finally {
        await prisma.task.delete({ where: { id: task.id } });
      }
      return true;
    });
    if (ran === null) return;
  });

  it("disbursementByPeriod() sums totalAmount/amountDisbursed/amountPending per (year, quarter)", async () => {
    const ran = await withDb(async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const client = await prisma.client.create({ data: { name: `ZZ Disb Client ${suffix}` } });
      const investor = await prisma.investor.create({
        data: { name: `ZZ Disb Investor ${suffix}`, investorType: "VentureCapital" },
      });

      let txn1: Awaited<ReturnType<typeof prisma.transaction.create>> | null = null;
      let txn2: Awaited<ReturnType<typeof prisma.transaction.create>> | null = null;
      let eng1: Awaited<ReturnType<typeof prisma.engagement.create>> | null = null;
      let eng2: Awaited<ReturnType<typeof prisma.engagement.create>> | null = null;
      try {
        txn1 = await prisma.transaction.create({
          data: { name: `ZZ Disb Txn 1 ${suffix}`, clientId: client.id },
        });
        txn2 = await prisma.transaction.create({
          data: { name: `ZZ Disb Txn 2 ${suffix}`, clientId: client.id },
        });

        // Sentinel year (2094) unlikely to collide with real/demo data.
        eng1 = await prisma.engagement.create({
          data: {
            name: `ZZ Eng 1 ${suffix}`,
            transactionId: txn1.id,
            investorId: investor.id,
            year: 2094,
            quarter: 1,
            totalAmount: 100,
            amountDisbursed: 40,
            amountPending: 60,
          },
        });
        eng2 = await prisma.engagement.create({
          data: {
            name: `ZZ Eng 2 ${suffix}`,
            transactionId: txn2.id,
            investorId: investor.id,
            year: 2094,
            quarter: 1,
            totalAmount: 200,
            amountDisbursed: 50,
            amountPending: 150,
          },
        });

        const summary = await disbursementByPeriod();
        expect(summary.find((r) => r.year === 2094 && r.quarter === 1)).toEqual({
          year: 2094,
          quarter: 1,
          total: 300,
          disbursed: 90,
          pending: 210,
        });
      } finally {
        if (eng1) await prisma.engagement.delete({ where: { id: eng1.id } });
        if (eng2) await prisma.engagement.delete({ where: { id: eng2.id } });
        if (txn1) await prisma.transaction.delete({ where: { id: txn1.id } });
        if (txn2) await prisma.transaction.delete({ where: { id: txn2.id } });
        await prisma.investor.delete({ where: { id: investor.id } });
        await prisma.client.delete({ where: { id: client.id } });
      }
      return true;
    });
    if (ran === null) return;
  });

  it("quietTransactions() finds active transactions with no activity in 14 days, scoped by ownerId when given", async () => {
    const ran = await withDb(async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const owner = await prisma.user.create({
        data: { name: `ZZ Quiet Owner ${suffix}`, email: `zz-quiet-${suffix}@test.local` },
      });
      const otherOwner = await prisma.user.create({
        data: { name: `ZZ Quiet Other ${suffix}`, email: `zz-quiet-other-${suffix}@test.local` },
      });
      const client = await prisma.client.create({ data: { name: `ZZ Quiet Client ${suffix}` } });

      let quietTxn: Awaited<ReturnType<typeof prisma.transaction.create>> | null = null;
      let activeTxn: Awaited<ReturnType<typeof prisma.transaction.create>> | null = null;
      let closedTxn: Awaited<ReturnType<typeof prisma.transaction.create>> | null = null;
      let otherOwnerQuietTxn: Awaited<ReturnType<typeof prisma.transaction.create>> | null = null;
      try {
        // Active, no recent activity -> quiet.
        quietTxn = await prisma.transaction.create({
          data: { name: `ZZ Quiet Txn ${suffix}`, clientId: client.id, ownerId: owner.id, stage: "DealPreparation" },
        });
        // Active, WITH recent activity -> not quiet.
        activeTxn = await prisma.transaction.create({
          data: {
            name: `ZZ Active Txn ${suffix}`,
            clientId: client.id,
            ownerId: owner.id,
            stage: "DealPreparation",
            activities: { create: { type: "Call", subject: "Call", occurredAt: new Date() } },
          },
        });
        // Closed, no activity -> excluded regardless of staleness.
        closedTxn = await prisma.transaction.create({
          data: { name: `ZZ Closed Txn ${suffix}`, clientId: client.id, ownerId: owner.id, stage: "ClosedWon" },
        });
        // Active, no activity, but a DIFFERENT owner -> excluded when scoped to `owner`.
        otherOwnerQuietTxn = await prisma.transaction.create({
          data: { name: `ZZ Other Owner Quiet Txn ${suffix}`, clientId: client.id, ownerId: otherOwner.id, stage: "DealPreparation" },
        });

        const orgWide = await quietTransactions();
        expect(orgWide.some((t) => t.id === quietTxn!.id)).toBe(true);
        expect(orgWide.some((t) => t.id === activeTxn!.id)).toBe(false);
        expect(orgWide.some((t) => t.id === closedTxn!.id)).toBe(false);
        expect(orgWide.some((t) => t.id === otherOwnerQuietTxn!.id)).toBe(true);

        const scoped = await quietTransactions(owner.id);
        expect(scoped.some((t) => t.id === quietTxn!.id)).toBe(true);
        expect(scoped.some((t) => t.id === otherOwnerQuietTxn!.id)).toBe(false);
        expect(scoped.every((t) => t.ownerId === owner.id)).toBe(true);
      } finally {
        if (quietTxn) await prisma.transaction.delete({ where: { id: quietTxn.id } });
        if (activeTxn) {
          await prisma.activity.deleteMany({ where: { transactionId: activeTxn.id } });
          await prisma.transaction.delete({ where: { id: activeTxn.id } });
        }
        if (closedTxn) await prisma.transaction.delete({ where: { id: closedTxn.id } });
        if (otherOwnerQuietTxn) await prisma.transaction.delete({ where: { id: otherOwnerQuietTxn.id } });
        await prisma.client.delete({ where: { id: client.id } });
        await prisma.user.deleteMany({ where: { id: { in: [owner.id, otherOwner.id] } } });
      }
      return true;
    });
    if (ran === null) return;
  });
});
