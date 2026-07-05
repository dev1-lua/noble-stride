// GraphQL mutations for the NobleStride Capital CRM.
// Thin resolvers — each is a one-line call to the matching service.

import { builder, MandateStageEnum, TransactionStageEnum, InteractionTypeEnum, OnboardingStatusEnum, CommChannelEnum, CommDirectionEnum } from "./builder";
import { setMandateStage } from "@/server/services/mandates";
import { setTransactionStage } from "@/server/services/transactions";
import { logEngagement, logActivity } from "@/server/services/engagements";
import { createEngagement, updateEngagement } from "@/server/services/engagements-crud";
import { InvestorInput, ClientInput, MandateInput, TransactionInput, PartnerInput, EngagementInput, ServiceProviderInput, DocumentInput, TaskInput, LogActivityInput } from "./inputs";
import { createInvestor, updateInvestor, deleteInvestor, setOnboardingStatus } from "@/server/services/investors";
import { recordOpenNda, recordClosedNda } from "@/server/services/nda";
import { createClient, updateClient, deleteClient } from "@/server/services/clients";
import { createMandate, updateMandate, deleteMandate } from "@/server/services/mandates";
import { createTransaction, updateTransaction, deleteTransaction } from "@/server/services/transactions";
import { createPartner, updatePartner, deletePartner } from "@/server/services/partners";
import { createServiceProvider, updateServiceProvider, deleteServiceProvider } from "@/server/services/service-providers";
import { createDocument, updateDocument, deleteDocument } from "@/server/services/documents";
import { createTask, updateTask, deleteTask } from "@/server/services/tasks";

builder.mutationFields((t) => ({
  // 1. updateMandateStage(id: ID!, stage: MandateStage!): Mandate
  updateMandateStage: t.prismaField({
    type: "Mandate",
    nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      stage: t.arg({ type: MandateStageEnum, required: true }),
    },
    resolve: (_query, _root, args, ctx) => setMandateStage(args.id, args.stage, ctx.actor),
  }),

  // 2. updateTransactionStage(id: ID!, stage: TransactionStage!): Transaction
  updateTransactionStage: t.prismaField({
    type: "Transaction",
    nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      stage: t.arg({ type: TransactionStageEnum, required: true }),
    },
    resolve: (_query, _root, args, ctx) => setTransactionStage(args.id, args.stage, ctx.actor),
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
    resolve: (_query, _root, args, ctx) =>
      logEngagement({
        transactionId: args.transactionId,
        investorId: args.investorId,
        type: args.type,
        subject: args.subject ?? undefined,
        body: args.body ?? undefined,
        channel: args.channel ?? undefined,
        direction: args.direction ?? undefined,
      }, ctx.actor),
  }),

  // 3b. logActivity(input: LogActivityInput!): Activity — generalized
  // communication logging (spec §3.10): any one-or-more of client/mandate/
  // transaction/investor/engagement, not just the transaction+investor pair.
  logActivity: t.prismaField({
    type: "Activity",
    nullable: false,
    args: { input: t.arg({ type: LogActivityInput, required: true }) },
    resolve: (_query, _root, args, ctx) => logActivity(args.input as never, ctx.actor),
  }),

  // ── Investor ──
  createInvestor: t.prismaField({
    type: "Investor", nullable: false,
    args: { input: t.arg({ type: InvestorInput, required: true }) },
    resolve: (_q, _r, args, ctx) => createInvestor(args.input as never, ctx.actor),
  }),
  updateInvestor: t.prismaField({
    type: "Investor", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: InvestorInput, required: true }) },
    resolve: (_q, _r, args) => updateInvestor(args.id, args.input as never),
  }),
  deleteInvestor: t.prismaField({
    type: "Investor", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_q, _r, args) => deleteInvestor(args.id),
  }),
  setInvestorOnboardingStatus: t.prismaField({
    type: "Investor", nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      status: t.arg({ type: OnboardingStatusEnum, required: true }),
    },
    resolve: (_q, _r, args, ctx) => setOnboardingStatus(String(args.id), args.status, ctx.actor),
  }),
  recordOpenNda: t.prismaField({
    type: "Investor", nullable: false,
    args: { investorId: t.arg.id({ required: true }) },
    resolve: (_q, _r, args, ctx) => recordOpenNda(String(args.investorId), ctx.actor),
  }),
  recordClosedNda: t.prismaField({
    type: "Engagement", nullable: false,
    args: { engagementId: t.arg.id({ required: true }) },
    resolve: (_q, _r, args, ctx) => recordClosedNda(String(args.engagementId), ctx.actor),
  }),

  // ── Client ──
  createClient: t.prismaField({
    type: "Client", nullable: false,
    args: { input: t.arg({ type: ClientInput, required: true }) },
    resolve: (_q, _r, args, ctx) => createClient(args.input as never, ctx.actor),
  }),
  updateClient: t.prismaField({
    type: "Client", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: ClientInput, required: true }) },
    resolve: (_q, _r, args) => updateClient(args.id, args.input as never),
  }),
  deleteClient: t.prismaField({
    type: "Client", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_q, _r, args) => deleteClient(args.id),
  }),

  // ── Mandate ──
  createMandate: t.prismaField({
    type: "Mandate", nullable: false,
    args: { input: t.arg({ type: MandateInput, required: true }) },
    resolve: (_q, _r, args, ctx) => createMandate(args.input as never, ctx.actor),
  }),
  updateMandate: t.prismaField({
    type: "Mandate", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: MandateInput, required: true }) },
    resolve: (_q, _r, args, ctx) => updateMandate(args.id, args.input as never, ctx.actor),
  }),
  deleteMandate: t.prismaField({
    type: "Mandate", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_q, _r, args) => deleteMandate(args.id),
  }),

  // ── Transaction ──
  createTransaction: t.prismaField({
    type: "Transaction", nullable: false,
    args: { input: t.arg({ type: TransactionInput, required: true }) },
    resolve: (_q, _r, args, ctx) => createTransaction(args.input as never, ctx.actor),
  }),
  updateTransaction: t.prismaField({
    type: "Transaction", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: TransactionInput, required: true }) },
    resolve: (_q, _r, args, ctx) => updateTransaction(args.id, args.input as never, ctx.actor),
  }),
  deleteTransaction: t.prismaField({
    type: "Transaction", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_q, _r, args) => deleteTransaction(args.id),
  }),

  // ── Partner ──
  createPartner: t.prismaField({
    type: "Partner", nullable: false,
    args: { input: t.arg({ type: PartnerInput, required: true }) },
    resolve: (_q, _r, args, ctx) => createPartner(args.input as never, ctx.actor),
  }),
  updatePartner: t.prismaField({
    type: "Partner", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: PartnerInput, required: true }) },
    resolve: (_q, _r, args) => updatePartner(args.id, args.input as never),
  }),
  deletePartner: t.prismaField({
    type: "Partner", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_q, _r, args) => deletePartner(args.id),
  }),

  // ── ServiceProvider ──
  createServiceProvider: t.prismaField({
    type: "ServiceProvider", nullable: false,
    args: { input: t.arg({ type: ServiceProviderInput, required: true }) },
    resolve: (_q, _r, args, ctx) => createServiceProvider(args.input as never, ctx.actor),
  }),
  updateServiceProvider: t.prismaField({
    type: "ServiceProvider", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: ServiceProviderInput, required: true }) },
    resolve: (_q, _r, args) => updateServiceProvider(args.id, args.input as never),
  }),
  deleteServiceProvider: t.prismaField({
    type: "ServiceProvider", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_q, _r, args) => deleteServiceProvider(args.id),
  }),

  // ── Document ──
  createDocument: t.prismaField({
    type: "Document", nullable: false,
    args: { input: t.arg({ type: DocumentInput, required: true }) },
    resolve: (_q, _r, args, ctx) => createDocument(args.input as never, ctx.actor),
  }),
  updateDocument: t.prismaField({
    type: "Document", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: DocumentInput, required: true }) },
    resolve: (_q, _r, args) => updateDocument(args.id, args.input as never),
  }),
  deleteDocument: t.prismaField({
    type: "Document", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_q, _r, args) => deleteDocument(args.id),
  }),

  // ── Engagement ──
  createEngagement: t.prismaField({
    type: "Engagement", nullable: false,
    args: { input: t.arg({ type: EngagementInput, required: true }) },
    resolve: (_q, _r, args, ctx) => createEngagement(args.input as never, ctx.actor),
  }),
  updateEngagement: t.prismaField({
    type: "Engagement", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: EngagementInput, required: true }) },
    resolve: (_q, _r, args, ctx) => updateEngagement(args.id, args.input as never, ctx.actor),
  }),

  // ── Task ──
  createTask: t.prismaField({
    type: "Task", nullable: false,
    args: { input: t.arg({ type: TaskInput, required: true }) },
    resolve: (_q, _r, args) => createTask(args.input as never),
  }),
  updateTask: t.prismaField({
    type: "Task", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: TaskInput, required: true }) },
    resolve: (_q, _r, args) => updateTask(args.id, args.input as never),
  }),
  deleteTask: t.prismaField({
    type: "Task", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_q, _r, args) => deleteTask(args.id),
  }),
}));
