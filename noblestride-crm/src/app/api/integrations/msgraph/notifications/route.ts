// src/app/api/integrations/msgraph/notifications/route.ts
// Microsoft Graph change-notifications webhook for Outlook mail sync. 404s
// when Outlook isn't configured (no attack surface). Handles the Graph
// subscription validation handshake (echo validationToken as text/plain),
// then for each notification looks up the GraphSubscription, fetches recent
// messages for its mailbox, and ingests them (idempotent via upsert).
import { NextResponse } from "next/server";
import { outlookConfigured } from "@/server/integrations/config";
import { parseGraphNotifications } from "@/server/integrations/msgraph/notifications";
import { getMailSyncProvider } from "@/server/integrations/mailsync/provider";
import { ingestMessage } from "@/server/services/mailsync";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!outlookConfigured()) return new NextResponse("Not found", { status: 404 });

  // Graph subscription validation handshake: echo validationToken as text/plain.
  const url = new URL(req.url);
  const validationToken = url.searchParams.get("validationToken");
  if (validationToken) {
    return new NextResponse(validationToken, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  const body = await req.json();
  const notes = parseGraphNotifications(body);
  const provider = getMailSyncProvider();
  for (const n of notes) {
    const sub = await prisma.graphSubscription.findUnique({ where: { subscriptionId: n.subscriptionId } });
    if (!sub) continue;
    // Fetch recent messages for the mailbox and ingest (list + upsert keeps it simple and idempotent).
    const msgs = await provider.listMessages(sub.mailbox, new Date(Date.now() - 10 * 60 * 1000));
    for (const m of msgs) await ingestMessage(sub.mailbox, m);
  }
  return NextResponse.json({ ok: true });
}
