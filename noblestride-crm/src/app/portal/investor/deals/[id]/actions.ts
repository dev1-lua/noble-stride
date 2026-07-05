// Express-interest / request-more-information write-back — the EOI step of
// the workflow doc, captured digitally. SECURITY: the investor id comes from
// the viewpoint cookie read SERVER-SIDE; the deal id is validated against the
// investor's own projected (visible) deal set before anything is written.
"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewpoint } from "@/server/viewpoint";
import { loadInvestorPortalData } from "@/server/visibility";

export async function expressInterest(formData: FormData): Promise<void> {
  const vp = await getViewpoint();
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
    select: { name: true },
  });

  // (a) Upsert the engagement — first touch starts the journey at "Shared".
  const engagement = await prisma.engagement.upsert({
    where: { transactionId_investorId: { transactionId: dealId, investorId } },
    create: {
      name: `${investor.name} — ${txn.name}`,
      transactionId: dealId,
      investorId,
      engagementStage: "Shared",
      lastContact: new Date(),
      createdSource: "API",
    },
    update: { lastContact: new Date() },
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

  // (c) Refresh the portal views that render this journey.
  revalidatePath(`/portal/investor/deals/${dealId}`);
  revalidatePath("/portal/investor/pipeline");
  redirect(`/portal/investor/deals/${dealId}?interest=sent`);
}
