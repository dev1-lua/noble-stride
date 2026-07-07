// prisma/demo-financials.ts — single source of truth for demo financial values
// (client HQ/revenue, mandate deal size, investor ticket range) so the seed
// (fresh DBs) and the backfill script (existing DB) never diverge. Plain
// literal data only — no Math.random, so re-running either consumer is
// deterministic and idempotent.

export interface ClientFinancials {
  hqCity: string;
  hqCountry: string;
  revenueLastYear: number; // USD
}

// Keyed by Client.name (prisma/seed-data.json `clients[].name`).
// East-Africa-context HQ cities, revenue plausible per sector ($0.5M–$50M).
export const CLIENT_FINANCIALS: Record<string, ClientFinancials> = {
  "Atilla Poultry Farm": { hqCity: "Nairobi", hqCountry: "Kenya", revenueLastYear: 4_200_000 },
  "Bid Apartments": { hqCity: "Kampala", hqCountry: "Uganda", revenueLastYear: 6_800_000 },
  "CESP Africa": { hqCity: "Dar es Salaam", hqCountry: "Tanzania", revenueLastYear: 12_500_000 },
  "Camino Ruiz": { hqCity: "Kigali", hqCountry: "Rwanda", revenueLastYear: 9_300_000 },
  "City Health Hospital (Prodigy)": { hqCity: "Lagos", hqCountry: "Nigeria", revenueLastYear: 15_000_000 },
  "Chipori Ltd (Sabor A' Mexico)": { hqCity: "Accra", hqCountry: "Ghana", revenueLastYear: 3_100_000 },
  "Mwendo delivery Limited": { hqCity: "Nairobi", hqCountry: "Kenya", revenueLastYear: 2_400_000 },
  "Study Buddy": { hqCity: "Kampala", hqCountry: "Uganda", revenueLastYear: 1_100_000 },
  "Akili Kids": { hqCity: "Dar es Salaam", hqCountry: "Tanzania", revenueLastYear: 850_000 },
  "Muhindi Mweusi Supermarket": { hqCity: "Lagos", hqCountry: "Nigeria", revenueLastYear: 5_600_000 },
  "Dr Arunga's Eye Hospital": { hqCity: "Nairobi", hqCountry: "Kenya", revenueLastYear: 2_900_000 },
  "Ewaka": { hqCity: "Kigali", hqCountry: "Rwanda", revenueLastYear: 1_750_000 },
  "Farmacie Limited": { hqCity: "Accra", hqCountry: "Ghana", revenueLastYear: 3_400_000 },
  "Arinifu": { hqCity: "Kampala", hqCountry: "Uganda", revenueLastYear: 2_100_000 },
  "Bicross Heart Solutions": { hqCity: "Lagos", hqCountry: "Nigeria", revenueLastYear: 1_950_000 },
  "Danjade": { hqCity: "Dar es Salaam", hqCountry: "Tanzania", revenueLastYear: 1_300_000 },
  "A G Energies": { hqCity: "Nairobi", hqCountry: "Kenya", revenueLastYear: 900_000 },
  "Deccan College": { hqCity: "Kigali", hqCountry: "Rwanda", revenueLastYear: 650_000 },
  "Eco foods and Cereals Uganda": { hqCity: "Kampala", hqCountry: "Uganda", revenueLastYear: 1_050_000 },
  "Jeen Mata Microfinance": { hqCity: "Accra", hqCountry: "Ghana", revenueLastYear: 4_700_000 },
};

// Keyed by Mandate.name (prisma/seed-data.json `clients[].mandate.name`).
// USD, $1M–$20M, plausible per sector/stage.
export const MANDATE_DEAL_SIZES: Record<string, number> = {
  "Atilla Poultry Farm – Capital Raise": 3_500_000,
  "Bid Apartments – Capital Raise": 6_000_000,
  "CESP Africa – Capital Raise": 10_000_000,
  "Camino Ruiz – Capital Raise": 8_500_000,
  "City Health Hospital (Prodigy) – Capital Raise": 12_000_000,
  "Chipori Ltd (Sabor A' Mexico) – Capital Raise": 2_800_000,
  "Mwendo delivery Limited – Capital Raise": 2_200_000,
  "Study Buddy – Capital Raise": 1_500_000,
  "Akili Kids – Capital Raise": 1_200_000,
  "Muhindi Mweusi Supermarket – Capital Raise": 4_500_000,
  "Dr Arunga's Eye Hospital – Capital Raise": 2_600_000,
  "Ewaka – Capital Raise": 1_800_000,
  "Farmacie Limited – Capital Raise": 3_200_000,
  "Arinifu – Capital Raise": 2_000_000,
  "Bicross Heart Solutions – Capital Raise": 1_700_000,
  "Danjade – Capital Raise": 1_400_000,
  "A G Energies – Capital Raise": 1_100_000,
  "Deccan College – Capital Raise": 1_000_000,
  "Eco foods and Cereals Uganda – Capital Raise": 1_300_000,
  "Jeen Mata Microfinance – Capital Raise": 5_000_000,
};

export interface InvestorTicket {
  ticketMin: number;
  ticketMax: number;
}

// Keyed by Investor.name (prisma/seed-data.json `investors[].name`). Only
// investors whose ticketMin AND ticketMax are BOTH null in seed-data.json —
// investors that already carry a value (e.g. Abraaj Group) are left intact.
// Bands: PE $5M–$50M, DFI $10M–$100M, Debt $1M–$20M, VC $0.5M–$5M.
export const INVESTOR_TICKETS: Record<string, InvestorTicket> = {
  // DFI
  IFC: { ticketMin: 25_000_000, ticketMax: 75_000_000 },
  "Bio invest Belgian Investment Company for Developing Countries SA/NV – BIO": { ticketMin: 15_000_000, ticketMax: 50_000_000 },
  "Finnish Fund for Industrial Cooperation Ltd. (FINNFUND)": { ticketMin: 12_000_000, ticketMax: 40_000_000 },
  "Abler Nordic Formerly Norwegian Microfinance initiative NMI": { ticketMin: 10_000_000, ticketMax: 30_000_000 },
  Fanisi: { ticketMin: 10_000_000, ticketMax: 25_000_000 },

  // PrivateEquity
  "I&P": { ticketMin: 8_000_000, ticketMax: 35_000_000 },
  responsAbility: { ticketMin: 10_000_000, ticketMax: 40_000_000 },
  Afrexim: { ticketMin: 15_000_000, ticketMax: 45_000_000 },
  "SIMA -Social Investment Managers & Advisors -SIMA Funds": { ticketMin: 5_000_000, ticketMax: 20_000_000 },
  "INVESTEC- Investment Principal, Africa Private Equity Investec Asset Management": { ticketMin: 20_000_000, ticketMax: 50_000_000 },
  "AGRI-VIE INVESTMENT ADVISORS (PTY) LIMITED": { ticketMin: 5_000_000, ticketMax: 25_000_000 },
  DOBEquity: { ticketMin: 6_000_000, ticketMax: 22_000_000 },
  "MCE Social Capital": { ticketMin: 5_000_000, ticketMax: 18_000_000 },
  Phatisa: { ticketMin: 8_000_000, ticketMax: 30_000_000 },
  Symbiotics: { ticketMin: 6_000_000, ticketMax: 25_000_000 },
  "Uqalo Capital": { ticketMin: 5_000_000, ticketMax: 15_000_000 },
  "34 Lombard Road London SW11 3RF": { ticketMin: 7_000_000, ticketMax: 28_000_000 },
  "MEDU Capital": { ticketMin: 5_000_000, ticketMax: 20_000_000 },
  "Imara Holdings": { ticketMin: 10_000_000, ticketMax: 35_000_000 },
  "Okavango Capital Partners": { ticketMin: 5_000_000, ticketMax: 20_000_000 },
  "Activa Capital": { ticketMin: 8_000_000, ticketMax: 30_000_000 },
  'Aldwych Capital Partners ("Aldwych")': { ticketMin: 6_000_000, ticketMax: 24_000_000 },

  // DebtProvider
  "Grassroots Business Fund": { ticketMin: 1_500_000, ticketMax: 8_000_000 },
  "Microvest Fund": { ticketMin: 1_000_000, ticketMax: 6_000_000 },
  "Agora Microfinance Partners LLP": { ticketMin: 2_000_000, ticketMax: 10_000_000 },
  "Gulf Capital": { ticketMin: 3_000_000, ticketMax: 15_000_000 },

  // VentureCapital
  "Fates Group": { ticketMin: 500_000, ticketMax: 3_000_000 },
  "Global Capital Management Ltd-K.S.C.C. (“ A wholly-owned Private Equity subsidiary of Global Invesment House K.S.C.C)": { ticketMin: 750_000, ticketMax: 4_000_000 },
};
