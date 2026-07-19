// Express-interest / request-more-information write-back — the EOI step of
// the workflow doc, captured digitally. SECURITY: the investor id comes from
// the viewpoint cookie read SERVER-SIDE; the deal id is validated against the
// investor's own projected (visible) deal set before anything is written.
"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";
import { loadInvestorPortalData } from "@/server/visibility";
import { notify } from "@/server/services/notifications";
import { nextStepLabel } from "@/lib/next-step";
import { rateLimit } from "@/server/auth/rate-limit";

async function throttlePortalAction(fallbackPath: string): Promise<void> {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`portal-action:${ip}`, { max: 10, windowMs: 10 * 60 * 1000 })) {
    redirect(fallbackPath);
  }
}

export async function expressInterest(formData: FormData): Promise<void> {
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");
  const investorId = vp.recordId as string;

  const dealIdRaw = formData.get("dealId");
  if (typeof dealIdRaw !== "string" || dealIdRaw.length === 0) redirect("/portal/investor");
  const dealId = dealIdRaw as string;

  const messageRaw = formData.get("message");
  const message = typeof messageRaw === "string" ? messageRaw.trim() : "";

  // Only deals the visibility engine already shows this investor are actionable.
  const { investor, deals } = await loadInvestorPortalData(prisma, investorId);
  const deal = deals.find((d) => d.id === dealId);
  if (!deal) notFound();

  // The projected `deal` set above is used ONLY for authorization — its name
  // may be the masked pre-interest codename ("Project Amber Falcon"). The
  // internal Engagement.name that admins see everywhere must carry the real
  // deal name, so it's fetched separately after authorization passes.
  const txn = await prisma.transaction.findUniqueOrThrow({
    where: { id: dealId },
    select: { name: true, ownerId: true },
  });

  // (a) Upsert the engagement — first touch starts the journey at "Shared".
  // An inbound EOI also flips status to "Interested" so admins see it on the
  // board/detail chip — but never downgrades a status an admin has already
  // progressed past the early contact states.
  const existing = await prisma.engagement.findUnique({
    where: { transactionId_investorId: { transactionId: dealId, investorId } },
    select: { status: true },
  });
  const bumpStatus =
    !existing || existing.status === "NotContacted" || existing.status === "Contacted";
  const engagement = await prisma.engagement.upsert({
    where: { transactionId_investorId: { transactionId: dealId, investorId } },
    create: {
      name: `${investor.name} — ${txn.name}`,
      transactionId: dealId,
      investorId,
      engagementStage: "Shared",
      status: "Interested",
      lastContact: new Date(),
      createdSource: "API",
    },
    update: { lastContact: new Date(), ...(bumpStatus ? { status: "Interested" as const } : {}) },
  });

  // (b) Log the request on the timeline. (InteractionType has no dedicated
  // InfoRequest value; "Note" is the neutral timeline entry — the subject
  // carries the semantics.)
  await prisma.activity.create({
    data: {
      type: "Note",
      subject: "Investor expressed interest via portal",
      body: message || null,
      engagementId: engagement.id,
      transactionId: dealId,
      investorId,
      createdSource: "API",
    },
  });

  // (b2) Best-effort: alert the engagement owner (falling back to the
  // transaction owner when the engagement has none) that an investor has
  // expressed interest. Portal actions have no internal actor to skip.
  const interestRecipient = engagement.ownerId ?? txn.ownerId;
  if (interestRecipient) {
    await notify([interestRecipient], {
      kind: "interest_expressed",
      title: `${investor.name} expressed interest in ${txn.name}`,
      href: `/engagement/${engagement.id}`,
    });
  }

  // (c) Refresh the portal views that render this journey.
  revalidatePath(`/portal/investor/deals/${dealId}`);
  revalidatePath("/portal/investor/pipeline");
  redirect(`/portal/investor/deals/${dealId}?interest=sent`);
}

/**
 * Stage-aware "request next step" (spec 2026-07-19 §8): the investor SIGNALS
 * (Activity + owner notification); staff move the stage. Never mutates
 * engagementStage — stages drive visibility tiers and NDA gating.
 */
export async function requestNextStep(formData: FormData): Promise<void> {
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");
  const investorId = vp.recordId as string;

  await throttlePortalAction("/portal/investor");

  const dealIdRaw = formData.get("dealId");
  if (typeof dealIdRaw !== "string" || dealIdRaw.length === 0) redirect("/portal/investor");
  const dealId = dealIdRaw as string;

  const { investor, deals } = await loadInvestorPortalData(prisma, investorId);
  if (!deals.find((d) => d.id === dealId)) notFound();

  const engagement = await prisma.engagement.findUnique({
    where: { transactionId_investorId: { transactionId: dealId, investorId } },
  });
  if (!engagement) redirect(`/portal/investor/deals/${dealId}`);
  const step = nextStepLabel(engagement.engagementStage);
  if (!step) redirect(`/portal/investor/deals/${dealId}`);

  await prisma.activity.create({
    data: {
      type: "Note",
      subject: `Investor requested next step via portal: ${step}`,
      engagementId: engagement.id,
      transactionId: dealId,
      investorId,
      createdSource: "API",
    },
  });

  const txn = await prisma.transaction.findUniqueOrThrow({
    where: { id: dealId },
    select: { name: true, ownerId: true },
  });
  const recipient = engagement.ownerId ?? txn.ownerId;
  if (recipient) {
    await notify([recipient], {
      kind: "next_step_requested",
      title: `${investor.name} — ${step} on ${txn.name}`,
      href: `/engagement/${engagement.id}`,
    });
  }

  revalidatePath(`/portal/investor/deals/${dealId}`);
  redirect(`/portal/investor/deals/${dealId}?request=sent`);
}

/**
 * Decline / withdraw (spec 2026-07-19 §8): the ONE stage the portal may set
 * directly — strictly access-reducing (Declined → tier NONE). Records a
 * StageChange for the staff timeline and notifies the owner. After this the
 * deal drops out of the investor's visible set, so we land on the pipeline
 * (which keeps declined history) rather than the deal page.
 */
export async function declineDeal(formData: FormData): Promise<void> {
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");
  const investorId = vp.recordId as string;

  await throttlePortalAction("/portal/investor/pipeline");

  const dealIdRaw = formData.get("dealId");
  if (typeof dealIdRaw !== "string" || dealIdRaw.length === 0) redirect("/portal/investor");
  const dealId = dealIdRaw as string;

  const { investor, deals } = await loadInvestorPortalData(prisma, investorId);
  if (!deals.find((d) => d.id === dealId)) notFound();

  const engagement = await prisma.engagement.findUnique({
    where: { transactionId_investorId: { transactionId: dealId, investorId } },
  });
  if (!engagement) redirect(`/portal/investor/deals/${dealId}`);
  // Declined and Invested are both terminal for the portal's decline action —
  // Invested must never be walked back to Declined by a stale/duplicate submit.
  if (engagement.engagementStage === "Declined" || engagement.engagementStage === "Invested") {
    redirect("/portal/investor/pipeline");
  }

  const fromStage = engagement.engagementStage;
  let updated = 0;
  await prisma.$transaction(async (tx) => {
    const result = await tx.engagement.updateMany({
      where: { id: engagement.id, engagementStage: { notIn: ["Declined", "Invested"] } },
      data: { engagementStage: "Declined", status: "Passed", lastContact: new Date() },
    });
    updated = result.count;
    if (updated !== 1) return;
    await tx.stageChange.create({
      data: {
        field: "engagementStage",
        fromValue: fromStage,
        toValue: "Declined",
        engagementId: engagement.id,
        transactionId: dealId,
        investorId,
        createdSource: "API",
      },
    });
    await tx.activity.create({
      data: {
        type: "Note",
        subject: "Investor withdrew from the deal via portal",
        engagementId: engagement.id,
        transactionId: dealId,
        investorId,
        createdSource: "API",
      },
    });
  });

  if (updated === 1) {
    const txn = await prisma.transaction.findUniqueOrThrow({
      where: { id: dealId },
      select: { name: true, ownerId: true },
    });
    const recipient = engagement.ownerId ?? txn.ownerId;
    if (recipient) {
      await notify([recipient], {
        kind: "deal_declined",
        title: `${investor.name} withdrew from ${txn.name}`,
        href: `/engagement/${engagement.id}`,
      });
    }
  }

  revalidatePath("/portal/investor/pipeline");
  revalidatePath("/portal/investor");
  redirect("/portal/investor/pipeline?declined=1");
}
