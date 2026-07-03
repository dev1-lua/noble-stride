"use server";
// actions.ts — server action wrapper for the referral form. Thin by design:
// resolves the acting partner from the viewpoint cookie SERVER-SIDE (never a
// client-passed id), parses the form, and delegates to submitReferral.

import { redirect } from "next/navigation";
import { getViewpoint } from "@/server/viewpoint";
import { submitReferral } from "./submit-referral";

export async function submitReferralAction(formData: FormData): Promise<void> {
  const vp = await getViewpoint();
  if (vp.role !== "partner" || !vp.recordId) redirect("/dashboard");

  const companyName = String(formData.get("companyName") ?? "").trim();
  if (!companyName) redirect("/portal/partner/refer?error=name");

  const dealSizeRaw = String(formData.get("dealSize") ?? "").trim();
  const dealSizeNum = dealSizeRaw ? Number(dealSizeRaw) : NaN;

  await submitReferral(vp.recordId, {
    companyName,
    sector: String(formData.get("sector") ?? "").trim() || undefined,
    dealSize: Number.isFinite(dealSizeNum) && dealSizeNum >= 0 ? dealSizeNum : undefined,
    contactName: String(formData.get("contactName") ?? "").trim() || undefined,
    context: String(formData.get("context") ?? "").trim() || undefined,
  });

  redirect("/portal/partner/refer?submitted=1");
}
