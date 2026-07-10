// src/app/api/integrations/docusign/connect/route.ts
// DocuSign Connect webhook. 404s when DocuSign isn't configured (no attack
// surface), verifies the HMAC signature before doing anything else (401 on a
// bad/missing signature, no state change), and only calls
// resolveEnvelopeCompletion for the envelope-completed event.
import { NextResponse } from "next/server";
import { docusignConfigured, docusignEnv } from "@/server/integrations/config";
import { verifyDocusignHmac, parseConnectEvent } from "@/server/integrations/esign/webhook";
import { resolveEnvelopeCompletion } from "@/server/services/esign";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!docusignConfigured()) return new NextResponse("Not found", { status: 404 });

  const raw = await req.text();
  const sig = req.headers.get("x-docusign-signature-1") ?? "";
  if (!verifyDocusignHmac(raw, sig, docusignEnv().webhookHmacKey)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const evt = parseConnectEvent(JSON.parse(raw));
  if (evt?.event === "envelope-completed") {
    await resolveEnvelopeCompletion(evt.envelopeId, evt.completedAt ?? new Date());
  }
  return NextResponse.json({ ok: true });
}
