// GraphQL queries for the Noblestride Capital CRM.
// Thin resolvers — each is a one-line call to the matching service.
// Non-Prisma output types are defined here via builder.objectRef + .implement.

import {
  builder,
  MandateStageEnum,
  TransactionStageEnum,
  AdvisoryStageEnum,
  InvestorTypeEnum,
  SectorEnum,
  GeographyEnum,
  InvestorStatusEnum,
  PartnerTypeEnum,
  PartnerStatusEnum,
} from "./builder";
import {
  InvestorRef,
  ClientRef,
  MandateRef,
  TransactionRef,
  AdvisoryEngagementRef,
  EngagementRef,
  PartnerRef,
  ActivityRef,
  DocumentRef,
  SavedViewRef,
  CheckCompanyResultRef,
  StaffResolveResultRef,
  ClientStatusPayloadRef,
  PartnerSelfPayloadRef,
  InvestorIdentityRef,
  InvestorSelfViewRef,
  AgentInvestorMatchRef,
  TeaserContextRef,
} from "./types";
import type { StatValue, DashboardStats, InvestorSegments, Insight } from "@/server/domain/types";
import type { InvestorMatch } from "@/server/domain/ranking";
import type { PartnerReferralStats } from "@/server/services/partners";
import {
  listInvestors,
  countInvestors,
  investorSegments,
  getInvestor,
} from "@/server/services/investors";
import { listClients, getClient } from "@/server/services/clients";
import {
  listMandates,
  mandatesByStage,
  getMandate,
} from "@/server/services/mandates";
import {
  listTransactions,
  transactionsByStage,
  getTransaction,
} from "@/server/services/transactions";
import {
  listAdvisory,
  advisoryByStage,
  getAdvisory,
} from "@/server/services/advisory";
import { engagementsByDeal, getEngagement } from "@/server/services/engagements";
import { listDocuments, getDocument } from "@/server/services/documents";
import { listPartners, getPartner, partnerReferralStats } from "@/server/services/partners";
import { dashboardStats, pipelineOverview, dealPipelineTrend } from "@/server/services/dashboard";
import { aiOverviewInsights, aiMatchInvestors, aiFindProspects, aiAsk } from "@/server/services/ai";
import { listSavedViews } from "@/server/services/saved-views";
import { unreadFor, unreadCountFor } from "@/server/services/notifications";
import { getOrgLens } from "@/server/rbac/context";
import { globalSearch, type SearchResult } from "@/server/search/global-search";
import { assertAutomation } from "@/server/rbac/enforce";
import { checkCompany } from "@/server/services/client-intake";
import { getClientStatus } from "@/server/services/client-status";
import { partnerSelfView } from "@/server/services/partner-self";
import { resolveStaffUserSummary } from "@/server/services/agent-delegation";
import {
  investorByEmail,
  investorSelfView,
  matchInvestorsForTransaction,
  transactionTeaserContext,
} from "@/server/services/investor-agent";

// ── Input types ───────────────────────────────────────────────────────────────

const InvestorFilterInput = builder.inputType("InvestorFilter", {
  fields: (t) => ({
    investorType: t.field({ type: InvestorTypeEnum, required: false }),
    sector: t.field({ type: SectorEnum, required: false }),
    geography: t.field({ type: GeographyEnum, required: false }),
    status: t.field({ type: InvestorStatusEnum, required: false }),
    ticketMin: t.float({ required: false }),
    ticketMax: t.float({ required: false }),
    search: t.string({ required: false }),
  }),
});

const MandateFilterInput = builder.inputType("MandateFilter", {
  fields: (t) => ({
    stage: t.field({ type: MandateStageEnum, required: false }),
    clientId: t.id({ required: false }),
  }),
});

const TransactionFilterInput = builder.inputType("TransactionFilter", {
  fields: (t) => ({
    stage: t.field({ type: TransactionStageEnum, required: false }),
    clientId: t.id({ required: false }),
  }),
});

const AdvisoryFilterInput = builder.inputType("AdvisoryFilter", {
  fields: (t) => ({
    stage: t.field({ type: AdvisoryStageEnum, required: false }),
    clientId: t.id({ required: false }),
  }),
});

const PartnerFilterInput = builder.inputType("PartnerFilter", {
  fields: (t) => ({
    partnerType: t.field({ type: PartnerTypeEnum, required: false }),
    status: t.field({ type: PartnerStatusEnum, required: false }),
  }),
});

// ── Non-Prisma output objectRefs ──────────────────────────────────────────────

// StatValue
const StatValueRef = builder.objectRef<StatValue>("StatValue").implement({
  fields: (t) => ({
    value: t.exposeFloat("value"),
    delta: t.exposeFloat("delta"),
  }),
});

// DashboardStats
const DashboardStatsRef = builder.objectRef<DashboardStats>("DashboardStats").implement({
  fields: (t) => ({
    activeMandates: t.field({ type: StatValueRef, resolve: (s) => s.activeMandates }),
    activeTransactions: t.field({ type: StatValueRef, resolve: (s) => s.activeTransactions }),
    investorsEngagedQtr: t.field({ type: StatValueRef, resolve: (s) => s.investorsEngagedQtr }),
    capitalRaisedYtd: t.field({ type: StatValueRef, resolve: (s) => s.capitalRaisedYtd }),
  }),
});

// InvestorSegments
const InvestorSegmentsRef = builder.objectRef<InvestorSegments>("InvestorSegments").implement({
  fields: (t) => ({
    total: t.exposeInt("total"),
    activeThisQuarter: t.exposeInt("activeThisQuarter"),
    privateEquity: t.exposeInt("privateEquity"),
    ventureCapital: t.exposeInt("ventureCapital"),
    dfi: t.exposeInt("dfi"),
    debtProvider: t.exposeInt("debtProvider"),
  }),
});

// StageCount — typed from pipelineOverview return shape
type StageCount = Awaited<ReturnType<typeof pipelineOverview>>["mandatesByStage"][number];
const StageCountRef = builder.objectRef<StageCount>("StageCount").implement({
  fields: (t) => ({
    stage: t.exposeString("stage"),
    label: t.exposeString("label"),
    count: t.exposeInt("count"),
  }),
});

// PipelineOverview
type PipelineOverviewType = Awaited<ReturnType<typeof pipelineOverview>>;
const PipelineOverviewRef = builder.objectRef<PipelineOverviewType>("PipelineOverview").implement({
  fields: (t) => ({
    mandatesByStage: t.field({ type: [StageCountRef], resolve: (o) => o.mandatesByStage }),
    transactionsByStage: t.field({ type: [StageCountRef], resolve: (o) => o.transactionsByStage }),
  }),
});

// PipelineTrendPoint
type PipelineTrendPoint = Awaited<ReturnType<typeof dealPipelineTrend>>[number];
const PipelineTrendPointRef = builder.objectRef<PipelineTrendPoint>("PipelineTrendPoint").implement({
  fields: (t) => ({
    month: t.exposeString("month"),
    active: t.exposeInt("active"),
    closed: t.exposeInt("closed"),
  }),
});

// MandateStageColumn
type MandateStageColumn = Awaited<ReturnType<typeof mandatesByStage>>[number];
const MandateStageColumnRef = builder.objectRef<MandateStageColumn>("MandateStageColumn").implement({
  fields: (t) => ({
    stage: t.exposeString("stage"),
    label: t.exposeString("label"),
    items: t.field({ type: [MandateRef], resolve: (c) => c.items }),
  }),
});

// TransactionStageColumn
type TransactionStageColumn = Awaited<ReturnType<typeof transactionsByStage>>[number];
const TransactionStageColumnRef = builder.objectRef<TransactionStageColumn>("TransactionStageColumn").implement({
  fields: (t) => ({
    stage: t.exposeString("stage"),
    label: t.exposeString("label"),
    items: t.field({ type: [TransactionRef], resolve: (c) => c.items }),
  }),
});

// AdvisoryStageColumn
type AdvisoryStageColumn = Awaited<ReturnType<typeof advisoryByStage>>[number];
const AdvisoryStageColumnRef = builder.objectRef<AdvisoryStageColumn>("AdvisoryStageColumn").implement({
  fields: (t) => ({
    stage: t.exposeString("stage"),
    label: t.exposeString("label"),
    items: t.field({ type: [AdvisoryEngagementRef], resolve: (c) => c.items }),
  }),
});

// EngagementsByDeal
type EngagementsByDealItem = Awaited<ReturnType<typeof engagementsByDeal>>[number];
const EngagementsByDealRef = builder.objectRef<EngagementsByDealItem>("EngagementsByDeal").implement({
  fields: (t) => ({
    transaction: t.field({ type: TransactionRef, resolve: (e) => e.transaction }),
    engagements: t.field({ type: [EngagementRef], resolve: (e) => e.engagements }),
  }),
});

// PartnerReferralRow
type PartnerReferralRow = PartnerReferralStats["byPartner"][number];
const PartnerReferralRowRef = builder.objectRef<PartnerReferralRow>("PartnerReferralRow").implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    name: t.exposeString("name"),
    referred: t.exposeInt("referred"),
    active: t.exposeInt("active"),
    closed: t.exposeInt("closed"),
    revenue: t.exposeFloat("revenue"),
  }),
});

// PartnerReferralStats
const PartnerReferralStatsRef = builder.objectRef<PartnerReferralStats>("PartnerReferralStats").implement({
  fields: (t) => ({
    totalPartners: t.exposeInt("totalPartners"),
    dealsReferred: t.exposeInt("dealsReferred"),
    closedRevenue: t.exposeFloat("closedRevenue"),
    conversionRate: t.exposeFloat("conversionRate"),
    byPartner: t.field({ type: [PartnerReferralRowRef], resolve: (s) => s.byPartner }),
  }),
});

// Insight
const InsightRef = builder.objectRef<Insight>("Insight").implement({
  fields: (t) => ({
    kind: t.exposeString("kind"),
    title: t.exposeString("title"),
    detail: t.exposeString("detail"),
  }),
});

// InvestorMatch
const InvestorMatchRef = builder.objectRef<InvestorMatch>("InvestorMatch").implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    score: t.exposeFloat("score"),
    reasons: t.exposeStringList("reasons"),
    warnings: t.exposeStringList("warnings"),
    contactName: t.exposeString("contactName", { nullable: true }),
    criteriaStale: t.exposeBoolean("criteriaStale"),
  }),
});

// Prospect
type Prospect = Awaited<ReturnType<typeof aiFindProspects>>[number];
const ProspectRef = builder.objectRef<Prospect>("Prospect").implement({
  fields: (t) => ({
    name: t.exposeString("name"),
    sector: t.exposeString("sector"),
    rationale: t.exposeString("rationale"),
  }),
});

// AiAnswer
type AiAnswer = Awaited<ReturnType<typeof aiAsk>>;
const AiAnswerRef = builder.objectRef<AiAnswer>("AiAnswer").implement({
  fields: (t) => ({
    answer: t.exposeString("answer"),
    sources: t.exposeStringList("sources"),
  }),
});

// SearchResult (Task C: global search) — plain service-shaped output, same
// non-Prisma-objectRef convention as the refs above.
const SearchResultRef = builder.objectRef<SearchResult>("SearchResult").implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    type: t.exposeString("type"),
    title: t.exposeString("title"),
    subtitle: t.exposeString("subtitle", { nullable: true }),
    href: t.exposeString("href"),
  }),
});

// Suppress unused-variable warnings — refs are used by Pothos at runtime via registration
void InvestorRef;
void ClientRef;
void PartnerRef;
void ActivityRef;
void DocumentRef;

// ── Query fields ──────────────────────────────────────────────────────────────

builder.queryFields((t) => ({
  // 1. investors(filter, page, pageSize): [Investor]
  investors: t.prismaField({
    type: ["Investor"],
    nullable: false,
    args: {
      filter: t.arg({ type: InvestorFilterInput, required: false }),
      page: t.arg.int({ required: false }),
      pageSize: t.arg.int({ required: false }),
    },
    resolve: (_query, _root, args) =>
      listInvestors(
        {
          investorType: args.filter?.investorType ?? undefined,
          sector: args.filter?.sector ?? undefined,
          geography: args.filter?.geography ?? undefined,
          status: args.filter?.status ?? undefined,
          ticketMin: args.filter?.ticketMin ?? undefined,
          ticketMax: args.filter?.ticketMax ?? undefined,
          search: args.filter?.search ?? undefined,
        },
        args.page != null && args.pageSize != null
          ? { page: args.page, pageSize: args.pageSize }
          : undefined
      ),
  }),

  // 2. investorsCount(filter): Int
  investorsCount: t.field({
    type: "Int",
    args: {
      filter: t.arg({ type: InvestorFilterInput, required: false }),
    },
    resolve: (_root, args) =>
      countInvestors({
        investorType: args.filter?.investorType ?? undefined,
        sector: args.filter?.sector ?? undefined,
        geography: args.filter?.geography ?? undefined,
        status: args.filter?.status ?? undefined,
        ticketMin: args.filter?.ticketMin ?? undefined,
        ticketMax: args.filter?.ticketMax ?? undefined,
        search: args.filter?.search ?? undefined,
      }),
  }),

  // 3. investorSegments: InvestorSegments
  investorSegments: t.field({
    type: InvestorSegmentsRef,
    resolve: () => investorSegments(),
  }),

  // 4. investor(id: ID!): Investor (nullable)
  investor: t.prismaField({
    type: "Investor",
    nullable: true,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: (_query, _root, args) => getInvestor(args.id),
  }),

  // 5. clients: [Client]
  clients: t.prismaField({
    type: ["Client"],
    nullable: false,
    resolve: () => listClients(),
  }),

  // 6. client(id: ID!): Client (nullable)
  client: t.prismaField({
    type: "Client",
    nullable: true,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: (_query, _root, args) => getClient(args.id),
  }),

  // 7. mandates(filter): [Mandate]
  mandates: t.prismaField({
    type: ["Mandate"],
    nullable: false,
    args: {
      filter: t.arg({ type: MandateFilterInput, required: false }),
    },
    resolve: (_query, _root, args) =>
      listMandates(
        args.filter != null
          ? { stage: args.filter.stage ?? undefined, clientId: args.filter.clientId ?? undefined }
          : undefined
      ),
  }),

  // 8. mandatesByStage: [MandateStageColumn]
  mandatesByStage: t.field({
    type: [MandateStageColumnRef],
    resolve: () => mandatesByStage(),
  }),

  // 9. mandate(id: ID!): Mandate (nullable)
  mandate: t.prismaField({
    type: "Mandate",
    nullable: true,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: (_query, _root, args) => getMandate(args.id),
  }),

  // 9b. advisory pipeline queries
  advisoryEngagements: t.prismaField({
    type: ["AdvisoryEngagement"],
    nullable: false,
    args: {
      filter: t.arg({ type: AdvisoryFilterInput, required: false }),
    },
    resolve: (_query, _root, args) =>
      listAdvisory(
        args.filter != null
          ? { stage: args.filter.stage ?? undefined, clientId: args.filter.clientId ?? undefined }
          : undefined
      ),
  }),
  advisoryByStage: t.field({
    type: [AdvisoryStageColumnRef],
    resolve: () => advisoryByStage(),
  }),
  advisoryEngagement: t.prismaField({
    type: "AdvisoryEngagement",
    nullable: true,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: (_query, _root, args) => getAdvisory(args.id),
  }),

  // 10. transactions(filter): [Transaction]
  transactions: t.prismaField({
    type: ["Transaction"],
    nullable: false,
    args: {
      filter: t.arg({ type: TransactionFilterInput, required: false }),
    },
    resolve: (_query, _root, args) =>
      listTransactions(
        args.filter != null
          ? { stage: args.filter.stage ?? undefined, clientId: args.filter.clientId ?? undefined }
          : undefined
      ),
  }),

  // 11. transactionsByStage: [TransactionStageColumn]
  transactionsByStage: t.field({
    type: [TransactionStageColumnRef],
    resolve: () => transactionsByStage(),
  }),

  // 12. transaction(id: ID!): Transaction (nullable)
  transaction: t.prismaField({
    type: "Transaction",
    nullable: true,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: (_query, _root, args) => getTransaction(args.id),
  }),

  // 13. engagementsByDeal: [EngagementsByDeal]
  engagementsByDeal: t.field({
    type: [EngagementsByDealRef],
    resolve: () => engagementsByDeal(),
  }),

  // 14. engagement(id: ID!): Engagement (nullable)
  engagement: t.prismaField({
    type: "Engagement",
    nullable: true,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: (_query, _root, args) => getEngagement(args.id),
  }),

  // 15. partners(filter): [Partner]
  partners: t.prismaField({
    type: ["Partner"],
    nullable: false,
    args: {
      filter: t.arg({ type: PartnerFilterInput, required: false }),
    },
    resolve: (_query, _root, args) =>
      listPartners(
        args.filter != null
          ? { partnerType: args.filter.partnerType ?? undefined, status: args.filter.status ?? undefined }
          : undefined
      ),
  }),

  // 16. partner(id: ID!): Partner (nullable)
  partner: t.prismaField({
    type: "Partner",
    nullable: true,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: (_query, _root, args) => getPartner(args.id),
  }),

  // 16b. documents(transactionId, clientId, investorId): [Document]
  documents: t.prismaField({
    type: ["Document"],
    nullable: false,
    args: {
      transactionId: t.arg.id({ required: false }),
      clientId: t.arg.id({ required: false }),
      investorId: t.arg.id({ required: false }),
      mandateId: t.arg.id({ required: false }),
    },
    resolve: (_query, _root, args) =>
      listDocuments({
        transactionId: args.transactionId ?? undefined,
        clientId: args.clientId ?? undefined,
        investorId: args.investorId ?? undefined,
        mandateId: args.mandateId ?? undefined,
      }),
  }),

  // 16c. document(id: ID!): Document (nullable)
  document: t.prismaField({
    type: "Document",
    nullable: true,
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: (_query, _root, args) => getDocument(args.id),
  }),

  // 17. partnerReferralStats: PartnerReferralStats
  partnerReferralStats: t.field({
    type: PartnerReferralStatsRef,
    resolve: () => partnerReferralStats(),
  }),

  // 18. dashboardStats: DashboardStats
  dashboardStats: t.field({
    type: DashboardStatsRef,
    resolve: () => dashboardStats(),
  }),

  // 19. pipelineOverview: PipelineOverview
  pipelineOverview: t.field({
    type: PipelineOverviewRef,
    resolve: () => pipelineOverview(),
  }),

  // 20. dealPipelineTrend: [PipelineTrendPoint]
  dealPipelineTrend: t.field({
    type: [PipelineTrendPointRef],
    resolve: () => dealPipelineTrend(),
  }),

  // 21. aiOverviewInsights: [Insight]
  aiOverviewInsights: t.field({
    type: [InsightRef],
    resolve: () => aiOverviewInsights(),
  }),

  // 22. aiMatchInvestors(transactionId: ID!): [InvestorMatch]
  aiMatchInvestors: t.field({
    type: [InvestorMatchRef],
    args: {
      transactionId: t.arg.id({ required: true }),
    },
    resolve: (_root, args) => aiMatchInvestors(args.transactionId),
  }),

  // 23. aiFindProspects(mandateId: ID!): [Prospect]
  aiFindProspects: t.field({
    type: [ProspectRef],
    args: {
      mandateId: t.arg.id({ required: true }),
    },
    resolve: (_root, args) => aiFindProspects(args.mandateId),
  }),

  // 24. aiAsk(question: String!): AiAnswer
  aiAsk: t.field({
    type: AiAnswerRef,
    args: {
      question: t.arg.string({ required: true }),
    },
    resolve: (_root, args) => aiAsk(args.question),
  }),

  // 25. savedViews(entity: String): [SavedView] — team-shared deals-queue views
  savedViews: t.field({
    type: [SavedViewRef],
    args: {
      entity: t.arg.string({ required: false }),
    },
    resolve: (_root, args) => listSavedViews(args.entity ?? undefined),
  }),

  // 26. myUnreadNotifications: [Notification] — latest 15 unread for the
  // current in-org lens user (Task 14 bell). Demo-lens mode: when the lens
  // has no resolved userId (Admin fallback), resolves to [] rather than
  // fetching for all users.
  myUnreadNotifications: t.prismaField({
    type: ["Notification"],
    nullable: false,
    resolve: async () => {
      const lens = await getOrgLens();
      if (!lens.userId) return [];
      return unreadFor(lens.userId, 15);
    },
  }),

  // 27. myUnreadNotificationCount: Int — badge count for the bell, same
  // demo-lens fallback as myUnreadNotifications.
  myUnreadNotificationCount: t.field({
    type: "Int",
    resolve: async () => {
      const lens = await getOrgLens();
      if (!lens.userId) return 0;
      return unreadCountFor(lens.userId);
    },
  }),

  // 28. globalSearch(query, limit): [SearchResult!]! — Task C. The viewer is
  // read from ctx.actor (never a client-supplied id); see
  // server/search/global-search.ts for the investor-vs-internal branching
  // and the visibility guarantees.
  globalSearch: t.field({
    type: [SearchResultRef],
    args: {
      query: t.arg.string({ required: true }),
      limit: t.arg.int({ required: false }),
    },
    resolve: (_root, args, ctx) => globalSearch(ctx.actor, args.query, args.limit ?? undefined),
  }),

  // Client Agent (SOW §8.1): existence probe for the public web-chat agent.
  // Automation-only; returns a 3-value enum and nothing else, by design.
  checkCompany: t.field({
    type: CheckCompanyResultRef,
    nullable: false,
    args: {
      name: t.arg.string({ required: true }),
      contactEmail: t.arg.string({ required: false }),
    },
    resolve: (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      return checkCompany(args.name, args.contactEmail ?? undefined);
    },
  }),

  // Lua front-desk gate (crmAgent data-in): verifies a staff email before the
  // agent hands off a conversation. Automation-only; no enumeration in the result.
  resolveStaffUser: t.field({
    type: StaffResolveResultRef,
    nullable: false,
    args: {
      email: t.arg.string({ required: true }),
    },
    resolve: (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      return resolveStaffUserSummary(args.email);
    },
  }),

  // Client status flow (spec 2026-07-14): trades a short-lived status token
  // (minted by verifyClientStatusOtp) for the hard-whitelisted status payload.
  // Automation-only; CrudError("Verification expired…") on a bad/expired token
  // passes through mask-error like every other resolver.
  clientStatus: t.field({
    type: ClientStatusPayloadRef,
    nullable: false,
    args: {
      token: t.arg.string({ required: true }),
    },
    resolve: (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      return getClientStatus(args.token);
    },
  }),

  // Partner self-service (SOW §7.2): trade a verified partner-self token for the
  // hard-whitelisted own-record view (own contact/agreement + own referred deals).
  partnerSelfView: t.field({
    type: PartnerSelfPayloadRef,
    nullable: false,
    args: { token: t.arg.string({ required: true }) },
    resolve: (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      return partnerSelfView(args.token);
    },
  }),

  // Investor Agent (spec 2026-07-14): identity match for inbound email routing.
  investorByEmail: t.field({
    type: InvestorIdentityRef,
    nullable: false,
    args: { email: t.arg.string({ required: true }) },
    resolve: (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      return investorByEmail(args.email);
    },
  }),
  // Investor Agent: the investor's OWN whitelisted profile (spec §7.2 "own profile").
  investorSelfView: t.field({
    type: InvestorSelfViewRef,
    nullable: false,
    args: { email: t.arg.string({ required: true }) },
    resolve: (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      return investorSelfView(args.email);
    },
  }),
  // Investor Agent: eligible investors for a deal (internal-only data; feeds drafts).
  matchInvestorsForTransaction: t.field({
    type: [AgentInvestorMatchRef],
    nullable: false,
    args: { transactionId: t.arg.string({ required: true }) },
    resolve: (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      return matchInvestorsForTransaction(args.transactionId);
    },
  }),
  // Investor Agent: the ONLY deal read the agent has — PRE_INTEREST projection.
  transactionTeaserContext: t.field({
    type: TeaserContextRef,
    nullable: false,
    args: { transactionId: t.arg.string({ required: true }) },
    resolve: (_root, args, ctx) => {
      assertAutomation(ctx.actor);
      return transactionTeaserContext(args.transactionId);
    },
  }),
}));
