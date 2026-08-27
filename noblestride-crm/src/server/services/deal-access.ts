// F6b.2 (image28) — "Grant deal access": the staff action that unlocks a deal
// for an investor who has registered interest.
//
// Decision D2 in full. The client's feedback implies detail should unmask when
// interest arrives; SOW §06 forbids sharing confidential information without a
// signed NDA. This service does NOT resolve that by weakening the guard — it
// rides `updateEngagement({ engagementStage: "NDASigned" })`, so
// `assertStageAllowed` runs exactly as it always has, and it refuses early with
// copy that points staff at the NDA flows F3.2 added. The unblocker is that the
// investor can now sign the NDA in one click, not that the rule bent.

import { prisma } from "@/lib/db";
import { updateEngagement } from "./engagements-crud";
import { actorSource } from "./crud";
import { ndaSatisfied, stageRequiresNda, NdaGuardError } from "@/server/domain/nda-guard";
import { notifyInvestors } from "./notifications";
import { dealCodename } from "@/server/visibility/codename";
import type { Actor } from "@/graphql/context";

export { accessState, portalStatusLabel } from "@/server/domain/access-state";
export type { AccessState, PortalDealStatusLabel } from "@/server/domain/access-state";

export const NO_NDA_MESSAGE =
  "This investor has no signed NDA yet, so deal details can't be unlocked. " +
  "Ask them to sign the Noblestride NDA in their portal (Portal → NDA), or record an Open/Closed NDA once you receive one.";

export async function grantDealAccess(
  engagementId: string,
  actor: Actor,
): Promise<{ engagementId: string; investorId: string; dealId: string }> {
  const engagement = await prisma.engagement.findUniqueOrThrow({
    where: { id: engagementId },
    select: {
      id: true,
      engagementStage: true,
      ndaType: true,
      investorId: true,
      transactionId: true,
      investor: { select: { ndaStatus: true, name: true } },
    },
  });
  const result = {
    engagementId,
    investorId: engagement.investorId,
    dealId: engagement.transactionId,
  };

  // Already unlocked — pressing the button twice must not re-stage, re-stamp or
  // re-notify.
  if (stageRequiresNda(engagement.engagementStage)) return result;

  if (!ndaSatisfied(engagement.investor, engagement)) throw new NdaGuardError(NO_NDA_MESSAGE);

  await updateEngagement(engagementId, { engagementStage: "NDASigned" }, actor);

  await prisma.$transaction(async (tx) => {
    // Audit metadata only: who granted access and when. Never a state source —
    // see the header of domain/access-state.ts.
    await tx.engagement.update({
      where: { id: engagementId },
      data: { accessGrantedAt: new Date(), accessGrantedById: actor.userId ?? null },
    });
    await tx.activity.create({
      data: {
        type: "Note",
        subject: `Deal access granted to ${engagement.investor.name}`,
        engagementId,
        transactionId: engagement.transactionId,
        investorId: engagement.investorId,
        createdSource: actorSource(actor),
      },
    });
  });

  // The investor knows this deal by its codename until the projection unmasks
  // it, so the notification uses the codename too.
  await notifyInvestors([engagement.investorId], {
    kind: "deal_access_granted",
    title: `Access granted — ${dealCodename(engagement.transactionId)}`,
    href: `/portal/investor/deals/${engagement.transactionId}`,
  }).catch((err) => console.error("[deal-access] notification failed:", err));

  return result;
}
