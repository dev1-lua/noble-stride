// Agent-write operation registry (crmAgent data-in, Task 5) — the declarative
// write allowlist for the agent's two-phase prepare/confirm surface. Every
// entry delegates to an EXISTING service function (no new business logic
// here); the registry only adds the plumbing Tasks 6-7 need to gate, preview,
// and execute a write generically:
//   - `entity`/`perm` mirror the exact `assertCan(ctx.actor, entity, perm)`
//     call the matching GraphQL mutation already makes (src/graphql/mutations.ts)
//     — same RBAC outcome whether the write comes from the UI or the agent.
//   - `schema` is the SAME zod schema the service/mutation validates with
//     (imported from src/lib/schemas/*), so a bad payload fails at prepare
//     time, before any DB round-trip.
//   - `lockedFields` mirrors service-level CrudError immutability rules
//     (mandates.ts/transactions.ts: dateOpened/source are locked once set).
//   - `loadCurrent` (update ops only) loads the current record — Tasks 6-7
//     use it for the update preview, no-op detection, locked-field checks,
//     and own-scoped RBAC (canUpdateRecord).
//   - `href` mirrors the exact route strings globalSearch returns
//     (src/server/search/global-search.ts), for deep-linking a write's result.
//
// NOTE ops with no natural "record id" of their own (recordOpenNda,
// recordClosedNda, recordMilestone, unrecordMilestone) are modeled as kind
// "update" with `targetId` null — the caller resolves `loadCurrent`'s id
// argument from the relevant payload field (investorId/engagementId) instead
// of a route param, same pattern as the brief's own recordOpenNda example.

import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Actor } from "@/graphql/context";
import type { RbacEntity } from "@/server/rbac/matrix";
import { MandateStage, TransactionStage, MilestoneKey, type DocumentAccessLevel } from "@prisma/client";

import { createClient, updateClient } from "@/server/services/clients";
import { createMandate, updateMandate, setMandateStage } from "@/server/services/mandates";
import { createTransaction, updateTransaction, setTransactionStage } from "@/server/services/transactions";
import { createEngagement, updateEngagement } from "@/server/services/engagements-crud";
import { logActivity } from "@/server/services/engagements";
import { createInvestor, updateInvestor } from "@/server/services/investors";
import { createPerson, updatePerson } from "@/server/services/persons";
import { createPartner, updatePartner } from "@/server/services/partners";
import { createTask, updateTask } from "@/server/services/tasks";
import { createDocument, updateDocument } from "@/server/services/documents";
import { recordMilestone, unrecordMilestone } from "@/server/services/milestones-crud";
import { recordOpenNda, recordClosedNda } from "@/server/services/nda";

import { clientCreateSchema, clientUpdateSchema } from "@/lib/schemas/client";
import { mandateCreateSchema, mandateUpdateSchema } from "@/lib/schemas/mandate";
import { transactionCreateSchema, transactionUpdateSchema } from "@/lib/schemas/transaction";
import { engagementCreateSchema, engagementUpdateSchema } from "@/lib/schemas/engagement";
import { logActivitySchema } from "@/lib/schemas/activity";
import { investorCreateSchema, investorUpdateSchema } from "@/lib/schemas/investor";
import { personCreateSchema, personUpdateSchema } from "@/lib/schemas/person";
import { partnerCreateSchema, partnerUpdateSchema } from "@/lib/schemas/partner";
import { taskCreateSchema, taskUpdateSchema } from "@/lib/schemas/task";
import { documentCreateSchema, documentUpdateSchema } from "@/lib/schemas/document";

export interface AgentWriteOp {
  entity: RbacEntity;
  perm: "C" | "U";
  kind: "create" | "update";
  /** zod schema the matching UI mutation/service validates with — import the SAME one (see the service file's imports). safeParse at prepare. */
  schema: z.ZodTypeAny;
  /** fields that must not change once set — mirror service-level CrudError rules */
  lockedFields?: string[];
  /** update ops: load current record for preview/no-op/locked-field checks + own-scoped RBAC */
  loadCurrent?: (id: string) => Promise<Record<string, unknown> | null>;
  execute: (actor: Actor, targetId: string | null, payload: Record<string, unknown>) => Promise<{ id: string }>;
  href?: (id: string) => string; // deep link, mirror globalSearch conventions
}

// ─── updateDocument: accessLevel changes toward Investor-shared/VDR are the
// CRM UI's job (docshare.ts / the dedicated Share-via-Box flow), never the
// agent's — reject them at prepare time with a clear, actionable message.
const RESTRICTED_AGENT_ACCESS_LEVELS: DocumentAccessLevel[] = ["InvestorShared", "VDR"];

const agentDocumentUpdateSchema = documentUpdateSchema.superRefine((data, ctx) => {
  if (data.accessLevel !== undefined && RESTRICTED_AGENT_ACCESS_LEVELS.includes(data.accessLevel)) {
    ctx.addIssue({
      code: "custom",
      message: "Document access level changes are made in the CRM UI.",
      path: ["accessLevel"],
    });
  }
});

// ─── Local schemas for services that validate inline (no exported schema) ────

const setMandateStageSchema = z.object({ stage: z.nativeEnum(MandateStage) });
const setTransactionStageSchema = z.object({ stage: z.nativeEnum(TransactionStage) });

const recordMilestoneAgentSchema = z.object({
  engagementId: z.string().min(1),
  key: z.nativeEnum(MilestoneKey),
  completedAt: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
});
const unrecordMilestoneSchema = z.object({
  engagementId: z.string().min(1),
  key: z.nativeEnum(MilestoneKey),
});
const recordOpenNdaSchema = z.object({ investorId: z.string().min(1) });
const recordClosedNdaSchema = z.object({ engagementId: z.string().min(1) });

export const AGENT_WRITE_REGISTRY: Record<string, AgentWriteOp> = {
  createClient: {
    entity: "Clients", perm: "C", kind: "create",
    schema: clientCreateSchema,
    execute: async (a, _t, p) => ({ id: (await createClient(p as never, a)).id }),
    href: (id) => `/clients/${id}`,
  },
  updateClient: {
    entity: "Clients", perm: "U", kind: "update",
    schema: clientUpdateSchema,
    loadCurrent: (id) => prisma.client.findUnique({ where: { id } }) as never,
    execute: async (a, t, p) => ({ id: (await updateClient(t!, p as never, a)).id }),
    href: (id) => `/clients/${id}`,
  },

  createMandate: {
    entity: "Mandates", perm: "C", kind: "create",
    schema: mandateCreateSchema,
    execute: async (a, _t, p) => ({ id: (await createMandate(p as never, a)).id }),
    href: (id) => `/mandates/${id}`,
  },
  updateMandate: {
    entity: "Mandates", perm: "U", kind: "update",
    schema: mandateUpdateSchema,
    lockedFields: ["dateOpened", "source"],
    loadCurrent: (id) => prisma.mandate.findUnique({ where: { id } }) as never,
    execute: async (a, t, p) => ({ id: (await updateMandate(t!, p as never, a)).id }),
    href: (id) => `/mandates/${id}`,
  },
  setMandateStage: {
    entity: "Mandates", perm: "U", kind: "update",
    schema: setMandateStageSchema,
    loadCurrent: (id) => prisma.mandate.findUnique({ where: { id } }) as never,
    execute: async (a, t, p) => ({ id: (await setMandateStage(t!, (p as { stage: MandateStage }).stage, a)).id }),
    href: (id) => `/mandates/${id}`,
  },

  createTransaction: {
    entity: "Transactions", perm: "C", kind: "create",
    schema: transactionCreateSchema,
    execute: async (a, _t, p) => ({ id: (await createTransaction(p as never, a)).id }),
    href: (id) => `/transactions/${id}`,
  },
  updateTransaction: {
    entity: "Transactions", perm: "U", kind: "update",
    schema: transactionUpdateSchema,
    lockedFields: ["dateOpened"],
    loadCurrent: (id) => prisma.transaction.findUnique({ where: { id } }) as never,
    execute: async (a, t, p) => ({ id: (await updateTransaction(t!, p as never, a)).id }),
    href: (id) => `/transactions/${id}`,
  },
  setTransactionStage: {
    entity: "Transactions", perm: "U", kind: "update",
    schema: setTransactionStageSchema,
    loadCurrent: (id) => prisma.transaction.findUnique({ where: { id } }) as never,
    execute: async (a, t, p) => ({
      id: (await setTransactionStage(t!, (p as { stage: TransactionStage }).stage, a)).id,
    }),
    href: (id) => `/transactions/${id}`,
  },

  createEngagement: {
    entity: "Engagements", perm: "C", kind: "create",
    schema: engagementCreateSchema,
    execute: async (a, _t, p) => ({ id: (await createEngagement(p, a)).id }),
    href: (id) => `/engagement/${id}`,
  },
  updateEngagement: {
    entity: "Engagements", perm: "U", kind: "update",
    schema: engagementUpdateSchema,
    loadCurrent: (id) => prisma.engagement.findUnique({ where: { id } }) as never,
    execute: async (a, t, p) => ({ id: (await updateEngagement(t!, p, a)).id }),
    href: (id) => `/engagement/${id}`,
  },
  logActivity: {
    // Always inserts a new Activity row (no natural "current" to diff
    // against), so it's modeled as kind "create" (buildCreatePreview, no
    // loadCurrent) even though its RBAC check mirrors the mutation's
    // assertCan(ctx.actor, "Engagements", "U").
    entity: "Engagements", perm: "U", kind: "create",
    schema: logActivitySchema,
    execute: async (a, _t, p) => ({ id: (await logActivity(p as never, a)).id }),
  },

  createInvestor: {
    entity: "Investors", perm: "C", kind: "create",
    schema: investorCreateSchema,
    execute: async (a, _t, p) => ({ id: (await createInvestor(p as never, a)).id }),
    href: (id) => `/investors/${id}`,
  },
  updateInvestor: {
    entity: "Investors", perm: "U", kind: "update",
    schema: investorUpdateSchema,
    loadCurrent: (id) => prisma.investor.findUnique({ where: { id } }) as never,
    execute: async (a, t, p) => ({ id: (await updateInvestor(t!, p as never, a)).id }),
    href: (id) => `/investors/${id}`,
  },

  createPerson: {
    // Mirrors the createPerson mutation's assertCan(ctx.actor, "Investors", "U")
    // — contacts have no dedicated RBAC_ENTITY (they attach to a
    // client/investor/partner parent, unknown statically).
    entity: "Investors", perm: "U", kind: "create",
    schema: personCreateSchema,
    execute: async (a, _t, p) => ({ id: (await createPerson(p, a)).id }),
  },
  updatePerson: {
    entity: "Investors", perm: "U", kind: "update",
    schema: personUpdateSchema,
    loadCurrent: (id) => prisma.person.findUnique({ where: { id } }) as never,
    execute: async (a, t, p) => ({ id: (await updatePerson(t!, p, a)).id }),
  },

  createPartner: {
    entity: "Partners", perm: "C", kind: "create",
    schema: partnerCreateSchema,
    execute: async (a, _t, p) => ({ id: (await createPartner(p as never, a)).id }),
    href: (id) => `/partners/${id}`,
  },
  updatePartner: {
    entity: "Partners", perm: "U", kind: "update",
    schema: partnerUpdateSchema,
    loadCurrent: (id) => prisma.partner.findUnique({ where: { id } }) as never,
    execute: async (a, t, p) => ({ id: (await updatePartner(t!, p as never, a)).id }),
    href: (id) => `/partners/${id}`,
  },

  createTask: {
    entity: "Tasks", perm: "C", kind: "create",
    schema: taskCreateSchema,
    execute: async (a, _t, p) => ({ id: (await createTask(p as never, a)).id }),
    href: () => "/tasks",
  },
  updateTask: {
    entity: "Tasks", perm: "U", kind: "update",
    schema: taskUpdateSchema,
    loadCurrent: (id) => prisma.task.findUnique({ where: { id } }) as never,
    execute: async (a, t, p) => ({ id: (await updateTask(t!, p as never, a)).id }),
    href: () => "/tasks",
  },

  createDocument: {
    entity: "Documents", perm: "C", kind: "create",
    schema: documentCreateSchema,
    execute: async (a, _t, p) => ({ id: (await createDocument(p, a)).id }),
  },
  updateDocument: {
    entity: "Documents", perm: "U", kind: "update",
    schema: agentDocumentUpdateSchema,
    loadCurrent: (id) => prisma.document.findUnique({ where: { id } }) as never,
    execute: async (a, t, p) => ({ id: (await updateDocument(t!, p, a)).id }),
  },

  recordMilestone: {
    // No standalone "record id" until upserted; `loadCurrent`'s id argument
    // is resolved from payload.engagementId by the caller (Tasks 6-7), same
    // pattern as recordOpenNda below.
    entity: "Engagements", perm: "U", kind: "update",
    schema: recordMilestoneAgentSchema,
    loadCurrent: (id) => prisma.engagement.findUnique({ where: { id }, include: { milestones: true } }) as never,
    execute: async (a, _t, p) => ({ id: (await recordMilestone(p, a)).id }),
  },
  unrecordMilestone: {
    entity: "Engagements", perm: "U", kind: "update",
    schema: unrecordMilestoneSchema,
    loadCurrent: (id) => prisma.engagement.findUnique({ where: { id }, include: { milestones: true } }) as never,
    execute: async (a, _t, p) => {
      const { engagementId, key } = p as { engagementId: string; key: MilestoneKey };
      await unrecordMilestone(engagementId, key);
      return { id: engagementId };
    },
  },

  recordOpenNda: {
    entity: "Investors", perm: "U", kind: "update",
    schema: recordOpenNdaSchema,
    loadCurrent: (id) => prisma.investor.findUnique({ where: { id } }) as never,
    execute: async (a, _t, p) => ({ id: (await recordOpenNda((p as { investorId: string }).investorId, a)).id }),
    href: (id) => `/investors/${id}`,
  },
  recordClosedNda: {
    entity: "Engagements", perm: "U", kind: "update",
    schema: recordClosedNdaSchema,
    loadCurrent: (id) => prisma.engagement.findUnique({ where: { id } }) as never,
    execute: async (a, _t, p) => ({ id: (await recordClosedNda((p as { engagementId: string }).engagementId, a)).id }),
    href: (id) => `/engagement/${id}`,
  },
};
