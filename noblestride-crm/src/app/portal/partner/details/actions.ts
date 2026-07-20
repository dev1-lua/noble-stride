"use server";
// actions.ts — server action for a partner updating their OWN contact details.
// Partner id comes from the viewpoint cookie server-side. The editable surface
// is deliberately limited to email / phone / organization — agreement status
// and fee-sharing terms are set by Noblestride, never by the partner.

import { redirect } from "next/navigation";
import { getViewpoint } from "@/server/viewpoint";
import { updatePartner } from "@/server/services/partners";
import { optionalPhone } from "@/lib/schemas/phone";

export async function updateOwnDetailsAction(formData: FormData): Promise<void> {
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role !== "partner" || !vp.recordId) redirect("/dashboard");

  const field = (name: string) => String(formData.get(name) ?? "").trim() || undefined;

  // Validate the phone before writing anything, so a bad phone can't leave
  // email/organization partially saved while the error banner implies
  // nothing happened.
  const phoneCheck = optionalPhone.safeParse(field("phone"));
  if (!phoneCheck.success) {
    redirect("/portal/partner/details?error=phone");
  }

  await updatePartner(vp.recordId, {
    email: field("email"),
    phone: phoneCheck.data,
    organization: field("organization"),
  });

  redirect("/portal/partner/details?saved=1");
}
