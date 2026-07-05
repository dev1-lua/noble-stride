# Investor Onboarding — Design Spec

**Date:** 2026-07-05
**Branch:** `feat/InvestorOnboarding`
**Sources:** Phase 1 Client SOW (signed), CRM Concept Note, "Data collected from potential investors" doc, "End-to-End Client Onboarding and Fundraising Workflow" doc, user-confirmed decisions (2026-07-05).

## 1. Goal

Build the missing investor-onboarding pieces of the Phase 1 spec and wire them into the existing machinery (visibility engine, engagement stages, milestones, fund profile, admin CRM). Scope is **missing pieces only**: public registration, demo 2FA, pending→approval workflow, NDA recording + gating, teaser view refinements, and admin dashboard mapping. Existing matching (`ranking.ts`), engagement tracking (`EngagementStage` + milestones), and reporting stay as-is unless verification finds a real mismatch with the spec.

**Non-negotiable guardrails (SOW §06):** no automatic contractual action; no VDR access without internal approval AND the correct signed NDA; nothing confidential shared automatically; greylisted/excluded investors see nothing; the system never auto-sends deals to investors.

## 2. Decisions already made (do not re-open)

- All registration/profile fields **mandatory** (client to confirm later — logged as meeting question).
- **Open NDA** → investor can access every target company's data room (subject to per-deal internal approval). **Closed NDA** → exactly one deal's data room; each further deal needs a new NDA.
- 2FA/OTP is **demo-only** (static code, nothing sent). Logged in `memory/remaining-tasks.md`.
- Approach: **extend `Investor`** (no separate registration model). Registration creates an `Investor` row in `PendingReview`.
- Same Prisma schema style / frontend patterns; **additive** migrations only, no renames/removals.
- Every new datum must be surfaced on the admin side — no dead data.
- Tracker/memory files live **in-repo only** (`memory/` folder). No global memory writes, no CLAUDE.md.

## 3. Data model (additive migration)

New enum:

```prisma
enum OnboardingStatus {
  PendingReview
  Approved
  Rejected
}
```

`Investor` additions:

| Field | Type | Purpose |
|---|---|---|
| `onboardingStatus` | `OnboardingStatus @default(Approved)` | Approval gate. Default `Approved` keeps existing/seeded investors working; self-registrations explicitly set `PendingReview`. |
| `emailVerifiedAt` | `DateTime?` | Demo email-OTP stamp. |
| `phoneVerifiedAt` | `DateTime?` | Demo phone-OTP stamp. |
| `registeredAt` | `DateTime?` | Self-registration timestamp (null for team-created funds). |
| `openNdaSignedAt` | `DateTime?` | When an Open NDA was recorded. |

`Engagement` addition: `ndaSignedAt DateTime?` — per-deal (Closed) NDA record date; `ndaType` already exists.

Registration field mapping (reuses existing fields): fund name → `Investor.name`; contact person/email/phone → `Person` (`isPrimaryContact: true`); sector preference → `sectorFocus`; deal type → `instruments` (existing `Instrument` enum); deal size band → `ticketMin`/`ticketMax`. `createdSource: API` marks self-registration; also writes an `Activity` ("Investor self-registered").

Vocab: add `OnboardingStatus` labels + `STATUS_DOT` colors to `src/lib/vocab.ts`.

## 4. NDA semantics

- **Open NDA:** `Investor.ndaStatus = OpenNDA` + `openNdaSignedAt`. Satisfies the NDA requirement on **every** deal; VDR access on any deal then needs only internal approval (stage change).
- **Closed NDA:** `Engagement.ndaType = Closed` + `ndaSignedAt` on that engagement (and `Investor.ndaStatus = ClosedNDA` if not already Open). Satisfies NDA for **that one deal only**.
- NDAs are **recorded by the team**, optionally linked to a `Document` of type `NDA`. No e-sign in this phase.
- **Restage guard (service layer):** moving an engagement to `NDASigned` or beyond — and especially `VDRAccess`/`DueDiligence` — is blocked unless the correct NDA is recorded (open NDA, or closed NDA on that specific engagement). Blocked restage returns a clear error surfaced in the admin UI.

## 5. Visibility engine changes

`src/server/visibility/` stays the single gating authority.

- `tiers.ts`: `onboardingStatus !== Approved` → tier `NONE` (in addition to the existing classification block).
- Doc projection (`project.ts`): VDR documents project only when tier is `DD` **and** the NDA rule (§4) is satisfied for that deal.
- Teaser projection (pre-NDA / `PRE_INTEREST`): company name **masked** as a codename ("Project <word> — <Sector>, <Country>"); unmasks at `AFTER_NDA`. Shown pre-NDA: sector, region/country, deal type, requested ticket size, deal stage, 2–3 sentence non-identifying description, coarse banded indicators via `bandCurrency()` (revenue, EBITDA, years operating), approved `Teaser`/`PitchDeck` docs. Hidden: full financials, IM, model, VDR, client contacts, other investors, internal notes (unchanged `FIELD_MATRIX` + hard rules).

## 6. Public registration flow — `/register`

Top-level public route (no viewpoint cookie required; there is no real auth in the app).

- **Step A — form.** Six mandatory fields: Fund name, Contact person, Contact email, Telephone, Sector preference (multi-select chips from `Sector`), Deal type (dropdown from `Instrument`), Deal size (dropdown bands: `<$100k`, `$100k–250k`, `$250k–500k`, `$500k–1M`, `$1M–5M`, `>$5M`).
- **Corporate-email validation** (shared Zod refinement, unit-tested): reject gmail, googlemail, yahoo, hotmail, outlook, live, msn, aol, icloud, me.com, proton(mail), gmx, yandex, mail.com, zoho — error: "Please use your corporate email address."
- **Step B — demo 2FA.** OTP screen for email + phone; static code `000000`, visibly labeled "Demo — OTP delivery not yet wired." Correct entry stamps `emailVerifiedAt`/`phoneVerifiedAt`.
- **Step C — confirmation.** "Your registration is under review by the Noblestride team." No deal visibility of any kind (anti-broker gate).
- Implementation pattern (matches `portal/partner/refer/`): RSC form → thin `"use server"` action → plain testable core module (`register-investor.ts`) creating `Investor (PendingReview)` + primary-contact `Person` in one transaction + `Activity` log.

**Pending/rejected portal experience:** portal layout checks `onboardingStatus`; `PendingReview` → branded "Registration under review" screen, `Rejected` → "not approved" screen. No shell content leaks (consistent with tier `NONE`).

## 7. Admin mapping (no dead data)

- `/investors` list: *Onboarding* segment counts (Pending / Approved / Rejected) + onboarding-status chip column.
- Investor detail: **Onboarding panel** (registration date, contact, OTP stamps, Approve / Reject / Greylist actions via urql mutations → services) + **NDA panel** (`ndaStatus`, open-NDA date, per-deal closed-NDA list with linked NDA `Document`s, actions to record an Open or Closed NDA).
- Engagement detail: NDA state; blocked-restage reason shown clearly.
- `/dashboard`: *Investor Onboarding* stat group — pending-review count (links to queue), approvals this month, NDA coverage (open / closed / none among Active investors).
- Field-by-field audit at the end: every new field is read somewhere in admin (status → queue+chips; stamps + registeredAt → onboarding panel; NDA dates → NDA panel + engagement page).

## 8. Trackers (in-repo `memory/` folder)

- `memory/remaining-tasks.md` — real auth/session missing; OTP static demo; NDA e-sign (DocuSign) not wired; matching remains heuristic; anything new discovered during the build.
- `memory/client-meeting-questions.md` — (a) complete investor field set + which are truly mandatory (assumed all); (b) exact Open vs Closed NDA visibility/VDR gating (assumed open = all data rooms, closed = one); (c) teaser anonymization of company names pre-NDA (assumed masked).

## 9. Testing & verification

- **Vitest (colocated):** corporate-email validator; `register-investor` core (creates Investor+Person pending, rejects missing fields/free emails); tier resolution (`PendingReview`/`Rejected` → `NONE`); NDA restage guard (open passes everywhere, closed passes only its deal, none blocks); teaser projection (masked name, bands, hidden fields).
- **End-to-end smoke:** viewpoint-cookie curl recipe (`/api/viewpoint?role=investor&recordId=…&next=…`) against a pending, an approved-no-NDA, an open-NDA, a closed-NDA, and a greylisted investor.
- **Visual verification (Playwright)** against the running dev server `http://localhost:3000` — screenshot/inspect `/register` (all 3 steps), `/dashboard` (new stat group), `/investors` (segments + chips), investor detail (onboarding + NDA panels), portal pending screen, portal teaser card pre/post NDA. Fallback if Playwright is unavailable: `chrome.exe --headless=new --screenshot` with the `next=` viewpoint chaining (see dev quirks).
- Dev-environment quirks: dev server usually already on :3000 (don't restart); `prisma generate` EPERM while dev server runs — schema changes require stopping it for the migration, then restart; revert `src/generated/pothos-types.ts` path churn; pre-existing lint failures in clients-table.tsx, count-up.tsx, prisma/seed.ts, investors-crud.smoke.test.ts are not ours.

## 10. Delivery process

Subagent-driven development: **Sonnet** implements each task → **Opus** reviews each task → **Fable** reviews the complete branch at the end, looping on fixes until the result matches this spec and the client documents.
