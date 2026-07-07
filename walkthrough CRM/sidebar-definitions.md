# Sidebar definitions — what every item is

Definitions for every entry in the app's sidebars: the admin CRM sidebar (dark, left), plus the investor- and partner-portal navs. Spec references are to the Build Specification (`docs/SOW.md`).

## Admin CRM sidebar — MAIN section

| Item | Route | What it is |
|---|---|---|
| **Dashboard** | `/dashboard` | The reporting home (spec §13): stat groups and charts — pipeline overview, deal status distribution, investor engagement, investor onboarding queue, disbursement totals, referrals, team & tasks, recent changes feed. Most tiles link into the list page they summarise. |
| **Mandates** | `/mandates` | The sell-side **engagement contracts**: one mandate per client fundraising assignment (spec §3.2 "Deal/Mandate"). Kanban board by mandate stage; each mandate holds deal size, sector, NDA/EA contract dates, and links to its client and transactions. A mandate is "the assignment NobleStride was hired for." |
| **Transactions** | `/transactions` | The **live deals** being executed under a mandate (spec §3.2): target raise, instrument, deal type, stage kanban (Origination → Closing), milestones, VDR link, success fee. This is the record investors get matched against — a "deal" in the investor portal is a transaction. |
| **Clients** | `/clients` | The **target companies** raising capital (spec §3.1 "Company/Target"): profile, sector, countries, financials (revenue/EBITDA/assets), founders, codename for pre-NDA anonymity, status. Manually onboarded by the team after KYC + engagement contract (Concept Note rule). |
| **Investors** | `/investors` | The **investor database** (spec §3.4): PE funds, DFIs, angels, family offices — mandate criteria (sectors, geographies, ticket range, instruments), engagement classification (Active/Inactive/OnHold/Excluded/Greylisted), NDA status, and the **onboarding panel** where self-registrations are Approved / Rejected / Greylisted. |
| **Engagement** | `/engagement` | The **investor-×-deal tracker** (spec §3.11 "Investor-Deal Engagement"): one card per investor-deal pair, kanban by engagement stage (Shared → Teaser Sent → NDA Signed → … → Invested/Declined). Stage here drives what that investor sees in their portal. Cards restage in place; "Open engagement →" opens the detail page with NDA recording, milestones and timeline. |
| **Documents** | `/documents` | The document register (spec §3.9): teasers, IMs, financial models, NDAs, audited accounts — each with type, version, **access level** (Internal / ClientShared / InvestorShared / VDR) and an external file URL. Access level + engagement stage decide what investors can open. |
| **Tasks** | `/tasks` | Team to-dos (spec §3.8): status, assignee, due date, auto-computed escalation when overdue, and free links to any client/mandate/transaction/investor/activity. Created standalone or with "+ Task" from any timeline entry. |
| **Partners** | `/partners` | Referral sources and advisors (spec §3.6 "Referral/Partner"): who introduced which deals, fee-sharing agreements, partner agreement status, internal-only flags. Partner identity is never exposed to investors (hard rule, spec §7.2). |
| **Service Providers** | `/service-providers` | Third-party professionals on deals (spec §3.7): lawyers, auditors, DD firms — contact, fee, status, linked transactions. |
| **Access Matrix** | `/access-matrix` | A rendered copy of the spec §7.2 role-access matrix (Admin / Deal lead / Team / Investor / Partner × entity CRU rights). **Display-only documentation** — external investor/partner gating is enforced by the visibility engine, but internal roles are not enforced (no real auth yet; tracked). |

## Admin sidebar — AGENTS section

The 2×2 card grid (**Overview, Prospecting, CRM, Notes**) and its green "3" badge are **visual placeholders** — the four spec §8 agents (Client, Investor, Investor Tracker, Referral/Partner) are not built, and clicking the cards does nothing. The one working AI-ish feature is the **"Ask your agents anything…" bar in the topbar** (a heuristic `aiAsk` query over live CRM data) and the **Match Investors / Find Prospects** buttons on transactions and mandates (heuristic ranking, spec's "predictive matching" placeholder).

## Admin sidebar — bottom

| Item | What it is |
|---|---|
| **Settings** | Cosmetic button — no settings page exists yet. |
| **Collapse chevron** | Cosmetic — the sidebar does not actually collapse. |

## Investor portal sidebar (`/portal/investor`, external view)

| Item | Route | What it is |
|---|---|---|
| **Opportunities** | `/portal/investor` | Deals matching the investor's registered mandate (sector/geography/ticket), each at its visibility tier — codename teaser pre-NDA, full identity after. |
| **My Pipeline** | `/portal/investor/pipeline` | The investor's own engagements: per-deal stage, milestone stepper (mirrors the admin milestone checklist), declined history at the bottom. |
| **Fund Profile** | `/portal/investor/profile` | Self-service profile (from the "Data collected from potential investors" doc): mandate criteria, track record, team, DD requirements — editable by the investor, feeds matching. |

## Partner portal tabs (`/portal/partner`)

| Item | Route | What it is |
|---|---|---|
| **Overview** | `/portal/partner` | The partner's referral scoreboard: deals introduced, their progression, conversion. Only their own referrals — no client financials or investor identities. |
| **Submit Referral** | `/portal/partner/refer` | Form to refer a new company/deal into NobleStride's pipeline; lands as a lead for team review. |
| **My Details** | `/portal/partner/details` | The partner's own record: contact details, fee-sharing agreement status. |

---
*Related: the deep-dive per Build-Spec section lives in the numbered files in this folder — start at [README.md](README.md).*
