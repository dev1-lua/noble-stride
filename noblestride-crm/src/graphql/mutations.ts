// GraphQL mutations for the NobleStride Capital CRM.
// Thin resolvers — each is a one-line call to the matching service.

import { builder, MandateStageEnum, TransactionStageEnum, InteractionTypeEnum, OnboardingStatusEnum, CommChannelEnum, CommDirectionEnum, MilestoneKeyEnum, DDTrackEnum } from "./builder";
import { setMandateStage } from "@/server/services/mandates";
import { setTransactionStage } from "@/server/services/transactions";
import { logEngagement, logActivity } from "@/server/services/engagements";
import { createEngagement, updateEngagement } from "@/server/services/engagements-crud";
import { recordMilestone, unrecordMilestone } from "@/server/services/milestones-crud";
import { InvestorInput, ClientInput, MandateInput, TransactionInput, PartnerInput, EngagementInput, ServiceProviderInput, DocumentInput, TaskInput, LogActivityInput, PersonInput, MilestoneInput, DueDiligenceTrackInput } from "./inputs";
import { createInvestor, updateInvestor, deleteInvestor, setOnboardingStatus, greylistInvestor, markInvestorCriteriaVerified } from "@/server/services/investors";
import { recordOpenNda, recordClosedNda } from "@/server/services/nda";
import { createClient, updateClient, deleteClient } from "@/server/services/clients";
import { createMandate, updateMandate, deleteMandate, acceptIntakeMandate, deprioritizeIntakeMandate, rerunQualification } from "@/server/services/mandates";
import { createTransaction, updateTransaction, deleteTransaction } from "@/server/services/transactions";
import { createPartner, updatePartner, deletePartner } from "@/server/services/partners";
import { createServiceProvider, updateServiceProvider, deleteServiceProvider } from "@/server/services/service-providers";
import { createDocument, updateDocument, deleteDocumentVersion } from "@/server/services/documents";
import { createTask, updateTask, deleteTask } from "@/server/services/tasks";
import { createPerson, updatePerson, deletePerson } from "@/server/services/persons";
import { upsertDDTrack, deleteDDTrack } from "@/server/services/due-diligence";
import { createSavedView, renameSavedView, deleteSavedView, type SavedViewConfig } from "@/server/services/saved-views";
import { SavedViewRef } from "./types";
import { markNotificationsRead, markAllNotificationsRead } from "@/server/services/notifications";
import { getOrgLens } from "@/server/rbac/context";
import { assertAdmin, assertCan, assertCanDelete, assertCanUpdateOwnScoped } from "@/server/rbac/enforce";
import { prisma } from "@/lib/db";

builder.mutationFields((t) => ({
  // 1. updateMandateStage(id: ID!, stage: MandateStage!): Mandate
  updateMandateStage: t.prismaField({
    type: "Mandate",
    nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      stage: t.arg({ type: MandateStageEnum, required: true }),
    },
    resolve: async (_query, _root, args, ctx) => {
      await assertCanUpdateOwnScoped(ctx.actor, "Mandates", () =>
        prisma.mandate.findUnique({ where: { id: String(args.id) }, select: { leadId: true } }),
      );
      return setMandateStage(args.id, args.stage, ctx.actor);
    },
  }),

  // 2. updateTransactionStage(id: ID!, stage: TransactionStage!): Transaction
  updateTransactionStage: t.prismaField({
    type: "Transaction",
    nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      stage: t.arg({ type: TransactionStageEnum, required: true }),
    },
    resolve: async (_query, _root, args, ctx) => {
      await assertCanUpdateOwnScoped(ctx.actor, "Transactions", () =>
        prisma.transaction.findUnique({ where: { id: String(args.id) }, select: { ownerId: true } }),
      );
      return setTransactionStage(args.id, args.stage, ctx.actor);
    },
  }),

  // 3. logEngagement(transactionId, investorId, type, subject, body): Activity
  logEngagement: t.prismaField({
    type: "Activity",
    nullable: false,
    args: {
      transactionId: t.arg.id({ required: true }),
      investorId: t.arg.id({ required: true }),
      type: t.arg({ type: InteractionTypeEnum, required: true }),
      subject: t.arg.string({ required: false }),
      body: t.arg.string({ required: false }),
      channel: t.arg({ type: CommChannelEnum, required: false }),
      direction: t.arg({ type: CommDirectionEnum, required: false }),
    },
    resolve: async (_query, _root, args, ctx) => {
      assertCan(ctx.actor, "Engagements", "U");
      return logEngagement({
        transactionId: args.transactionId,
        investorId: args.investorId,
        type: args.type,
        subject: args.subject ?? undefined,
        body: args.body ?? undefined,
        channel: args.channel ?? undefined,
        direction: args.direction ?? undefined,
      }, ctx.actor);
    },
  }),

  // 3b. logActivity(input: LogActivityInput!): Activity — generalized
  // communication logging (spec §3.10): any one-or-more of client/mandate/
  // transaction/investor/engagement, not just the transaction+investor pair.
  logActivity: t.prismaField({
    type: "Activity",
    nullable: false,
    args: { input: t.arg({ type: LogActivityInput, required: true }) },
    resolve: async (_query, _root, args, ctx) => {
      assertCan(ctx.actor, "Engagements", "U");
      return logActivity(args.input as never, ctx.actor);
    },
  }),

  // ── Investor ──
  createInvestor: t.prismaField({
    type: "Investor", nullable: false,
    args: { input: t.arg({ type: InvestorInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Investors", "C");
      return createInvestor(args.input as never, ctx.actor);
    },
  }),
  updateInvestor: t.prismaField({
    type: "Investor", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: InvestorInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Investors", "U");
      return updateInvestor(args.id, args.input as never, ctx.actor);
    },
  }),
  deleteInvestor: t.prismaField({
    type: "Investor", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCanDelete(ctx.actor, "Investors");
      return deleteInvestor(args.id);
    },
  }),
  markInvestorCriteriaVerified: t.prismaField({
    type: "Investor", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_q, _r, args) => markInvestorCriteriaVerified(args.id),
  }),
  setInvestorOnboardingStatus: t.prismaField({
    type: "Investor", nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      status: t.arg({ type: OnboardingStatusEnum, required: true }),
    },
    resolve: async (_q, _r, args, ctx) => {
      assertAdmin(ctx.actor);
      return setOnboardingStatus(String(args.id), args.status, ctx.actor);
    },
  }),
  // Greylist decision (SOW §11.2 — greylisted funds never see opportunities):
  // blocks portal visibility AND resolves the registration as Rejected.
  greylistInvestor: t.prismaField({
    type: "Investor", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertAdmin(ctx.actor);
      return greylistInvestor(String(args.id), ctx.actor);
    },
  }),
  recordOpenNda: t.prismaField({
    type: "Investor", nullable: false,
    args: { investorId: t.arg.id({ required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Investors", "U");
      return recordOpenNda(String(args.investorId), ctx.actor);
    },
  }),
  recordClosedNda: t.prismaField({
    type: "Engagement", nullable: false,
    args: { engagementId: t.arg.id({ required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Engagements", "U");
      return recordClosedNda(String(args.engagementId), ctx.actor);
    },
  }),

  // ── Client ──
  createClient: t.prismaField({
    type: "Client", nullable: false,
    args: { input: t.arg({ type: ClientInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Clients", "C");
      return createClient(args.input as never, ctx.actor);
    },
  }),
  updateClient: t.prismaField({
    type: "Client", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: ClientInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Clients", "U");
      return updateClient(args.id, args.input as never, ctx.actor);
    },
  }),
  deleteClient: t.prismaField({
    type: "Client", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCanDelete(ctx.actor, "Clients");
      return deleteClient(args.id);
    },
  }),

  // ── Mandate ──
  createMandate: t.prismaField({
    type: "Mandate", nullable: false,
    args: { input: t.arg({ type: MandateInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Mandates", "C");
      return createMandate(args.input as never, ctx.actor);
    },
  }),
  updateMandate: t.prismaField({
    type: "Mandate", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: MandateInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      await assertCanUpdateOwnScoped(ctx.actor, "Mandates", () =>
        prisma.mandate.findUnique({ where: { id: String(args.id) }, select: { leadId: true } }),
      );
      return updateMandate(args.id, args.input as never, ctx.actor);
    },
  }),
  deleteMandate: t.prismaField({
    type: "Mandate", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCanDelete(ctx.actor, "Mandates");
      return deleteMandate(args.id);
    },
  }),

  // Intake review actions (Task 12) — website-intake mandates land in
  // NewLead with a computed qualification verdict; a human reviews from here.
  acceptIntakeMandate: t.prismaField({
    type: "Mandate", nullable: false,
    args: { id: t.arg.id({ required: true }), leadId: t.arg.id({ required: true }) },
    resolve: (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Mandates", "U");
      return acceptIntakeMandate(args.id, args.leadId, ctx.actor);
    },
  }),
  deprioritizeIntakeMandate: t.prismaField({
    type: "Mandate", nullable: false,
    args: { id: t.arg.id({ required: true }), reason: t.arg.string({ required: true }) },
    resolve: (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Mandates", "U");
      return deprioritizeIntakeMandate(args.id, args.reason, ctx.actor);
    },
  }),
  rerunQualification: t.prismaField({
    type: "Mandate", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Mandates", "U");
      return rerunQualification(args.id);
    },
  }),

  // ── Transaction ──
  createTransaction: t.prismaField({
    type: "Transaction", nullable: false,
    args: { input: t.arg({ type: TransactionInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Transactions", "C");
      return createTransaction(args.input as never, ctx.actor);
    },
  }),
  updateTransaction: t.prismaField({
    type: "Transaction", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: TransactionInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      await assertCanUpdateOwnScoped(ctx.actor, "Transactions", () =>
        prisma.transaction.findUnique({ where: { id: String(args.id) }, select: { ownerId: true } }),
      );
      return updateTransaction(args.id, args.input as never, ctx.actor);
    },
  }),
  deleteTransaction: t.prismaField({
    type: "Transaction", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCanDelete(ctx.actor, "Transactions");
      return deleteTransaction(args.id);
    },
  }),

  // ── Partner ──
  createPartner: t.prismaField({
    type: "Partner", nullable: false,
    args: { input: t.arg({ type: PartnerInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Partners", "C");
      return createPartner(args.input as never, ctx.actor);
    },
  }),
  updatePartner: t.prismaField({
    type: "Partner", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: PartnerInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Partners", "U");
      return updatePartner(args.id, args.input as never, ctx.actor);
    },
  }),
  deletePartner: t.prismaField({
    type: "Partner", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCanDelete(ctx.actor, "Partners");
      return deletePartner(args.id);
    },
  }),

  // ── ServiceProvider ──
  createServiceProvider: t.prismaField({
    type: "ServiceProvider", nullable: false,
    args: { input: t.arg({ type: ServiceProviderInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Service Providers", "C");
      return createServiceProvider(args.input as never, ctx.actor);
    },
  }),
  updateServiceProvider: t.prismaField({
    type: "ServiceProvider", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: ServiceProviderInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Service Providers", "U");
      return updateServiceProvider(args.id, args.input as never);
    },
  }),
  deleteServiceProvider: t.prismaField({
    type: "ServiceProvider", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCanDelete(ctx.actor, "Service Providers");
      return deleteServiceProvider(args.id);
    },
  }),

  // ── Document ──
  createDocument: t.prismaField({
    type: "Document", nullable: false,
    args: { input: t.arg({ type: DocumentInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Documents", "C");
      return createDocument(args.input as never, ctx.actor);
    },
  }),
  updateDocument: t.prismaField({
    type: "Document", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: DocumentInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Documents", "U");
      return updateDocument(args.id, args.input as never);
    },
  }),
  deleteDocument: t.prismaField({
    type: "Document", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCanDelete(ctx.actor, "Documents");
      return deleteDocumentVersion(args.id);
    },
  }),

  // ── Engagement ──
  createEngagement: t.prismaField({
    type: "Engagement", nullable: false,
    args: { input: t.arg({ type: EngagementInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Engagements", "C");
      return createEngagement(args.input as never, ctx.actor);
    },
  }),
  updateEngagement: t.prismaField({
    type: "Engagement", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: EngagementInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      await assertCanUpdateOwnScoped(ctx.actor, "Engagements", () =>
        prisma.engagement.findUnique({ where: { id: String(args.id) }, select: { ownerId: true } }),
      );
      return updateEngagement(args.id, args.input as never, ctx.actor);
    },
  }),

  // ── Task ──
  createTask: t.prismaField({
    type: "Task", nullable: false,
    args: { input: t.arg({ type: TaskInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Tasks", "C");
      return createTask(args.input as never);
    },
  }),
  updateTask: t.prismaField({
    type: "Task", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: TaskInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      await assertCanUpdateOwnScoped(ctx.actor, "Tasks", () =>
        prisma.task.findUnique({ where: { id: String(args.id) }, select: { assigneeId: true } }),
      );
      return updateTask(args.id, args.input as never);
    },
  }),
  deleteTask: t.prismaField({
    type: "Task", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCanDelete(ctx.actor, "Tasks");
      return deleteTask(args.id);
    },
  }),

  // ── Person (contacts, spec §3.5) ──
  createPerson: t.prismaField({
    type: "Person", nullable: false,
    args: { input: t.arg({ type: PersonInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Investors", "U");
      return createPerson(args.input as never, ctx.actor);
    },
  }),
  updatePerson: t.prismaField({
    type: "Person", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: PersonInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Investors", "U");
      return updatePerson(args.id, args.input as never, ctx.actor);
    },
  }),
  deletePerson: t.prismaField({
    type: "Person", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCanDelete(ctx.actor, "Investors");
      return deletePerson(args.id);
    },
  }),

  // ── Engagement milestones (spec §6.2) ──
  recordMilestone: t.prismaField({
    type: "EngagementMilestone", nullable: false,
    args: { input: t.arg({ type: MilestoneInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Engagements", "U");
      return recordMilestone(args.input as never, ctx.actor);
    },
  }),
  unrecordMilestone: t.boolean({
    nullable: false,
    args: {
      engagementId: t.arg.id({ required: true }),
      key: t.arg({ type: MilestoneKeyEnum, required: true }),
    },
    resolve: async (_r, args, ctx) => {
      assertCan(ctx.actor, "Engagements", "U");
      return unrecordMilestone(String(args.engagementId), args.key);
    },
  }),

  // ── DueDiligenceTrack ──
  upsertDueDiligenceTrack: t.prismaField({
    type: "DueDiligenceTrack", nullable: false,
    args: { input: t.arg({ type: DueDiligenceTrackInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Transactions", "U");
      return upsertDDTrack(args.input as never);
    },
  }),
  deleteDueDiligenceTrack: t.prismaField({
    type: "DueDiligenceTrack", nullable: false,
    args: { transactionId: t.arg.id({ required: true }), track: t.arg({ type: DDTrackEnum, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Transactions", "U");
      return deleteDDTrack(String(args.transactionId), args.track);
    },
  }),

  // ── SavedView (deals-queue, team-shared) ──
  createSavedView: t.field({
    type: SavedViewRef, nullable: false,
    args: {
      name: t.arg.string({ required: true }),
      config: t.arg.string({ required: true }),
      entity: t.arg.string({ required: false }),
    },
    resolve: async (_r, args, ctx) => {
      assertCan(ctx.actor, "Tasks", "R");
      return createSavedView({
        name: args.name,
        entity: args.entity ?? undefined,
        config: JSON.parse(args.config) as SavedViewConfig,
      });
    },
  }),
  renameSavedView: t.field({
    type: SavedViewRef, nullable: false,
    args: { id: t.arg.id({ required: true }), name: t.arg.string({ required: true }) },
    resolve: async (_r, args, ctx) => {
      assertCan(ctx.actor, "Tasks", "R");
      return renameSavedView(String(args.id), args.name);
    },
  }),
  deleteSavedView: t.field({
    type: SavedViewRef, nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_r, args, ctx) => {
      assertCan(ctx.actor, "Tasks", "R");
      return deleteSavedView(String(args.id));
    },
  }),

  // ── Notification (Task 14 bell) ──
  // Both mutations scope the update to the current in-org lens user, so a
  // user can only ever mark their own notifications read. Demo-lens mode:
  // when the lens has no resolved userId (Admin fallback), no-ops to 0.
  markNotificationsRead: t.int({
    nullable: false,
    args: { ids: t.arg({ type: ["ID"], required: true }) },
    resolve: async (_r, args) => {
      const lens = await getOrgLens();
      if (!lens.userId) return 0;
      return markNotificationsRead(lens.userId, args.ids.map(String));
    },
  }),
  markAllNotificationsRead: t.int({
    nullable: false,
    resolve: async () => {
      const lens = await getOrgLens();
      if (!lens.userId) return 0;
      return markAllNotificationsRead(lens.userId);
    },
  }),
}));
