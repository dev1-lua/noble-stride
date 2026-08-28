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
import {
  postInvestorMessage,
  seedInvestorThreadMessage,
  staffRecipientsForEngagementId,
} from "@/server/services/conversations";
import { requirePortalEditor, requireThreadParticipation } from "@/server/auth/portal-authz";
import { ensureInvestorDealFolder } from "@/server/services/folders";
import { nextStepLabel } from "@/lib/next-step";
import { rateLimit } from "@/server/auth/rate-limit";
import { safeReturnTo } from "./return-to";
import {
  addParticipant,
  removeParticipant,
  ParticipantError,
} from "@/server/services/engagement-participants";

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
  // Seat gate (action points 2026-07 item 3): expressing interest commits the
  // org — Editors only.
  const member = await requirePortalEditor();

  const dealIdRaw = formData.get("dealId");
  if (typeof dealIdRaw !== "string" || dealIdRaw.length === 0) redirect("/portal/investor");
  const dealId = dealIdRaw as string;

  const returnTo = safeReturnTo(formData.get("returnTo"), dealId);
  // The other three portal actions already throttle; per-card forms widen the
  // surface, so this closes the gap.
  await throttlePortalAction(returnTo);

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

  // File-room grouping (item 5): the investor now has a seat on this deal —
  // scaffold their subfolder under "07 Potential Investors". Idempotent +
  // best-effort (never throws).
  await ensureInvestorDealFolder(dealId, investor.name);

  // (b) Log the request on the timeline. (InteractionType has no dedicated
  // InfoRequest value; "Note" is the neutral timeline entry — the subject
  // carries the semantics.)
  await prisma.activity.create({
    data: {
      type: "Note",
      channel: "Portal",
      direction: "Inbound",
      subject: "Investor expressed interest via portal",
      body: message || null,
      engagementId: engagement.id,
      transactionId: dealId,
      investorId,
      createdSource: "API",
    },
  });

  // (b1) Seed the two-way conversation thread with the investor's message so
  // the request opens the queue (action points 2026-07 item 1). The Activity
  // above already audits it — seed only, no second Activity/notification.
  if (message) {
    await seedInvestorThreadMessage(engagement.id, member.personId, message);
  }

  // (b2) Best-effort: alert admins + deal lead + deal assists + engagement
  // owner (action points 2026-07 item 2), by bell AND email. Portal actions
  // have no internal actor to skip.
  await notify(await staffRecipientsForEngagementId(engagement.id), {
    kind: "interest_expressed",
    title: `${investor.name} expressed interest in ${txn.name}`,
    body: message || undefined,
    href: `/engagement/${engagement.id}#conversation`,
    email: true,
  });

  // (c) Refresh the portal views that render this journey.
  revalidatePath(`/portal/investor/deals/${dealId}`);
  revalidatePath("/portal/investor/pipeline");
  revalidatePath("/portal/investor");
  redirect(`${returnTo}?interest=sent`);
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
  // Seat gate (item 3): requesting a step acts for the org — Editors only.
  const member = await requirePortalEditor();

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
      channel: "Portal",
      direction: "Inbound",
      subject: `Investor requested next step via portal: ${step}`,
      engagementId: engagement.id,
      transactionId: dealId,
      investorId,
      createdSource: "API",
    },
  });

  // Drop the request into the conversation thread too, so the queue captures
  // it (item 1). Seed only — the Activity above and notify below cover audit
  // + fan-out.
  await seedInvestorThreadMessage(engagement.id, member.personId, `Requested next step: ${step}`);

  const txn = await prisma.transaction.findUniqueOrThrow({
    where: { id: dealId },
    select: { name: true, ownerId: true },
  });
  // Route to admins + deal lead + assists + engagement owner, bell AND email (item 2).
  await notify(await staffRecipientsForEngagementId(engagement.id), {
    kind: "next_step_requested",
    title: `${investor.name} — ${step} on ${txn.name}`,
    href: `/engagement/${engagement.id}#conversation`,
    email: true,
  });

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
  // Seat gate (item 3): withdrawing is the strongest org action — Editors only.
  await requirePortalEditor("/portal/investor/pipeline");

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
    // Route to admins + deal lead + assists + engagement owner, bell AND email (item 2).
    await notify(await staffRecipientsForEngagementId(engagement.id), {
      kind: "deal_declined",
      title: `${investor.name} withdrew from ${txn.name}`,
      href: `/engagement/${engagement.id}`,
      email: true,
    });
  }

  revalidatePath("/portal/investor/pipeline");
  revalidatePath("/portal/investor");
  redirect("/portal/investor/pipeline?declined=1");
}

/**
 * Post a follow-up into the engagement's two-way conversation thread (action
 * points 2026-07 item 1). Editors always may post; Viewers need the
 * per-member opt-in (item 3). Writes the message + timeline Activity and
 * notifies admins + deal lead + assists by bell and email (item 2).
 */
export async function postThreadMessage(formData: FormData): Promise<void> {
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");
  const investorId = vp.recordId as string;

  const dealIdRaw = formData.get("dealId");
  if (typeof dealIdRaw !== "string" || dealIdRaw.length === 0) redirect("/portal/investor");
  const dealId = dealIdRaw as string;

  const member = await requireThreadParticipation(`/portal/investor/deals/${dealId}`);
  await throttlePortalAction(`/portal/investor/deals/${dealId}`);

  const messageRaw = formData.get("message");
  const message = typeof messageRaw === "string" ? messageRaw.trim() : "";
  if (!message) redirect(`/portal/investor/deals/${dealId}`);

  // Only deals the visibility engine already shows this investor are actionable.
  const { deals } = await loadInvestorPortalData(prisma, investorId);
  if (!deals.find((d) => d.id === dealId)) notFound();

  const engagement = await prisma.engagement.findUnique({
    where: { transactionId_investorId: { transactionId: dealId, investorId } },
    select: { id: true },
  });
  if (!engagement) redirect(`/portal/investor/deals/${dealId}`);

  await postInvestorMessage({ engagementId: engagement.id, personId: member.personId, body: message });

  revalidatePath(`/portal/investor/deals/${dealId}`);
  redirect(`/portal/investor/deals/${dealId}?message=sent`);
}

/**
 * F6b.4 (image31): add an onboarded colleague to a deal. Authorised exactly the
 * way expressInterest is — the investor id comes from the viewpoint cookie, and
 * the deal must already be in this fund's projected set.
 */
export async function addParticipantAction(formData: FormData): Promise<void> {
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");
  const investorId = vp.recordId as string;

  const dealIdRaw = formData.get("dealId");
  if (typeof dealIdRaw !== "string" || dealIdRaw.length === 0) redirect("/portal/investor");
  const dealId = dealIdRaw as string;
  const dealPath = `/portal/investor/deals/${dealId}`;

  const member = await requirePortalEditor(dealPath);
  await throttlePortalAction(dealPath);

  const personId = String(formData.get("personId") ?? "");
  if (!personId) redirect(`${dealPath}?participant=missing`);

  const { deals } = await loadInvestorPortalData(prisma, investorId);
  if (!deals.find((d) => d.id === dealId)) notFound();

  const engagement = await prisma.engagement.findUnique({
    where: { transactionId_investorId: { transactionId: dealId, investorId } },
    select: { id: true },
  });
  if (!engagement) redirect(`${dealPath}?participant=no-engagement`);

  try {
    await addParticipant({
      engagementId: engagement.id,
      personId,
      investorId,
      addedByPersonId: member.personId,
      // EngagementParticipant.addedById points at User; a portal add has none.
      addedByUserId: null,
    });
  } catch (err) {
    if (err instanceof ParticipantError) redirect(`${dealPath}?participant=not-onboarded`);
    throw err;
  }

  revalidatePath(dealPath);
  revalidatePath("/portal/investor/pipeline");
  redirect(`${dealPath}?participant=added`);
}

export async function removeParticipantAction(formData: FormData): Promise<void> {
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");
  const investorId = vp.recordId as string;

  const dealIdRaw = formData.get("dealId");
  if (typeof dealIdRaw !== "string" || dealIdRaw.length === 0) redirect("/portal/investor");
  const dealId = dealIdRaw as string;
  const dealPath = `/portal/investor/deals/${dealId}`;

  await requirePortalEditor(dealPath);
  await throttlePortalAction(dealPath);

  const personId = String(formData.get("personId") ?? "");
  if (!personId) redirect(dealPath);

  const { deals } = await loadInvestorPortalData(prisma, investorId);
  if (!deals.find((d) => d.id === dealId)) notFound();

  const engagement = await prisma.engagement.findUnique({
    where: { transactionId_investorId: { transactionId: dealId, investorId } },
    select: { id: true },
  });
  if (!engagement) redirect(dealPath);

  try {
    await removeParticipant({ engagementId: engagement.id, personId, investorId });
  } catch (err) {
    if (err instanceof ParticipantError) redirect(`${dealPath}?participant=primary`);
    throw err;
  }

  revalidatePath(dealPath);
  revalidatePath("/portal/investor/pipeline");
  redirect(`${dealPath}?participant=removed`);
}
