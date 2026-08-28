# Client Feedback Inventory — "Additional Feedback_Input Lua System August 2026.docx"
(Every item, incl. what the screenshots/annotations say. IDs used in the plan.)

## 1. Login page
F1.1 Separate, clearly labelled links to sign up / log in as **Client** vs **Investor** (screenshot: signup step-1 "What best describes you?" — Founder/SME, Investor/FUND, Service Provider, NGO/Social Enterprise). Annotation: the NGO/Social Enterprise option "can be for internal Noblestride employees" → repurpose 4th option as **Noblestride staff (internal)**.

## 2. New business / client submission workflow
F2.1 Website intake application syncs to CRM but isn't easily accessible (screenshot: notification "New website application: Fundraising Company" — only reachable via bell). Need a first-class **Website Applications / Intake queue** page + nav, notification links straight to it.
F2.2 Clients list ("Fundraising Company" shows as Prospect client): add **Date created** column + sort/filter (newest opportunities first).
F2.3 Contact info from intake wizard step 2 (Contact person, Role, Corporate email, Phone) is NOT captured after submission → must be persisted and shown on the client/intake record (contacts).

## 3. Investor set-up
F3.1 Investor onboarding: optional **upload investment criteria file** (screenshot: registration review step w/ Fund, Contact, Investor type, Sectors, Geographies, Deal preference, Team members). Admin review queue (Approve/Reject/Greylist) should show/link the file.
F3.2 NDA section on investor page ("None / Record Open NDA"): two options — (a) **open Noblestride NDA template & sign (e-sign/acknowledge)**, (b) **investor uploads their own NDA** for Noblestride sign-off.
F3.3 Investor Database list: add **Date onboarded** column + filter/sort.
F3.4 **People search**: search by a person's name → profile showing their fund, role, contact details (investor contacts / team members are searchable; global search & investors page).
F3.5 Team members added during registration (name, email, phone): must receive **invite/notification email** to set credentials; "Reset link" must actually email the member. Confirm/implement both.
F3.6 Changing an investor contact's email (Contacts card: testinvestor4 → solomon.oulula@noblestride.co.ke) did NOT update the Account access/user record (still testinvestor4@fundxyz.org). Email change must propagate contact ↔ user (and vice versa), with audit.

## 4.1 Deals view
F4.1.1 Deal workflow from opportunity → sign-off not defined/configurable. Deal Journey (17 stages) vs Edit Mandate "Stage: Signed" dropdown are inconsistent/clashing ("An opportunity is considered a deal after it has been signed"). Need one coherent model: configurable **pipeline/workflow templates**, stage list per deal, manual "move to stage" (e.g. "move to investor shortlisting").
F4.1.2 Stages must be **customisable** (create new workflow templates for new deals; edit/reorder/add stages).
F4.1.3 Deal Journey cards should be **interactive**: clicking a stage opens the related thing (VDR setup → open VDR/data room; NDA → NDA record; Investor shortlisting → shortlist, etc.), and manual stages can be marked done.
F4.1.4 Deals list filters look crowded → **simple, clean filter bar** (search + a few primary filters + "More filters" drawer; saved views tucked away).

## 4.2 Advisory work
F4.2.1 Advisory assignment needs **classification** (Financial Model, Valuation, Business Plan, Due Diligence, Pitch Deck, Advisory Support, Other…) — field on create/edit + display + filter.

## 4.3 Retainer tracking
F4.3.1 Retainer: beyond amount/invoiced/paid dates, track **paid amount, pending balance**, payment log (multiple payments), display on deal page + deals list/finance.

## 5. Agents (general)
F5.1 Each agent must, on first contact / "how does this work", **summarise its role and give a simple guide** on how to work with it — BEFORE demanding passphrase. Current passphrase-first structure "doesn't work".
F5.2 Opportunity: use AI + **publicly available resources** to offer summary/news about clients/investors in the DB (research tool: web search → brief).
F5.3 CRM agent (baseAgent_agent_1783976635757_xgvfd9dr3): can't summarise CRM info; loops on "reply with passphrase AND email" even when user includes email. Fix: proper onboarding/help; verify flow clear; once verified, summarise deals/investors/clients; answer "what's the main function of this CRM", "how many opportunities in the deal".
F5.4 Investor agent (…1784027151836_i3pfzhycr): will it know which deal the investor is looking at? Needs identity → investor → their deals/interests context; explain how to test (registered email; portal deep link / deal context).
F5.5 Client agent (…1783981692495_we70afz23): make **tone more professional** (less chatty; e.g. Gmail rejection message).
F5.6 Referral partner agent (…1784064430432_jb06nrzm6): **drop partner usage for now**; partners simply log in to portal to see deal status. → Disable partner-facing channel/mode (staff-only or deactivate), ensure partner portal shows deal status.
F5.7 Investor tracker agent (…1784032867846_7j9q1ht9n): "Share a pass phrase and confirm how it's set" → document where passphrase is set (env var), how to rotate, and agent should explain what a passphrase is / how to get it instead of a bare refusal.
F5.8 Website intake agent (…1784533792964_cdn1jgbrd): duplicates Client agent; concern about sharing info out of context. Idea: CRM gives clients visibility of submitted info + status (portal). → De-duplicate: intake agent = pre-submission/public only (no CRM record disclosure beyond verified-email status), client agent = post-onboarding; make portal the source of truth for document submission/status.

## 6. Clients
F6.1 Clients list: add filters **Country, Sector, Revenue** (+ date created per F2.2).

## 6b. Investor portal
F6b.1 Investor should see **all** deals (brief teaser summary), filter, and **"Express interest"** button → notification to deal lead (+ CRM record).
F6b.2 Restrict additional deal details until investor expressed interest AND has been granted access (gating: teaser → interest → approved access → full details/data room).
F6b.3 "Your progress on this deal" milestone checklist (15 items incl. "Success fee paid"): clarify how these fields get set — hide from investor (or show only deal open/closed/ongoing status), investor can add comments; **remove "Success fee paid"** from investor view. Dashboard KPI cards (Committed/Disbursed/Pending $0): **hide by default**, admin toggle to show/update (setting).
F6b.4 Investor can **add colleagues as participants** to a deal they've been invited to (participants must be onboarded team members).

## 7. Summary workflow (image32: "Transaction Advisory – Simple Workflow", 12 steps)
1 New opportunity (sources: client, partner/referral, cold outreach, desk research, network) → 2 Initial evaluation (Short-term/Advisory assignment OR Transaction/Deal) → 3 NDA signed (+ fee-share agreement if partner) → 4A Short-term assignment scope / 4B Deal opportunity: financial & commercial analysis → 5 Deal approved / open for assignment (assign Deal Lead + assistants) → 6 Opportunity preparation (VDR, teaser, IM, financial model, shortlist…) → 7 Internal review (recommended) → 8 Investor outreach (code name + brief summary only) → 9 Investor interest (assess; investor NDA → more info) → 10 Three-party discussions → 11 Term sheet / transaction progression → 12 Success fee / fee share.
Three phases: QUALIFY → PREPARE → EXECUTE. Key rule: No NDA → no confidential info.
→ Default workflow template must mirror these 12 steps (replace 17-stage list), with Advisory branch (4A) vs Transaction branch (4B).

## Reference platform
F8 Review https://aikaafricafund.com/login structure (create dummy accounts) and adopt architecturally: role-separated login/signup, investor deal-room flow, interest gating, etc.
