// Investor-portal NDA actions (F3.2 / image7).
//
// SECURITY: the investor id comes from the portal membership resolved
// SERVER-SIDE; nothing about the fund is taken from the form. The signature is
// re-validated here even though the pad already validated it — the pad is a
// convenience for the signer, not a gate.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requirePortalEditor } from "@/server/auth/portal-authz";
import { rateLimit } from "@/server/auth/rate-limit";
import { signOpenNdaClickwrap, submitOwnNda } from "@/server/services/nda";
import { CrudError } from "@/server/services/crud";
import { prisma } from "@/lib/db";

const PAGE = "/portal/investor/nda";

/** Allow-listed outcome slugs — the page never reflects raw query text. */
export type NdaNotice =
  | "signed"
  | "submitted"
  | "signature-missing"
  | "signatory-missing"
  | "name-missing"
  | "throttled"
  | "failed";

async function clientIp(): Promise<string | null> {
  const hdrs = await headers();
  return hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

async function throttle(): Promise<void> {
  const ip = (await clientIp()) ?? "local";
  if (!rateLimit(`portal-nda:${ip}`, { max: 10, windowMs: 10 * 60 * 1000 })) {
    redirect(`${PAGE}?notice=throttled`);
  }
}

export async function signStandardNdaAction(formData: FormData): Promise<void> {
  const member = await requirePortalEditor(PAGE);
  await throttle();

  const signerName = String(formData.get("signerName") ?? "").trim();
  const signatureImage = String(formData.get("signatureImage") ?? "");
  const authorisedSignatory = formData.get("authorisedSignatory") === "on";

  if (!signerName) redirect(`${PAGE}?notice=name-missing`);
  if (!signatureImage) redirect(`${PAGE}?notice=signature-missing`);
  if (!authorisedSignatory) redirect(`${PAGE}?notice=signatory-missing`);

  const person = await prisma.person.findUnique({
    where: { id: member.personId },
    select: { email: true },
  });

  try {
    await signOpenNdaClickwrap(
      {
        investorId: member.investorId,
        personId: member.personId,
        signerName,
        signerEmail: person?.email ?? "",
        signatureImage,
        ip: await clientIp(),
        authorisedSignatory,
      },
      { type: "HUMAN" },
    );
  } catch (err) {
    if (err instanceof CrudError) redirect(`${PAGE}?notice=signature-missing`);
    console.error("[portal/nda] click-wrap signature failed:", err);
    redirect(`${PAGE}?notice=failed`);
  }

  revalidatePath(PAGE);
  revalidatePath("/portal/investor");
  revalidatePath("/portal/investor/pipeline");
  redirect(`${PAGE}?notice=signed`);
}

export async function submitOwnNdaAction(formData: FormData): Promise<void> {
  const member = await requirePortalEditor(PAGE);
  await throttle();

  const documentId = String(formData.get("documentId") ?? "");
  if (!documentId) redirect(`${PAGE}?notice=failed`);

  try {
    await submitOwnNda(
      { investorId: member.investorId, personId: member.personId, documentId },
      { type: "HUMAN" },
    );
  } catch (err) {
    if (!(err instanceof CrudError)) console.error("[portal/nda] own-NDA submission failed:", err);
    redirect(`${PAGE}?notice=failed`);
  }

  revalidatePath(PAGE);
  redirect(`${PAGE}?notice=submitted`);
}
