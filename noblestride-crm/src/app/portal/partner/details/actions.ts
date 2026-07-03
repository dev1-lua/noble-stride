"use server";
// actions.ts — server action for a partner updating their OWN contact details.
// Partner id comes from the viewpoint cookie server-side. The editable surface
// is deliberately limited to email / phone / organization — agreement status
// and fee-sharing terms are set by NobleStride, never by the partner.

import { redirect } from "next/navigation";
import { getViewpoint } from "@/server/viewpoint";
import { updatePartner } from "@/server/services/partners";

export async function updateOwnDetailsAction(formData: FormData): Promise<void> {
  const vp = await getViewpoint();
  if (vp.role !== "partner" || !vp.recordId) redirect("/dashboard");

  const field = (name: string) => String(formData.get(name) ?? "").trim() || undefined;

  await updatePartner(vp.recordId, {
    email: field("email"),
    phone: field("phone"),
    organization: field("organization"),
  });

  redirect("/portal/partner/details?saved=1");
}
