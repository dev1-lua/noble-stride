// plant-onboarding-data.ts — demo data for investor onboarding (Task 10 of the
// Investor Onboarding plan): a fresh self-registered PendingReview investor, an
// Open-NDA investor, a Closed-NDA engagement, and a coherence backfill so the
// restage guard (assertStageAllowed) doesn't trip on pre-existing seed data
// that predates the NDA-gating feature.
// Idempotent: every step checks before creating/mutating.
// Run: npx tsx scripts/plant-onboarding-data.ts
import { PrismaClient, EngagementStage } from "@prisma/client";
import { stageRequiresNda } from "../src/server/domain/nda-guard";

const prisma = new PrismaClient();

const now = () => new Date();

// ── 1. Pending investor: self-registered, OTP-verified, awaiting review ──────
async function plantPendingInvestor() {
  const name = "Meridian Frontier Capital";
  const existing = await prisma.investor.findFirst({ where: { name } });
  if (existing) {
    return { skipped: true, id: existing.id, name };
  }

  const ts = now();
  const investor = await prisma.investor.create({
    data: {
      name,
      investorType: "PrivateEquity",
      sectorFocus: ["Agribusiness", "Technology"],
      instruments: ["Equity"],
      ticketMin: 1_000_000,
      ticketMax: 5_000_000,
      onboardingStatus: "PendingReview",
      registeredAt: ts,
      emailVerifiedAt: ts,
      phoneVerifiedAt: ts,
      createdSource: "API",
    },
  });
  await prisma.person.create({
    data: {
      firstName: "Amina",
      lastName: "Okonkwo",
      email: "amina@meridianfrontier.com",
      phone: "+254722000111",
      isPrimaryContact: true,
      investorId: investor.id,
    },
  });
  await prisma.activity.create({
    data: {
      type: "Note",
      subject: `Investor self-registered via portal: ${name}`,
      body: "Contact: Amina Okonkwo <amina@meridianfrontier.com>, +254722000111. Awaiting team review.",
      investorId: investor.id,
      createdSource: "API",
    },
  });
  return { skipped: false, id: investor.id, name };
}

// ── 2. Open-NDA investor: first Active+Approved, ndaStatus None, engaged ─────
async function plantOpenNdaInvestor() {
  const alreadyOpen = await prisma.investor.findFirst({ where: { ndaStatus: "OpenNDA" } });
  if (alreadyOpen) {
    return { skipped: true, id: alreadyOpen.id, name: alreadyOpen.name };
  }

  const candidate = await prisma.investor.findFirst({
    where: {
      engagementClassification: "Active",
      onboardingStatus: "Approved",
      ndaStatus: "None",
      engagements: { some: {} },
    },
    orderBy: { name: "asc" },
  });
  if (!candidate) {
    return { skipped: true, id: null, name: null, reason: "no eligible investor found" };
  }

  const ts = now();
  const updated = await prisma.investor.update({
    where: { id: candidate.id },
    data: { ndaStatus: "OpenNDA", openNdaSignedAt: ts },
  });
  await prisma.activity.create({
    data: {
      type: "NDASigned",
      subject: `Open NDA recorded — ${updated.name}`,
      investorId: updated.id,
      createdSource: "API",
    },
  });
  return { skipped: false, id: updated.id, name: updated.name };
}

// ── 3. Closed-NDA engagement: one post-NDA engagement, investor not open-NDA ─
// Brief's literal pool is NDASigned/IMShared with ndaType null; plant-portal-data.ts
// already stamps ndaType on every post-NDA-stage engagement it creates, so that
// exact pool is typically empty on a seeded DB. Fall back to any other
// NDA-requiring stage so the demo still gets one *recorded* (dated) Closed NDA,
// distinct from the dateless legacy rows the coherence backfill (step 4) produces.
async function plantClosedNdaEngagement(openNdaInvestorId: string | null) {
  const anySigned = await prisma.engagement.findFirst({ where: { ndaSignedAt: { not: null } } });
  if (anySigned) {
    return { skipped: true, id: anySigned.id, name: anySigned.name };
  }

  const excludeOpenNda = openNdaInvestorId ? { investorId: { not: openNdaInvestorId } } : {};

  let candidate = await prisma.engagement.findFirst({
    where: { engagementStage: { in: ["NDASigned", "IMShared"] }, ndaType: null, ...excludeOpenNda },
    orderBy: { id: "asc" },
  });
  let usedFallback = false;
  if (!candidate) {
    usedFallback = true;
    candidate = await prisma.engagement.findFirst({
      where: {
        engagementStage: { in: ["DueDiligence", "VDRAccess", "Invested", "TermSheet", "Offer", "Meeting", "InfoRequest"] },
        ndaType: null,
        investor: { ndaStatus: { not: "OpenNDA" } },
        ...excludeOpenNda,
      },
      orderBy: { id: "asc" },
    });
  }
  if (!candidate) {
    return { skipped: true, id: null, name: null, reason: "no eligible engagement found", usedFallback };
  }

  const ts = now();
  const engagement = await prisma.engagement.update({
    where: { id: candidate.id },
    data: { ndaType: "Closed", ndaSignedAt: ts },
    include: { investor: true },
  });
  if (engagement.investor.ndaStatus === "None") {
    await prisma.investor.update({ where: { id: engagement.investorId }, data: { ndaStatus: "ClosedNDA" } });
  }
  await prisma.activity.create({
    data: {
      type: "NDASigned",
      subject: `Closed NDA recorded — ${engagement.name}`,
      engagementId: engagement.id,
      investorId: engagement.investorId,
      transactionId: engagement.transactionId,
      createdSource: "API",
    },
  });
  return { skipped: false, id: engagement.id, name: engagement.name, investorId: engagement.investorId, usedFallback };
}

// ── 4. Coherence backfill: legacy engagements at NDA-requiring stages with no
// ndaType, whose investor hasn't recorded an Open NDA → stamp ndaType "Closed"
// WITHOUT ndaSignedAt (these are legacy rows predating NDA tracking, not a
// recorded signing event). Keeps assertStageAllowed() from tripping on them.
async function backfillNdaCoherence() {
  const ndaRequiredStages = (Object.values(EngagementStage) as EngagementStage[]).filter(stageRequiresNda);
  const candidates = await prisma.engagement.findMany({
    where: {
      engagementStage: { in: ndaRequiredStages },
      ndaType: null,
      investor: { ndaStatus: { not: "OpenNDA" } },
    },
    select: { id: true },
  });
  if (candidates.length === 0) return 0;
  const result = await prisma.engagement.updateMany({
    where: { id: { in: candidates.map((c) => c.id) } },
    data: { ndaType: "Closed" },
  });
  return result.count;
}

async function main() {
  const pending = await plantPendingInvestor();
  const openNda = await plantOpenNdaInvestor();
  const closedNda = await plantClosedNdaEngagement(openNda.id);
  const backfilled = await backfillNdaCoherence();

  console.log("── plant-onboarding-data summary ──────────────────────────────");
  console.log(
    pending.skipped
      ? `pending investor: skipped (already exists — ${pending.name}, ${pending.id})`
      : `pending investor: created — ${pending.name} (${pending.id})`,
  );
  console.log(
    openNda.skipped
      ? `open-NDA investor: skipped (${openNda.id ? `already exists — ${openNda.name}, ${openNda.id}` : openNda.reason})`
      : `open-NDA investor: created — ${openNda.name} (${openNda.id})`,
  );
  console.log(
    closedNda.skipped
      ? `closed-NDA engagement: skipped (${closedNda.id ? `an engagement already has ndaSignedAt — ${closedNda.name}, ${closedNda.id}` : closedNda.reason})`
      : `closed-NDA engagement: created — ${closedNda.name} (${closedNda.id})${closedNda.usedFallback ? " [fallback stage pool]" : ""}`,
  );
  console.log(`coherence backfill: ${backfilled} engagement(s) stamped ndaType="Closed" (ndaSignedAt left null — legacy)`);
  console.log("────────────────────────────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
