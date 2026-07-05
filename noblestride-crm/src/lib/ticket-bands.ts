// Deal-size dropdown bands for investor registration. Bands align with the
// client's own "Template to Collect Investor Preferences" check sizes,
// extended upward for the PE/DFI audience. Selecting a band writes
// Investor.ticketMin/ticketMax.

export interface TicketBand {
  key: string;
  label: string;
  min: number;
  /** null = open-ended upper bound */
  max: number | null;
}

export const TICKET_BANDS: TicketBand[] = [
  { key: "lt100k", label: "Under $100k", min: 0, max: 100_000 },
  { key: "100k-250k", label: "$100k – $250k", min: 100_000, max: 250_000 },
  { key: "250k-500k", label: "$250k – $500k", min: 250_000, max: 500_000 },
  { key: "500k-1m", label: "$500k – $1M", min: 500_000, max: 1_000_000 },
  { key: "1m-5m", label: "$1M – $5M", min: 1_000_000, max: 5_000_000 },
  { key: "gt5m", label: "Over $5M", min: 5_000_000, max: null },
];

export function ticketBand(key: string): TicketBand | undefined {
  return TICKET_BANDS.find((b) => b.key === key);
}
