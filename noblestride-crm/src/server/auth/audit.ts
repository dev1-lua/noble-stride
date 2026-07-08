// Auth audit trail on the existing Activity model. Best-effort: auditing must
// never break the auth flow itself.

import { prisma } from "@/lib/db";

export async function logAuthEvent(
  subject: string,
  body?: string,
  opts?: { investorId?: string },
): Promise<void> {
  try {
    await prisma.activity.create({
      data: { type: "Note", subject, body, investorId: opts?.investorId, createdSource: "SYSTEM" },
    });
  } catch (err) {
    console.error("[auth] audit write failed:", err);
  }
}
