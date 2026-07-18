// Investor workspace service — the staff-side 360° view extras that
// getInvestor (investors.ts) doesn't load: full communications (activities
// beyond the recent-20, Outlook emails, Teams meetings), documents, open
// tasks, and agent artifacts (outreach drafts, proposed changes).
// Thin layer: Prisma calls only. No GraphQL, no React.

import { prisma } from "@/lib/db";

export async function getInvestorWorkspaceExtras(investorId: string) {
  const [activities, emails, meetings, documents, tasks, outreachDrafts, proposedChanges] = await Promise.all([
    prisma.activity.findMany({
      where: { investorId },
      orderBy: { occurredAt: "desc" },
      take: 100,
    }),
    prisma.emailMessage.findMany({
      where: { investorId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { transaction: { select: { name: true } } },
    }),
    prisma.meeting.findMany({
      where: { investorId },
      orderBy: { startAt: "desc" },
      take: 50,
      include: { transaction: { select: { name: true } } },
    }),
    prisma.document.findMany({
      where: { investorId, isCurrent: true },
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { name: true } } },
    }),
    prisma.task.findMany({
      where: { investorId, status: { notIn: ["Done", "Dropped"] } },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      include: { assignee: { select: { name: true } }, transaction: { select: { name: true } } },
    }),
    prisma.outreachDraft.findMany({
      where: { investorId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { transaction: { select: { name: true } } },
    }),
    prisma.investorProposedChange.findMany({
      where: { investorId, status: "Pending" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { activities, emails, meetings, documents, tasks, outreachDrafts, proposedChanges };
}
