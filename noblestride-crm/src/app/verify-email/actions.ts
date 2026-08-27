"use server";
// The confirm step for a self-service email change (F3.6).
//
// The token is consumed on POST only, never on GET: mail clients and chat apps
// fetch link previews, and a GET-consumed link would be burned before the
// person ever clicked it.

import { redirect } from "next/navigation";
import { confirmEmailChange } from "@/server/auth/change-email";

export interface VerifyEmailState {
  error?: string;
}

export async function confirmEmailChangeAction(
  _prev: VerifyEmailState,
  formData: FormData,
): Promise<VerifyEmailState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { error: "This confirmation link is no longer valid. Request the change again." };
  const res = await confirmEmailChange(token);
  if (!res.ok) return { error: res.error };
  // Every session was invalidated by the change, so the only sensible next step
  // is signing in again — with the new address.
  redirect("/login?notice=email-verified");
}
