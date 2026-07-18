// /api/cron/alerts — Vercel cron entry point for the proactive staff-alert
// sweep (vercel.json schedules it weekday mornings). Vercel invokes cron
// routes with `Authorization: Bearer ${CRON_SECRET}` when the env var is set;
// fail closed when it's missing so the route can't be triggered publicly.

import { NextResponse } from "next/server";
import { runStaffAlerts } from "@/server/services/alerts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runStaffAlerts();
  console.log("[cron/alerts]", JSON.stringify(result));
  return NextResponse.json(result);
}
