// GraphQL mutations for the Noblestride Capital CRM.
// Thin resolvers — each is a one-line call to the matching service.

import { builder, MandateStageEnum, TransactionStageEnum, AdvisoryStageEnum, InteractionTypeEnum, OnboardingStatusEnum, CommChannelEnum, CommDirectionEnum, MilestoneKeyEnum, DDTrackEnum } from "./builder";
import { setMandateStage } from "@/server/services/mandates";
import { setTransactionStage } from "@/server/services/transactions";
import { logEngagement, logActivity } from "@/server/services/engagements";
import { createEngagement, updateEngagement } from "@/server/services/engagements-crud";
import { recordMilestone, unrecordMilestone } from "@/server/services/milestones-crud";
import { InvestorInput, ClientInput, MandateInput, TransactionInput, AdvisoryInput, PartnerInput, EngagementInput, ServiceProviderInput, DocumentInput, TaskInput, LogActivityInput, PersonInput, MilestoneInput, DueDiligenceTrackInput, SendEsignInput, ScheduleMeetingInput, ClientIntakeInput, WebsiteIntakeInput, LogClientMessageInput, InvestorUpdateSubmitInput, InvestorCommunicationInput, InvestorFlagInput, OutreachDraftsInput, PartnerSelfUpdateInput } from "./inputs";
import { createInvestor, updateInvestor, deleteInvestor, setOnboardingStatus, greylistInvestor, markInvestorCriteriaVerified } from "@/server/services/investors";
import { recordOpenNda, recordClosedNda } from "@/server/services/nda";
import { createClient, updateClient, deleteClient } from "@/server/services/clients";
import { createMandate, updateMandate, deleteMandate, acceptIntakeMandate, deprioritizeIntakeMandate, rerunQualification } from "@/server/services/mandates";
import { setAdvisoryStage, createAdvisory, updateAdvisory, deleteAdvisory } from "@/server/services/advisory";
import { createTransaction, updateTransaction, deleteTransaction } from "@/server/services/transactions";
import { createPartner, updatePartner, deletePartner } from "@/server/services/partners";
import { createServiceProvider, updateServiceProvider, deleteServiceProvider } from "@/server/services/service-providers";
import { createDocument, updateDocument, deleteDocumentVersion } from "@/server/services/documents";
import { createTask, updateTask, deleteTask } from "@/server/services/tasks";
import { createPerson, updatePerson, deletePerson } from "@/server/services/persons";
import { upsertDDTrack, deleteDDTrack } from "@/server/services/due-diligence";
import { createSavedView, renameSavedView, deleteSavedView, type SavedViewConfig } from "@/server/services/saved-views";
import { SavedViewRef, EsignEnvelopeResult, AgentAckRef, ClientMessageAckRef, ClientOtpVerifyRef, AgentWritePreviewRef, AgentWriteResultRef, DraftsAckRef, DealInterestAckRef, PartnerAccessCodeRef, PartnerVerifyRef } from "./types";
import { issuePartnerAccessCode, verifyPartnerAccessCode, submitPartnerSelfUpdate } from "@/server/services/partner-self";
import { markNotificationsRead, markAllNotificationsRead } from "@/server/services/notifications";
import { getOrgLens } from "@/server/rbac/context";
import { assertAdmin, assertCan, assertCanDelete, assertCanUpdateOwnScoped, assertAutomation } from "@/server/rbac/enforce";
import { prisma } from "@/lib/db";
import { CrudError } from "@/server/services/crud";
import { sendEsignEnvelope } from "@/server/services/esign";
import type { ESignKind } from "@/server/integrations/esign/provider";
import { shareDocumentViaBox } from "@/server/services/docshare";
import { scheduleMeeting } from "@/server/services/meetings";
import { submitClientIntake, submitWebsiteClientIntake, logInboundClientMessage, type LogClientMessageInput as LogClientMessageInputShape } from "@/server/services/client-intake";
import { requestClientStatusOtp, verifyClientStatusOtp } from "@/server/services/client-status";
import { prepareAgentWrite, commitAgentWrite, cancelAgentWrite } from "@/server/services/agent-write";
import { submitInvestorUpdate, logInvestorCommunication, flagInvestorForReview, expressDealInterestFromAgent } from "@/server/services/investor-agent";
import { saveOutreachDrafts } from "@/server/services/outreach";
import { InteractionType } from "@prisma/client";

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

  // 2b. updateAdvisoryStage(id: ID!, stage: AdvisoryStage!): AdvisoryEngagement
  updateAdvisoryStage: t.prismaField({
    type: "AdvisoryEngagement",
    nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      stage: t.arg({ type: AdvisoryStageEnum, required: true }),
    },
    resolve: async (_query, _root, args, ctx) => {
      await assertCanUpdateOwnScoped(ctx.actor, "Advisory", () =>
        prisma.advisoryEngagement.findUnique({ where: { id: String(args.id) }, select: { leadId: true } }),
      );
      return setAdvisoryStage(args.id, args.stage, ctx.actor);
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

  // ── E-sign (Task 7) — sends an envelope via the configured provider seam
  // (manual no-op fallback when DocuSign is unconfigured; see
  // src/server/integrations/esign/provider.ts). Guarded the same as
  // recordClosedNda: a staff-write check on Engagements.
  sendEsignEnvelope: t.field({
    type: EsignEnvelopeResult, nullable: false,
    args: { input: t.arg({ type: SendEsignInput, required: true }) },
    resolve: async (_r, { input }, ctx) => {
      assertCan(ctx.actor, "Engagements", "U");
      return sendEsignEnvelope({
        kind: input.kind as ESignKind,
        documentBase64: input.documentBase64,
        documentName: input.documentName,
        signer: { email: input.signerEmail, name: input.signerName },
        subject: input.subject,
        linkRecord: {
          investorId: input.investorId != null ? String(input.investorId) : undefined,
          engagementId: input.engagementId != null ? String(input.engagementId) : undefined,
          transactionId: input.transactionId != null ? String(input.transactionId) : undefined,
        },
      }, ctx.actor);
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

  // ── Advisory ──
  createAdvisory: t.prismaField({
    type: "AdvisoryEngagement", nullable: false,
    args: { input: t.arg({ type: AdvisoryInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCan(ctx.actor, "Advisory", "C");
      return createAdvisory(args.input as never, ctx.actor);
    },
  }),
  updateAdvisory: t.prismaField({
    type: "AdvisoryEngagement", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: AdvisoryInput, required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      await assertCanUpdateOwnScoped(ctx.actor, "Advisory", () =>
        prisma.advisoryEngagement.findUnique({ where: { id: String(args.id) }, select: { leadId: true } }),
      );
      return updateAdvisory(args.id, args.input as never, ctx.actor);
    },
  }),
  deleteAdvisory: t.prismaField({
    type: "AdvisoryEngagement", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      assertCanDelete(ctx.actor, "Advisory");
      return deleteAdvisory(args.id);
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

  // ── Inline lead/assist reassignment (verification step 2026-07) ──
  // Thin mutations for the /deals inline editors: they call the update services
  // with a partial payload, so they need neither the create-shaped
  // MandateInput/TransactionInput/AdvisoryInput (which require name+clientId)
  // nor a re-send of unrelated fields. Each runs the same ownership-scoped RBAC
  // check as the full update, and the service fires the assignment notification.
  assignMandateLead: t.prismaField({
    type: "Mandate", nullable: false,
    args: { id: t.arg.id({ required: true }), leadId: t.arg.id({ required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      await assertCanUpdateOwnScoped(ctx.actor, "Mandates", () =>
        prisma.mandate.findUnique({ where: { id: String(args.id) }, select: { leadId: true } }),
      );
      return updateMandate(args.id, { leadId: String(args.leadId) } as never, ctx.actor);
    },
  }),
  setMandateAssists: t.prismaField({
    type: "Mandate", nullable: false,
    args: { id: t.arg.id({ required: true }), assistIds: t.arg({ type: ["ID"], required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      await assertCanUpdateOwnScoped(ctx.actor, "Mandates", () =>
        prisma.mandate.findUnique({ where: { id: String(args.id) }, select: { leadId: true } }),
      );
      return updateMandate(args.id, { assistIds: args.assistIds.map(String) } as never, ctx.actor);
    },
  }),
  assignTransactionOwner: t.prismaField({
    type: "Transaction", nullable: false,
    args: { id: t.arg.id({ required: true }), ownerId: t.arg.id({ required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      await assertCanUpdateOwnScoped(ctx.actor, "Transactions", () =>
        prisma.transaction.findUnique({ where: { id: String(args.id) }, select: { ownerId: true } }),
      );
      return updateTransaction(args.id, { ownerId: String(args.ownerId) } as never, ctx.actor);
    },
  }),
  setTransactionAssists: t.prismaField({
    type: "Transaction", nullable: false,
    args: { id: t.arg.id({ required: true }), assistIds: t.arg({ type: ["ID"], required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      await assertCanUpdateOwnScoped(ctx.actor, "Transactions", () =>
        prisma.transaction.findUnique({ where: { id: String(args.id) }, select: { ownerId: true } }),
      );
      return updateTransaction(args.id, { assistIds: args.assistIds.map(String) } as never, ctx.actor);
    },
  }),
  assignAdvisoryLead: t.prismaField({
    type: "AdvisoryEngagement", nullable: false,
    args: { id: t.arg.id({ required: true }), leadId: t.arg.id({ required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      await assertCanUpdateOwnScoped(ctx.actor, "Advisory", () =>
        prisma.advisoryEngagement.findUnique({ where: { id: String(args.id) }, select: { leadId: true } }),
      );
      return updateAdvisory(args.id, { leadId: String(args.leadId) } as never, ctx.actor);
    },
  }),
  setAdvisoryAssists: t.prismaField({
    type: "AdvisoryEngagement", nullable: false,
    args: { id: t.arg.id({ required: true }), assistIds: t.arg({ type: ["ID"], required: true }) },
    resolve: async (_q, _r, args, ctx) => {
      await assertCanUpdateOwnScoped(ctx.actor, "Advisory", () =>
        prisma.advisoryEngagement.findUnique({ where: { id: String(args.id) }, select: { leadId: true } }),
      );
      return updateAdvisory(args.id, { assistIds: args.assistIds.map(String) } as never, ctx.actor);
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

  // ── Share via Box (Task 12b) — fetches the document's stored bytes from
  // its fileUrl and hands them to the docshare provider seam (manual no-op
  // fallback when Box is unconfigured; see src/server/integrations/docshare/provider.ts).
  // Guarded the same as updateDocument: a staff-write check on Documents.
  shareDocumentViaBox: t.string({
    nullable: false,
    args: { documentId: t.arg.id({ required: true }) },
    resolve: async (_r, args, ctx) => {
      assertCan(ctx.actor, "Documents", "U");
      const doc = await prisma.document.findUnique({ where: { id: String(args.documentId) } });
      if (!doc) throw new Error("Document not found");
      if (!doc.fileUrl) throw new Error("Document has no fileUrl to share");
      const r = await fetch(doc.fileUrl);
      const bytes = Buffer.from(await r.arrayBuffer());
      const { sharedUrl } = await shareDocumentViaBox(doc.id, bytes, {
        filename: doc.name,
        contentType: r.headers.get("content-type") ?? "application/octet-stream",
      });
      return sharedUrl;
    },
  }),

  // ── Schedule a Teams call (Task 15) — schedules a meeting via the
  // configured provider seam (manual no-op fallback throws when Teams is
  // unconfigured; see src/server/integrations/meetings/provider.ts). The UI
  // only renders the trigger button when isConfigured("teams") is true.
  // Guarded the same as recordClosedNda/sendEsignEnvelope: a staff-write
  // check on Engagements.
  scheduleMeeting: t.string({
    nullable: false,
    args: { input: t.arg({ type: ScheduleMeetingInput, required: true }) },
    resolve: async (_r, { input }, ctx) => {
      assertCan(ctx.actor, "Engagements", "U");
      const attendees = JSON.parse(input.attendeesJson) as { email: string; name?: string }[];
      const result = await scheduleMeeting({
        subject: input.subject,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        attendees,
        linkRecord: {
          engagementId: input.engagementId != null ? String(input.engagementId) : undefined,
          transactionId: input.transactionId != null ? String(input.transactionId) : undefined,
          investorId: input.investorId != null ? String(input.investorId) : undefined,
        },
      }, ctx.actor);
      return result.joinUrl;
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
      return updateTask(args.id, args.input as never, ctx.actor);
    },
  }),
  // Inline task lead/assist reassignment (verification step 2026-07) — partial
  // payload without the required-title TaskInput; the service fires the
  // assignment notification. Same ownership-scoped RBAC as updateTask.
  assignTask: t.prismaField({
    type: "Task", nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      assigneeId: t.arg.id({ required: false }),
      assistantId: t.arg.id({ required: false }),
    },
    resolve: async (_q, _r, args, ctx) => {
      await assertCanUpdateOwnScoped(ctx.actor, "Tasks", () =>
        prisma.task.findUnique({ where: { id: String(args.id) }, select: { assigneeId: true } }),
      );
      const input: Record<string, string> = {};
      if (args.assigneeId != null) input.assigneeId = String(args.assigneeId);
      if (args.assistantId != null) input.assistantId = String(args.assistantId);
      return updateTask(args.id, input as never, ctx.actor);
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

  // ── Client Agent (SOW §8.1) — automation-only, minimal acks ──
  submitClientIntake: t.field({
    type: AgentAckRef,
    nullable: false,
    args: { input: t.arg({ type: ClientIntakeInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      const { conversationSummary, qualificationNotes, attachmentUrls, ...intake } =
        args.input as Record<string, unknown> & {
          conversationSummary: string;
          qualificationNotes?: string | null;
          attachmentUrls?: string[] | null;
        };
      // GraphQL optionals arrive as null; intakeSubmitSchema expects absent.
      const raw = Object.fromEntries(Object.entries(intake).filter(([, v]) => v != null));
      return submitClientIntake(raw, { conversationSummary, qualificationNotes, attachmentUrls });
    },
  }),
  // ── Website Intake & Qualification Agent (SOW §10) — automation-only, minimal ack ──
  submitWebsiteIntake: t.field({
    type: AgentAckRef,
    nullable: false,
    args: { input: t.arg({ type: WebsiteIntakeInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      const { conversationSummary, qualificationNotes, attachmentUrls, ...intake } =
        args.input as Record<string, unknown> & {
          conversationSummary: string;
          qualificationNotes?: string | null;
          attachmentUrls?: string[] | null;
        };
      // GraphQL optionals arrive as null; websiteIntakeSchema expects absent.
      const raw = Object.fromEntries(Object.entries(intake).filter(([, v]) => v != null));
      return submitWebsiteClientIntake(raw, { conversationSummary, qualificationNotes, attachmentUrls });
    },
  }),
  logInboundClientMessage: t.field({
    type: ClientMessageAckRef,
    nullable: false,
    args: { input: t.arg({ type: LogClientMessageInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      return logInboundClientMessage(args.input as unknown as LogClientMessageInputShape);
    },
  }),

  // ── Client status OTP flow (spec 2026-07-14) — automation-only ──
  // requestClientStatusOtp always acks {ok:true} — the anti-enumeration
  // invariant (no branch may leak whether a company/contact exists) lives
  // entirely in the service; the resolver must not differentiate outcomes.
  requestClientStatusOtp: t.field({
    type: AgentAckRef,
    nullable: false,
    args: {
      companyName: t.arg.string({ required: true }),
      contactEmail: t.arg.string({ required: true }),
    },
    resolve: (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      return requestClientStatusOtp(args.companyName, args.contactEmail);
    },
  }),
  verifyClientStatusOtp: t.field({
    type: ClientOtpVerifyRef,
    nullable: false,
    args: {
      companyName: t.arg.string({ required: true }),
      contactEmail: t.arg.string({ required: true }),
      code: t.arg.string({ required: true }),
    },
    resolve: (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      return verifyClientStatusOtp(args.companyName, args.contactEmail, args.code);
    },
  }),

  // ── Partner self-service (SOW §7.2) — automation-only ──
  // issuePartnerAccessCode is staff-initiated (referral agent staff mode); it
  // returns the raw code ONCE for out-of-band delivery to the partner.
  issuePartnerAccessCode: t.field({
    type: PartnerAccessCodeRef,
    nullable: false,
    args: { partnerId: t.arg.string({ required: true }) },
    resolve: (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      return issuePartnerAccessCode(args.partnerId);
    },
  }),
  // verifyPartnerAccessCode always collapses failures to {status:"failed"} — the
  // anti-enumeration invariant lives in the service; the resolver must not differ.
  verifyPartnerAccessCode: t.field({
    type: PartnerVerifyRef,
    nullable: false,
    args: {
      partnerRef: t.arg.string({ required: true }),
      code: t.arg.string({ required: true }),
    },
    resolve: (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      return verifyPartnerAccessCode(args.partnerRef, args.code);
    },
  }),
  // submitPartnerSelfUpdate queues a proposed change + staff task; never mutates
  // the Partner directly (SOW §8.4). Token-scoped to the verified partner.
  submitPartnerSelfUpdate: t.field({
    type: AgentAckRef,
    nullable: false,
    args: { input: t.arg({ type: PartnerSelfUpdateInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      let proposedFields: Record<string, unknown>;
      try {
        proposedFields = JSON.parse(args.input.proposedFieldsJson) as Record<string, unknown>;
      } catch {
        throw new Error("proposedFieldsJson is not valid JSON");
      }
      return submitPartnerSelfUpdate(args.input.token, proposedFields, args.input.summary);
    },
  }),

  // ── crmAgent write surface (spec 2026-07-14) — automation transport + delegated RBAC ──
  agentPrepareWrite: t.field({
    type: AgentWritePreviewRef,
    nullable: false,
    args: {
      operation: t.arg.string({ required: true }),
      targetId: t.arg.string({ required: false }),
      payloadJson: t.arg.string({ required: true }),
      actorEmail: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      return prepareAgentWrite({
        operation: args.operation,
        targetId: args.targetId ?? undefined,
        payloadJson: args.payloadJson,
        actorEmail: args.actorEmail,
      });
    },
  }),
  agentCommitWrite: t.field({
    type: AgentWriteResultRef,
    nullable: false,
    args: {
      writeToken: t.arg.string({ required: true }),
      actorEmail: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      return commitAgentWrite(args.writeToken, args.actorEmail);
    },
  }),
  agentCancelWrite: t.field({
    type: AgentAckRef,
    nullable: false,
    args: {
      writeToken: t.arg.string({ required: true }),
      actorEmail: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      return cancelAgentWrite(args.writeToken, args.actorEmail);
    },
  }),

  // ── Investor Agent (spec 2026-07-14) — automation-only, minimal acks ──
  submitInvestorUpdate: t.field({
    type: AgentAckRef,
    nullable: false,
    args: { input: t.arg({ type: InvestorUpdateSubmitInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      let proposedFields: Record<string, unknown>;
      try {
        proposedFields = JSON.parse(args.input.proposedFieldsJson) as Record<string, unknown>;
      } catch {
        throw new Error("proposedFieldsJson is not valid JSON");
      }
      return submitInvestorUpdate({
        investorId: args.input.investorId,
        personId: args.input.personId ?? null,
        proposedFields,
        summary: args.input.summary,
        sourceEmail: args.input.sourceEmail,
      });
    },
  }),
  logInvestorCommunication: t.field({
    type: AgentAckRef,
    nullable: false,
    args: { input: t.arg({ type: InvestorCommunicationInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      if (args.input.direction !== "Inbound" && args.input.direction !== "Outbound")
        throw new CrudError("direction must be Inbound or Outbound");
      // interactionType arrives as a raw GraphQL string; the service force-casts
      // it to the Prisma InteractionType enum, so validate it here first — a
      // clear error beats a dishonest cast blowing up as an opaque DB error
      // downstream (and getting masked to "Unexpected error." at that).
      if (!Object.values(InteractionType).includes(args.input.interactionType as InteractionType)) {
        throw new CrudError(
          `interactionType must be one of: ${Object.values(InteractionType).join(", ")}`,
        );
      }
      return logInvestorCommunication({
        investorId: args.input.investorId,
        direction: args.input.direction,
        interactionType: args.input.interactionType,
        subject: args.input.subject ?? null,
        summary: args.input.summary,
      });
    },
  }),
  flagInvestorForReview: t.field({
    type: AgentAckRef,
    nullable: false,
    args: { input: t.arg({ type: InvestorFlagInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      if (args.input.source !== "MANUAL" && args.input.source !== "SECURITY")
        throw new CrudError("source must be MANUAL or SECURITY");
      return flagInvestorForReview({
        investorId: args.input.investorId ?? null,
        email: args.input.email ?? null,
        reason: args.input.reason ?? null,
        source: args.input.source,
        summary: args.input.summary,
      });
    },
  }),
  // Investor Agent: a matched investor replied interested → surface it to the
  // deal owner + return a secure portal deep link (deal detail never leaves email).
  expressDealInterestForAgent: t.field({
    type: DealInterestAckRef,
    nullable: false,
    args: {
      investorId: t.arg.string({ required: true }),
      dealHint: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      const r = await expressDealInterestFromAgent({ investorId: args.investorId, dealHint: args.dealHint ?? null });
      return { matched: r.matched, dealName: r.dealName ?? null, portalUrl: r.portalUrl ?? null };
    },
  }),
  saveOutreachDrafts: t.field({
    type: DraftsAckRef,
    nullable: false,
    args: { input: t.arg({ type: OutreachDraftsInput, required: true }) },
    resolve: async (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      return saveOutreachDrafts(
        args.input.transactionId,
        args.input.drafts.map((d) => ({
          investorId: d.investorId,
          personId: d.personId ?? null,
          subject: d.subject,
          body: d.body,
          matchRationale: d.matchRationale,
        })),
      );
    },
  }),
}));
