// Two-phase agent write, phase 1 (crmAgent data-in, Task 6): validate,
// gate, and preview a write WITHOUT touching the target record. Persists a
// Pending row in AgentPendingWrite (the audit ledger — spec §5.2) and hands
// the caller a `writeToken` to confirm (Task 7) or let expire.
//
// Every rejection throws CrudError with an actionable message — the agent
// surfaces these back to the operator verbatim, so no generic "failed".

import { prisma } from "@/lib/db";
import { CrudError, sameCalendarDate } from "./crud";
import { resolveDelegatedActor } from "./agent-delegation";
import { AGENT_WRITE_REGISTRY } from "./agent-write-registry";
import { buildCreatePreview, buildUpdatePreview } from "./agent-write-preview";
import { assertCan, assertCanUpdateOwnScoped } from "@/server/rbac/enforce";

const PREPARE_TTL_MS = 10 * 60 * 1000;

/** Two lockedField values are "the same" — date-aware (mirrors mandates.ts' sameCalendarDate use), else string-normalized. */
function lockedFieldUnchanged(current: unknown, incoming: unknown): boolean {
  if (current instanceof Date && incoming instanceof Date) return sameCalendarDate(current, incoming);
  if (current instanceof Date && typeof incoming === "string") {
    const incomingDate = new Date(incoming);
    if (!Number.isNaN(incomingDate.getTime())) return sameCalendarDate(current, incomingDate);
  }
  return String(incoming) === String(current);
}

export async function prepareAgentWrite(input: {
  operation: string;
  targetId?: string | null;
  payloadJson: string;
  actorEmail: string;
}): Promise<{ writeToken: string; preview: string; warnings: string[] }> {
  const actor = await resolveDelegatedActor(input.actorEmail);

  const op = AGENT_WRITE_REGISTRY[input.operation];
  if (!op) throw new CrudError(`Unknown operation "${input.operation}".`);

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(input.payloadJson);
  } catch {
    throw new CrudError("Invalid JSON payload.");
  }

  const parsed = op.schema.safeParse(payload);
  if (!parsed.success) {
    throw new CrudError(
      `Invalid fields: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  payload = parsed.data as Record<string, unknown>;

  let preview: string;
  const warnings: string[] = [];

  if (op.kind === "update") {
    const targetId = input.targetId ?? (payload.investorId as string | undefined) ?? (payload.engagementId as string | undefined);
    if (!targetId) throw new CrudError("targetId is required for updates.");

    const current = await op.loadCurrent!(targetId);
    if (!current) throw new CrudError("Record not found.");

    // RBAC with the record for own-scoping:
    await assertCanUpdateOwnScoped(actor, op.entity, async () => current as never);

    for (const f of op.lockedFields ?? []) {
      const incoming = payload[f];
      const before = current[f];
      if (incoming !== undefined && before != null && !lockedFieldUnchanged(before, incoming)) {
        throw new CrudError(`${f} cannot be changed once set.`);
      }
    }

    const built = buildUpdatePreview(input.operation, current, payload);
    if (built.changedKeys.length === 0) throw new CrudError("Nothing to change — the record already has these values.");
    preview = built.preview;
  } else {
    assertCan(actor, op.entity, op.perm);
    preview = buildCreatePreview(input.operation, payload);
  }

  const row = await prisma.agentPendingWrite.create({
    data: {
      operation: input.operation,
      targetId: input.targetId ?? null,
      payload: payload as never,
      actorEmail: input.actorEmail.trim(),
      actorUserId: actor.userId!,
      preview,
      expiresAt: new Date(Date.now() + PREPARE_TTL_MS),
    },
  });

  return { writeToken: row.id, preview, warnings };
}

/**
 * Phase 2 (Task 7): claim a Pending write token and apply it via the
 * registry's `execute`. Re-runs RBAC (TOCTOU guard) right before executing —
 * prepare's gate ran minutes ago; a role change or mandate reassignment in
 * between must not let a now-unauthorized write through. Any rejection here
 * (RBAC's GraphQLError, or a CrudError/other error from `execute`) releases
 * the claim (RBAC failure → back to Pending; execute failure → Failed with
 * the error recorded) and rethrows so the caller sees the real message.
 * One exception goes straight to Failed instead of back to Pending, because
 * retrying can never succeed: the target record having been deleted between
 * prepare and commit ("Record not found"). Registry drift (operation no
 * longer known) is treated like any other RBAC-time rejection and releases
 * back to Pending.
 */
export async function commitAgentWrite(
  writeToken: string,
  actorEmail: string,
): Promise<{ ok: true; summary: string; recordId: string; href: string | null }> {
  const actor = await resolveDelegatedActor(actorEmail);

  const claimed = await prisma.agentPendingWrite.updateMany({
    where: { id: writeToken, status: "Pending", expiresAt: { gt: new Date() } },
    data: { status: "Committing" },
  });
  if (claimed.count === 0) {
    throw new CrudError("This change is expired, already processed, or cancelled — please propose it again.");
  }

  const row = (await prisma.agentPendingWrite.findUnique({ where: { id: writeToken } }))!;

  const releaseToPending = () => prisma.agentPendingWrite.update({ where: { id: writeToken }, data: { status: "Pending" } });

  if (row.actorUserId !== actor.userId) {
    await releaseToPending();
    throw new CrudError("This change was prepared by a different user.");
  }

  const op = AGENT_WRITE_REGISTRY[row.operation];
  const payload = row.payload as Record<string, unknown>;
  const targetId = row.targetId ?? (payload.investorId as string | undefined) ?? (payload.engagementId as string | undefined);

  const RECORD_NOT_FOUND = "Record not found.";

  try {
    if (!op) throw new CrudError(`Unknown operation "${row.operation}".`);

    if (op.kind === "update") {
      // Fetch the current record before RBAC (not inside its fetch callback,
      // which only runs for non-Admin roles) so a record deleted between
      // prepare and commit is caught the same way for every role, instead of
      // surfacing as a generic RBAC "Not authorized" for non-admins while
      // admins fell through to a raw not-found error from `execute`.
      const current = await op.loadCurrent!(targetId!);
      if (!current) {
        await prisma.agentPendingWrite.update({
          where: { id: writeToken },
          data: { status: "Failed", error: "Record not found" },
        });
        throw new CrudError(RECORD_NOT_FOUND);
      }
      await assertCanUpdateOwnScoped(actor, op.entity, async () => current as never);
    } else {
      assertCan(actor, op.entity, op.perm);
    }
  } catch (err) {
    // RBAC rejects with GraphQLError, not CrudError — handle both without an
    // instanceof filter, per the Task 6 review's error-shape caution. The
    // record-not-found case above already marked the row Failed (terminal —
    // retrying can't help), so don't release it back to Pending here.
    if (!(err instanceof CrudError && err.message === RECORD_NOT_FOUND)) {
      await releaseToPending();
    }
    throw err;
  }

  try {
    const result = await op.execute(actor, row.targetId, payload);
    await prisma.agentPendingWrite.update({
      where: { id: writeToken },
      data: { status: "Committed", resultId: result.id, committedAt: new Date() },
    });
    return {
      ok: true as const,
      summary: `Done — ${row.operation} applied.`,
      recordId: result.id,
      href: op.href ? op.href(result.id) : null,
    };
  } catch (err) {
    await prisma.agentPendingWrite.update({
      where: { id: writeToken },
      data: { status: "Failed", error: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }
}

/** Withdraw a Pending write before it's committed — no-op past that point. */
export async function cancelAgentWrite(writeToken: string, actorEmail: string): Promise<{ ok: true }> {
  const actor = await resolveDelegatedActor(actorEmail);
  const n = await prisma.agentPendingWrite.updateMany({
    where: { id: writeToken, status: "Pending", actorUserId: actor.userId! },
    data: { status: "Cancelled" },
  });
  if (n.count === 0) throw new CrudError("No pending change to cancel.");
  return { ok: true as const };
}
