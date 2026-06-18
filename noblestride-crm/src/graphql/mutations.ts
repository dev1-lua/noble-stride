// GraphQL mutations for the NobleStride Capital CRM.
// Thin resolvers — each is a one-line call to the matching service.

import { builder, MandateStageEnum, TransactionStageEnum, InteractionTypeEnum } from "./builder";
import { setMandateStage } from "@/server/services/mandates";
import { setTransactionStage } from "@/server/services/transactions";
import { logEngagement } from "@/server/services/engagements";

builder.mutationFields((t) => ({
  // 1. updateMandateStage(id: ID!, stage: MandateStage!): Mandate
  updateMandateStage: t.prismaField({
    type: "Mandate",
    nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      stage: t.arg({ type: MandateStageEnum, required: true }),
    },
    resolve: (_query, _root, args) => setMandateStage(args.id, args.stage),
  }),

  // 2. updateTransactionStage(id: ID!, stage: TransactionStage!): Transaction
  updateTransactionStage: t.prismaField({
    type: "Transaction",
    nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      stage: t.arg({ type: TransactionStageEnum, required: true }),
    },
    resolve: (_query, _root, args) => setTransactionStage(args.id, args.stage),
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
    },
    resolve: (_query, _root, args) =>
      logEngagement({
        transactionId: args.transactionId,
        investorId: args.investorId,
        type: args.type,
        subject: args.subject ?? undefined,
        body: args.body ?? undefined,
      }),
  }),
}));
