# Lua × Noblestride Capital | Scope of Work & Build Specification

**LUA — Enterprise AI Operations**

## Scope of Work & Build Specification
### Investment Operations Platform: CRM & Agents
**Lua × Noblestride Capital Investments Ltd**

| | |
|---|---|
| **Prepared for** | Noblestride Capital Investments Ltd |
| **Prepared by** | Lua, Inc. |
| **Document** | Statement of Work (SOW) and configuration specification under the Lua Enterprise Agreement |
| **Reference** | Enterprise Agreement dated 15 May 2026, Appendix A |
| **Purpose** | Engineer-ready specification for configuring the CRM and agents |
| **Version** | 2.0 · Draft for review |
| **Date** | 1 June 2026 |
| **Classification** | Privileged & Confidential |

---

## 1. Purpose and how to use this document

This document does two jobs. It is the agreed Statement of Work under the Enterprise Agreement dated 15 May 2026, and it is the configuration specification an engineer uses to start building the CRM and agents.

Part I sets the scope and objectives. Part II is the data model: every entity, every field, its type, whether it is required, and its controlled values, drawn from Noblestride's existing trackers and scoping answers. Part III specifies the agents and integrations at the level of triggers, field mappings and human gates. Part IV covers reporting, delivery, commercials and the open items still to confirm.

Where a value or rule could not be fully confirmed without reading confidential deal data, it is marked as an open item in section 23 rather than guessed. Those items are the agenda for the discovery workshop and do not block the start of configuration.

> **Reading guide:** field names in the data dictionary use Noblestride's existing column names where they exist, so the mapping from the current spreadsheets is one-to-one. Rows shaded green mark records or fields that are new versus the current trackers.

### 1.1 Objectives

- **Centralise the operating data.** Companies, deals, advisory engagements, investors, contacts, partners, service providers, documents, tasks and communications in one structured system.
- **Speed up investor matching.** Match mandates to investors on sector, geography, ticket size, instrument and live deployment status from a single investor database.
- **Capture channel signal.** Pull the relevant updates and action points out of WhatsApp and email and log them against the right deal.
- **Qualify inbound automatically, behind a human gate.** A website agent that collects structured information, runs first-pass qualification, and routes qualified opportunities to a deal lead.
- **Give investors controlled visibility.** A mechanism for investors to see opportunities that fit their criteria, with confidentiality gates and Noblestride approval.
- **Make the pipeline visible.** Dashboards across mandates, investor engagement, deal progression, referral activity and team workload.

### 1.2 Scope at a glance

| # | Component | What it does |
|---|---|---|
| 1 | CRM & Deal Management | Central system for all core records, relationships, audit trails and tagging. |
| 2 | Client Agent | Handles inbound client correspondence and feeds intake and onboarding. |
| 3 | Investor Agent | Manages investor correspondence and outreach; keeps investor records current. |
| 4 | Investor Tracker Agent | Tracks the investor-to-deal relationship through to close and disbursement. |
| 5 | Referral / Partner Tracking Agent | Captures referral sources, partners, fee-sharing and conversion. |
| 6 | WhatsApp Integration | Structures inbound WhatsApp correspondence into the CRM. |
| 7 | Website Intake & Qualification Agent | Collects information, runs first-pass qualification, routes qualified leads. |
| 8 | Investor Deal Visibility | Controlled investor view of matching mandates, with confidentiality gates. |
| 9 | Reporting & Dashboards | Operational visibility across the business. |

All four agents run on the appropriate channels for the task: WhatsApp, Slack, email and web chat.

---

# PART II · DATA MODEL & CONFIGURATION

## 2. Entity catalogue and relationships

The system manages the record types below. Service Provider is new versus the current trackers; the Investor-Deal Engagement link record formalises what the Term Sheet Deals tab already holds. Advisory Engagement is specified as an optional add-on and is not part of committed PoC scope unless confirmed in discovery. The rest map directly to existing Noblestride spreadsheets.

| Entity | Source today | Role |
|---|---|---|
| Company / Target | Deal tabs, intake form | The client raising capital or seeking advisory. Central anchor. |
| Deal / Mandate | All Deals + per-lead tabs | A fundraising transaction. |
| Advisory Engagement (optional) | Advisory Work tab | Non-fundraising advisory mandate, valued in KES. Optional add-on, pending confirmation. |
| Investor | Investor Tracker (Contacts VC PE DFI) | Capital provider: PE, VC, DFI, corporate, lender, individual. |
| Investor Contact | Investor Tracker | Named people inside each investor. |
| Referral / Partner | Engagement tracker (Source/Referee), referral trackers | Originators and introducers of deals. |
| Service Provider | Law Firms tab | Legal, audit, tax, ESG and technical advisors on a deal. |
| Task | Tasks Tracker (WhatsApp) | Action items and follow-ups. |
| Document | Deal tabs (Teaser/IM/Model/VDR), engagement tracker | Deal and entity documents. |
| Communication | WhatsApp / email / meetings | Logged correspondence, anchored to a deal. |
| Investor-Deal Engagement | Term Sheet Deals tab | Link record: investor engagement and disbursement per deal. |

### 2.1 Relationship rules

- The Company / Target is the central anchor. Every communication, document and task ties back to a deal, and every deal ties back to a company.
- One deal is one communication universe. Clients, investors and partners meet through the deal.
- Investor-to-deal links are held in the Investor-Deal Engagement record, which carries matching state, term sheets and disbursement.
- A company can hold both fundraising Deals and Advisory Engagements.
- Partners and Service Providers link to one or many deals; partner identity is internal-only and never exposed to investors.

---

## 3. Data dictionary

Field names follow Noblestride's existing column names where they exist. Type abbreviations: **Picklist** (single-select controlled value), **Multi** (multi-select), **Lookup** (relationship to another record), **Auto** (system-generated). Picklist values are listed in section 4.

### 3.1 Company / Target

| Field | Type | Req | Values / source / notes |
|---|---|---|---|
| Company ID | Auto | Y | System unique key. |
| Project codename | Text | Y | Internal alias used on deal tabs, kept separate from legal name for confidentiality. |
| Legal name | Text | Y | Registered company name. |
| Registration no. | Text | N | CR12 / CR10; link to uploaded document. |
| Year founded | Number | N | Used in the 3-year operating test. |
| HQ city / country | Text | Y | |
| Countries of operations | Multi | N | Geographic footprint. |
| Sector | Picklist | Y | Sector list (4.7). |
| Sub-sector | Picklist | N | Sector taxonomy (section 5). |
| Core product / service | Text | Y | |
| Description | Long text | Y | |
| Business model | Long text | N | |
| Founders, gender | Multi | N | Source for women-led impact flag. |
| Founders, nationality | Text | N | |
| Ownership / shareholding | Long text | N | |
| Directors / management | Long text | N | |
| Target clients | Text | N | |
| Years of operation | Number | N | Derived from year founded. |
| Staff / branches | Number | N | |
| Last year revenue (USD) | Currency | N | Qualification input. |
| Revenue forecast (USD) | Currency | N | |
| EBITDA / net profit | Currency | N | Qualification input. |
| Profitability | Picklist | N | Profitable / loss-making. |
| Existing debt | Currency | N | |
| Loan book (FIs) | Currency | N | For financial institutions. |
| Total assets | Currency | N | From intake form. |
| Primary contact | Lookup | Y | Contact record. |
| Website / social | Text | N | |
| Origination source | Picklist | Y | Source list (4.6). |
| Impact flags | Multi | N | Women-led, youth-led. |
| Status | Picklist | Y | Active / prospect / archived. |

### 3.2 Deal / Mandate

| Field | Type | Req | Values / source / notes |
|---|---|---|---|
| Deal ID | Auto | Y | Unique, immutable. |
| Project | Text | Y | Codename shown on deal tabs. |
| Company | Lookup | Y | Company / Target. |
| Deal type | Picklist | Y | Debt / Equity / Equity & Debt. |
| Instrument | Picklist | N | Debt / Equity / Mezzanine / Grant / Hybrid. |
| Target profile | Text | N | Short descriptor. |
| Max selling stake | Picklist | N | Minority / Majority / Full Sale / N/A (equity). |
| Ticket size (USD Mn) | Number | Y | Amount being raised. |
| Use of funds | Long text | N | |
| Sector | Picklist | Y | Inherited from company; editable. |
| Status | Picklist | Y | Open / On Hold / Closed / Dropped / Closed & Reopened / Closed & On Hold. |
| Deal stage | Picklist | Y | Pipeline stage (4.4). |
| Deal milestone | Picklist | N | Current milestone (4.3). |
| Deal lead | Lookup | Y | Team member. |
| Deal assistant | Lookup | N | Team member. |
| Consultant / referrer | Lookup | N | Partner record; internal-only. |
| Date onboarded | Date | Y | Immutable once set. |
| Source | Picklist | Y | Origination source (4.6). |
| Teaser | Picklist | N | Not started / Draft / Done. |
| IM | Picklist | N | Not started / Draft / Done. |
| Model | Picklist | N | Not started / Draft / Done. |
| VDR | Text / link | N | Data room status and link. |
| Probability of closure | Percent | N | |
| Comments | Long text | N | |

### 3.3 Advisory Engagement (optional add-on)

> **Optional, not committed scope.** Noblestride also runs non-fundraising advisory mandates (valuations, DD reports, business plans) valued in KES, currently in the Advisory Work tab. This is not part of the committed PoC scope. The structure is specified here so that, if the team chooses to include it, adding it is a switch rather than a redesign.

| Field | Type | Req | Values / source / notes |
|---|---|---|---|
| Engagement ID | Auto | Y | |
| Company | Lookup | Y | Company / Target. |
| Project type | Picklist | Y | Advisory type (4.8). |
| Company profile | Long text | N | |
| Project value (KES) | Currency | Y | Fee value in KES. |
| Date onboarded | Date | Y | |
| Due date | Date | N | |
| Project lead | Lookup | Y | Team member. |
| Project assistant | Lookup | N | Team member. |
| Project milestone | Picklist | N | Advisory milestone (4.9). |
| Status | Picklist | Y | Aligned with deal status values. |
| Comments | Long text | N | |

### 3.4 Investor

| Field | Type | Req | Values / source / notes |
|---|---|---|---|
| Investor ID | Auto | Y | |
| Firm / fund name | Text | Y | |
| Institution type | Picklist | Y | PE / VC / DFI / Corporate / Lender / Individual / Family office. |
| Website | Text | N | |
| Sector focus | Multi | Y | Matching input. |
| Geographic focus | Multi | Y | Matching input. |
| Country restrictions | Text | N | Exclusions. |
| Ticket size min (USD) | Currency | Y | Matching input. |
| Ticket size max (USD) | Currency | Y | Matching input. |
| Instruments | Multi | Y | Debt / Equity / Mezzanine / Grant. |
| Deployment status | Picklist | Y | Active / Not deploying / On hold. |
| Investment mandate | Long text | N | Fund criteria. |
| Stage preference | Picklist | N | |
| Target return / IRR | Text | N | |
| Shareholding preference | Picklist | N | Minority / Majority. |
| Min EBITDA / revenue / loan-book | Currency | N | Threshold(s). |
| Pricing preference | Text | N | |
| ESG / impact focus | Text | N | |
| Current fund size / deployable | Currency | N | |
| Remaining investment period | Text | N | |
| DD requirements / timeline | Long text | N | |
| IC / approval process | Long text | N | |
| Track record | Long text | N | Notable investments, exits. |
| NDA status (Noblestride) | Picklist | Y | None / Open NDA / Closed NDA. |
| Engagement classification | Picklist | Y | Active / Inactive / On hold / Excluded / Greylisted. Drives visibility (section 13). |
| Next action date | Date | N | |
| Feedback | Long text | N | |
| SSA-region contact | Lookup | N | Investor Contact. |

### 3.5 Investor Contact

| Field | Type | Req | Values / source / notes |
|---|---|---|---|
| Contact ID | Auto | Y | |
| Investor | Lookup | Y | Parent investor. |
| Name | Text | Y | |
| Role | Text | N | |
| Email | Email | Y | Per Noblestride note, flag/avoid generic Gmail/Yahoo for fund contacts. |
| Phone | Phone | Y | Used for OTP where relevant. |
| Primary contact | Boolean | N | |
| SSA contact | Boolean | N | Region-specific point person. |

### 3.6 Referral / Partner

| Field | Type | Req | Values / source / notes |
|---|---|---|---|
| Partner ID | Auto | Y | |
| Name | Text | Y | |
| Advisor type | Picklist | N | Lawyer / Investor / Consultant / Transaction advisor / Advisory firm / Other. |
| Organization | Text | N | |
| Email | Email | Y | |
| Phone | Phone | Y | |
| Fee-sharing agreement | Boolean | N | |
| Fee-sharing terms | Long text | N | |
| NDA / partner agreement | Picklist | N | None / Sent / Signed. |
| Deals introduced | Lookup (multi) | N | Deals. |
| Internal-only | Boolean | Y | Default true. Identity never exposed to investors. |
| Status | Picklist | N | Active / Inactive. |

### 3.7 Service Provider

> **New record type.** From the Law Firms tab and the DD workflow (Big 4 and legal advisors). Lets the agents file legal, audit, tax and ESG advisors against a deal instead of losing them in notes.

| Field | Type | Req | Values / source / notes |
|---|---|---|---|
| Provider ID | Auto | Y | |
| Name | Text | Y | |
| Type | Picklist | Y | Law firm / Audit (Big 4) / Tax / ESG / Technical / Other. |
| Contact person | Text | N | |
| Email / phone | Email / Phone | N | |
| Profile | Long text | N | |
| Engaged on | Lookup (multi) | N | Deals. |
| Fee / amount | Currency | N | |
| Status | Picklist | N | |

### 3.8 Task

| Field | Type | Req | Values / source / notes |
|---|---|---|---|
| Task ID | Auto | Y | |
| Linked record | Lookup | Y | Project / Client / Investor (deal, company or investor). |
| Action point | Text | Y | |
| Source | Picklist | Y | Monday Meeting / WhatsApp / Email / Verbal / Other. |
| Status | Picklist | Y | Not started / Pending / Ongoing / Done / Dropped. |
| Deadline | Date | N | Drives overdue escalation. |
| Owner | Lookup | Y | Team member. |
| Assistant | Lookup | N | Team member. |
| Notes | Long text | N | |
| Escalation flag | Boolean | Auto | Set when overdue (section 12). |

### 3.9 Document

| Field | Type | Req | Values / source / notes |
|---|---|---|---|
| Document ID | Auto | Y | |
| Linked record | Lookup | Y | Deal / company / investor. |
| Type | Picklist | Y | NDA / Engagement contract / Teaser / IM / Financial model / Valuation / Pitch deck / Audited accounts / CR12 / Term sheet / Loan agreement / SPA / SHA / Other. |
| Version | Text | N | |
| Access level | Picklist | Y | Internal / Client-shared / Investor-shared / VDR. Enforced by access control (section 6). |
| Status | Picklist | N | Draft / Under review / Approved / Shared / Executed. |
| File | File | Y | |
| Uploaded by / date | Auto | Y | |

### 3.10 Communication

| Field | Type | Req | Values / source / notes |
|---|---|---|---|
| Comm ID | Auto | Y | |
| Channel | Picklist | Y | WhatsApp / Email / Slack / Web chat / Call / Meeting. |
| Linked record | Lookup | Y | Deal / company / investor. |
| Direction | Picklist | N | Inbound / Outbound. |
| Summary | Long text | Y | Structured by the agent. |
| Extracted action items | Lookup (multi) | N | Tasks created from this communication. |
| Timestamp | DateTime | Y | |
| Logged by | Auto | Y | Agent or user. |

### 3.11 Investor-Deal Engagement (link record)

This link record carries the investor-to-deal relationship and the disbursement tracking from the Term Sheet Deals tab. One record per investor per deal.

| Field | Type | Req | Values / source / notes |
|---|---|---|---|
| Link ID | Auto | Y | |
| Investor | Lookup | Y | |
| Deal | Lookup | Y | |
| Engagement stage | Picklist | Y | Shared / Teaser sent / NDA signed / IM shared / VDR access / Meeting / Info request / DD / Term sheet / Offer / Invested / Declined. |
| Interest level | Picklist | N | Low / Medium / High. |
| NDA type | Picklist | N | Open / Closed. |
| Term sheet issued | Boolean | N | With issue date. |
| Total amount (USD Mn) | Currency | N | From Term Sheet Deals. |
| Amount disbursed (USD Mn) | Currency | N | |
| Amount pending (USD Mn) | Currency | N | |
| Engagement status | Picklist | N | Disbursed / Ongoing / Fell off / Dropped. |
| Date received | Date | N | |
| Year / Quarter | Auto | N | Derived from date received. |
| Probability of closure | Percent | N | |
| Feedback | Long text | N | |

---

## 4. Controlled-value (picklist) library

These values are taken from Noblestride's existing list tabs. They are the starting configuration; the team can extend them. Team-member name lists are managed as a User picklist and will be set at kickoff.

**4.1 Deal type**
Debt; Equity; Equity & Debt.

**4.2 Investment instrument**
Debt; Equity; Mezzanine; Grant; Hybrid / combination.

**4.3 Deal milestone**
Term Sheet; Non-Binding Offer; Loan Agreement; SPA / SHA; Due Diligence; IC; TA; Closed.

**4.4 Deal stage**
Indicative TS; Term Sheet; Due Diligence; IC; Loan Agreement; Shareholder Agreement; Share Purchase Agreement; TA; Closed.

**4.5 Deal status (pipeline)**
Open; On Hold; Closed; Closed & Reopened; Closed & On Hold; Dropped.

**4.6 Origination source**
Referral; Direct enquiry; Consultant; Investor; Partner; Social media (LinkedIn / WhatsApp); Website; Networking event; Internal business development.

**4.7 Max selling stake**
Minority; Majority; Full Sale; N/A.

**4.8 Advisory project type**
Valuation Report; Financial Due Diligence Report; Business Plan; Expression of Interest; Financial Model; Advisory Support; Pitch Deck; Merger Report; Financial Model & Business Plan; Business / Project Proposal; Concept Note.

**4.9 Advisory project milestone**
Client Engagement; Draft; 1st Draft Shared; Ongoing; Completed; Dropped.

**4.10 Engagement status (investor-deal / disbursement)**
Disbursed; Ongoing; Fell off; Dropped.

**4.11 Task status**
Not started; Pending; Ongoing; Done; Dropped.

**4.12 Task source**
Monday Meeting; WhatsApp; Email; Verbal; Other.

**4.13 Investor deployment status**
Active / Deploying; Not deploying; On hold.

**4.14 Investor engagement classification**
Active; Inactive; On hold; Excluded; Greylisted.

**4.15 NDA type**
Open (investor ↔ Noblestride, multi data room); Closed (investor ↔ Noblestride ↔ client, single data room).

**4.16 Document access level**
Internal; Client-shared; Investor-shared; VDR.

---

## 5. Sector taxonomy

Operational sector picklist (deal and company level), from the current deal lists:

> Agribusiness; Aviation; Construction; Education; Energy; Financial Services; Healthcare; Hospitality; Infrastructure; Leasing; Manufacturing; Media & Entertainment; Real Estate; Retail & FMCG; Services; Technology; Transport & Logistics; Water & Sanitation.

Sub-sectors are available as a second-level picklist from Noblestride's sector document (for example, under Financial Services: Insurance, Banks, Microfinance, Pension funds, VC & PE; under Technology: Fintech, Edtech, Agritech, Healthtech, Insuretech, E-commerce, Proptech, Cybersecurity). The full sub-sector list is configured from that document.

> **Note:** real estate, oil & gas, mining, alcohol, tobacco and gambling are excluded sectors for qualification (section 11). Real Estate appears in the sector list because legacy advisory records reference it; the qualification rules still screen it out for new fundraising leads.

---

## 6. Milestone framework

Milestones drive deal progression, the visibility gates and the dashboards. They split into client-side document preparation, investor-side process, and post-deal.

### 6.1 Client-side document preparation

| Milestone | Applies to |
|---|---|
| Teaser | All deals |
| Financial model | All deals |
| Information Memorandum (IM) | All deals |
| Valuation report | Equity transactions |
| Business plan | Optional |

### 6.2 Investor-side process milestones

| # | Milestone |
|---|---|
| 1 | Receipt and review of the teaser |
| 2 | Execution of the NDA |
| 3 | Expression of interest / letter of intent / email confirming interest |
| 4 | Data room access |
| 5 | Preliminary due diligence |
| 6 | Internal IC paper |
| 7 | First IC approval |
| 8 | Issuance of non-binding term sheet |
| 9 | Execution of the term sheet |
| 10 | Onsite detailed due diligence (financial, tax, commercial, ESG, legal) |
| 11 | Second IC approval |
| 12 | Issuance of a binding offer |
| 13 | Loan agreement or share purchase agreement |
| 14 | Competition authority approval (CAK / COMESA) |

### 6.3 Post-deal

- Disbursement / transaction completion.
- Success-fee invoicing and payment.
- Post-transaction monitoring and relationship management.

---

## 7. Audit, immutability and access control

### 7.1 Immutable / audited fields

Where a protected field changes, the system keeps the prior value, the timestamp and the user who made the change.

- Core identifiers on companies, investors, partners and contacts: legal names, registration details, primary contacts.
- Deal records: creation date, originating source and unique deal ID.
- Investor interest records: expressions of interest, rejections and offer terms shared.
- Deal stage history: every stage change with timestamp and responsible user.

### 7.2 Roles and access matrix

Access is role-based and enforced at the data layer. C = create, R = read, U = update, n/a = no access. External roles see only what the visibility rules (section 13) permit.

| Entity | Admin | Deal lead | Team member | Investor (ext.) | Partner (ext.) |
|---|---|---|---|---|---|
| Company / Target | CRU | CRU (own) | R | gated | n/a |
| Deal / Mandate | CRU | CRU (own) | R | gated | n/a |
| Advisory Engagement | CRU | CRU (own) | R | n/a | n/a |
| Investor | CRU | CRU | R | own profile | n/a |
| Investor Contact | CRU | CRU | R | n/a | n/a |
| Referral / Partner | CRU | CRU | R | n/a | own |
| Service Provider | CRU | CRU | R | n/a | n/a |
| Task | CRU | CRU | CRU (own) | n/a | n/a |
| Document | CRU | CRU | R | gated | n/a |
| Investor-Deal Engagement | CRU | CRU | R | own | n/a |

> **Hard rule:** partner / consultant identity and the identity of other investors on a deal are never visible to any external role, regardless of gate. Excluded and greylisted investors see nothing.

---

# PART III · AGENTS & INTEGRATIONS

## 8. Agent specifications

Each agent is specified by what fires it, the channels it runs on, what it reads, what it does, what it writes to the CRM, the human gate, and what it must never do. The agents prepare, route and track. People decide and release.

### 8.1 Client Agent

| Aspect | Specification |
|---|---|
| Purpose | Handle inbound client and prospect correspondence; structure it; feed intake and onboarding. |
| Channels | WhatsApp, email, web chat. |
| Trigger | Inbound message from a prospect or client; a new website-qualified lead. |
| Reads | Message content, attachments, existing Company / Deal records. |
| Does | Classifies the message; extracts intake fields against the checklist (section 9); drafts a summary and next steps; flags qualification signals. |
| Writes | Creates / updates Company and Communication records; creates Tasks for the deal lead; attaches Documents. |
| Human gate | Deal lead reviews and progresses. No onboarding, NDA or contract action without approval. |
| Never | Sign or accept NDAs/contracts; onboard a client; convert a lead to an active deal; commit the firm to anything. |

### 8.2 Investor Agent

| Aspect | Specification |
|---|---|
| Purpose | Manage investor correspondence and outreach; keep investor records current. |
| Channels | Email, WhatsApp, Slack. |
| Trigger | Inbound investor message; a mandate ready for outreach; a change in investor criteria detected. |
| Reads | Investor profile, mandate, Investor-Deal Engagement, deal data. |
| Does | Captures changes to investor criteria/status/contacts; prepares tailored deal introductions and teasers for matching investors; logs feedback and response times. |
| Writes | Updates Investor and Investor Contact; creates Communication and Investor-Deal Engagement records; drafts outreach for review. |
| Human gate | Deal lead reviews and releases all initial outreach. Material profile changes prompt confirmation. |
| Never | Send initial investor outreach automatically before interest is verified; share confidential client data; route investor data requests to clients before a formal introduction. |

### 8.3 Investor Tracker Agent

| Aspect | Specification |
|---|---|
| Purpose | Track the investor-to-deal relationship through to close and disbursement. |
| Channels | Runs in the CRM; reads from email/WhatsApp via the Communication log. |
| Trigger | Any change to an Investor-Deal Engagement; scheduled follow-up checks. |
| Reads | Investor-Deal Engagement, milestones, term sheets, documents. |
| Does | Maintains engagement stage per investor per deal; tracks term sheets, DD status and disbursement; surfaces which investors fit a live mandate; flags stalled or overdue engagements. |
| Writes | Updates Investor-Deal Engagement (stage, term sheet, amounts, status); creates follow-up Tasks. |
| Human gate | Deal lead acts on flags; status changes that affect a client are reviewed. |
| Never | Grant VDR access automatically; share a deal with an excluded investor; issue or accept commercial terms. |

### 8.4 Referral / Partner Tracking Agent

| Aspect | Specification |
|---|---|
| Purpose | Capture introductions, partner relationships, fee-sharing and conversion. |
| Channels | Email, WhatsApp. |
| Trigger | A partner introduces a deal; a referred deal changes stage. |
| Reads | Partner records, linked deals, deal stage history. |
| Does | Records the originator, contacts, advisor type and fee-sharing; tracks referral-to-onboarded conversion and stage per referred deal; compiles partner performance. |
| Writes | Creates / updates Partner records and partner-to-deal links; updates conversion metrics. |
| Human gate | Advisor-to-Noblestride deal sharing is reviewed by a person, never auto-actioned. |
| Never | Expose partner / consultant identity to investors; act on fee-sharing without a recorded agreement. |

---

## 9. WhatsApp correspondence integration

The integration connects to Noblestride's existing WhatsApp workflows and classifies inbound messages, routing the relevant ones into the CRM. The mapping below is the configuration starting point.

| Inbound signal | System action | Writes to |
|---|---|---|
| Deal status update (e.g. DD, term sheet, closing) | Update deal stage / milestone; log communication | Deal, Communication |
| Client / investor / transaction update | Log against the right deal | Communication, Deal |
| Task or follow-up assigned in chat | Create a linked task for the deal lead | Task |
| Assigned or potential deal mentioned | Route to the deal manager's queue | Deal, Task |
| Overdue / missed deadline | Flag and escalate | Task (escalation flag) |
| Client / investor data or status request | Open a tracked workflow with assignment and monitoring | Task, Communication |

### 9.1 Never automated from WhatsApp

- Internal team discussions and deal allocations.
- Sensitive or personal conversations in groups.
- Investor data requests routed to clients before a formal introduction.
- Initial investor communications before interest is verified.
- Advisor-to-Noblestride deal sharing.
- Any commercial negotiation or clarification of terms.

---

## 10. Website intake and qualification agent

Embedded on the website, the agent collects structured information, runs first-pass qualification, and routes qualified opportunities to the team. It does not onboard anyone.

### 10.1 Intake fields

From Noblestride's target-company data collector. Required fields are marked.

| Field | Req | Field | Req |
|---|---|---|---|
| Legal name | Y | Amount raising (current round) | Y |
| Year founded | Y | Instrument (debt/equity/mezzanine) | Y |
| HQ city | Y | Expected post-money valuation | N |
| Countries of operations | Y | Raised to date (current round) | N |
| Sector | Y | Raised to date (since inception) | N |
| Core product / service | Y | Existing investors | N |
| Description | Y | Last year revenue (USD) | N |
| Founders, gender | Y | Revenue forecast this year (USD) | N |
| Founders, nationality | Y | Profitability | N |
| Target clients | Y | Pitch deck (upload) | N |
| Contact person / role / email | Y | Origination source / website | N |
| NDA acceptance (before sensitive docs) | Y | Notes | N |

### 10.2 Qualification logic

The agent screens against the firm's published criteria and labels each lead Qualified or Rejected for human review. It never auto-rejects without the lead being visible to the team.

| Qualifies for review | Deprioritised / rejected |
|---|---|
| Profitable, positive EBITDA | Start-up / early-stage, no revenue or <3 yrs history |
| Clean audited accounts 3+ years | No audited accounts for last 3 years |
| Annual revenue ≥ USD 1M | Annual revenue < USD 1M |
| Funding need ≥ USD 1M (debt or equity) | Raise < USD 500k |
| Use of funds: growth, CAPEX, working capital | Restricted sectors: oil & gas, real estate, gambling, alcohol, tobacco, mining |
| Acceptable sector, Sub-Saharan Africa | Outside Sub-Saharan Africa |
| Fits investor appetite & internal criteria | Government-owned or PEP-linked |

### 10.3 Routing after qualification

A qualified lead is held in an open queue and assigned to a deal lead manually. The human process then takes over: introductory call, NDA, financial review, assessment, engagement contract, entry into the formal process. No lead converts to an active deal automatically.

---

## 11. Investor deal visibility

Investors see mandates that fit their criteria, with confidentiality gates. Access is granted and revocable by Noblestride, not a default. Visibility is field-level and tied to the engagement gate.

| Field / document | Pre-interest | After NDA | DD stage |
|---|---|---|---|
| Company profile, sector, target profile | Visible | Visible | Visible |
| Deal type, requested ticket size | Visible | Visible | Visible |
| Revenue, EBITDA, total assets, use of funds | Limited | Visible | Visible |
| Status of matching active mandates | Visible | Visible | Visible |
| Full financials, IM, financial model | Hidden | Visible | Visible |
| VDR / due-diligence files | Hidden | On request | Visible |
| Advisor and client contacts | Hidden | Hidden | Visible |
| Other investors on the deal | Hidden | Hidden | Hidden |
| Engagement contracts | Hidden | Hidden | Hidden |
| Investor feedback / offers / client responses | Hidden | Hidden | Hidden |
| Internal team messages | Hidden | Hidden | Hidden |

### 11.1 Filters available to investors

Country; sector; ticket size; deal type and facility type; core financials (revenue, EBITDA, net profit); impact filter (women-led, youth-led).

### 11.2 Access model and controls

- All active investors get baseline visibility and filter to what fits their focus; they are not hard-siloed by type.
- Noblestride keeps back-end control to limit, restrict or deactivate access for investors on hold, inactive or excluded.
- VDR access stays locked until an investor expresses formal interest and signs an NDA, and is revoked promptly if they decline.
- Excluded and greylisted funds never see opportunities.

---

## 12. Automation guardrails and escalation

Human-in-the-loop control is part of the build, not a setting. The lists below are binding.

### 12.1 Actions that never happen automatically

1. Signing or accepting NDAs and engagement contracts.
2. Onboarding a client before initial review, financial analysis and management approval.
3. Converting a lead into an active deal before criteria are validated and a deal lead is assigned.
4. Accepting, rejecting or deprioritising an opportunity without management oversight.
5. Sharing confidential client information with investors, stakeholders or third parties.
6. Granting VDR access without internal approval and a confirmed, signed NDA.
7. Sharing a deal with an excluded investor or a party that fails internal clearance.
8. Sharing a deal with consultants or partners without an NDA and, where applicable, a fee-sharing agreement.
9. Sending external communications without internal review and approval.
10. Committing the firm to timelines, fees, terms, exclusivity, deliverables or any binding obligation.

### 12.2 Escalation triggers

- Overdue or missed deadlines.
- Any deal status change.
- Internal WhatsApp task assignments, which auto-create a linked to-do for the deal lead.
- Client or investor requests, which open a tracked workflow with assignment and monitoring.
- Requests for internal review of a deliverable such as a financial model or teaser.

---

# PART IV · REPORTING, DELIVERY & COMMERCIAL

## 13. Reporting and dashboards

| Dashboard | Fields / groupings |
|---|---|
| Pipeline overview | Active vs inactive deals; deals by lead; by transaction type; by sector; by ticket-size band. |
| Deal status | Distribution across screening, term sheet issued, closed, rejected; deal stage history. |
| Investor engagement | Deals under review by each investor; deals rejected; invested/completed; historical engagement summary. |
| Disbursement | Total / disbursed / pending by deal, investor, year and quarter. |
| Referrals & partners | Deals introduced by each partner; status of each; conversion (introduced → progressed → closed/rejected). |
| Team & tasks | Deal load by team member; task status by owner; overdue actions. |
| Advisory | Advisory engagements by type, value (KES), lead and milestone. |

---

## 14. Systems and integrations

Noblestride runs on Microsoft 365 (SharePoint, Outlook, Excel, PowerPoint, Teams), WhatsApp, LinkedIn, Microsoft To Do and Google Meet / Zoom. The platform fits this environment.

### 14.1 Integrations in scope

- WhatsApp, for the correspondence integration (section 9).
- Email (Outlook / Microsoft 365), for capturing relevant deal and investor correspondence.
- Slack and web chat, as agent channels.
- The website, for the embedded intake and qualification agent.
- Document storage (for example SharePoint), subject to available API and admin access (section 17).

### 14.2 Data protection

- Role-based access control (section 7) and confidentiality gates enforced at the data layer.
- Alignment with Kenya's Data Protection Act, 2019: access rights, secure storage, confidentiality, data handling.
- Encryption in transit and at rest, audit trails and incident response per the Enterprise Agreement and its DPA (Appendix C).

---

## 15. Deliverables

| Deliverable | Description |
|---|---|
| Discovery & configuration brief | Validated workflows, this data model confirmed, access matrix and integration plan, signed off before build. |
| Configured CRM | All core entities, relationships, audit trails, picklists and tagging. |
| Four deployed agents | Client, Investor, Investor Tracker and Referral/Partner agents on their channels. |
| WhatsApp integration | Inbound structuring and logging with the rules in section 9. |
| Website intake & qualification agent | Form, qualification logic and routing in section 10. |
| Investor deal visibility | Controlled investor view with filters and gates in section 11. |
| Reporting dashboards | The views in section 13. |
| Access controls & DPA configuration | Roles, gates and data-protection settings. |
| Onboarding & handover | Team walkthrough, configuration documentation, PoC support setup. |

---

## 16. Approach and timeline

The implementation runs 4 to 6 weeks from the Effective Date, inside the 3-month Proof of Concept in Appendix A.

| Phase | Timing | Focus |
|---|---|---|
| 1. Discovery & scoping | Weeks 1-2 | Validate this data model and workflows, confirm open items (section 17), set the access matrix and integrations. |
| 2. Build & configuration | Weeks 2-5 | Configure the CRM and entities, build and connect the agents, set up WhatsApp and website integrations, implement visibility and access controls. |
| 3. Deployment & onboarding | Weeks 5-6 | Deploy, load and structure existing data, walk the team through, begin the PoC. |
| PoC period | Months 1-3 | Run on live operations, refine, review usage ahead of post-PoC terms. |

---

## 17. Items to confirm together in discovery

A short list of decisions and details we will lock in together during the discovery workshop. None of them block the start of configuration; they refine specific pieces of the build.

| # | Item | What we will confirm |
|---|---|---|
| 1 | Advisory work in or out of PoC scope | Whether to include Advisory Engagement (section 3.3) in this PoC. |
| 2 | Final picklist values & team-member (User) list | Confirm the controlled values and set the User list at kickoff. |
| 3 | Full Term Sheet Deals semantics | Walk through the disbursement tracking together to confirm the finer points. |
| 4 | Full investor field set | Confirm the investor fields are complete and which are required. |
| 5 | Sub-sector taxonomy depth | Agree how many sub-sector levels to configure. |
| 6 | API / admin access per system | Confirm SharePoint, Outlook and WhatsApp access at kickoff. |
| 7 | Access coordinator | Confirm the owner (Evans Wesonga / Solomon named as candidates). |
| 8 | Open vs Closed NDA handling in visibility | Agree how each NDA type maps to VDR access scope. |

---

## 18. Roles and responsibilities

| Area | Lua | Noblestride |
|---|---|---|
| Discovery & sign-off | Run workshops, confirm the data model | Provide detail, attend, sign off the brief |
| Build & configuration | Configure platform, build agents | Confirm configuration decisions |
| System access | Specify access required | Nominate coordinator; provide timely API/admin access |
| Data | Structure and load data | Provide trackers, files, templates; confirm data quality |
| Approvals & content | Build routing and gates | Make all approval and release decisions |
| Support (PoC) | Provide support per the SLA (Appendix B) | Raise issues via the designated contact |

**Designated contacts.** Lua: Lorcan O'Cathain (lorcan@heylua.ai). Noblestride: Evans Wesonga, CEO (evans.wesonga@noblestride.co.ke).

---

## 19. Assumptions, dependencies and out of scope

### 19.1 Assumptions and dependencies

- Timely access to systems, channels, data and people through the nominated coordinator.
- Existing trackers, templates and files made available for the data load.
- API / admin access available for integrated systems, or an agreed alternative.
- Approval and release decisions made within reasonable timeframes.
- Third-party channel costs (WhatsApp, SMS, voice) are Noblestride's, per the Enterprise Agreement.

### 19.2 Out of scope

- Workflows, integrations or functionality beyond what is described here.
- Advisory engagement tracking (section 3.3), unless confirmed as an add-on in discovery.
- Automated production of investor documents (teasers, IMs, models, valuations); the system tracks and stores them, the team produces them.
- Migration or restructuring of historical data beyond the agreed initial load.
- Outbound automated commercial communication or negotiation.
- Custom integrations with systems not listed in section 14.

---

## 20. Commercial terms

This SOW operates under the Enterprise Agreement dated 15 May 2026. The commercial terms (implementation fee, monthly minimum commitment, usage thresholds, initial term, the 3-month Proof of Concept and the Month 3 break clause) are set out in Appendix A of that Agreement and are not restated here. Appendix A governs.

Additional workflows, integrations or functionality beyond the scope described in this document may be scoped and commercially agreed separately, per Appendix A.

---

## 21. Acceptance

By signing below, both parties confirm this Scope of Work and build specification as the agreed basis for configuration under the Enterprise Agreement dated 15 May 2026.

| | |
|---|---|
| **Name:** Lorcan O'Cathain | **Name:** Evans Wesonga, CEO |
| **Title:** | **Title:** Chief Executive Officer |
| **Signature:** | **Signature:** |
| **Date:** | **Date:** |