# WS-B close-out — Auth / Onboarding / Applications / Investor Portal

Branch `feedback/2026-08`. All 15 tasks complete. This is the per-item account of what
shipped, how it was verified, and what is deliberately still open.

---

## Verification, as run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` (env exported) | **204 files / 1404 tests, 0 failures** |
| `npx eslint .` | 21 errors / 12 warnings — the untouched baseline, unchanged |
| `npx playwright test` | **65 / 65**, run twice consecutively |
| `npx prisma migrate status` | 42 migrations, "Database schema is up to date!" |
| `npm run db:verify-parity` | both checks pass (drift = the 9 expected `DROP INDEX "*_trgm_idx"`; strict parity empty) |
| teardown check | 0 `zz-` rows · 13 transactions · 63 engagements · 839 persons · 1 default WorkflowTemplate · AppSettings at seeded values |

Run the sweep as a watchable walkthrough with **`npm run test:e2e:watch`** (headed, 400 ms
between actions; `E2E_SLOWMO` overrides the pace). Every spec's `describe` names the feedback
item it proves and each test narrates itself with `test.step()`.

> **Environment note.** The local database is now **`noblestride_dump2`**. See plan §5g.1: the
> previous copy had silently lost its transactions, engagements, people and every
> INVESTOR/PARTNER account before this session began, which shallow count checks did not catch.
> `Person` and `Engagement` are the canaries — verify them, do not trust a handover's numbers.

---

## Per item

### F1.1 — role-separated sign-in and registration (§1 / image1)
`/login` is a split panel with four copy-only tabs (`?as=client|investor|partner|staff`,
unknown → staff) and a note saying the tabs only change help text. The Client tab links to the
new `/apply/status` tracker; Investor to fund registration; Partner to claiming an invitation.
`/register` opens with the four role cards image1 asked for — the fourth being Noblestride's own
staff — each routed to its own form, with the email-first classifier moved behind `?path=email`.
**Why copy-only:** gating by tab would tell a visitor which kind an address belongs to, and would
lock out anyone who is both a partner contact and a fund contact. `e2e/auth-entry.spec.ts` proves
a fund signing in from the *staff* tab still lands in the investor portal. Commit `a7f6818`.

### F2.1 / F2.3 — the applications queue and the applicant's details (§2 texts 1 and 3 / image2, image4)
`/applications` with Awaiting / Accepted / Not-taken-forward tabs, search, and inline
accept / drop / re-qualify; a sidebar item with a count; the dashboard callout and both intake
notifications retargeted at it. The contacts **were** already being persisted — nothing rendered
them — so `getMandate` now loads `client.contacts`, `IntakeReviewPanel` gained an Applicant block,
and both submit paths split the submitted full name into first and last. `applicationCounts().awaiting`
is asserted equal to `dashboard.ts::intakeAwaitingReviewCount`, so the badge and the queue can
never disagree. Commit `d2eb51e`; spec `e2e/applications.spec.ts`.

### F2.4 / G1 — the applicant's own status page (image25)
Public `/apply/status`: corporate email → 6-digit code → the applications on file for that
address, each with its status, the contact we hold, the documents by name/type/status only, and an
**interest count** — never an investor's name. Upload endpoint for adding a document afterwards.
Two real findings during Task 7: the applicant cookie is path-scoped to `/apply/status`, so the
upload route had to live inside that scope (every upload 401'd first), and Next truncates request
bodies at 10 MB, which turned an oversized file into an opaque 500 until
`experimental.proxyClientMaxBodySize` was raised to 16 MB and a Content-Length pre-check added.
Commit `4c44c1c`; spec `e2e/apply-status.spec.ts`, which also proves an unknown address gets the
identical response.

### F3.1 — optional investment-criteria upload (§3 text 1 / image5, image6)
A purpose-scoped 15-minute JWT minted by a successful registration opens a `?step=upload` screen
with a first-class **Skip**, because the client said optional. Authenticated funds can upload the
same document later from the portal's Documents card. Staff surfaces image6 asked for: a "Criteria
attached" badge in the dashboard review queue, a "Criteria on file" header chip, and the criteria
pinned atop the Documents tab. Commit `838a920`; spec `e2e/register-criteria.spec.ts` drives the
real 7-step wizard through to the upload.

### F3.2 — the NDA (§3 text 2 / image7)
`src/lib/nda/standard-nda.ts` is a versioned template — eight clauses drawn from SOW §06's
confidentiality terms, Kenyan law — pure, so the portal renders it for reading and the same
function reproduces a signed agreement afterwards from `templateVersion` + the stored signature.
`signature-pad.tsx` offers Draw / Type / Upload, all three re-encoded through a canvas and trimmed
to the inked box. Three routes to one end state — click-wrap, own-NDA upload, staff countersign —
all funnelling through a private `applyOpenNda()` shared with the original `recordOpenNda`, so the
flows cannot drift. Staff get **Send standard NDA** and a pending-uploads list with **Mark
countersigned**. Commit `492b136`; spec `e2e/nda-clickwrap.spec.ts`.

### F3.3 / F3.4 — date onboarded, and searching for a person (§3 texts 3 and 4 / image8, image9)
`Investor.approvedAt` is stamped on approval and never cleared; a sortable Onboarded column
(`nulls: "last"` in **both** directions, because Postgres puts NULLs first on DESC) and two
date-range inputs. `buildInvestorWhere` now ORs the fund name with contact first name, last name
and email, and a new `searchInvestorPeople` feeds a People card above the table that deep-links to
`/investors/<id>#contact-<personId>`.
**Backfill ruling:** 93 of 94 approved investors would have fallen back to `createdAt`, all
carrying the same bulk-import timestamp. Writing that as a "date onboarded" would invent history,
so the script defaults to `activity,registeredAt`, stamped the one investor with a real approval
Activity, and left 93 blank. Pass `--sources=…,createdAt` for demo data. Commit `922fcc0`; spec
`e2e/investors-list.spec.ts`.

### F3.5 — invitations and reset links are emailed (§3 text 5 / image10)
`createTeamInvite` / `resendTeamInvite` / `inviteExistingContact` take a `baseUrl` and return
`{rawToken, emailSent}`; a new `pending-member-invites.ts` fans invitations out at approval
(idempotent, skipping the primary contact and anyone who has signed in); registration sends a
link-free heads-up; `issueStaffResetLink` replaced the inline token minting in both staff reset
actions. When mail goes out the link sits one click away behind a disclosure; when it does not,
the copy-link panel stays exactly as prominent, because it is then the only way in. Commit
`8518aea`; spec `e2e/team-invite.spec.ts` redeems a real invitation, proves it is single-use, and
signs in as the new member.

### F3.6 — changing an email moves the account (§3 text 6 / image11, image12)
`src/server/auth/change-email.ts`: a pure `emailPolicyFor` (refusals never echo the address), an
immediate staff path, and a self-service path via `pendingEmail` + a `VERIFY_EMAIL` token. Both
write account + person + user in one transaction, record `StageChange{field:"email"}` and an
Activity, invalidate every session, and notify both addresses. Wired into `updatePerson`, the
investor profile form (own record → confirmed change; a colleague with an account → refused), the
POST-only `/verify-email/[token]` route, and Change-email controls on the users / investor /
partner panels. Commit `051a365`; spec `e2e/contact-email-sync.spec.ts` proves the old address
stops working and the new one starts.

### F5.6 — partner login (§5 referral agent / image23)
`/portal/partner/*` was dead code: `resolveViewpointFor` never yielded a partner viewpoint.
Now it handles PARTNER, `login.ts` resolves `home` through `viewpointHome`,
`getPartnerMembership`/`requirePartnerMember` exist, `peekInviteToken` is generalised on
`account.kind` so `/invite` serves both portals, `partner-invites.ts` mirrors team invites, and
`partners/[id]` gained a `PartnerAccessPanel`. `loadPartnerPortalData` also loads referred
transactions, projected as their **own** list because Transaction carries TransactionStage while
`referredDeals` is MandateStage-typed and drives the funnel — merging would mislabel one.
**Deviation:** `Activity` has no `partnerId`, so partner invites audit through `logAuthEvent` only;
surfacing a partner timeline needs a schema change. Commit `a386c7d`; spec
`e2e/partner-login.spec.ts`.

### F6b.1 — see every deal, register interest anywhere (§6b text 1 / image27)
`loadInvestorPortalData` no longer drops a live deal just because the investor has no engagement
on it and discovery did not match. Discovery now decides a **label**
(`ProjectedDeal.matchesMandate`), not visibility. The access gate is untouched and asserted: a
blocked or unapproved investor still resolves to tier NONE and sees nothing. Browse all /
Matches-my-mandate tabs with live counts, a chip, and an Express-interest form on every card for
Editors. `expressInterest` gained an allow-listed `returnTo` and the throttle the other three
portal actions already had. Also `investorEngagedDealsByEmail` + the `investorEngagedDeals` query
for the WS-C `my_deals` tool — codenames only, and `[]` for an unknown address so it cannot be
used as an existence oracle. Commit `9b2b4db`; spec `e2e/portal-browse-all.spec.ts`.
**Deviation:** `safeReturnTo` lives in its own module, because a `"use server"` file may only
export async functions — exporting it from `actions.ts` broke the dev build.

### F6b.2 — restricted until interest **and** granted access (§6b text 2 / image28, decision D2)
The client's wording implies detail should unmask when interest arrives; SOW §06 forbids sharing
confidential information without an NDA. `grantDealAccess` does not resolve that by weakening the
guard — it rides `updateEngagement({ engagementStage: "NDASigned" })`, so `assertStageAllowed` runs
exactly as before, and it refuses early with copy naming the portal NDA flow F3.2 added. The
unblocker is that the NDA is now one click away. `domain/access-state.ts` derives state from the
**stage**, never from `accessGrantedAt`, which is audit metadata: as a state source a stage
rollback would leave the UI claiming access the guard no longer allows. Investor side: an
"Interest received — being reviewed" banner and pipeline rows labelled in Aika's vocabulary
instead of the internal enum. Commit `bb239ae`; spec `e2e/grant-deal-access.spec.ts` drives the
whole chain including the refusal.

### F6b.3 / G3 — status, not a checklist (image29, image30)
`portalDealStatus` → **Open | In progress | Closed**. An internal pause (`dealStatus: "OnHold"`)
deliberately reads as Open — Noblestride pausing its own work is not the investor's business.
"In progress" reuses `stageRequiresNda`, so it cannot drift from the access gate. The deal page
leads with that chip plus the conversation thread; the 14-step checklist renders only when
`portal.deal.milestones` is on, and `INVESTOR_VISIBLE_MILESTONES` (derived, not hand-listed) drops
`SuccessFeePaid` **at the projection boundary**, so the key never reaches the portal even with the
checklist switched on. The dashboard replaces the hidden finance tiles with an onboarding
checklist — account → fund profile → NDA → criteria → approval — each outstanding step linking to
the page that completes it. Commit `f644a1e`; spec `e2e/portal-deal-status.spec.ts` toggles the
setting through `/settings/app` and back.

### F6b.4 — participants (§6b text 4 / image31)
Both rules live in the service: the engagement must belong to the fund doing the adding, and the
person must be a colleague at that fund with an **ACTIVE** portal account — image31's "the members
need to be onboarded into the system for this to happen". Colleagues without an account are simply
not offered, and a person from another fund gets the identical refusal so the message is no
existence oracle. Adding is idempotent on the unique index; removing refuses on the primary
contact, who follows every deal by definition. Portal card (Editors act, Viewers read), an "Only
deals I follow" pipeline tab, and a read-only staff roster. Commit `12c5981`; spec
`e2e/participants.spec.ts`.
**Deviation:** `EngagementParticipant.addedById` points at `User`, so a portal add records no
adder; the Activity row carries the fund's action. Attributing it needs a schema change.

### G4 — the diagram's step-1 sources (§7 / image32)
`Source += DeskResearch, ExistingNetwork` in migration 7, with labels in `vocab.ts`. The deals
filter and the intake form's source select pick them up automatically. Commit `c2d13a1`.

---

## Real bugs this work exposed, and fixed

1. **Login counted successful sign-ins against its brute-force budget** (20 per 10 minutes per IP).
   Noblestride's own staff share an office IP, so twenty successful sign-ins would have locked the
   office out with "Too many failed attempts". The gate now charges up front and **refunds** on
   success and on an OTP hand-off, so it counts what it exists to count. Unit-tested in
   `src/server/auth/__tests__/rate-limit.test.ts`.
2. **Fixture teardown left rows behind.** `ESignEnvelope.investorId` is `SetNull`, so every
   envelope the NDA spec wrote survived its investor as an orphan; and fixtures notify the 14 real
   admin users, whose notifications were accumulating in the restored dump. Both are now cleared,
   along with participants and applicant OTP challenges.
3. **A `"use server"` module cannot export a synchronous helper** — it is a build error, not a lint
   nit. Caught by driving the real browser rather than trusting `tsc`.
4. **The signature pad sits below a 28 rem agreement**, so on a laptop a signer must scroll to find
   it. Noted as a UX follow-up; the spec scrolls it into view.

## The branch review

Seven findings, all verified and fixed in `f837f32`, each with a regression test: boolean portal filters
were silently dropped on a tab switch (`String(true)` vs the parser's `"1"`); `ClosedReopened` was treated as
closed although it is active everywhere else; the portal status chip could move BACKWARDS when the IM was
shared; `investorEngagedDealsByEmail` had no onboarding or classification gate, so a greylisted or
still-pending investor could email the agent for their deals; granting access could silently un-decline a
withdrawn investor; the Add-a-colleague dropdown pre-selected the one person who could never be removed; and
the public-research guard refused real companies ("3M", "Project Finance Advisors"). Details in that commit.

Items 2 and 3 below were the two open items carried INTO the review and are fixed in `be30405`.

## Open items, carried to the branch review and the verification guide

1. **G6 / D6 — the "Live Tracker deal template"** (image27) does not exist in the repo. The investor
   teaser keeps the interim fields `projectDealForInvestor` already produces (codename, sector,
   countries, deal type, instrument, target raise, banded financials, mandate status). Re-map once
   the client supplies the template.
2. ~~`priority`, `referralQualified` and `partnerFeeStatus` declared clearable but never passing the
   `clearable` prop~~ — **fixed** in `be30405`.
3. ~~The staff upload route advertising 50 MB against a 16 MB proxy ceiling~~ — **fixed** in `be30405`:
   the shared ceiling is 16 MB, a test reads the number out of `next.config.ts` so the two cannot drift, and
   the route gained the Content-Length pre-check and 413.
4. `src/components/crm/engagement-stage-board.tsx` is **dead code** — nothing imports it. The F6b.2
   "Awaiting access grant" chip therefore went on the transaction page's engagements list, which is
   the surface that actually renders.
5. The restored dump carries its own test residue the name-prefix cleanup cannot see — seven
   orphaned `pat@pendingfund.com` people and a few `zztest`-email contacts, all named as ordinary
   people. Harmless, but worth a targeted sweep before any production restore.
6. `Notification.personId` was dropped from migration 7 as a deliberate de-scope: participants are
   notified through `notifyInvestors(investorId, …)`, matching the existing per-org model.
7. A retainer **payment log** (F4.3.1's third clause) remains unbuilt in both plans; WS-A shipped
   paid amount + balance only.

## Commits

| Commit | Task |
|---|---|
| `c2d13a1` | 1 — migration 7, schema, `auth-mail.ts`, vocabulary |
| `e451b08` | (prevention) `db:verify-parity` |
| `8518aea` | 2 — F3.5 invitations and reset links email |
| `a386c7d` | 3 — F5.6 partner login |
| `a7f6818` | 4 — F1.1 login / register front door |
| `051a365` | 5 — F3.6 email change |
| `d2eb51e` | 6 — F2.1 / F2.3 applications |
| `4c44c1c` | 7 — F2.4 / G1 `/apply/status` |
| `922fcc0` | 8 — F3.3 / F3.4 onboarded date, people search |
| `838a920` | 9 — F3.1 criteria upload |
| `492b136` | 10 — F3.2 NDA click-wrap |
| `9b2b4db` | 11 — F6b.1 browse all + `investorEngagedDeals` |
| `bb239ae` | 12 — F6b.2 grant deal access |
| `f644a1e` | 13 — F6b.3 / G3 status chip, gated milestones, onboarding stepper |
| `12c5981` | 14 — F6b.4 participants |
| `7f3e644` | 15 — the Playwright sweep as a walkthrough |
