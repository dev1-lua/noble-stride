// deal-kind.ts — pure conversions between the two deal-kind vocabularies in
// this codebase. Deliberately does NOT import `@prisma/client` (its `DealKind`
// enum) so client components can import this module: `DealKindEnum` is a
// string-literal union with the same string values as the Prisma enum.
//
// `src/server/domain/deals-queue.ts` has its own lowercase `DealKind` union
// ("mandate" | "transaction" | "advisory") for the unified deals queue — that
// module stays Prisma-free too and is NOT to import this file's Prisma-shaped
// enum. These two helpers are the only bridge between the two vocabularies.

export type DealKindEnum = "Mandate" | "Transaction" | "Advisory";

type LowercaseDealKind = "mandate" | "transaction" | "advisory";

const TO_ENUM: Record<LowercaseDealKind, DealKindEnum> = {
  mandate: "Mandate",
  transaction: "Transaction",
  advisory: "Advisory",
};

const FROM_ENUM: Record<DealKindEnum, LowercaseDealKind> = {
  Mandate: "mandate",
  Transaction: "transaction",
  Advisory: "advisory",
};

const HREF_SEGMENT: Record<DealKindEnum, string> = {
  Mandate: "mandates",
  Transaction: "transactions",
  Advisory: "advisory",
};

/** "mandate" | "transaction" | "advisory" -> "Mandate" | "Transaction" | "Advisory" */
export function toDealKindEnum(kind: LowercaseDealKind): DealKindEnum {
  return TO_ENUM[kind];
}

/** "Mandate" | "Transaction" | "Advisory" -> "mandate" | "transaction" | "advisory" */
export function fromDealKindEnum(kind: DealKindEnum): LowercaseDealKind {
  return FROM_ENUM[kind];
}

/** Entity-detail path for a deal, e.g. `dealHref("Transaction", "t1")` -> "/transactions/t1". */
export function dealHref(kind: DealKindEnum, id: string): string {
  return `/${HREF_SEGMENT[kind]}/${id}`;
}
