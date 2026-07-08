# Naming decisions — pending approval

**Date:** 2026-07-08 · **For:** review with management before/at the Marko demo
**Context:** We are renaming user-facing labels to match the vocabulary in Marko's
`NobleStride_Full_Scoping_Document.docx`. Renames that are **verbatim his words** have been
implemented already (see "Already implemented" at the bottom). The items below are **inferred or
judgment calls** — please mark a decision for each.

All renames are display-only (component strings / `vocab.ts`); nothing in the database, GraphQL
API, or URLs changes. Every item here is reversible in minutes.

---

## Decisions needed

### 1. What to call a Mandate: keep "Mandate" or rename to "Client Engagement"?

- **Current (implemented):** kept **"Mandate"**.
- **Evidence for "Mandate":** Marko's own §01: *"recurring Monday meetings where active mandates
  are reviewed"* — it's the team's spoken word.
- **Evidence for "Client Engagement":** his written lifecycle uses "engagement" for the client
  relationship — step 6 *"Engagement Contract & Retainer"*, step 16 *"Success Fee & Engagement
  Closure… formally close the engagement"*; NobleStride's tracker file is literally named
  *"Engagement contract Tracker"*. Now that the investor-side "Engagement" is renamed to
  "Investor Outreach", the word is free and unambiguous.
- **Our recommendation:** keep **Mandate** (shorter, already spoken, matches finance convention).

**Decision:** ☐ Keep "Mandate" ☐ Rename to "Client Engagement"

### 2. "Deal NDA" label on the outreach detail page

- The per-investor-per-deal NDA card was titled **"Engagement NDA"**. After the rename that label
  became orphan jargon, so it now reads **"Deal NDA"** (provisional).
- Alternatives: "Investor NDA (this deal)", "Closed NDA".
- Doc grounding: §05 speaks of the investor *"execut[ing] an NDA"* per deal — no exact noun given.

**Decision:** ☐ Keep "Deal NDA" ☐ Use: ______________

### 3. Rename "Activity" timeline headers to "Communications & notes"?

- **Not implemented — awaiting decision.**
- Evidence: Marko §07: *"All communications and activities should be anchored to a specific
  deal"*; his §02 investor list includes *"Communication history"*. He uses **both** words, so
  neither is clearly "his term".
- Recommendation: rename to "Communications & notes" (matches how the timeline is actually used).

**Decision:** ☐ Rename ☐ Keep "Activity"

### 4. Align internal stage labels with his §07 stage list?

- **Not implemented — awaiting decision.** His single stage list: *"Origination, Screening, NDA
  signed, Teaser/Information Memorandum shared, Financial Model/Analysis, Investor outreach,
  Offers received, Due diligence, Closing / Completion"*.
- Possible label mappings (display-only): Mandate "New Lead" → "Origination", "Qualification" →
  "Screening".
- Risk: his list is ONE pipeline; our data has three (mandate / transaction / investor-outreach
  stages). Forcing his 9 names onto our ~26 stages creates fake matches. The planned "deal
  journey" view (simplification spec, Wave 2) presents his list faithfully instead.
- Recommendation: **don't rename stages**; deliver his pipeline via the journey view + tooltips.

**Decision:** ☐ Leave stages, build journey view ☐ Rename the two mandate stages ☐ Discuss

### 5. Merge "Service Providers" into a "Partners & Advisors" page?

- **Not implemented — structural Wave-1 change, awaiting decision** (in the simplification spec).
- Doc grounding: §06/§07 treat partners, consultants, advisors as one referral/advisor world;
  "Service Provider" appears nowhere in Marko's document.

**Decision:** ☐ Merge under "Partners & Advisors" ☐ Keep separate nav items

---

## Points of awareness (no action needed unless you disagree)

- **"Investor Outreach" collision with the transaction stage of the same name:** our transaction
  pipeline has a stage labeled "Investor Outreach", and the renamed tracker now shares that name.
  We consider this harmonious (the stage means "the deal is in outreach"; the tracker is where
  outreach lives) — and the stage name is verbatim Marko's. Flagging in case you'd rather
  differentiate.
- **Investor-portal copy kept as-is** ("No active engagements yet."): for the external investor,
  "engagement" is natural English about their own participation, not internal jargon.
- **"Engagement Classification" on the investor form kept:** matches Marko's §02 phrase *"Active
  engagement status"* for investors (Active / Inactive / On Hold / Excluded / Greylisted).
- **Status vs Stage on outreach records:** each outreach record still shows both a legacy "status"
  funnel (Not Contacted → Committed) and the 12-step stage. This is a product-simplification
  question (not naming) — tracked in the simplification spec.

---

## Already implemented (grounded verbatim in Marko's document)

Investor×deal "Engagement" → **"Investor Outreach"** everywhere internal-facing, grounded in his
step 11 title *"Investor Outreach & Engagement"* and the §07 stage *"Investor outreach"*:

- Sidebar nav item, topbar title/subtitle, both tracker page titles (By Deal / By Investor),
  breadcrumbs.
- Section headers on transaction and investor detail pages; deal-summary rollup label.
- Dialogs/controls: "Log Outreach" (was "Log Engagement"), "Edit Investor Outreach" drawer,
  restage select aria-label, "Open outreach →" card links.
- Dashboard cards: "Investor Outreach", "Historical Outreach"; change-feed field label
  "Outreach Stage".
- Empty states: "No outreach recorded.", "No outreach yet", "No invested deals yet."
