# §11. Investor deal visibility

**Spec (Build Specification §11):** Investors see mandates that fit their criteria, behind confidentiality gates that Noblestride grants and can revoke. Visibility is field-level across three gate stages (pre-interest / after NDA / DD): basic profile and ticket size are always visible, financials unlock after NDA, VDR files at DD, and some things are never visible to any investor (other investors on the deal, partner identity, engagement contracts, internal messages). §11.1 lists investor-side filters (country, sector, ticket size, deal type, core financials, impact). §11.2 sets the access model: baseline visibility for active investors, back-end control to restrict or deactivate, VDR locked until formal interest + signed NDA, and excluded/greylisted funds never see opportunities.

## Build status

**Built — the best-covered deliverable in the app.** (Source: comparative analysis §11.) A dedicated visibility engine with 200+ tests implements the full field matrix, the hard rules (partner identity and other investors never projected to any external role), and excluded/greylisted blocking across three code paths. Investor self-registration + the admin approval queue implement §11.2's back-end control with a real PendingReview → Approved gate.

Gaps: **§11.1 investor-facing filter UI is missing** — matching is automatic from the stored investor profile rather than filters the investor operates (the impact filter is now unblocked at the data layer but has no UI). Decline-triggered VDR revocation is manual (via restage) rather than prompt/automatic.

## See it in the app

1. Log in at `http://localhost:3000/login` as `jane@noblestride.co` (any password), then use the topbar **Viewing as** switcher to pick any *approved, active* investor lens.
2. You land on `http://localhost:3000/portal/investor`: deal cards show only mandates matching that investor's stored criteria, each with a **tier badge** (pre-interest / after NDA / DD).
3. Open a pre-NDA deal (`/portal/investor/deals/[id]`): the company appears under its **codename** with a masked teaser — revenue/EBITDA limited, IM/model/VDR hidden, and no advisor, client-contact, or other-investor information anywhere.
4. Switch back to the admin lens, open the same investor at `http://localhost:3000/investors/[id]`, and in the NDA panel record an **Open NDA**. Return to that investor's lens: real names and full financials unlock on every deal (Open NDA = all data rooms; a Closed NDA unlocks exactly one engagement).
5. Test the blocking rule: as admin, **Greylist** an investor from `/investors/[id]`, then switch to their lens — every portal page shows a "Portal access restricted" screen and tier NONE. Excluded, Inactive and OnHold behave the same; pending/rejected registrations get under-review / not-approved screens.
6. `http://localhost:3000/portal/investor/pipeline` shows the investor's own engagements with milestone steppers — their view of §11's "status of matching active mandates."

## Key source files

- `src/server/visibility/tiers.ts` — tier derivation (NONE / PRE_INTEREST / AFTER_NDA / DD) incl. classification blocking
- `src/server/visibility/matrix.ts` — the §11 field-visibility matrix as data
- `src/server/visibility/project.ts` — field projection and teaser masking applied to every external read
- `src/server/visibility/codename.ts`, `src/server/visibility/load.ts` — codename masking pre-NDA; gated loading
- `src/server/services/nda.ts`, `src/server/domain/nda-guard.ts` — Open/Closed NDA recording and the VDR gate
- `src/app/portal/investor/` — portal pages; `src/components/portal/tier-badge.tsx`, `milestone-stepper.tsx`
- `src/server/onboarding/register-investor.ts`, `src/components/crm/onboarding-actions.tsx` — §11.2 grant/revoke control
