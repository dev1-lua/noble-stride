// src/app/api/integrations/box/webhook/route.ts
// Box event-notification webhook. 404s when Box isn't configured (no attack
// surface), verifies the HMAC signature before doing anything else (401 on a
// bad/missing signature, no state change), and records preview/download
// events onto DocumentShareEvent for the matching document.
import { NextResponse } from "next/server";
import { boxConfigured, boxEnv } from "@/server/integrations/config";
import { verifyBoxSignature, parseBoxEvent } from "@/server/integrations/docshare/webhook";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!boxConfigured()) return new NextResponse("Not found", { status: 404 });
  const raw = await req.text();
  const env = boxEnv();
  const ok = verifyBoxSignature(raw, {
    signaturePrimary: req.headers.get("box-signature-primary"),
    signatureSecondary: req.headers.get("box-signature-secondary"),
    timestamp: req.headers.get("box-signature-timestamp"),
  }, env.webhookPrimary, env.webhookSecondary);
  if (!ok) return new NextResponse("Invalid signature", { status: 401 });

  const evt = parseBoxEvent(JSON.parse(raw));
  if (evt) {
    const doc = await prisma.document.findFirst({ where: { boxFileId: evt.boxFileId }, select: { id: true } });
    if (doc) {
      await prisma.documentShareEvent.create({
        data: { documentId: doc.id, action: evt.trigger === "FILE.DOWNLOADED" ? "DOWNLOAD" : "PREVIEW", source: "box" },
      });
    }
  }
  return NextResponse.json({ ok: true });
}
