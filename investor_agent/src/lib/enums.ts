// Mirrors of noblestride-crm prisma enums (validated again server-side).
export const SECTORS = [
  "Agribusiness", "FinancialServices", "FMCG", "Manufacturing", "RenewableEnergy",
  "Technology", "Healthcare", "Banking", "RealEstate", "Education", "Infrastructure",
  "Aviation", "Construction", "Hospitality", "Leasing", "MediaEntertainment",
  "Services", "TransportLogistics", "WaterSanitation", "Energy", "OilAndGas",
  "Mining", "Gambling", "Alcohol", "Tobacco",
] as const;

export const GEOGRAPHIES = [
  "EastAfrica", "WestAfrica", "SouthernAfrica", "SubSaharanAfrica", "PanAfrica",
  "NorthAfrica", "FrancophoneAfrica", "MENA", "Europe", "USA", "Global",
] as const;

export const INSTRUMENTS = ["Equity", "Debt", "Mezzanine", "Grant", "Convertible", "Hybrid"] as const;

export const INVESTMENT_STAGES = ["PreSeed", "Seed", "SeriesA", "SeriesB", "Growth", "MatureBuyout"] as const;

export const INVESTOR_STATUSES = [
  "ActivelyDeploying", "Fundraising", "FinalClose", "FullyDeployed", "Dormant",
] as const;

export const INTERACTION_TYPES = [
  "Outreach", "Meeting", "Call", "Email", "Feedback", "Note", "Other",
] as const;
