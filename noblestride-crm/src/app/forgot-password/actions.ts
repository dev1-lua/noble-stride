"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/server/auth/reset";
import { rateLimit } from "@/server/auth/rate-limit";

export async function forgotPasswordAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (email && rateLimit(`forgot:${ip}`, { max: 5, windowMs: 10 * 60 * 1000 })) {
    const host = hdrs.get("host") ?? "localhost:3000";
    const proto = hdrs.get("x-forwarded-proto") ?? "http";
    await requestPasswordReset(email, `${proto}://${host}`);
  }
  redirect("/forgot-password?sent=1"); // same response regardless — no enumeration
}
