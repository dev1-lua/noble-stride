"use server";
// Invite redemption (spec 2026-07-19 §5.3). The token travels as a route
// param + hidden field; errors round-trip via an allow-listed ?error slug —
// same pattern as reset-password. Rate-limited per IP: the email gate is a
// guessing surface.

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { rateLimit } from "@/server/auth/rate-limit";
import { redeemInvite } from "@/server/auth/team-invites";

export async function redeemInviteAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/login");

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`invite:${ip}`, { max: 10, windowMs: 10 * 60 * 1000 })) {
    redirect(`/invite/${encodeURIComponent(token)}?error=rate-limited`);
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) {
    redirect(`/invite/${encodeURIComponent(token)}?error=mismatch`);
  }

  const res = await redeemInvite(token, email, password);
  if (!res.ok) {
    redirect(`/invite/${encodeURIComponent(token)}?error=${res.reason}`);
  }
  redirect("/login?notice=invite-complete");
}
