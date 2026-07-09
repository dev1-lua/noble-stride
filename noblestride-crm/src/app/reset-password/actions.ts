"use server";

import { redirect } from "next/navigation";
import { performPasswordReset } from "@/server/auth/reset";

export async function resetPasswordAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!token) redirect("/login");
  if (password !== confirm) {
    redirect(`/reset-password/${encodeURIComponent(token)}?error=mismatch`);
  }
  const res = await performPasswordReset(token, password);
  if (!res.ok) {
    redirect(`/reset-password/${encodeURIComponent(token)}?error=${res.reason}`);
  }
  redirect("/login?notice=password-updated");
}
