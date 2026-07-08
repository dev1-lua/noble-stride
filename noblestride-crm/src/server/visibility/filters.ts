// Visibility engine — investor-side opportunity filters (SPEC §11.1).
// Pure narrowing over already-gated candidates: filters can only REDUCE what
// discovery/tier gating produced, never widen it. Parsing is defensive —
// anything invalid is simply ignored (unfiltered, still gated).

import { DealType, Geography, Instrument, Sector } from "@prisma/client";
import type { DealInput } from "./project";
import { toNum } from "./project";

export interface OpportunityFilters {
  sector?: Sector;
  country?: Geography;
  dealType?: DealType;
  instrument?: Instrument;
  ticketMin?: number;
  ticketMax?: number;
  revenueMin?: number;
  revenueMax?: number;
  ebitdaMin?: number;
  ebitdaMax?: number;
  netProfitMin?: number;
  netProfitMax?: number;
  womenLed?: boolean;
  youthLed?: boolean;
}

export function applyOpportunityFilters<T extends DealInput>(deals: T[], f: OpportunityFilters): T[] {
  return deals.filter((deal) => {
    const client = deal.client ?? null;
    if (f.sector) {
      const sectors = [...(deal.sector ?? []), ...(client?.sector ?? [])];
      if (!sectors.includes(f.sector)) return false;
    }
    if (f.country && !(client?.countries ?? []).includes(f.country)) return false;
    if (f.dealType && deal.dealType !== f.dealType) return false;
    if (f.instrument && !(deal.instrument ?? []).includes(f.instrument)) return false;
    const raise = toNum(deal.targetRaise);
    if (f.ticketMin != null && (raise == null || raise < f.ticketMin)) return false;
    if (f.ticketMax != null && (raise == null || raise > f.ticketMax)) return false;
    const revenue = toNum(client?.revenueLastYear);
    if (f.revenueMin != null && (revenue == null || revenue < f.revenueMin)) return false;
    if (f.revenueMax != null && (revenue == null || revenue > f.revenueMax)) return false;
    const ebitda = toNum(client?.ebitda);
    if (f.ebitdaMin != null && (ebitda == null || ebitda < f.ebitdaMin)) return false;
    if (f.ebitdaMax != null && (ebitda == null || ebitda > f.ebitdaMax)) return false;
    const netProfit = toNum(client?.netProfit);
    if (f.netProfitMin != null && (netProfit == null || netProfit < f.netProfitMin)) return false;
    if (f.netProfitMax != null && (netProfit == null || netProfit > f.netProfitMax)) return false;
    if (f.womenLed && !(client?.impactFlags ?? []).includes("WomenLed")) return false;
    if (f.youthLed && !(client?.impactFlags ?? []).includes("YouthLed")) return false;
    return true;
  });
}

type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function parseEnum<T extends Record<string, string>>(enumObj: T, v: string | undefined): T[keyof T] | undefined {
  return v != null && Object.values(enumObj).includes(v) ? (v as T[keyof T]) : undefined;
}

function parseNum(v: string | undefined): number | undefined {
  if (v == null || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Parse URL searchParams into filters, dropping anything invalid. */
export function parseOpportunityFilters(params: RawParams): OpportunityFilters {
  const f: OpportunityFilters = {};
  const sector = parseEnum(Sector, first(params.sector));
  if (sector) f.sector = sector;
  const country = parseEnum(Geography, first(params.country));
  if (country) f.country = country;
  const dealType = parseEnum(DealType, first(params.dealType));
  if (dealType) f.dealType = dealType;
  const instrument = parseEnum(Instrument, first(params.instrument));
  if (instrument) f.instrument = instrument;
  const ticketMin = parseNum(first(params.ticketMin));
  if (ticketMin != null) f.ticketMin = ticketMin;
  const ticketMax = parseNum(first(params.ticketMax));
  if (ticketMax != null) f.ticketMax = ticketMax;
  const revenueMin = parseNum(first(params.revenueMin));
  if (revenueMin != null) f.revenueMin = revenueMin;
  const revenueMax = parseNum(first(params.revenueMax));
  if (revenueMax != null) f.revenueMax = revenueMax;
  const ebitdaMin = parseNum(first(params.ebitdaMin));
  if (ebitdaMin != null) f.ebitdaMin = ebitdaMin;
  const ebitdaMax = parseNum(first(params.ebitdaMax));
  if (ebitdaMax != null) f.ebitdaMax = ebitdaMax;
  const netProfitMin = parseNum(first(params.netProfitMin));
  if (netProfitMin != null) f.netProfitMin = netProfitMin;
  const netProfitMax = parseNum(first(params.netProfitMax));
  if (netProfitMax != null) f.netProfitMax = netProfitMax;
  if (first(params.womenLed) === "1") f.womenLed = true;
  if (first(params.youthLed) === "1") f.youthLed = true;
  return f;
}
