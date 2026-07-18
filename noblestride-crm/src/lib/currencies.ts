// Curated currency list for ticket/deal amounts (client feedback 2026-07:
// "currency options" — USD-only assumption removed). Codes are ISO 4217;
// list order = rough frequency for Noblestride's SSA deal flow.
// ⚠ Note (questionnaire Q13): dashboards and ticket bands still bucket
// amounts nominally — no FX conversion happens anywhere yet.

export const CURRENCIES: { code: string; label: string }[] = [
  { code: "USD", label: "USD — US Dollar" },
  { code: "KES", label: "KES — Kenyan Shilling" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "NGN", label: "NGN — Nigerian Naira" },
  { code: "ZAR", label: "ZAR — South African Rand" },
  { code: "TZS", label: "TZS — Tanzanian Shilling" },
  { code: "UGX", label: "UGX — Ugandan Shilling" },
  { code: "RWF", label: "RWF — Rwandan Franc" },
  { code: "ETB", label: "ETB — Ethiopian Birr" },
  { code: "EGP", label: "EGP — Egyptian Pound" },
  { code: "MAD", label: "MAD — Moroccan Dirham" },
  { code: "GHS", label: "GHS — Ghanaian Cedi" },
  { code: "XOF", label: "XOF — West African CFA Franc" },
  { code: "AED", label: "AED — UAE Dirham" },
];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

export const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c.code, label: c.label }));
