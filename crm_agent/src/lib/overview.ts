// Org-level view of the CRM (F5.3, image20).
//
// The client asked two questions this agent could not answer: "what is the main
// function of this CRM" and "how many opportunities are in the pipeline".
// summarize_record answers about one record and analyze_pipeline returns a
// narrative; neither gives a total, and — more importantly — neither says what
// an "opportunity" is. That ambiguity is the real reason the question was asked,
// so the definition ships with the number.
//
// Pure: no CrmClient, no AI. The tool layer fetches; this shapes and renders.

export interface StatValue {
  value: number;
  delta: number;
}

export interface StageCount {
  stage: string;
  label: string;
  count: number;
}

export interface OverviewRaw {
  dashboardStats: {
    activeMandates: StatValue;
    activeTransactions: StatValue;
    investorsEngagedQtr: StatValue;
    capitalRaisedYtd: StatValue;
  };
  pipelineOverview: {
    mandatesByStage: StageCount[];
    transactionsByStage: StageCount[];
  };
  investorsCount: number;
}

export interface OverviewShape {
  definition: string;
  opportunities: {
    total: number;
    mandates: number;
    transactions: number;
    activeMandates: number;
    activeTransactions: number;
  };
  investors: { total: number; engagedThisQuarter: number };
  capitalRaisedYtd: number;
  /** Up to five stages with a non-zero count, biggest first. */
  topStages: { label: string; count: number; pipeline: "mandates" | "transactions" }[];
}

/**
 * What "opportunity" means here, in the CRM's own terms. Stated with every total
 * so the number cannot be read as covering advisory work, which is tracked
 * separately.
 */
export const OPPORTUNITY_DEFINITION =
  "An opportunity here is one record in a deal pipeline: a Mandate (winning and setting up a client to advise) or a Transaction (running that client's raise). Advisory assignments are tracked separately and are not counted in this total.";

const num = (v: number | null | undefined): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const stat = (s: StatValue | null | undefined): number => num(s?.value);
const stages = (rows: StageCount[] | null | undefined): StageCount[] => (Array.isArray(rows) ? rows : []);
const sum = (rows: StageCount[]): number => rows.reduce((t, r) => t + num(r.count), 0);

export function shapeOverview(raw: OverviewRaw): OverviewShape {
  const mandateStages = stages(raw.pipelineOverview?.mandatesByStage);
  const transactionStages = stages(raw.pipelineOverview?.transactionsByStage);
  const mandates = sum(mandateStages);
  const transactions = sum(transactionStages);

  const topStages = [
    ...mandateStages.map((r) => ({ label: r.label, count: num(r.count), pipeline: "mandates" as const })),
    ...transactionStages.map((r) => ({ label: r.label, count: num(r.count), pipeline: "transactions" as const })),
  ]
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    definition: OPPORTUNITY_DEFINITION,
    opportunities: {
      total: mandates + transactions,
      mandates,
      transactions,
      // From dashboardStats: PipelineOverview's GraphQL type exposes only the
      // stage arrays, not the service's mandatesActive/transactionsActive.
      activeMandates: stat(raw.dashboardStats?.activeMandates),
      activeTransactions: stat(raw.dashboardStats?.activeTransactions),
    },
    investors: {
      total: num(raw.investorsCount),
      engagedThisQuarter: stat(raw.dashboardStats?.investorsEngagedQtr),
    },
    capitalRaisedYtd: stat(raw.dashboardStats?.capitalRaisedYtd),
    topStages,
  };
}

const group = (n: number): string => n.toLocaleString("en-US");

/** USD, whole dollars, grouped. Spelled with a code rather than a symbol so the
 *  postprocessor's currency rules and the persona's formatting agree. */
function money(n: number): string {
  return `USD ${group(Math.round(n))}`;
}

/** 3 to 6 lines, each metric on its own line with a bold label (persona rules). */
export function renderOverview(shape: OverviewShape, link: string): string {
  const o = shape.opportunities;
  const lines = [
    "This CRM is Noblestride's single record for winning clients, running their fundraises, and managing investor relationships.",
    `**Opportunities:** ${group(o.total)} opportunities in total, ${group(o.mandates)} mandates and ${group(o.transactions)} transactions, of which ${group(o.activeMandates + o.activeTransactions)} are active. ${shape.definition}`,
    `**Investors:** ${group(shape.investors.total)} on file, ${group(shape.investors.engagedThisQuarter)} engaged this quarter. **Capital raised year to date:** ${money(shape.capitalRaisedYtd)}.`,
  ];

  if (shape.topStages.length > 0) {
    lines.push(
      `**Biggest stages:** ${shape.topStages
        .map((s) => `${s.label} ${group(s.count)} (${s.pipeline})`)
        .join(", ")}.`,
    );
  }

  lines.push(`Full dashboard: ${link}`);
  return lines.join("\n");
}
