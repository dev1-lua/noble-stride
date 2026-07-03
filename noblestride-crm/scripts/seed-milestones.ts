// seed-milestones.ts — backfill EngagementMilestone rows from each
// engagement's current stage (docs: "Sectors and Milestones"). Idempotent:
// skipDuplicates on the (engagementId, key) unique. Dates are staggered
// backwards from lastContact so the checklist reads as a believable history.
// Run: npx tsx scripts/seed-milestones.ts
import { PrismaClient } from "@prisma/client";
import { STAGE_MILESTONES } from "../src/lib/milestones";

const prisma = new PrismaClient();

async function main() {
  const engagements = await prisma.engagement.findMany({
    select: {
      id: true,
      engagementStage: true,
      lastContact: true,
      disbursementStatus: true,
      createdAt: true,
    },
  });

  let created = 0;
  for (const e of engagements) {
    const keys = [...STAGE_MILESTONES[e.engagementStage]];
    if (e.disbursementStatus === "Disbursed") keys.push("SuccessFeePaid");
    if (!keys.length) continue;
    const anchor = (e.lastContact ?? e.createdAt).getTime();
    const res = await prisma.engagementMilestone.createMany({
      data: keys.map((key, i) => ({
        engagementId: e.id,
        key,
        // Earliest milestone furthest back; ~12 days apart, ending at anchor.
        completedAt: new Date(anchor - (keys.length - 1 - i) * 12 * 86_400_000),
        createdSource: "IMPORT" as const,
      })),
      skipDuplicates: true,
    });
    created += res.count;
  }
  console.log({ engagements: engagements.length, milestonesCreated: created });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
