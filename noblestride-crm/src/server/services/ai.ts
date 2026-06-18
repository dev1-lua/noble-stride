// AI service — canned (data-aware) implementations of AI-flavoured CRM functions.
// SEAM: each exported function body is replaced by Lua (Data API / LuaTool) at
// integration time — see SPEC §8. Signatures stay identical.
// No GraphQL, no React. Read-only — no provenance is set here.

import { prisma } from "@/lib/db";
import { label } from "@/lib/vocab";
import { rankInvestorMatches } from "@/server/domain/ranking";
import type { MatchInvestor, MatchTxn, InvestorMatch } from "@/server/domain/ranking";
import type { Insight } from "@/server/domain/types";
import { dashboardStats, pipelineOverview } from "@/server/services/dashboard";

// ─── Public AI functions ──────────────────────────────────────────────────────

// SEAM: replace body with Lua (Data API semantic search / LuaTool) — see SPEC §8. Signature stays identical.
export async function aiMatchInvestors(transactionId: string): Promise<InvestorMatch[]> {
  const [txn, investors] = await Promise.all([
    prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { client: true },
    }),
    prisma.investor.findMany({
      select: {
        id: true,
        name: true,
        sectorFocus: true,
        geographicFocus: true,
        ticketMin: true,
        ticketMax: true,
        status: true,
      },
    }),
  ]);

  if (txn == null) return [];

  const matchTxn: MatchTxn = {
    sector: txn.sector,
    targetRaise: Number(txn.targetRaise ?? 0),
    geography: txn.client?.countries ?? [],
  };

  const matchInvestors: MatchInvestor[] = investors.map((inv) => ({
    id: inv.id,
    name: inv.name,
    sectorFocus: inv.sectorFocus as string[],
    geographicFocus: inv.geographicFocus as string[],
    ticketMin: inv.ticketMin != null ? Number(inv.ticketMin) : null,
    ticketMax: inv.ticketMax != null ? Number(inv.ticketMax) : null,
    status: inv.status,
  }));

  return rankInvestorMatches(matchInvestors, matchTxn, 8);
}

// SEAM: replace body with Lua (Data API semantic search / LuaTool) — see SPEC §8. Signature stays identical.
export async function aiFindProspects(
  mandateId: string
): Promise<{ name: string; sector: string; rationale: string }[]> {
  const mandate = await prisma.mandate.findUnique({
    where: { id: mandateId },
    include: { client: true },
  });

  if (mandate == null) return [];

  const prospects = await prisma.client.findMany({
    where: {
      sector: { hasSome: mandate.sector },
      id: { not: mandate.clientId },
    },
    take: 5,
  });

  return prospects.map((client) => ({
    name: client.name,
    sector: label("Sector", client.sector[0]),
    rationale: `Operates in ${label("Sector", client.sector[0])} — matches the mandate's sector focus`,
  }));
}

// SEAM: replace body with Lua (Data API semantic search / LuaTool) — see SPEC §8. Signature stays identical.
export async function aiOverviewInsights(): Promise<Insight[]> {
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const insights: Insight[] = [];

  // 1. Convert insight: mandates in Proposal or Negotiation
  const convertCount = await prisma.mandate.count({
    where: { stage: { in: ["Proposal", "Negotiation"] } },
  });
  if (convertCount > 0) {
    insights.push({
      kind: "convert",
      title: `${convertCount} mandate${convertCount === 1 ? "" : "s"} ready to convert`,
      detail: `${convertCount} mandate${convertCount === 1 ? " is" : "s are"} in Proposal or Negotiation stage and may be ready to move forward.`,
    });
  }

  // 2. Attention insight: active transactions with no activity in the last 14d
  const activeTransactions = await prisma.transaction.findMany({
    where: { stage: { notIn: ["ClosedWon", "ClosedLost"] } },
    select: {
      id: true,
      name: true,
      activities: {
        where: { occurredAt: { gte: fourteenDaysAgo } },
        select: { id: true },
        take: 1,
      },
    },
  });
  const staleCount = activeTransactions.filter((t) => t.activities.length === 0).length;
  if (staleCount > 0) {
    insights.push({
      kind: "attention",
      title: `${staleCount} deal${staleCount === 1 ? "" : "s"} with no activity in 14 days`,
      detail: `${staleCount} active transaction${staleCount === 1 ? " has" : "s have"} had no logged activity in the past 14 days and may need follow-up.`,
    });
  }

  // 3. Match insight: pick one active transaction, find top investor match
  const oneTxn = await prisma.transaction.findFirst({
    where: { stage: { notIn: ["ClosedWon", "ClosedLost"] } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true },
  });
  if (oneTxn != null) {
    const matches = await aiMatchInvestors(oneTxn.id);
    if (matches.length > 0) {
      const top = matches[0];
      const topReason = top.reasons[0] ?? "Strong fit";
      insights.push({
        kind: "match",
        title: `Top match for ${oneTxn.name}: ${top.name}`,
        detail: `Score ${(top.score * 100).toFixed(0)}%, ${topReason}`,
      });
    }
  }

  return insights;
}

// SEAM: replace body with Lua (Data API semantic search / LuaTool) — see SPEC §8. Signature stays identical.
export async function aiAsk(
  question: string
): Promise<{ answer: string; sources: string[] }> {
  const q = question.toLowerCase();

  if (q.includes("pipeline") || q.includes("deal") || q.includes("transaction")) {
    const [overview, stats] = await Promise.all([pipelineOverview(), dashboardStats()]);
    const txnSummary = overview.transactionsByStage
      .filter((s) => s.count > 0)
      .map((s) => `${s.label}: ${s.count}`)
      .join(", ");
    return {
      answer: `The deal pipeline currently has ${stats.activeTransactions.value} active transaction${stats.activeTransactions.value === 1 ? "" : "s"}. By stage: ${txnSummary || "no transactions yet"}. Capital raised YTD: $${stats.capitalRaisedYtd.value.toLocaleString()}.`,
      sources: ["Pipeline overview", "Dashboard stats"],
    };
  }

  if (q.includes("investor")) {
    const total = await prisma.investor.count();
    const stats = await dashboardStats();
    return {
      answer: `There are ${total} investor${total === 1 ? "" : "s"} in the database. ${stats.investorsEngagedQtr.value} were engaged this quarter.`,
      sources: ["Investor count", "Dashboard stats"],
    };
  }

  // General dashboard summary
  const [stats, overview] = await Promise.all([dashboardStats(), pipelineOverview()]);
  const mandateSummary = overview.mandatesByStage
    .filter((s) => s.count > 0)
    .map((s) => `${s.label}: ${s.count}`)
    .join(", ");
  return {
    answer: `Dashboard summary: ${stats.activeMandates.value} active mandate${stats.activeMandates.value === 1 ? "" : "s"} (${mandateSummary || "none"}), ${stats.activeTransactions.value} active transaction${stats.activeTransactions.value === 1 ? "" : "s"}, ${stats.investorsEngagedQtr.value} investor${stats.investorsEngagedQtr.value === 1 ? "" : "s"} engaged this quarter. Capital raised YTD: $${stats.capitalRaisedYtd.value.toLocaleString()}.`,
    sources: ["Dashboard stats", "Pipeline overview"],
  };
}
